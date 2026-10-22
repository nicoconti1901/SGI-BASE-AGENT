import { Prisma, type InspectionAnswerValue } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureDefaultTemplates, getTemplateByKey } from "@/lib/inspection-templates";
import { InspectionError, writeAudit, type Db, type Tx } from "@/lib/inspection-support";
import { getAssetType } from "@/domain/inspections/asset-types";
import { applicableItems, deriveInspectionResult, resolveAutoConform } from "@/domain/inspections/result";
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

export const INSPECTIONS_PAGE_SIZE = 25;
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
  input: { tenantId: string; actorUserId: string; assetId: string; inspectedAt?: string },
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
  const template = await getTemplateByKey(input.tenantId, type.periodicTemplateKey, db);
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
      answers: {
        orderBy: { item: { sortOrder: "asc" } },
        include: { item: true, attachments: { select: { id: true, fileName: true }, orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!inspection) return null;
  const inspector = await db.user.findUnique({ where: { id: inspection.inspectorUserId }, select: { name: true } });
  const dueDates = dueDatesOf(inspection.asset?.dueDates ?? []);
  const referenceDate = isoFromDate(inspection.inspectedAt);

  return {
    inspection,
    inspectorName: inspector?.name ?? "Usuario",
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

export type InspectionListFilter = { status?: "draft" | "closed"; assetId?: string; inspectorUserId?: string; after?: string; take?: number };

/** Última página por cursor `(fecha, id)`: la consulta no crece con el tamaño de la página. */
export async function listInspections(tenantId: string, filter: InspectionListFilter = {}, db: Db = prisma) {
  const take = Math.min(filter.take ?? INSPECTIONS_PAGE_SIZE, 100);
  const [afterDate, afterId] = filter.after?.split("_") ?? [];
  const cursor: Prisma.InspectionWhereInput =
    afterDate && afterId && isIsoDate(afterDate)
      ? { OR: [{ inspectedAt: { lt: dateFromIso(afterDate) } }, { inspectedAt: dateFromIso(afterDate), id: { lt: afterId } }] }
      : {};
  const rows = await db.inspection.findMany({
    where: {
      tenantId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.assetId ? { assetId: filter.assetId } : {}),
      ...(filter.inspectorUserId ? { inspectorUserId: filter.inspectorUserId } : {}),
      ...cursor,
    },
    orderBy: [{ inspectedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    include: { asset: { select: { code: true, description: true } }, template: { select: { name: true } }, site: { select: { name: true } } },
  });
  const page = rows.slice(0, take);
  const userIds = [...new Set(page.map((r) => r.inspectorUserId))];
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  const last = page[page.length - 1];
  return {
    items: page.map((r) => ({ ...r, inspectorName: names.get(r.inspectorUserId) ?? "Usuario" })),
    nextCursor: rows.length > take && last ? `${isoFromDate(last.inspectedAt)}_${last.id}` : null,
  };
}

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
 * Las consecuencias del resultado (estado del activo, acción, hallazgo, próximo vencimiento) son el slice S4 y
 * se enganchan en este punto, dentro de la misma transacción.
 */
export async function closeInspection(
  input: {
    tenantId: string;
    actorUserId: string;
    canEditOthers: boolean;
    inspectionId: string;
    confirmLowerReadings?: boolean;
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
      return { id: inspection.id, alreadyClosed: false };
    },
    { timeout: 30_000 },
  );
}
