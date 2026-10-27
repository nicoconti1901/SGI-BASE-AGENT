import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reminderStartsAt } from "@/domain/automation/due";
import { closeDueItemsForEntity, upsertOpenDueItemForEntity, type CreateDueItemInput } from "@/lib/automation";
import { cleanName, normalizeKey } from "@/domain/masterdata/roster";
import { buildApprovedList, type ApprovedList } from "@/domain/suppliers/approved-list";
import { CUIT_ERROR_MESSAGES, formatCuit, isValidCuit } from "@/domain/suppliers/cuit";
import { buenosAiresToday } from "@/domain/suppliers/dates";
import {
  parseSupplierCsv,
  planSupplierImport,
  type SupplierCsvError,
  type SupplierCsvRow,
  type SupplierImportPlan,
} from "@/domain/suppliers/import";
import { DEFAULT_INITIAL_EVAL_DAYS, DEFAULT_REEVALUATION, initialEvaluationDue, type ReevaluationConfig } from "@/domain/suppliers/schedule";
import { computeSupplierSummary, windowEnd } from "@/domain/suppliers/summary";
import { DEFAULT_CRITERIA, DEFAULT_DOCUMENT_TYPES } from "@/domain/suppliers/templates";
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WARN_DAYS,
  SUPPLIER_CRITICALITIES,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
  type SupplierCriticalityValue,
  type SupplierStatusValue,
  type SupplierTypeValue,
} from "@/domain/suppliers/types";

type Tx = Prisma.TransactionClient;

/** Error de negocio con un mensaje listo para mostrar en la UI. */
export class SupplierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierError";
  }
}

export const SUPPLIER_PAGE_SIZE = 25;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const num = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

type AuditInput = {
  tenantId: string;
  entityId: string;
  action:
    | "create" | "update" | "deactivate" | "reactivate" | "import" | "export" | "link_person" | "unlink_person"
    | "evaluate" | "void_evaluation" | "publish_template" | "save_template" | "discard_template"
    | "upload_document" | "void_document" | "save_document_type" | "create_finding" | "communicate";
  actorUserId: string | null;
  summary: string;
};

/** Mismo registro de auditoría que datos maestros (quién, cuándo, qué). */
export async function audit(db: Tx, input: AuditInput) {
  await db.masterDataAudit.create({ data: { entityType: "supplier", ...input } });
}

// ─── Valores por defecto al activar el módulo ──────────────────────────────

/**
 * Siembra la v1 de cada plantilla, los tipos de documento sugeridos y los ajustes.
 * Idempotente: lo que ya existe (y puede haber sido editado) no se toca. Los ajustes son la marca de «hecho».
 */
export async function ensureSupplierDefaults(tenantId: string, db: PrismaClient = prisma): Promise<{ seeded: boolean }> {
  if (await db.supplierSettings.findUnique({ where: { tenantId }, select: { id: true } })) return { seeded: false };
  try {
    await db.$transaction(async (tx) => {
      for (const supplierType of SUPPLIER_TYPES) {
        if (await tx.supplierCriteriaTemplate.count({ where: { tenantId, supplierType } })) continue;
        await tx.supplierCriteriaTemplate.create({
          data: {
            tenantId,
            supplierType,
            version: 1,
            status: "published",
            ...DEFAULT_THRESHOLDS,
            changeNote: "Versión inicial sugerida",
            publishedAt: new Date(),
            criteria: { create: DEFAULT_CRITERIA[supplierType].map((c, i) => ({ tenantId, position: i + 1, ...c })) },
          },
        });
      }
      if ((await tx.supplierDocumentType.count({ where: { tenantId } })) === 0) {
        await tx.supplierDocumentType.createMany({
          data: DEFAULT_DOCUMENT_TYPES.map((t, position) => ({ tenantId, position, ...t })),
        });
      }
      await tx.supplierSettings.create({ data: { tenantId } });
    });
    return { seeded: true };
  } catch (error) {
    // Otra solicitud sembró al mismo tiempo.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { seeded: false };
    throw error;
  }
}

/** Periodicidad de la reevaluación y plazo de la evaluación inicial de la empresa (con los valores por defecto del SPEC). */
export async function getSupplierSchedule(
  tenantId: string,
  db: Tx = prisma,
): Promise<{ config: ReevaluationConfig; initialEvalDays: number }> {
  const s = await db.supplierSettings.findUnique({ where: { tenantId } });
  if (!s) return { config: DEFAULT_REEVALUATION, initialEvalDays: DEFAULT_INITIAL_EVAL_DAYS };
  return {
    config: { critical: s.reevalCriticalMonths, standard: s.reevalStandardMonths, conditional: s.reevalConditionalMonths },
    initialEvalDays: s.initialEvalDays,
  };
}

export async function getReevaluationConfig(tenantId: string, db: Tx = prisma): Promise<ReevaluationConfig> {
  return (await getSupplierSchedule(tenantId, db)).config;
}

// ─── Resumen desnormalizado ────────────────────────────────────────────────

/**
 * Único lugar que escribe las columnas de resumen del proveedor (estado, último puntaje, próxima
 * reevaluación, documentos faltantes y `attentionAt`). Se llama dentro de la transacción de cada
 * escritura relevante; recalcular desde cero siempre da lo mismo que la actualización incremental.
 */
export async function recomputeSupplierSummary(tenantId: string, supplierId: string, db: Tx = prisma, now: Date = new Date()) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw new SupplierError("Proveedor no encontrado");

  const [last, docTypes, schedule] = await Promise.all([
    db.supplierEvaluation.findFirst({
      where: { tenantId, supplierId, voidedAt: null },
      orderBy: [{ evaluatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, result: true, evaluatedAt: true, totalScore: true },
    }),
    db.supplierDocumentType.findMany({
      where: { tenantId, active: true, appliesTo: { has: supplier.type }, OR: [{ required: true }, { blocksEnablement: true }] },
      select: { id: true, required: true, blocksEnablement: true },
    }),
    getSupplierSchedule(tenantId, db),
  ]);
  const currentDocs = docTypes.length
    ? await db.supplierDocument.findMany({
        where: { tenantId, supplierId, voidedAt: null, typeId: { in: docTypes.map((t) => t.id) } },
        orderBy: { createdAt: "desc" },
        distinct: ["typeId"],
        select: { typeId: true, expiresAt: true },
      })
    : [];

  const summary = computeSupplierSummary({
    supplier,
    last: last && { ...last, totalScore: num(last.totalScore) },
    docTypes,
    currentDocs,
    config: schedule.config,
    today: buenosAiresToday(now),
  });
  const updated = await db.supplier.update({ where: { id: supplier.id }, data: { ...summary, lastScore: summary.lastScore } });
  await syncEvaluationDueItem(db, updated, schedule.initialEvalDays);
  await syncDocumentDueItems(db, updated);
  return updated;
}

/**
 * Un `DueItem` abierto por documento vigente con vencimiento (`supplier_document` / document.id).
 * El vigente de cada tipo es el último no anulado; los reemplazados, anulados o de un proveedor de baja se cierran.
 * También deja `supersededAt` al día. Idempotente: repetir no duplica.
 */
async function syncDocumentDueItems(
  db: Tx,
  supplier: { id: string; tenantId: string; legalName: string; ownerUserId: string | null; inactiveAt: Date | null },
) {
  const docs = await db.supplierDocument.findMany({
    where: { tenantId: supplier.tenantId, supplierId: supplier.id },
    select: { id: true, typeId: true, expiresAt: true, voidedAt: true, supersededAt: true, type: { select: { name: true, recurrence: true, active: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  if (docs.length === 0) return;

  const seen = new Set<string>();
  const current: typeof docs = [];
  const retired: string[] = [];
  const stillCurrent: string[] = [];
  const supersede: string[] = [];
  for (const doc of docs) {
    const isCurrent = !doc.voidedAt && !seen.has(doc.typeId);
    if (!doc.voidedAt) seen.add(doc.typeId);
    if (isCurrent && doc.expiresAt && doc.type.active && !supplier.inactiveAt) current.push(doc);
    else retired.push(doc.id);
    if (isCurrent && doc.supersededAt) stillCurrent.push(doc.id);
    if (!isCurrent && !doc.voidedAt && !doc.supersededAt) supersede.push(doc.id);
  }

  await db.dueItem.updateMany({
    where: { tenantId: supplier.tenantId, entityType: SUPPLIER_DOCUMENT_ENTITY, entityId: { in: retired }, status: "open" },
    data: { status: "closed" },
  });
  if (stillCurrent.length) await db.supplierDocument.updateMany({ where: { id: { in: stillCurrent } }, data: { supersededAt: null } });
  if (supersede.length) await db.supplierDocument.updateMany({ where: { id: { in: supersede } }, data: { supersededAt: new Date() } });
  if (current.length === 0) return;

  const siteId = await singleSupplierSiteId(supplier.tenantId, supplier.id, db);
  for (const doc of current) {
    await ensureOpenDueItem(
      db,
      {
        tenantId: supplier.tenantId,
        entityType: SUPPLIER_DOCUMENT_ENTITY,
        entityId: doc.id,
        title: `Vence «${doc.type.name}» de ${supplier.legalName}`,
        dueAt: doc.expiresAt!,
        leadDays: doc.type.recurrence === "monthly" ? 7 : 30,
        ownerUserId: supplier.ownerUserId,
        siteId,
      },
      asClient(db),
    );
  }
}

/** Las funciones de automatización tipan `PrismaClient`; en una transacción usan los mismos delegados. */
export const asClient = (db: Tx | PrismaClient) => db as unknown as PrismaClient;

export const SUPPLIER_EVALUATION_ENTITY = "supplier_evaluation";
export const SUPPLIER_DOCUMENT_ENTITY = "supplier_document";
const REEVALUATION_LEAD_DAYS = 30;
const INITIAL_EVALUATION_LEAD_DAYS = 7;

/** `siteId` del vencimiento: la sede del proveedor solo si atiende exactamente una. */
export async function singleSupplierSiteId(tenantId: string, supplierId: string, db: Tx): Promise<string | null> {
  const sites = await db.supplierSite.findMany({ where: { tenantId, supplierId }, select: { siteId: true }, take: 2 });
  return sites.length === 1 ? sites[0].siteId : null;
}

/**
 * Deja un único `DueItem` abierto para la entidad. Si ya existe uno idéntico no lo toca (actualizarlo
 * borraría el registro de avisos ya enviados); si cambió algo, lo actualiza; si no existe, lo crea.
 */
async function ensureOpenDueItem(db: Tx, input: CreateDueItemInput & { entityId: string }, client: PrismaClient) {
  const existing = await db.dueItem.findFirst({
    where: { tenantId: input.tenantId, entityType: input.entityType, entityId: input.entityId, status: "open" },
  });
  if (
    existing &&
    existing.dueAt.getTime() === input.dueAt.getTime() &&
    existing.title === input.title.trim() &&
    existing.leadDays === (input.leadDays ?? existing.leadDays) &&
    existing.ownerUserId === (input.ownerUserId ?? null) &&
    existing.siteId === (input.siteId ?? null)
  ) {
    return existing;
  }
  return upsertOpenDueItemForEntity(input, client);
}

/**
 * Un único `DueItem` abierto de evaluación por proveedor (`supplier_evaluation` / supplier.id):
 * - sin evaluar (crítico y estándar): la evaluación inicial pendiente, alta + N días, aviso 7 días antes;
 * - evaluado: la reevaluación en la fecha vigente, aviso 30 días antes;
 * - no aprobado, bajo impacto, de baja: ninguno (se cierra el abierto).
 * Se actualiza con la fecha vigente o se cierra si ya no corresponde. Repetir no duplica.
 */
async function syncEvaluationDueItem(
  db: Tx,
  supplier: {
    id: string;
    tenantId: string;
    legalName: string;
    status: SupplierStatusValue;
    criticality: SupplierCriticalityValue;
    createdAt: Date;
    nextEvaluationDueAt: Date | null;
    ownerUserId: string | null;
  },
  initialEvalDays: number,
) {
  const key = { tenantId: supplier.tenantId, entityType: SUPPLIER_EVALUATION_ENTITY, entityId: supplier.id };
  const initialDue = initialEvaluationDue({
    status: supplier.status,
    criticality: supplier.criticality,
    createdDay: buenosAiresToday(supplier.createdAt),
    initialEvalDays,
  });
  const dueAt = supplier.status === "inactive" ? null : (supplier.nextEvaluationDueAt ?? initialDue);
  if (!dueAt) {
    await closeDueItemsForEntity(key, asClient(db));
    return;
  }
  const isInitial = !supplier.nextEvaluationDueAt;
  await ensureOpenDueItem(
    db,
    {
      ...key,
      title: isInitial ? `Evaluar proveedor nuevo: ${supplier.legalName}` : `Reevaluar proveedor: ${supplier.legalName}`,
      dueAt,
      leadDays: isInitial ? INITIAL_EVALUATION_LEAD_DAYS : REEVALUATION_LEAD_DAYS,
      ownerUserId: supplier.ownerUserId,
      siteId: await singleSupplierSiteId(supplier.tenantId, supplier.id, db),
    },
    asClient(db),
  );
}

// ─── Alta, edición y baja ──────────────────────────────────────────────────

export type SupplierInput = {
  legalName: string;
  tradeName?: string | null;
  taxId?: string | null;
  type: SupplierTypeValue;
  category?: string | null;
  criticality: SupplierCriticalityValue;
  criticalityReason?: string | null;
  ownerUserId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  /** Sedes a las que atiende. Vacío = todas. */
  siteIds?: string[];
};

const blank = (value: string | null | undefined) => cleanName(value ?? "") || null;

async function prepareSupplier(tenantId: string, input: SupplierInput, db: Tx) {
  const legalName = cleanName(input.legalName);
  if (legalName.length < 2) throw new SupplierError("La razón social debe tener al menos 2 caracteres");

  let taxId: string | null = null;
  if (input.taxId && input.taxId.trim()) {
    const check = isValidCuit(input.taxId);
    if (!check.valid) throw new SupplierError(CUIT_ERROR_MESSAGES[check.reason]);
    taxId = check.value;
  }
  if (!SUPPLIER_TYPES.includes(input.type)) throw new SupplierError("Elegí el tipo de proveedor");
  if (!SUPPLIER_CRITICALITIES.includes(input.criticality)) throw new SupplierError("Elegí la criticidad");
  const criticalityReason = blank(input.criticalityReason);
  if (input.criticality !== "standard" && !criticalityReason) {
    throw new SupplierError("Escribí el motivo de la criticidad: es obligatorio para proveedores críticos y de bajo impacto");
  }
  const contactEmail = input.contactEmail?.trim() || null;
  if (contactEmail && !EMAIL.test(contactEmail)) throw new SupplierError("El email de contacto no es válido");

  const ownerUserId = input.ownerUserId || null;
  if (ownerUserId && !(await db.membership.count({ where: { tenantId, userId: ownerUserId } }))) {
    throw new SupplierError("El responsable no es integrante de la empresa");
  }
  const siteIds = [...new Set(input.siteIds ?? [])];
  if (siteIds.length && (await db.site.count({ where: { tenantId, active: true, id: { in: siteIds } } })) !== siteIds.length) {
    throw new SupplierError("Alguna sede no existe o está dada de baja");
  }

  return {
    siteIds,
    data: {
      legalName,
      tradeName: blank(input.tradeName),
      taxId,
      type: input.type,
      category: blank(input.category),
      criticality: input.criticality,
      criticalityReason,
      ownerUserId,
      contactName: blank(input.contactName),
      contactEmail,
      contactPhone: blank(input.contactPhone),
      notes: input.notes?.trim() || null,
    },
  };
}

async function translateUnique(error: unknown): Promise<never> {
  // Carrera entre dos altas con el mismo CUIT: la restricción única de la base es la última defensa.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new SupplierError("Ya hay un proveedor con ese CUIT en la empresa");
  }
  throw error;
}

async function assertTaxIdFree(tenantId: string, taxId: string | null, exceptId: string | undefined, db: Tx) {
  if (!taxId) return;
  const found = await db.supplier.findFirst({
    where: { tenantId, taxId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { legalName: true },
  });
  if (found) throw new SupplierError(`Ya hay un proveedor con el CUIT ${formatCuit(taxId)}: «${found.legalName}»`);
}

export async function createSupplier(input: SupplierInput & { tenantId: string; actorUserId: string }, db: PrismaClient = prisma) {
  await ensureSupplierDefaults(input.tenantId, db);
  try {
    return await db.$transaction(async (tx) => {
      const { data, siteIds } = await prepareSupplier(input.tenantId, input, tx);
      await assertTaxIdFree(input.tenantId, data.taxId, undefined, tx);
      const created = await tx.supplier.create({
        data: {
          ...data,
          tenantId: input.tenantId,
          createdByUserId: input.actorUserId,
          sites: { create: siteIds.map((siteId) => ({ siteId, tenantId: input.tenantId })) },
        },
      });
      const supplier = await recomputeSupplierSummary(input.tenantId, created.id, tx);
      await audit(tx, { tenantId: input.tenantId, entityId: supplier.id, action: "create", actorUserId: input.actorUserId, summary: `Alta de proveedor «${supplier.legalName}» (${SUPPLIER_TYPE_LABELS[supplier.type]})` });
      return supplier;
    });
  } catch (error) {
    return translateUnique(error);
  }
}

type TrackedKey =
  | "legalName" | "tradeName" | "taxId" | "type" | "category" | "criticality"
  | "criticalityReason" | "ownerUserId" | "contactName" | "contactEmail" | "contactPhone" | "notes";

const TRACKED: { key: TrackedKey; label: string }[] = [
  { key: "legalName", label: "razón social" },
  { key: "taxId", label: "CUIT" },
  { key: "type", label: "tipo" },
  { key: "category", label: "rubro" },
  { key: "criticality", label: "criticidad" },
  { key: "criticalityReason", label: "motivo de la criticidad" },
  { key: "ownerUserId", label: "responsable" },
  { key: "contactName", label: "contacto" },
  { key: "contactEmail", label: "email" },
  { key: "contactPhone", label: "teléfono" },
  { key: "notes", label: "notas" },
  { key: "tradeName", label: "nombre de fantasía" },
];
export async function updateSupplier(input: SupplierInput & { tenantId: string; actorUserId: string; id: string }, db: PrismaClient = prisma) {
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.supplier.findFirst({ where: { id: input.id, tenantId: input.tenantId }, include: { sites: true } });
      if (!current) throw new SupplierError("Proveedor no encontrado");
      const { data, siteIds } = await prepareSupplier(input.tenantId, input, tx);
      await assertTaxIdFree(input.tenantId, data.taxId, current.id, tx);

      const changed = TRACKED.filter((t) => (current[t.key] ?? null) !== (data[t.key] ?? null)).map((t) => t.label);
      const before = new Set(current.sites.map((s) => s.siteId));
      if (before.size !== siteIds.length || siteIds.some((id) => !before.has(id))) changed.push("sedes");

      await tx.supplierSite.deleteMany({ where: { supplierId: current.id } });
      await tx.supplier.update({
        where: { id: current.id },
        data: { ...data, sites: { create: siteIds.map((siteId) => ({ siteId, tenantId: input.tenantId })) } },
      });
      // Cambiar el tipo o la criticidad cambia los documentos exigidos y la próxima reevaluación.
      const supplier = await recomputeSupplierSummary(input.tenantId, current.id, tx);
      await audit(tx, {
        tenantId: input.tenantId,
        entityId: supplier.id,
        action: "update",
        actorUserId: input.actorUserId,
        summary: `Edición de proveedor «${supplier.legalName}»${changed.length ? `: cambió ${changed.join(", ")}` : ""}`,
      });
      return supplier;
    });
  } catch (error) {
    return translateUnique(error);
  }
}

export async function deactivateSupplier(
  input: { tenantId: string; actorUserId: string; id: string; reason: string },
  db: PrismaClient = prisma,
) {
  const reason = cleanName(input.reason);
  if (reason.length < 3) throw new SupplierError("Escribí el motivo de la baja");
  await db.$transaction(async (tx) => {
    const current = await tx.supplier.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
    if (!current) throw new SupplierError("Proveedor no encontrado");
    await tx.supplier.update({ where: { id: current.id }, data: { inactiveAt: new Date(), inactiveReason: reason } });
    await recomputeSupplierSummary(input.tenantId, current.id, tx);
    await audit(tx, { tenantId: input.tenantId, entityId: current.id, action: "deactivate", actorUserId: input.actorUserId, summary: `Baja de proveedor «${current.legalName}»: ${reason}` });
  });
}

export async function reactivateSupplier(input: { tenantId: string; actorUserId: string; id: string }, db: PrismaClient = prisma) {
  await db.$transaction(async (tx) => {
    const current = await tx.supplier.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
    if (!current) throw new SupplierError("Proveedor no encontrado");
    await tx.supplier.update({ where: { id: current.id }, data: { inactiveAt: null, inactiveReason: null } });
    await recomputeSupplierSummary(input.tenantId, current.id, tx);
    await audit(tx, { tenantId: input.tenantId, entityId: current.id, action: "reactivate", actorUserId: input.actorUserId, summary: `Reactivación de proveedor «${current.legalName}»` });
  });
}

// ─── Lectura: lista, conteos y ficha ───────────────────────────────────────

export type SupplierView = "attention" | "red" | "amber" | "unrated" | "approved" | "all";

export type SupplierFilters = {
  view?: SupplierView;
  status?: SupplierStatusValue;
  criticality?: SupplierCriticalityValue;
  type?: SupplierTypeValue;
  category?: string;
  siteId?: string;
  /** Aprobados o condicionales con documentación bloqueante vencida o faltante. */
  notEnabled?: boolean;
  q?: string;
};

const ACTIVE_STATUSES: SupplierStatusValue[] = ["approved", "conditional"];

/** Espejo en SQL de `supplierSemaphore` e `isEnabled`: un test compara ambos. */
export function supplierViewWhere(view: SupplierView, today: Date): Prisma.SupplierWhereInput {
  const end = windowEnd(today, DEFAULT_WARN_DAYS);
  const active = { status: { in: ACTIVE_STATUSES } };
  const red: Prisma.SupplierWhereInput = { OR: [{ status: "not_approved" }, { ...active, attentionAt: { lt: today } }] };
  const amber: Prisma.SupplierWhereInput = {
    AND: [
      active,
      { OR: [{ attentionAt: null }, { attentionAt: { gte: today } }] },
      { OR: [{ attentionAt: { lte: end } }, { missingRequiredDocs: { gt: 0 } }, { status: "conditional" }] },
    ],
  };
  switch (view) {
    case "red":
      return red;
    case "amber":
      return amber;
    case "attention":
      return { OR: [red, amber] };
    case "unrated":
      return { status: "potential" };
    case "approved":
      return enabledWhere(today);
    default:
      return {};
  }
}

function enabledWhere(today: Date): Prisma.SupplierWhereInput {
  return {
    status: { in: ACTIVE_STATUSES },
    missingBlockingDocs: 0,
    OR: [{ blockingDocExpiresAt: null }, { blockingDocExpiresAt: { gte: today } }],
  };
}

export function supplierListWhere(tenantId: string, filters: SupplierFilters, today: Date): Prisma.SupplierWhereInput {
  const q = filters.q?.trim();
  const digits = q?.replace(/\D/g, "");
  const and: Prisma.SupplierWhereInput[] = [supplierViewWhere(filters.view ?? "all", today)];
  if (filters.status) and.push({ status: filters.status });
  if (filters.criticality) and.push({ criticality: filters.criticality });
  if (filters.type) and.push({ type: filters.type });
  if (filters.category) and.push({ category: { equals: filters.category, mode: "insensitive" } });
  // Sin sedes cargadas = atiende todas.
  if (filters.siteId) and.push({ OR: [{ sites: { none: {} } }, { sites: { some: { siteId: filters.siteId } } }] });
  if (filters.notEnabled) {
    and.push({ status: { in: ACTIVE_STATUSES }, OR: [{ missingBlockingDocs: { gt: 0 } }, { blockingDocExpiresAt: { lt: today } }] });
  }
  if (q) {
    and.push({
      OR: [
        { legalName: { contains: q, mode: "insensitive" } },
        { tradeName: { contains: q, mode: "insensitive" } },
        ...(digits && digits.length >= 3 ? [{ taxId: { contains: digits } }] : []),
      ],
    });
  }
  return { tenantId, AND: and };
}

const listSelect = {
  id: true,
  legalName: true,
  tradeName: true,
  taxId: true,
  type: true,
  category: true,
  criticality: true,
  status: true,
  lastScore: true,
  lastEvaluatedAt: true,
  nextEvaluationDueAt: true,
  blockingDocExpiresAt: true,
  missingRequiredDocs: true,
  missingBlockingDocs: true,
  attentionAt: true,
} satisfies Prisma.SupplierSelect;

export type SupplierListItem = Omit<Prisma.SupplierGetPayload<{ select: typeof listSelect }>, "lastScore"> & { lastScore: number | null };

/** Página de la lista, paginada en el servidor. Lo más urgente primero (los sin fecha al final). */
export async function listSuppliers(
  tenantId: string,
  filters: SupplierFilters = {},
  page = 1,
  now: Date = new Date(),
  db: Tx = prisma,
) {
  const today = buenosAiresToday(now);
  const where = supplierListWhere(tenantId, filters, today);
  const total = await db.supplier.count({ where });
  const pages = Math.max(1, Math.ceil(total / SUPPLIER_PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const rows = await db.supplier.findMany({
    where,
    select: listSelect,
    orderBy:
      filters.view === "approved"
        ? [{ legalName: "asc" }]
        : [{ attentionAt: { sort: "asc", nulls: "last" } }, { legalName: "asc" }],
    skip: (current - 1) * SUPPLIER_PAGE_SIZE,
    take: SUPPLIER_PAGE_SIZE,
  });
  const items: SupplierListItem[] = rows.map((r) => ({ ...r, lastScore: num(r.lastScore) }));
  return { items, total, page: current, pages, pageSize: SUPPLIER_PAGE_SIZE };
}

export type SupplierCounts = { red: number; amber: number; unrated: number; approved: number; total: number };

/** Los números de la franja superior: todo contado en la base. */
export async function getSupplierCounts(tenantId: string, now: Date = new Date(), db: Tx = prisma): Promise<SupplierCounts> {
  const today = buenosAiresToday(now);
  const count = (view: SupplierView) => db.supplier.count({ where: { tenantId, ...supplierViewWhere(view, today) } });
  const [red, amber, unrated, approved, total] = await Promise.all([
    count("red"),
    count("amber"),
    count("unrated"),
    count("approved"),
    db.supplier.count({ where: { tenantId } }),
  ]);
  return { red, amber, unrated, approved, total };
}

export async function listSupplierCategories(tenantId: string, db: Tx = prisma): Promise<string[]> {
  const rows = await db.supplier.groupBy({
    by: ["category"],
    where: { tenantId, category: { not: null } },
    orderBy: { category: "asc" },
    take: 100,
  });
  return rows.map((r) => r.category!).filter(Boolean);
}

export async function getSupplier(tenantId: string, id: string, db: Tx = prisma) {
  const supplier = await db.supplier.findFirst({
    where: { id, tenantId },
    include: { sites: { include: { site: { select: { id: true, name: true } } } } },
  });
  if (!supplier) return null;
  const owner = supplier.ownerUserId
    ? await db.user.findFirst({
        where: { id: supplier.ownerUserId, memberships: { some: { tenantId } } },
        select: { id: true, name: true },
      })
    : null;
  return { ...supplier, lastScore: num(supplier.lastScore), owner, siteList: supplier.sites.map((s) => s.site) };
}

// ─── Personas del contratista ──────────────────────────────────────────────

export async function listSupplierPeople(tenantId: string, supplierId: string, db: Tx = prisma) {
  return db.person.findMany({
    where: { tenantId, supplierId },
    select: { id: true, name: true, employeeCode: true, status: true, position: { select: { name: true } }, site: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });
}

/** Personas de contratistas todavía sin vincular, para ofrecer en la ficha. Las que ya figuran con el nombre del contratista van primero. */
export async function searchLinkablePeople(
  tenantId: string,
  supplierId: string,
  opts: { q?: string; take?: number } = {},
  db: Tx = prisma,
) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, tenantId }, select: { legalName: true } });
  if (!supplier) return [];
  const q = opts.q?.trim();
  const people = await db.person.findMany({
    where: {
      tenantId,
      employer: "contractor",
      status: "active",
      supplierId: null,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { employeeCode: { contains: q, mode: "insensitive" } }, { contractorName: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: { id: true, name: true, employeeCode: true, contractorName: true },
    orderBy: { name: "asc" },
    take: Math.min(opts.take ?? 30, 50),
  });
  const key = normalizeKey(supplier.legalName);
  return people
    .map((p) => ({ ...p, sameName: p.contractorName ? normalizeKey(p.contractorName) === key : false }))
    .sort((a, b) => Number(b.sameName) - Number(a.sameName));
}

export async function linkPersonToSupplier(
  input: { tenantId: string; actorUserId: string; supplierId: string; personId: string },
  db: PrismaClient = prisma,
) {
  await db.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId } });
    if (!supplier) throw new SupplierError("Proveedor no encontrado");
    if (supplier.type !== "contractor") throw new SupplierError("Solo se vinculan personas a proveedores de tipo contratista");
    const person = await tx.person.findFirst({ where: { id: input.personId, tenantId: input.tenantId } });
    if (!person) throw new SupplierError("Persona no encontrada");
    if (person.employer !== "contractor") throw new SupplierError("Solo se vinculan personas cargadas como de contratista");
    await tx.person.update({ where: { id: person.id }, data: { supplierId: supplier.id } });
    await audit(tx, { tenantId: input.tenantId, entityId: supplier.id, action: "link_person", actorUserId: input.actorUserId, summary: `Se vinculó a ${person.name} (${person.employeeCode}) con «${supplier.legalName}»` });
  });
}

export async function unlinkPersonFromSupplier(
  input: { tenantId: string; actorUserId: string; supplierId: string; personId: string },
  db: PrismaClient = prisma,
) {
  await db.$transaction(async (tx) => {
    const person = await tx.person.findFirst({ where: { id: input.personId, tenantId: input.tenantId, supplierId: input.supplierId } });
    if (!person) throw new SupplierError("La persona no está vinculada a este proveedor");
    await tx.person.update({ where: { id: person.id }, data: { supplierId: null } });
    await audit(tx, { tenantId: input.tenantId, entityId: input.supplierId, action: "unlink_person", actorUserId: input.actorUserId, summary: `Se desvinculó a ${person.name} (${person.employeeCode})` });
  });
}

// ─── Importación CSV ───────────────────────────────────────────────────────

export type SupplierImportPreview = {
  plan: SupplierImportPlan;
  /** Errores de formato por fila (esas filas no se importan). */
  errors: SupplierCsvError[];
  /** Filas válidas, ya sin las que apuntan a un responsable que no es de la empresa. */
  totalRows: number;
};

async function loadImportContext(tenantId: string, db: Tx) {
  const [existing, members] = await Promise.all([
    db.supplier.findMany({ where: { tenantId }, select: { taxId: true, legalName: true } }),
    db.membership.findMany({ where: { tenantId }, select: { user: { select: { id: true, email: true } } } }),
  ]);
  return { existing, ownerByEmail: new Map(members.map((m) => [m.user.email.toLowerCase(), m.user.id])) };
}

function resolveOwners(rows: SupplierCsvRow[], ownerByEmail: Map<string, string>) {
  const valid: SupplierCsvRow[] = [];
  const errors: SupplierCsvError[] = [];
  for (const row of rows) {
    if (row.ownerEmail && !ownerByEmail.has(row.ownerEmail)) {
      errors.push({ line: row.line, field: "responsable", message: `${row.ownerEmail} no es usuario de la empresa` });
    } else {
      valid.push(row);
    }
  }
  return { valid, errors };
}

export async function previewSupplierImport(tenantId: string, csv: string, db: Tx = prisma): Promise<SupplierImportPreview> {
  const parsed = parseSupplierCsv(csv);
  const ctx = await loadImportContext(tenantId, db);
  const owners = resolveOwners(parsed.rows, ctx.ownerByEmail);
  const errors = [...parsed.errors, ...owners.errors].sort((a, b) => a.line - b.line);
  return { plan: planSupplierImport(owners.valid, ctx.existing), errors, totalRows: parsed.rows.length + parsed.errors.length };
}

/**
 * Aplica la importación: vuelve a calcular el plan en el servidor (no confía en la vista previa).
 * Todos entran como «sin evaluar» —nunca se aprueba al importar— y lo que ya existe no se toca.
 */
export async function applySupplierImport(
  input: { tenantId: string; actorUserId: string; csv: string },
  db: PrismaClient = prisma,
) {
  await ensureSupplierDefaults(input.tenantId, db);
  const preview = await previewSupplierImport(input.tenantId, input.csv, db);
  const toCreate = preview.plan.items.filter((i) => i.action === "create").map((i) => i.row);
  if (toCreate.length === 0) return { created: 0, existing: preview.plan.counts.exists, errors: preview.errors.length };

  const ctx = await loadImportContext(input.tenantId, db);
  await db.$transaction(
    async (tx) => {
      // Un proveedor nuevo no tiene documentos: los faltantes salen de los tipos activos, sin recalcular uno por uno.
      const docTypes = await tx.supplierDocumentType.findMany({
        where: { tenantId: input.tenantId, active: true, OR: [{ required: true }, { blocksEnablement: true }] },
        select: { appliesTo: true, required: true, blocksEnablement: true },
      });
      const missing = (type: SupplierTypeValue) => {
        const applicable = docTypes.filter((t) => t.appliesTo.includes(type));
        return {
          missingRequiredDocs: applicable.filter((t) => t.required).length,
          missingBlockingDocs: applicable.filter((t) => t.blocksEnablement).length,
        };
      };
      const { initialEvalDays } = await getSupplierSchedule(input.tenantId, tx);
      const createdDay = buenosAiresToday(new Date());
      const rows = toCreate.map((row) => ({ id: randomUUID(), row }));
      await tx.supplier.createMany({
        data: rows.map(({ id, row }) => ({
          id,
          tenantId: input.tenantId,
          legalName: row.legalName,
          tradeName: row.tradeName,
          taxId: row.taxId,
          type: row.type,
          category: row.category,
          criticality: row.criticality,
          criticalityReason: row.criticalityReason,
          ownerUserId: row.ownerEmail ? (ctx.ownerByEmail.get(row.ownerEmail) ?? null) : null,
          contactName: row.contactName,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          notes: row.notes,
          status: "potential" as const,
          createdByUserId: input.actorUserId,
          ...missing(row.type),
        })),
      });
      // La evaluación inicial pendiente de los críticos y estándar, en lote (el mismo `DueItem` que deja `recomputeSupplierSummary`).
      const dueAt = initialEvaluationDue({ status: "potential", criticality: "standard", createdDay, initialEvalDays });
      const pending = rows.filter(({ row }) => row.criticality !== "low");
      if (dueAt && pending.length) {
        await tx.dueItem.createMany({
          data: pending.map(({ id, row }) => ({
            tenantId: input.tenantId,
            title: `Evaluar proveedor nuevo: ${row.legalName}`,
            entityType: SUPPLIER_EVALUATION_ENTITY,
            entityId: id,
            dueAt,
            leadDays: INITIAL_EVALUATION_LEAD_DAYS,
            remindAt: reminderStartsAt(dueAt, INITIAL_EVALUATION_LEAD_DAYS),
            ownerUserId: row.ownerEmail ? (ctx.ownerByEmail.get(row.ownerEmail) ?? null) : null,
          })),
        });
      }
      await audit(tx, {
        tenantId: input.tenantId,
        entityId: "import",
        action: "import",
        actorUserId: input.actorUserId,
        summary: `Importación de proveedores: ${toCreate.length} nuevos, ${preview.plan.counts.exists} ya existentes, ${preview.errors.length} con error`,
      });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return { created: toCreate.length, existing: preview.plan.counts.exists, errors: preview.errors.length };
}

// ─── Lista de aprobados ────────────────────────────────────────────────────

/** Aprobados y condicionales habilitados al momento `now`, por razón social. Solo trae las columnas necesarias. */
export async function getApprovedList(tenantId: string, now: Date = new Date(), db: Tx = prisma): Promise<ApprovedList> {
  const rows = await db.supplier.findMany({
    where: { tenantId, status: { in: ACTIVE_STATUSES } },
    select: {
      id: true, legalName: true, taxId: true, type: true, category: true, criticality: true, status: true,
      lastScore: true, nextEvaluationDueAt: true, missingBlockingDocs: true, blockingDocExpiresAt: true,
    },
    orderBy: { legalName: "asc" },
  });
  const list = buildApprovedList(rows.map((r) => ({ ...r, lastScore: num(r.lastScore) })), buenosAiresToday(now));
  return { ...list, generatedAt: now };
}

export async function recordApprovedListExport(
  input: { tenantId: string; actorUserId: string; count: number; excluded: number; format: "csv" | "print" },
  db: Tx = prisma,
) {
  await audit(db, {
    tenantId: input.tenantId,
    entityId: "approved-list",
    action: "export",
    actorUserId: input.actorUserId,
    summary: `Se generó la lista de aprobados (${input.format === "csv" ? "CSV" : "vista imprimible"}): ${input.count} proveedores, ${input.excluded} fuera por documentación`,
  });
}
