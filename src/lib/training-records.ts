/**
 * Registro de capacitaciones (SPEC-training, slice 20.3): sesiones con asistentes, carga individual de un
 * certificado, anulación con motivo (nunca se borra), adjuntos e importación del histórico.
 * Todo está acotado por `tenantId`; cada alta, anulación e importación deja registro en `TrainingAudit`.
 * El estado de cada persona no se guarda: se calcula al leer (`src/lib/training.ts`).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import { TrainingError, audit } from "@/lib/training-config";
import { loadPersonTrainingData, trainingToday } from "@/lib/training";
import { cleanName, normalizeKey } from "@/domain/masterdata/roster";
import { addDays, isIsoDate, dateOnly, type IsoDate } from "@/domain/training/dates";
import { computeTrainingStatus, computeValidUntil, isQualifiedForTask, summarizeCompliance } from "@/domain/training/rules";
import {
  TRAINING_IMPORT_MAX_ROWS,
  parseTrainingCsv,
  planTrainingImport,
  type ExistingTrainingRecord,
  type TrainingImportPlan,
  type TrainingImportRowError,
} from "@/domain/training/import";
import type { TrainingResultValue } from "@/domain/training/types";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

const dateFromIso = (iso: IsoDate) => new Date(`${iso}T00:00:00.000Z`);

export const MAX_ATTENDEES = 500;
export const MIN_VOID_REASON = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const IMPORT_BATCH = 500;

function uniqueToError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new TrainingError("Alguna persona ya tiene registrado ese curso ese día con ese resultado: revisá que no esté cargado");
  }
  throw error;
}

function checkScore(score: number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new TrainingError("La nota tiene que ser un número entero de 0 a 100");
  return score;
}

function checkDate(value: string, label: string, today: IsoDate): IsoDate {
  if (!isIsoDate(value)) throw new TrainingError(`${label}: fecha inválida`);
  if (value > today) throw new TrainingError(`${label} no puede ser futura`);
  return value;
}

async function requireCourse(db: Db | Tx, tenantId: string, courseId: string) {
  const course = await db.course.findFirst({ where: { id: courseId, tenantId } });
  if (!course) throw new TrainingError("El curso no existe");
  if (!course.active) throw new TrainingError("El curso está dado de baja: reactivalo para registrar capacitaciones");
  return course;
}

async function requireActivePeople(db: Db | Tx, tenantId: string, personIds: string[]) {
  const people = await db.person.findMany({ where: { id: { in: personIds }, tenantId, status: "active" }, select: { id: true, name: true } });
  if (people.length !== new Set(personIds).size) throw new TrainingError("Alguna persona no existe o está dada de baja");
  return people;
}

async function requireMember(db: Db | Tx, tenantId: string, userId: string | null | undefined, label: string) {
  if (!userId) return null;
  const member = await db.membership.findFirst({ where: { tenantId, userId }, select: { userId: true } });
  if (!member) throw new TrainingError(`${label} no pertenece a la empresa`);
  return userId;
}

// ─── Sesiones con asistentes ───────────────────────────────────────────────

export type AttendeeInput = { personId: string; result: TrainingResultValue; score?: number | null };

export type SessionInput = {
  tenantId: string;
  actorUserId: string;
  courseId: string;
  heldAt: IsoDate;
  siteId?: string | null;
  level?: "senior" | "middle" | "operational" | null;
  instructorKind: "internal" | "external";
  instructorName: string;
  providerName?: string | null;
  hours?: number | null;
  /** Quien evalúa la eficacia, si el curso la pide. */
  evaluatorUserId?: string | null;
  notes?: string | null;
  attendees: AttendeeInput[];
};

/**
 * Registra una sesión dictada con todos sus asistentes en una transacción: un registro por persona,
 * con el vencimiento calculado con la vigencia del curso, y una evaluación de eficacia pendiente por cada
 * aprobado si el curso la exige. Repetir el mismo registro (persona, curso, día, resultado) se rechaza.
 */
export async function registerSession(input: SessionInput, db: Db = prisma) {
  const today = trainingToday();
  const heldAt = checkDate(input.heldAt, "La fecha de la sesión", today);
  const instructorName = cleanName(input.instructorName);
  if (instructorName.length < 2) throw new TrainingError("Indicá quién dictó la capacitación");
  if (input.attendees.length === 0) throw new TrainingError("Elegí al menos un asistente");
  if (input.attendees.length > MAX_ATTENDEES) throw new TrainingError(`Una sesión admite hasta ${MAX_ATTENDEES} asistentes`);
  const ids = input.attendees.map((a) => a.personId);
  if (new Set(ids).size !== ids.length) throw new TrainingError("Hay una persona repetida entre los asistentes");
  if (input.hours !== null && input.hours !== undefined && !(input.hours > 0 && input.hours <= 999)) throw new TrainingError("La duración tiene que ser mayor que 0");
  const scores = input.attendees.map((a) => checkScore(a.score));

  const course = await requireCourse(db, input.tenantId, input.courseId);
  await requireActivePeople(db, input.tenantId, ids);
  if (input.siteId) {
    const site = await db.site.findFirst({ where: { id: input.siteId, tenantId: input.tenantId }, select: { id: true } });
    if (!site) throw new TrainingError("La sede no existe");
  }
  const evaluatorUserId = await requireMember(db, input.tenantId, input.evaluatorUserId, "El evaluador");

  try {
    return await db.$transaction(
      async (tx) => {
        const session = await tx.trainingSession.create({
          data: {
            tenantId: input.tenantId,
            courseId: course.id,
            status: "held",
            heldAt: dateFromIso(heldAt),
            siteId: input.siteId || null,
            level: input.level ?? null,
            instructorKind: input.instructorKind,
            instructorName,
            providerName: cleanName(input.providerName ?? "") || null,
            hours: input.hours ?? course.defaultHours ?? null,
            evaluatorUserId,
            notes: input.notes?.trim() || null,
            createdByUserId: input.actorUserId,
          },
          select: { id: true },
        });
        const validUntil = computeValidUntil(heldAt, course.validityMonths);
        const records = await tx.trainingRecord.createManyAndReturn({
          data: input.attendees.map((a, i) => ({
            tenantId: input.tenantId,
            personId: a.personId,
            courseId: course.id,
            sessionId: session.id,
            completedAt: dateFromIso(heldAt),
            result: a.result,
            score: scores[i],
            validUntil: a.result === "passed" && validUntil ? dateFromIso(validUntil) : null,
            validUntilSource: "computed" as const,
            source: "session" as const,
            providerName: cleanName(input.providerName ?? "") || null,
            recordedByUserId: input.actorUserId,
          })),
          select: { id: true, result: true },
        });
        if (course.requiresEffectiveness) {
          const dueAt = dateFromIso(addDays(heldAt, course.effectivenessDays));
          await tx.trainingEffectiveness.createMany({
            data: records.filter((r) => r.result === "passed").map((r) => ({ tenantId: input.tenantId, recordId: r.id, dueAt, evaluatorUserId })),
          });
        }
        await audit(tx, {
          tenantId: input.tenantId,
          entityType: "training_session",
          entityId: session.id,
          action: "register",
          actorUserId: input.actorUserId,
          summary: `Sesión «${course.name}» del ${heldAt} con ${records.length} asistente(s)`,
        });
        return { sessionId: session.id, records: records.length };
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    return uniqueToError(error);
  }
}

// ─── Carga individual de un certificado ────────────────────────────────────

export type IndividualRecordInput = {
  tenantId: string;
  actorUserId: string;
  personId: string;
  courseId: string;
  completedAt: IsoDate;
  result: TrainingResultValue;
  score?: number | null;
  /** Vencimiento que trae el certificado. Sin dato, se calcula con la vigencia del curso. */
  validUntil?: IsoDate | null;
  providerName?: string | null;
  certificateNumber?: string | null;
  notes?: string | null;
  evaluatorUserId?: string | null;
};

export async function addIndividualRecord(input: IndividualRecordInput, db: Db = prisma) {
  const today = trainingToday();
  const completedAt = checkDate(input.completedAt, "La fecha de la capacitación", today);
  const score = checkScore(input.score);
  const certificateDue = input.validUntil || null;
  if (certificateDue) {
    if (!isIsoDate(certificateDue)) throw new TrainingError("Vencimiento: fecha inválida");
    if (input.result !== "passed") throw new TrainingError("Solo una capacitación aprobada tiene vencimiento");
    if (certificateDue < completedAt) throw new TrainingError("El vencimiento no puede ser anterior a la fecha de la capacitación");
  }
  const course = await requireCourse(db, input.tenantId, input.courseId);
  await requireActivePeople(db, input.tenantId, [input.personId]);
  const evaluatorUserId = await requireMember(db, input.tenantId, input.evaluatorUserId, "El evaluador");

  const validUntil = input.result === "passed" ? (certificateDue ?? computeValidUntil(completedAt, course.validityMonths)) : null;
  try {
    return await db.$transaction(async (tx) => {
      const record = await tx.trainingRecord.create({
        data: {
          tenantId: input.tenantId,
          personId: input.personId,
          courseId: course.id,
          completedAt: dateFromIso(completedAt),
          result: input.result,
          score,
          validUntil: validUntil ? dateFromIso(validUntil) : null,
          validUntilSource: certificateDue ? "certificate" : "computed",
          source: "individual",
          certificateNumber: cleanName(input.certificateNumber ?? "") || null,
          providerName: cleanName(input.providerName ?? "") || null,
          notes: input.notes?.trim() || null,
          recordedByUserId: input.actorUserId,
        },
        select: { id: true },
      });
      if (course.requiresEffectiveness && input.result === "passed") {
        await tx.trainingEffectiveness.create({
          data: { tenantId: input.tenantId, recordId: record.id, dueAt: dateFromIso(addDays(completedAt, course.effectivenessDays)), evaluatorUserId },
        });
      }
      await audit(tx, {
        tenantId: input.tenantId,
        entityType: "training_record",
        entityId: record.id,
        action: "register",
        actorUserId: input.actorUserId,
        summary: `Registro individual de «${course.name}» del ${completedAt}`,
      });
      return record;
    });
  } catch (error) {
    return uniqueToError(error);
  }
}

// ─── Anulación con motivo ──────────────────────────────────────────────────

function checkReason(reason: string): string {
  const text = reason.trim();
  if (text.length < MIN_VOID_REASON) throw new TrainingError(`Contá el motivo de la anulación (al menos ${MIN_VOID_REASON} caracteres)`);
  return text;
}

/** Un registro anulado no cuenta para nada, pero queda en el historial con quién y por qué. */
export async function voidRecord(input: { tenantId: string; actorUserId: string; recordId: string; reason: string }, db: Db = prisma) {
  const reason = checkReason(input.reason);
  return db.$transaction(async (tx) => {
    const record = await tx.trainingRecord.findFirst({ where: { id: input.recordId, tenantId: input.tenantId }, include: { course: { select: { name: true } } } });
    if (!record) throw new TrainingError("Registro no encontrado");
    if (record.voidedAt) throw new TrainingError("El registro ya está anulado");
    const done = await tx.trainingRecord.updateMany({
      where: { id: record.id, tenantId: input.tenantId, voidedAt: null },
      data: { voidedAt: new Date(), voidedByUserId: input.actorUserId, voidReason: reason },
    });
    if (done.count === 0) return record;
    await audit(tx, { tenantId: input.tenantId, entityType: "training_record", entityId: record.id, action: "void", actorUserId: input.actorUserId, summary: `Registro de «${record.course.name}» anulado`, reason });
    return record;
  });
}

/** Anula la sesión y todos sus registros vigentes con el mismo motivo. */
export async function voidSession(input: { tenantId: string; actorUserId: string; sessionId: string; reason: string }, db: Db = prisma) {
  const reason = checkReason(input.reason);
  return db.$transaction(async (tx) => {
    const session = await tx.trainingSession.findFirst({ where: { id: input.sessionId, tenantId: input.tenantId }, include: { course: { select: { name: true } } } });
    if (!session) throw new TrainingError("Sesión no encontrada");
    if (session.voidedAt) throw new TrainingError("La sesión ya está anulada");
    const now = new Date();
    const done = await tx.trainingSession.updateMany({
      where: { id: session.id, tenantId: input.tenantId, voidedAt: null },
      data: { voidedAt: now, voidedByUserId: input.actorUserId, voidReason: reason, status: "cancelled" },
    });
    if (done.count === 0) return { voidedRecords: 0 };
    const records = await tx.trainingRecord.updateMany({
      where: { sessionId: session.id, tenantId: input.tenantId, voidedAt: null },
      data: { voidedAt: now, voidedByUserId: input.actorUserId, voidReason: reason },
    });
    await audit(tx, {
      tenantId: input.tenantId,
      entityType: "training_session",
      entityId: session.id,
      action: "void",
      actorUserId: input.actorUserId,
      summary: `Sesión «${session.course.name}» anulada con ${records.count} registro(s)`,
      reason,
    });
    return { voidedRecords: records.count };
  });
}

// ─── Adjuntos (planilla firmada, certificado) ──────────────────────────────

export function buildTrainingAttachmentKey(input: { tenantId: string; ownerId: string; attachmentId: string; fileName: string }) {
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${input.tenantId}/training/${input.ownerId}/${input.attachmentId}/${safe}`;
}

function contentTypeOf(contentType: string, fileName: string): string {
  if (ATTACHMENT_TYPES.has(contentType)) return contentType;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return contentType;
}

/** Planilla firmada de una sesión o certificado de un registro. PDF, JPG o PNG, hasta 10 MB. */
export async function uploadTrainingAttachment(
  input: {
    tenantId: string;
    actorUserId: string;
    target: { sessionId: string } | { recordId: string };
    fileName: string;
    contentType: string;
    body: Buffer;
    storage?: ObjectStorage;
  },
  db: Db = prisma,
) {
  const storage = input.storage ?? getObjectStorage();
  const contentType = contentTypeOf(input.contentType, input.fileName);
  if (!ATTACHMENT_TYPES.has(contentType)) throw new TrainingError("Solo se admiten archivos PDF, JPG o PNG");
  if (input.body.length === 0) throw new TrainingError("El archivo está vacío");
  if (input.body.length > MAX_ATTACHMENT_BYTES) throw new TrainingError("El archivo supera el máximo de 10 MB");

  const ownerId = "sessionId" in input.target ? input.target.sessionId : input.target.recordId;
  const owner =
    "sessionId" in input.target
      ? await db.trainingSession.findFirst({ where: { id: ownerId, tenantId: input.tenantId }, select: { voidedAt: true } })
      : await db.trainingRecord.findFirst({ where: { id: ownerId, tenantId: input.tenantId }, select: { voidedAt: true } });
  if (!owner) throw new TrainingError("No se encontró a qué adjuntar el archivo");
  if (owner.voidedAt) throw new TrainingError("Está anulado: no se le pueden adjuntar archivos");

  const created = await db.trainingAttachment.create({
    data: {
      tenantId: input.tenantId,
      ...("sessionId" in input.target ? { sessionId: ownerId } : { recordId: ownerId }),
      storageKey: "pending",
      fileName: input.fileName,
      contentType,
      sizeBytes: input.body.length,
      uploadedById: input.actorUserId,
    },
  });
  const storageKey = buildTrainingAttachmentKey({ tenantId: input.tenantId, ownerId, attachmentId: created.id, fileName: input.fileName });
  try {
    await storage.putObject(storageKey, input.body, contentType);
  } catch (error) {
    await db.trainingAttachment.delete({ where: { id: created.id } });
    throw error;
  }
  const attachment = await db.trainingAttachment.update({ where: { id: created.id }, data: { storageKey } });
  await audit(db, { tenantId: input.tenantId, entityType: "sessionId" in input.target ? "training_session" : "training_record", entityId: ownerId, action: "attach", actorUserId: input.actorUserId, summary: `Archivo adjunto: ${input.fileName}` });
  return attachment;
}

export async function readTrainingAttachment(attachmentId: string, options?: { db?: Db; storage?: ObjectStorage }) {
  const db = options?.db ?? prisma;
  const storage = options?.storage ?? getObjectStorage();
  const attachment = await db.trainingAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return null;
  const object = await storage.getObject(attachment.storageKey);
  if (!object) return null;
  return { attachment, body: object.body, contentType: object.contentType };
}

// ─── Lecturas ──────────────────────────────────────────────────────────────

export const SESSIONS_PAGE_SIZE = 25;

/** Sesiones por cursor `(fecha, id)`, de la más reciente a la más antigua. */
export async function listSessions(tenantId: string, filter: { courseId?: string; siteId?: string; after?: string; take?: number } = {}, db: Db = prisma) {
  const take = Math.min(filter.take ?? SESSIONS_PAGE_SIZE, 100);
  const [afterDate, afterId] = filter.after?.split("_") ?? [];
  const cursor: Prisma.TrainingSessionWhereInput =
    afterDate && afterId && isIsoDate(afterDate)
      ? { OR: [{ heldAt: { lt: dateFromIso(afterDate) } }, { heldAt: dateFromIso(afterDate), id: { lt: afterId } }] }
      : {};
  const rows = await db.trainingSession.findMany({
    where: { tenantId, ...(filter.courseId ? { courseId: filter.courseId } : {}), ...(filter.siteId ? { siteId: filter.siteId } : {}), AND: [cursor] },
    orderBy: [{ heldAt: "desc" }, { id: "desc" }],
    take: take + 1,
    include: {
      course: { select: { name: true } },
      site: { select: { name: true } },
      _count: { select: { records: { where: { voidedAt: null } }, attachments: true } },
    },
  });
  const page = rows.slice(0, take);
  const last = page[page.length - 1];
  return { items: page, nextCursor: rows.length > take && last ? `${dateOnly(last.heldAt)}_${last.id}` : null };
}

export async function getSession(tenantId: string, sessionId: string, db: Db = prisma) {
  return db.trainingSession.findFirst({
    where: { id: sessionId, tenantId },
    include: {
      course: true,
      site: { select: { name: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      records: {
        orderBy: { person: { name: "asc" } },
        take: MAX_ATTENDEES,
        include: { person: { select: { id: true, name: true, employeeCode: true, documentId: true, position: { select: { name: true } } } } },
      },
    },
  });
}

/** Personas activas para tildar como asistentes, filtradas por sede (base o adicional), puesto o texto. */
export async function listAttendeeCandidates(
  tenantId: string,
  filter: { siteId?: string; positionId?: string; q?: string; take?: number } = {},
  db: Db = prisma,
) {
  const q = filter.q?.trim();
  const people = await db.person.findMany({
    where: {
      tenantId,
      status: "active",
      ...(filter.siteId ? { OR: [{ siteId: filter.siteId }, { extraSites: { some: { siteId: filter.siteId } } }] } : {}),
      ...(filter.positionId ? { positionId: filter.positionId } : {}),
      ...(q ? { AND: [{ OR: [{ name: { contains: q, mode: "insensitive" } }, { employeeCode: { contains: q, mode: "insensitive" } }] }] } : {}),
    },
    select: { id: true, name: true, employeeCode: true, position: { select: { name: true } }, site: { select: { name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: Math.min(filter.take ?? MAX_ATTENDEES, MAX_ATTENDEES),
  });
  return people.map((p) => ({ id: p.id, name: p.name, employeeCode: p.employeeCode, positionName: p.position.name, siteName: p.site.name }));
}

/** Historial de una persona (incluye lo anulado), del más reciente al más antiguo. */
export async function listPersonRecords(tenantId: string, personId: string, take = 200, db: Db = prisma) {
  return db.trainingRecord.findMany({
    where: { tenantId, personId },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take,
    include: { course: { select: { name: true } }, session: { select: { id: true } }, _count: { select: { attachments: true } } },
  });
}

// ─── Importación del histórico ─────────────────────────────────────────────

export type TrainingImportPreview = {
  plan: TrainingImportPlan;
  parseErrors: TrainingImportRowError[];
};

async function buildImportPlan(tenantId: string, csv: string, db: Db): Promise<TrainingImportPreview> {
  const parsed = parseTrainingCsv(csv, { today: trainingToday() });
  if (parsed.rows.length === 0) return { plan: { items: [], counts: { create: 0, update: 0, unchanged: 0, error: 0 } }, parseErrors: parsed.errors };

  const codes = [...new Set(parsed.rows.map((r) => normalizeKey(r.employeeCode)))];
  const people = await db.$queryRaw<{ id: string; employeeCode: string }[]>`
    SELECT "id", "employeeCode" FROM "person"
    WHERE "tenantId" = ${tenantId} AND lower("employeeCode") = ANY(${codes}::text[])`;
  const courses = await db.course.findMany({ where: { tenantId, active: true }, select: { id: true, name: true, code: true, validityMonths: true } });
  const existingRows = people.length
    ? await db.trainingRecord.findMany({
        where: { tenantId, voidedAt: null, personId: { in: people.map((p) => p.id) }, courseId: { in: courses.map((c) => c.id) } },
        select: { personId: true, courseId: true, completedAt: true, result: true, score: true, validUntil: true, validUntilSource: true, providerName: true, certificateNumber: true },
        take: 50_000,
      })
    : [];
  const existing: ExistingTrainingRecord[] = existingRows.map((e) => ({
    personId: e.personId,
    courseId: e.courseId,
    completedAt: dateOnly(e.completedAt),
    result: e.result,
    score: e.score,
    validUntil: e.validUntil ? dateOnly(e.validUntil) : null,
    validUntilSource: e.validUntilSource,
    providerName: e.providerName,
    certificateNumber: e.certificateNumber,
  }));
  return { plan: planTrainingImport(existing, parsed.rows, { people, courses }), parseErrors: parsed.errors };
}

/** Qué haría la importación, sin guardar nada. */
export async function previewTrainingImport(tenantId: string, csv: string, db: Db = prisma): Promise<TrainingImportPreview> {
  return buildImportPlan(tenantId, csv, db);
}

/**
 * Importa el histórico: crea lo nuevo, actualiza lo que cambió y deja igual el resto, así que reimportar el mismo
 * archivo no duplica. Los registros nacen sin avisos (no se crea eficacia) y sin evidencia hasta subir el archivo.
 */
export async function applyTrainingImport(input: { tenantId: string; actorUserId: string; csv: string }, db: Db = prisma) {
  const { plan, parseErrors } = await buildImportPlan(input.tenantId, input.csv, db);
  const creates = plan.items.filter((i) => i.action === "create");
  const updates = plan.items.filter((i) => i.action === "update");
  const toDate = (iso: IsoDate | null | undefined) => (iso ? dateFromIso(iso) : null);

  for (let i = 0; i < creates.length; i += IMPORT_BATCH) {
    const batch = creates.slice(i, i + IMPORT_BATCH);
    try {
      await db.trainingRecord.createMany({
        data: batch.map((item) => ({
          tenantId: input.tenantId,
          personId: item.personId!,
          courseId: item.courseId!,
          completedAt: dateFromIso(item.row.completedAt),
          result: item.row.result,
          score: item.row.score,
          validUntil: toDate(item.validUntil),
          validUntilSource: item.validUntilSource ?? "computed",
          source: "import" as const,
          providerName: item.row.providerName,
          certificateNumber: item.row.certificateNumber,
          recordedByUserId: input.actorUserId,
        })),
        skipDuplicates: true, // otra importación a la vez: el índice único evita el doble registro
      });
    } catch (error) {
      uniqueToError(error);
    }
  }
  for (let i = 0; i < updates.length; i += IMPORT_BATCH) {
    const batch = updates.slice(i, i + IMPORT_BATCH);
    await db.$transaction(
      batch.map((item) =>
        db.trainingRecord.updateMany({
          where: {
            tenantId: input.tenantId,
            personId: item.personId!,
            courseId: item.courseId!,
            completedAt: dateFromIso(item.row.completedAt),
            result: item.row.result,
            voidedAt: null,
          },
          data: {
            score: item.row.score,
            validUntil: toDate(item.validUntil),
            validUntilSource: item.validUntilSource ?? "computed",
            providerName: item.row.providerName,
            certificateNumber: item.row.certificateNumber,
          },
        }),
      ),
    );
  }
  await audit(db, {
    tenantId: input.tenantId,
    entityType: "training_record",
    entityId: "import",
    action: "import",
    actorUserId: input.actorUserId,
    summary: `Importación de histórico: ${plan.counts.create} nuevo(s), ${plan.counts.update} actualizado(s), ${plan.counts.unchanged} sin cambios, ${plan.counts.error + parseErrors.length} con error`,
  });
  return { counts: plan.counts, errors: parseErrors.length };
}

export { TRAINING_IMPORT_MAX_ROWS };

// ─── Ficha de la persona ───────────────────────────────────────────────────

/**
 * Todo lo que muestra la ficha: estado de cada curso exigido, historial (con lo anulado), habilitación para
 * cada tarea que tiene asignada y los certificados adjuntos. Usa la función pura con los datos de UNA persona.
 */
export async function getPersonFile(tenantId: string, personId: string, db: Db = prisma) {
  const today = trainingToday();
  const data = await loadPersonTrainingData(tenantId, personId, {}, db);
  if (!data) return null;
  const person = await db.person.findFirst({
    where: { id: personId, tenantId },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      documentId: true,
      status: true,
      employer: true,
      site: { select: { name: true } },
      position: { select: { name: true } },
      jobTasks: { select: { jobTask: { select: { id: true, name: true, critical: true } } } },
    },
  });
  if (!person) return null;
  const statuses = computeTrainingStatus(data.person, data.requirements, data.records, today);
  const history = await listPersonRecords(tenantId, personId, 200, db);
  const attachments = history.length
    ? await db.trainingAttachment.findMany({
        where: { tenantId, recordId: { in: history.map((h) => h.id) } },
        select: { id: true, recordId: true, fileName: true },
        take: 500,
      })
    : [];
  const courseIds = [...new Set([...statuses.map((s) => s.courseId), ...history.map((h) => h.courseId)])];
  const courses = courseIds.length ? await db.course.findMany({ where: { tenantId, id: { in: courseIds } }, select: { id: true, name: true } }) : [];
  const courseName = new Map(courses.map((c) => [c.id, c.name]));
  const tasks = person.jobTasks
    .map((t) => ({
      ...t.jobTask,
      qualification: isQualifiedForTask(data.person, t.jobTask.id, data.requirements, data.records, today),
    }))
    .sort((x, y) => Number(y.critical) - Number(x.critical) || x.name.localeCompare(y.name, "es"));
  return {
    today,
    person,
    statuses: statuses.map((s) => ({ ...s, courseName: courseName.get(s.courseId) ?? "Curso" })),
    summary: summarizeCompliance(statuses),
    history,
    attachmentsByRecord: attachments.reduce<Record<string, { id: string; fileName: string }[]>>((acc, a) => {
      (acc[a.recordId!] ??= []).push({ id: a.id, fileName: a.fileName });
      return acc;
    }, {}),
    courseName,
    tasks,
  };
}
