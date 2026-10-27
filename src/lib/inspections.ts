import { Prisma, type InspectionAnswerValue } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureDefaultTemplates, getTemplateByKey } from "@/lib/inspection-templates";
import { InspectionError, writeAudit, type Db, type Tx } from "@/lib/inspection-support";
import { getAssetType } from "@/domain/inspections/asset-types";
import { applicableItems, deriveInspectionResult, itemOutcome, resolveAutoConform } from "@/domain/inspections/result";
import { applyAssetStatus, createFollowUp, updatePlan, type FollowUpChoice } from "@/lib/inspection-consequences";
import { runInspectionCloseHooks } from "@/lib/inspection-hooks";
import type { NonconformingItem } from "@/domain/inspections/consequences";
import { validateInspectionForClose, MAX_PHOTOS_PER_ANSWER, MAX_PHOTOS_PER_INSPECTION } from "@/domain/inspections/close";
import { dateFromIso, isIsoDate, isoFromDate, todayIso } from "@/domain/inspections/dates";
import {
  InspectionDomainError,
  type AppliesWhen,
  type AutoSource,
  type EvalAnswer,
  type EvalItem,
} from "@/domain/inspections/types";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";

export { INSPECTIONS_PAGE_SIZE, listInspections, type InspectionListFilter } from "@/lib/inspection-list";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ItemRow = Prisma.InspectionTemplateItemGetPayload<object>;

function asJson<T>(value: Prisma.JsonValue | null): T | null {
  return value === null ? null : (value as T);
}

function toEvalItem(item: ItemRow, autoConform?: boolean): EvalItem {
  return {
    id: item.id,
    criticality: item.criticality,
    kind: item.kind,
    naAllowed: item.naAllowed,
    required: item.required,
    photoOnNc: item.photoOnNc,
    minValue: item.minValue,
    maxValue: item.maxValue,
    autoSource: asJson<AutoSource>(item.autoSource),
    autoConform,
  };
}

/** Las no conformidades de las respuestas, con la criticidad y el comentario del inspector. */
function nonconformingOf(
  answers: { itemId: string; value: InspectionAnswerValue | null; numberValue: number | null; comment: string | null; item: ItemRow }[],
  autoConform: Map<string, boolean>,
): NonconformingItem[] {
  const out: NonconformingItem[] = [];
  for (const a of answers) {
    if (a.item.kind !== "check" && a.item.kind !== "number") continue;
    const outcome = itemOutcome(toEvalItem(a.item, autoConform.get(a.itemId)), {
      itemId: a.itemId,
      value: a.item.autoSource ? undefined : a.value,
      numberValue: a.numberValue,
    });
    if (outcome === "nonconform") out.push({ code: a.item.code, text: a.item.text, criticality: a.item.criticality, comment: a.comment });
  }
  return out;
}

function dueDatesOf(rows: { kind: string; dueAt: Date }[]) {
  return rows.map((d) => ({ kind: d.kind, dueAt: isoFromDate(d.dueAt) }));
}

// ─── Empezar ───────────────────────────────────────────────────────────────

/**
 * Abre el borrador de una inspección sobre un activo. Si el inspector ya tiene uno abierto del mismo activo
 * lo devuelve (así un doble toque o un reintento no crean dos). Guarda la versión activa de la plantilla:
 * los ítems de esta inspección ya no cambian aunque después se edite la plantilla.
 */
export async function startInspection(
  input: { tenantId: string; actorUserId: string; assetId: string; inspectedAt?: string; templateKey?: string },
  db: Db = prisma,
) {
  const asset = await db.asset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId }, include: { dueDates: true } });
  if (!asset) throw new InspectionError("Activo no encontrado");
  if (asset.status === "retired") throw new InspectionError("El activo está dado de baja: no se puede inspeccionar");
  const type = getAssetType(asset.typeKey);
  const today = todayIso();
  const inspectedAt = input.inspectedAt ?? today;
  if (!isIsoDate(inspectedAt)) throw new InspectionError("Fecha inválida");

  await ensureDefaultTemplates(input.tenantId, db);
  // Por defecto, la inspección periódica del tipo; algunos tipos suman un control previo al uso (otra plantilla, sin calendario).
  const templateKey = input.templateKey ?? type.periodicTemplateKey;
  if (templateKey !== type.periodicTemplateKey && templateKey !== type.preUseTemplateKey) throw new InspectionError("Este activo no admite ese tipo de control");
  const template = await getTemplateByKey(input.tenantId, templateKey, db);
  if (!template || !template.activeVersionId) throw new InspectionError("No se encontró la plantilla de inspección del tipo");

  const existing = await db.inspection.findFirst({
    where: { tenantId: input.tenantId, assetId: asset.id, templateId: template.id, inspectorUserId: input.actorUserId, status: "draft" },
    select: { id: true },
  });
  if (existing) return existing;

  const allItems = await db.inspectionTemplateItem.findMany({ where: { versionId: template.activeVersionId }, orderBy: { sortOrder: "asc" } });
  const applicable = applicableItems(
    allItems.map((i) => ({ ...i, appliesWhen: asJson<AppliesWhen>(i.appliesWhen) })),
    { asset: asset.attributes as Record<string, unknown> },
  );
  if (applicable.length === 0) throw new InspectionError("La plantilla no tiene ítems aplicables a este activo");
  const dueDates = dueDatesOf(asset.dueDates);

  try {
    return await db.$transaction(async (tx) => {
      const inspection = await tx.inspection.create({
        data: {
          tenantId: input.tenantId,
          templateId: template.id,
          versionId: template.activeVersionId!,
          assetId: asset.id,
          siteId: asset.siteId,
          sector: asset.sector,
          inspectorUserId: input.actorUserId,
          inspectedAt: dateFromIso(inspectedAt),
        },
        select: { id: true },
      });
      await tx.inspectionAnswer.createMany({
        data: applicable.map((item) => {
          const auto = asJson<AutoSource>(item.autoSource);
          return {
            tenantId: input.tenantId,
            inspectionId: inspection.id,
            itemId: item.id,
            autoDerived: Boolean(auto),
            value: auto ? (resolveAutoConform(auto, dueDates, inspectedAt) ? ("conform" as const) : ("nonconform" as const)) : null,
            answeredAt: auto ? new Date() : null,
          };
        }),
      });
      await writeAudit(tx, { tenantId: input.tenantId, entityType: "inspection", entityId: inspection.id, action: "start", actorUserId: input.actorUserId, summary: `Inspección iniciada sobre ${asset.code}` });
      return inspection;
    });
  } catch (error) {
    // Otra solicitud abrió el mismo borrador un instante antes: se devuelve ese.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const again = await db.inspection.findFirst({
        where: { tenantId: input.tenantId, assetId: asset.id, templateId: template.id, inspectorUserId: input.actorUserId, status: "draft" },
        select: { id: true },
      });
      if (again) return again;
    }
    throw error;
  }
}

// ─── Lectura ───────────────────────────────────────────────────────────────

/** La inspección con sus ítems, respuestas y fotos, lista para dibujar la pantalla. */
export async function getInspectionView(tenantId: string, inspectionId: string, db: Db = prisma) {
  const inspection = await db.inspection.findFirst({
    where: { id: inspectionId, tenantId },
    include: {
      template: { select: { key: true, name: true, reinspectionDays: true } },
      templateVersion: { select: { version: true } },
      asset: { include: { dueDates: { select: { kind: true, dueAt: true } } } },
      site: { select: { name: true } },
      performedBy: { select: { id: true, name: true, employeeCode: true, site: { select: { name: true } } } },
      finding: { select: { id: true, title: true, status: true } },
      action: { select: { id: true, title: true, description: true, status: true, ownerUserId: true, dueAt: true, attachments: { select: { id: true, fileName: true } } } },
      corrections: { orderBy: { createdAt: "desc" } },
      answers: {
        orderBy: { item: { sortOrder: "asc" } },
        include: { item: true, attachments: { select: { id: true, fileName: true }, orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!inspection) return null;
  const userIds = [...new Set([inspection.inspectorUserId, ...(inspection.action ? [inspection.action.ownerUserId] : []), ...inspection.corrections.map((c) => c.byUserId)])];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const inspector = { name: userName.get(inspection.inspectorUserId) };
  const dueDates = dueDatesOf(inspection.asset?.dueDates ?? []);
  const referenceDate = isoFromDate(inspection.inspectedAt);

  return {
    inspection,
    inspectorName: inspector?.name ?? "Usuario",
    userName: (id: string) => userName.get(id) ?? "Usuario",
    items: inspection.answers.map((a) => {
      const auto = asJson<AutoSource>(a.item.autoSource);
      const due = auto ? dueDates.find((d) => d.kind === auto.dueKind) : undefined;
      return {
        answer: a,
        item: a.item,
        evalItem: toEvalItem(a.item, auto ? resolveAutoConform(auto, dueDates, referenceDate) : undefined),
        autoDueAt: due?.dueAt ?? null,
      };
    }),
  };
}

export type InspectionView = NonNullable<Awaited<ReturnType<typeof getInspectionView>>>;


/** Siguiente activo de la misma sede con inspección pendiente (la «ronda»): el programa más atrasado que hoy no inspeccionó esta persona. */
export async function findNextPendingAsset(
  input: { tenantId: string; siteId: string; excludeAssetId: string | null; actorUserId: string },
  db: Db = prisma,
) {
  const today = dateFromIso(todayIso());
  const plans = await db.inspectionPlan.findMany({
    where: {
      tenantId: input.tenantId,
      siteId: input.siteId,
      active: true,
      nextDueAt: { not: null },
      assetId: input.excludeAssetId ? { not: input.excludeAssetId } : { not: null },
      asset: { status: { not: "retired" } },
    },
    orderBy: [{ nextDueAt: "asc" }, { id: "asc" }],
    take: 25,
    select: { assetId: true, asset: { select: { id: true, code: true } } },
  });
  if (plans.length === 0) return null;
  const done = await db.inspection.findMany({
    where: { tenantId: input.tenantId, inspectorUserId: input.actorUserId, inspectedAt: today, assetId: { in: plans.map((p) => p.assetId!) } },
    select: { assetId: true },
  });
  const doneIds = new Set(done.map((d) => d.assetId));
  return plans.find((p) => !doneIds.has(p.assetId))?.asset ?? null;
}

// ─── Guardado del borrador ─────────────────────────────────────────────────

async function requireEditableDraft(tenantId: string, inspectionId: string, actorUserId: string, canEditOthers: boolean, db: Db | Tx) {
  const inspection = await db.inspection.findFirst({ where: { id: inspectionId, tenantId } });
  if (!inspection) throw new InspectionError("Inspección no encontrada");
  if (inspection.status !== "draft") throw new InspectionError("La inspección ya está cerrada", "closed");
  if (inspection.inspectorUserId !== actorUserId && !canEditOthers) throw new InspectionError("Solo quien empezó la inspección puede completarla");
  return inspection;
}

export type AnswerPatch = {
  value?: "conform" | "nonconform" | "na" | null;
  numberValue?: number | null;
  textValue?: string | null;
  comment?: string | null;
};

/** Guarda una respuesta del borrador (se llama en cada toque: guardado automático). `undefined` = no cambia. */
export async function saveAnswer(
  input: { tenantId: string; actorUserId: string; canEditOthers: boolean; inspectionId: string; itemId: string; patch: AnswerPatch },
  db: Db = prisma,
) {
  await requireEditableDraft(input.tenantId, input.inspectionId, input.actorUserId, input.canEditOthers, db);
  const answer = await db.inspectionAnswer.findUnique({
    where: { inspectionId_itemId: { inspectionId: input.inspectionId, itemId: input.itemId } },
    include: { item: true },
  });
  if (!answer || answer.tenantId !== input.tenantId) throw new InspectionError("El ítem no pertenece a esta inspección");
  if (answer.autoDerived) throw new InspectionError("Este ítem lo completa el sistema con el vencimiento del activo");

  const { patch } = input;
  const { item } = answer;
  const data: Prisma.InspectionAnswerUpdateManyMutationInput = { answeredAt: new Date() };
  if (patch.value !== undefined) {
    if (patch.value === "na" && !item.naAllowed) throw new InspectionError("Este ítem no admite «No aplica»");
    if (patch.value !== null && item.kind !== "check" && item.kind !== "number") throw new InspectionError("Este ítem no se responde con conforme / no conforme");
    if (patch.value === "nonconform" && item.kind === "number") throw new InspectionError("En un valor numérico el resultado se calcula del número");
    data.value = patch.value as InspectionAnswerValue | null;
  }
  if (patch.numberValue !== undefined) {
    if (patch.numberValue !== null && !Number.isFinite(patch.numberValue)) throw new InspectionError("El valor tiene que ser un número");
    if (item.kind !== "number" && item.kind !== "reading") throw new InspectionError("Este ítem no lleva un número");
    data.numberValue = patch.numberValue;
    if (item.kind === "number" && patch.value === undefined && patch.numberValue !== null) data.value = null; // deja de ser «No aplica»
  }
  if (patch.textValue !== undefined) data.textValue = patch.textValue?.slice(0, 2000) || null;
  if (patch.comment !== undefined) data.comment = patch.comment?.trim().slice(0, 2000) || null;

  const result = await db.inspectionAnswer.updateMany({
    where: { id: answer.id, tenantId: input.tenantId, inspection: { status: "draft" } },
    data,
  });
  if (result.count === 0) throw new InspectionError("La inspección ya está cerrada", "closed");
}

export async function saveInspectionMeta(
  input: {
    tenantId: string;
    actorUserId: string;
    canEditOthers: boolean;
    inspectionId: string;
    inspectedAt?: string;
    performedByPersonId?: string | null;
    notes?: string | null;
  },
  db: Db = prisma,
) {
  await requireEditableDraft(input.tenantId, input.inspectionId, input.actorUserId, input.canEditOthers, db);
  if (input.inspectedAt !== undefined && !isIsoDate(input.inspectedAt)) throw new InspectionError("Fecha inválida");
  if (input.performedByPersonId) {
    const person = await db.person.findFirst({ where: { id: input.performedByPersonId, tenantId: input.tenantId, status: "active" }, select: { id: true } });
    if (!person) throw new InspectionError("La persona no existe o está dada de baja");
  }
  const result = await db.inspection.updateMany({
    where: { id: input.inspectionId, tenantId: input.tenantId, status: "draft" },
    data: {
      ...(input.inspectedAt !== undefined ? { inspectedAt: dateFromIso(input.inspectedAt) } : {}),
      ...(input.performedByPersonId !== undefined ? { performedByPersonId: input.performedByPersonId || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim().slice(0, 4000) || null } : {}),
    },
  });
  if (result.count === 0) throw new InspectionError("La inspección ya está cerrada", "closed");
}

// ─── Fotos ─────────────────────────────────────────────────────────────────

export function buildInspectionAttachmentKey(input: { tenantId: string; inspectionId: string; attachmentId: string; fileName: string }) {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${input.tenantId}/inspections/${input.inspectionId}/${input.attachmentId}/${safeName}`;
}

export async function addInspectionPhoto(
  input: {
    tenantId: string;
    actorUserId: string;
    canEditOthers: boolean;
    inspectionId: string;
    itemId: string;
    fileName: string;
    contentType: string;
    body: Buffer;
    storage?: ObjectStorage;
  },
  db: Db = prisma,
) {
  await requireEditableDraft(input.tenantId, input.inspectionId, input.actorUserId, input.canEditOthers, db);
  if (!PHOTO_TYPES.has(input.contentType)) throw new InspectionError("Solo se admiten fotos JPG, PNG o WebP");
  if (input.body.length === 0) throw new InspectionError("La foto está vacía");
  if (input.body.length > MAX_PHOTO_BYTES) throw new InspectionError("La foto supera el máximo de 8 MB");
  const answer = await db.inspectionAnswer.findUnique({ where: { inspectionId_itemId: { inspectionId: input.inspectionId, itemId: input.itemId } } });
  if (!answer || answer.tenantId !== input.tenantId) throw new InspectionError("El ítem no pertenece a esta inspección");
  const [perAnswer, perInspection] = await Promise.all([
    db.inspectionAttachment.count({ where: { answerId: answer.id } }),
    db.inspectionAttachment.count({ where: { inspectionId: input.inspectionId } }),
  ]);
  if (perAnswer >= MAX_PHOTOS_PER_ANSWER) throw new InspectionError(`Cada ítem admite hasta ${MAX_PHOTOS_PER_ANSWER} fotos`);
  if (perInspection >= MAX_PHOTOS_PER_INSPECTION) throw new InspectionError(`Cada inspección admite hasta ${MAX_PHOTOS_PER_INSPECTION} fotos`);

  const storage = input.storage ?? getObjectStorage();
  const attachment = await db.inspectionAttachment.create({
    data: {
      tenantId: input.tenantId,
      inspectionId: input.inspectionId,
      answerId: answer.id,
      kind: "photo",
      storageKey: "pending",
      fileName: input.fileName.slice(0, 120),
      contentType: input.contentType,
      sizeBytes: input.body.length,
      uploadedById: input.actorUserId,
    },
  });
  const storageKey = buildInspectionAttachmentKey({ tenantId: input.tenantId, inspectionId: input.inspectionId, attachmentId: attachment.id, fileName: input.fileName });
  try {
    await storage.putObject(storageKey, input.body, input.contentType);
  } catch (error) {
    await db.inspectionAttachment.delete({ where: { id: attachment.id } });
    throw error;
  }
  return db.inspectionAttachment.update({ where: { id: attachment.id }, data: { storageKey }, select: { id: true, fileName: true } });
}

export async function deleteInspectionPhoto(
  input: { tenantId: string; actorUserId: string; canEditOthers: boolean; inspectionId: string; attachmentId: string; storage?: ObjectStorage },
  db: Db = prisma,
) {
  await requireEditableDraft(input.tenantId, input.inspectionId, input.actorUserId, input.canEditOthers, db);
  const attachment = await db.inspectionAttachment.findFirst({ where: { id: input.attachmentId, inspectionId: input.inspectionId, tenantId: input.tenantId } });
  if (!attachment) throw new InspectionError("Foto no encontrada");
  await db.inspectionAttachment.delete({ where: { id: attachment.id } });
  await (input.storage ?? getObjectStorage()).deleteObject(attachment.storageKey).catch(() => undefined);
}

export async function readInspectionAttachment(attachmentId: string, options?: { db?: Db; storage?: ObjectStorage }) {
  const db = options?.db ?? prisma;
  const attachment = await db.inspectionAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return null;
  const object = await (options?.storage ?? getObjectStorage()).getObject(attachment.storageKey);
  if (!object) return null;
  return { attachment, body: object.body, contentType: object.contentType };
}

// ─── Cierre ────────────────────────────────────────────────────────────────

export type CloseOutcome = { id: string; alreadyClosed: boolean };

/**
 * Cierra y firma la inspección (la firma es el usuario y la fecha). Calcula el resultado con las funciones puras:
 * nadie lo carga a mano. Es idempotente: cerrar dos veces (doble toque, reintento de red o dos pedidos a la vez)
 * deja una sola inspección cerrada y devuelve la misma.
 *
 * Las consecuencias del resultado se aplican en la misma transacción: estado del activo, programa y próximo
 * vencimiento, y la acción de seguimiento (con hallazgo en borrador si la plantilla lo pide y hay una crítica).
 * `canEditOthers` es el permiso de liberar activos (administrador o responsable de proceso): también decide si una
 * reinspección apta devuelve el activo a servicio.
 */
export async function closeInspection(
  input: {
    tenantId: string;
    actorUserId: string;
    canEditOthers: boolean;
    inspectionId: string;
    confirmLowerReadings?: boolean;
    /** Responsable y plazo de la acción de seguimiento, si el inspector no acepta los propuestos. */
    followUp?: FollowUpChoice;
  },
  db: Db = prisma,
): Promise<CloseOutcome> {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM inspection WHERE id = ${input.inspectionId} AND "tenantId" = ${input.tenantId} FOR UPDATE`;
      const inspection = await tx.inspection.findFirst({
        where: { id: input.inspectionId, tenantId: input.tenantId },
        include: {
          asset: { include: { dueDates: { select: { kind: true, dueAt: true } } } },
          answers: { include: { item: true } },
        },
      });
      if (!inspection) throw new InspectionError("Inspección no encontrada");
      if (inspection.status === "closed") return { id: inspection.id, alreadyClosed: true };
      if (inspection.inspectorUserId !== input.actorUserId && !input.canEditOthers) {
        throw new InspectionError("Solo quien empezó la inspección puede cerrarla");
      }

      const inspectedAt = isoFromDate(inspection.inspectedAt);
      const today = todayIso();
      const dueDates = dueDatesOf(inspection.asset?.dueDates ?? []);

      // Los ítems automáticos se vuelven a calcular con los vencimientos de hoy (pueden haberse renovado).
      const autoConform = new Map<string, boolean>();
      for (const a of inspection.answers) {
        const auto = asJson<AutoSource>(a.item.autoSource);
        if (!auto) continue;
        const conform = resolveAutoConform(auto, dueDates, inspectedAt);
        autoConform.set(a.itemId, conform);
        const value = conform ? "conform" : "nonconform";
        if (a.value !== value) await tx.inspectionAnswer.update({ where: { id: a.id }, data: { value, answeredAt: new Date() } });
      }

      const items = inspection.answers.map((a) => toEvalItem(a.item, autoConform.get(a.itemId)));
      const answers: EvalAnswer[] = inspection.answers.map((a) => ({
        itemId: a.itemId,
        value: a.item.autoSource ? undefined : a.value,
        numberValue: a.numberValue,
        textValue: a.textValue,
        comment: a.comment,
      }));

      let derived;
      try {
        derived = deriveInspectionResult(items, answers);
      } catch (error) {
        if (error instanceof InspectionDomainError) throw new InspectionError(error.message, error.code);
        throw error;
      }
      if (!derived.complete || !derived.result) {
        throw new InspectionError(`Faltan responder ${derived.missingItemIds.length} ítem(s)`, "incomplete", { missingItemIds: derived.missingItemIds });
      }

      const photoGroups = await tx.inspectionAttachment.groupBy({
        by: ["answerId"],
        where: { inspectionId: inspection.id, answerId: { not: null } },
        _count: { _all: true },
      });
      const itemOfAnswer = new Map(inspection.answers.map((a) => [a.id, a.itemId]));
      const photoCounts: Record<string, number> = {};
      for (const g of photoGroups) {
        const itemId = g.answerId ? itemOfAnswer.get(g.answerId) : undefined;
        if (itemId) photoCounts[itemId] = g._count._all;
      }

      // Lecturas (odómetro / horómetro): se copian al cerrar y no pueden ir hacia atrás sin confirmación.
      let readingKm: number | null = null;
      let readingHours: number | null = null;
      for (const a of inspection.answers) {
        if (a.item.kind !== "reading" || a.numberValue === null) continue;
        if (a.item.readingKey === "odometer_km") readingKm = Math.round(a.numberValue);
        if (a.item.readingKey === "hours") readingHours = a.numberValue;
      }
      const previous = inspection.assetId
        ? await tx.inspection.findFirst({
            where: { tenantId: input.tenantId, assetId: inspection.assetId, status: "closed", id: { not: inspection.id } },
            orderBy: [{ inspectedAt: "desc" }, { closedAt: "desc" }],
            select: { readingKm: true, readingHours: true },
          })
        : null;
      const readings = [
        ...(readingKm !== null ? [{ current: readingKm, previous: previous?.readingKm ?? null, confirmedLower: Boolean(input.confirmLowerReadings), label: "Odómetro" }] : []),
        ...(readingHours !== null ? [{ current: readingHours, previous: previous?.readingHours ?? null, confirmedLower: Boolean(input.confirmLowerReadings), label: "Horómetro" }] : []),
      ];

      const check = validateInspectionForClose({
        items,
        answers,
        photoCounts,
        inspectedAt,
        today,
        assetStatus: inspection.asset?.status ?? null,
        readings,
      });
      if (!check.ok) throw new InspectionError(check.blockers[0].message, "blocked", { blockers: check.blockers });

      const now = new Date();
      const closed = await tx.inspection.updateMany({
        where: { id: inspection.id, tenantId: input.tenantId, status: "draft" },
        data: {
          status: "closed",
          closedAt: now,
          result: derived.result,
          scorePct: derived.scorePct,
          applicableCount: derived.applicable,
          conformCount: derived.conform,
          nonconformCount: derived.nonconform,
          readingKm,
          readingHours,
        },
      });
      if (closed.count === 0) return { id: inspection.id, alreadyClosed: true };

      await writeAudit(tx, {
        tenantId: input.tenantId,
        entityType: "inspection",
        entityId: inspection.id,
        action: "close",
        actorUserId: input.actorUserId,
        summary: `Inspección cerrada y firmada: ${derived.result}, ${derived.nonconform} no conformidad(es) de ${derived.applicable}`,
      });

      // Consecuencias: estado del activo → programa y vencimiento → acción y hallazgo.
      const template = await tx.inspectionTemplate.findUniqueOrThrow({ where: { id: inspection.templateId } });
      const asset = inspection.asset;
      const statusChange = asset
        ? await applyAssetStatus(tx, {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            inspectionId: inspection.id,
            asset,
            result: derived.result,
            template,
            canRelease: input.canEditOthers,
            origin: "close",
          })
        : null;
      await updatePlan(tx, {
        tenantId: input.tenantId,
        template,
        asset,
        siteId: inspection.siteId,
        inspectionId: inspection.id,
        inspectedAt,
        result: derived.result,
        assetRetired: asset?.status === "retired" || statusChange?.to === "retired",
      });
      const nonconforming = nonconformingOf(inspection.answers, autoConform);
      await createFollowUp(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        inspection: { id: inspection.id, actionId: inspection.actionId, findingId: inspection.findingId, siteId: inspection.siteId },
        template,
        asset,
        nonconforming,
        statusChange,
        choice: input.followUp,
        detectedAt: inspectedAt,
      });
      await runInspectionCloseHooks(tx, template.key, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        inspection: { id: inspection.id, assetId: inspection.assetId, inspectedAt },
        result: derived.result,
      });
      return { id: inspection.id, alreadyClosed: false };
    },
    { timeout: 30_000 },
  );
}

// ─── Corrección de una inspección cerrada ──────────────────────────────────

export type CorrectionPatch = { value?: "conform" | "nonconform" | "na"; numberValue?: number | null };

const MIN_CORRECTION_REASON = 10;

function describeAnswer(item: ItemRow, answer: { value: InspectionAnswerValue | null; numberValue: number | null }): string | null {
  if (item.kind === "number") return answer.value === "na" ? "na" : answer.numberValue === null ? null : String(answer.numberValue);
  return answer.value;
}

/**
 * Corrige una respuesta de una inspección cerrada, con motivo: nada se edita en silencio. Recalcula el resultado
 * y deja la corrección registrada. Una corrección que empeora la última inspección del activo a «no apto» lo saca
 * de servicio; una que mejora no lo libera (liberar exige una reinspección). Si aparece una no conformidad y la
 * inspección no tenía acción de seguimiento, se crea.
 */
export async function correctInspectionAnswer(
  input: {
    tenantId: string;
    actorUserId: string;
    /** Administrador o responsable de proceso. */
    canRelease: boolean;
    inspectionId: string;
    answerId: string;
    patch: CorrectionPatch;
    reason: string;
  },
  db: Db = prisma,
) {
  if (!input.canRelease) throw new InspectionError("Solo un administrador o un responsable de proceso puede corregir una inspección cerrada");
  const reason = input.reason.trim();
  if (reason.length < MIN_CORRECTION_REASON) throw new InspectionError(`Contá el motivo de la corrección (al menos ${MIN_CORRECTION_REASON} caracteres)`);

  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM inspection WHERE id = ${input.inspectionId} AND "tenantId" = ${input.tenantId} FOR UPDATE`;
      const inspection = await tx.inspection.findFirst({
        where: { id: input.inspectionId, tenantId: input.tenantId },
        include: { asset: true, answers: { include: { item: true } } },
      });
      if (!inspection) throw new InspectionError("Inspección no encontrada");
      if (inspection.status !== "closed" || !inspection.result) throw new InspectionError("Solo se corrigen inspecciones cerradas: el borrador se edita directamente");

      const target = inspection.answers.find((a) => a.id === input.answerId);
      if (!target) throw new InspectionError("Respuesta no encontrada");
      if (target.item.autoSource) throw new InspectionError("Ese ítem lo calcula el sistema con los vencimientos del activo: no se corrige a mano");
      if (target.item.kind !== "check" && target.item.kind !== "number") throw new InspectionError("Solo se corrigen ítems de conforme / no conforme o con un valor numérico");

      const next = {
        value: target.item.kind === "check" ? (input.patch.value ?? target.value) : input.patch.value === "na" ? ("na" as const) : null,
        numberValue: target.item.kind === "number" && input.patch.value !== "na" ? (input.patch.numberValue ?? target.numberValue) : null,
      };
      if (target.item.kind === "check" && !next.value) throw new InspectionError("Indicá la respuesta correcta");
      if (next.value === "na" && !target.item.naAllowed) throw new InspectionError("Ese ítem no admite «no aplica»");
      if (target.item.kind === "number" && next.value !== "na" && (next.numberValue === null || !Number.isFinite(next.numberValue))) throw new InspectionError("Indicá el valor correcto");

      const before = describeAnswer(target.item, target);
      const after = describeAnswer(target.item, next);
      if (before === after) throw new InspectionError("La corrección no cambia la respuesta");

      const autoConform = new Map(inspection.answers.filter((a) => a.item.autoSource).map((a) => [a.itemId, a.value === "conform"]));
      const corrected = inspection.answers.map((a) => (a.id === target.id ? { ...a, ...next } : a));
      const items = corrected.map((a) => toEvalItem(a.item, autoConform.get(a.itemId)));
      const answers: EvalAnswer[] = corrected.map((a) => ({ itemId: a.itemId, value: a.item.autoSource ? undefined : a.value, numberValue: a.numberValue, textValue: a.textValue, comment: a.comment }));
      let derived;
      try {
        derived = deriveInspectionResult(items, answers);
      } catch (error) {
        if (error instanceof InspectionDomainError) throw new InspectionError(error.message, error.code);
        throw error;
      }
      if (!derived.result) throw new InspectionError("No se pudo recalcular el resultado");

      const previousResult = inspection.result;
      await tx.inspectionAnswer.update({ where: { id: target.id }, data: { value: next.value, numberValue: next.numberValue, answeredAt: new Date() } });
      await tx.inspection.update({
        where: { id: inspection.id },
        data: { result: derived.result, scorePct: derived.scorePct, applicableCount: derived.applicable, conformCount: derived.conform, nonconformCount: derived.nonconform },
      });
      await tx.inspectionCorrection.create({
        data: { tenantId: input.tenantId, inspectionId: inspection.id, answerId: target.id, previousValue: before, newValue: after, previousResult, newResult: derived.result, reason, byUserId: input.actorUserId },
      });
      await writeAudit(tx, {
        tenantId: input.tenantId,
        entityType: "inspection",
        entityId: inspection.id,
        action: "correct",
        actorUserId: input.actorUserId,
        summary: `Corrección de «${target.item.text}»: ${before ?? "—"} → ${after ?? "—"} (${previousResult} → ${derived.result}). Motivo: ${reason}`,
      });

      const template = await tx.inspectionTemplate.findUniqueOrThrow({ where: { id: inspection.templateId } });
      const asset = inspection.asset;
      let statusChange = null;
      if (asset && previousResult !== derived.result) {
        const latest = await tx.inspection.findFirst({
          where: { tenantId: input.tenantId, assetId: asset.id, status: "closed" },
          orderBy: [{ inspectedAt: "desc" }, { closedAt: "desc" }, { id: "desc" }],
          select: { id: true },
        });
        if (latest?.id === inspection.id) {
          if (previousResult !== "unfit" && derived.result === "unfit") {
            statusChange = await applyAssetStatus(tx, {
              tenantId: input.tenantId,
              actorUserId: input.actorUserId,
              inspectionId: inspection.id,
              asset,
              result: derived.result,
              template,
              canRelease: input.canRelease,
              origin: "correction",
            });
          }
          const current = await tx.asset.findUniqueOrThrow({ where: { id: asset.id }, select: { status: true } });
          await updatePlan(tx, {
            tenantId: input.tenantId,
            template,
            asset,
            siteId: inspection.siteId,
            inspectionId: inspection.id,
            inspectedAt: isoFromDate(inspection.inspectedAt),
            result: derived.result,
            assetRetired: current.status === "retired",
          });
        }
      }

      const nonconforming = nonconformingOf(corrected, autoConform);
      if (nonconforming.length > 0 && !inspection.actionId) {
        await createFollowUp(tx, {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          inspection: { id: inspection.id, actionId: inspection.actionId, findingId: inspection.findingId, siteId: inspection.siteId },
          template,
          asset,
          nonconforming,
          statusChange,
          detectedAt: isoFromDate(inspection.inspectedAt),
        });
      }
      if (previousResult !== "unfit" && derived.result === "unfit") {
        await runInspectionCloseHooks(tx, template.key, {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          inspection: { id: inspection.id, assetId: inspection.assetId, inspectedAt: isoFromDate(inspection.inspectedAt) },
          result: derived.result,
        });
      }
      return { result: derived.result, previousResult, statusChange };
    },
    { timeout: 30_000 },
  );
}
