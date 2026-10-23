import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cleanName, normalizeKey } from "@/domain/masterdata/roster";
import { validateTemplateForPublish, type TemplateCriterionInput } from "@/domain/suppliers/templates";
import {
  CRITERION_PHASES,
  DOCUMENT_RECURRENCES,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
  type DocumentRecurrenceValue,
  type SupplierTypeValue,
} from "@/domain/suppliers/types";
import { SupplierError, audit, recomputeSupplierSummary } from "@/lib/suppliers";

type Tx = Prisma.TransactionClient;

// ─── Plantillas de criterios con versiones ─────────────────────────────────

const templateInclude = { criteria: { orderBy: { position: "asc" } } } satisfies Prisma.SupplierCriteriaTemplateInclude;
export type TemplateWithCriteria = Prisma.SupplierCriteriaTemplateGetPayload<{ include: typeof templateInclude }>;

/** Todas las versiones de un tipo, la más nueva primero. Son pocas por tipo: se traen enteras con sus criterios. */
export async function listTemplateVersions(tenantId: string, supplierType: SupplierTypeValue, db: Tx = prisma): Promise<TemplateWithCriteria[]> {
  return db.supplierCriteriaTemplate.findMany({
    where: { tenantId, supplierType },
    include: templateInclude,
    orderBy: { version: "desc" },
    take: 50,
  });
}

export async function getPublishedTemplate(tenantId: string, supplierType: SupplierTypeValue, db: Tx = prisma): Promise<TemplateWithCriteria | null> {
  return db.supplierCriteriaTemplate.findFirst({ where: { tenantId, supplierType, status: "published" }, include: templateInclude });
}

/** Crea el borrador de la próxima versión a partir de la vigente (o devuelve el borrador que ya existe). */
export async function startTemplateDraft(
  input: { tenantId: string; actorUserId: string; supplierType: SupplierTypeValue },
  db: PrismaClient = prisma,
): Promise<TemplateWithCriteria> {
  if (!SUPPLIER_TYPES.includes(input.supplierType)) throw new SupplierError("Tipo de proveedor inválido");
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.supplierCriteriaTemplate.findFirst({
        where: { tenantId: input.tenantId, supplierType: input.supplierType, status: "draft" },
        include: templateInclude,
      });
      if (existing) return existing;
      // Se parte de la vigente; si no hay (se retiró), de la última versión.
      const base = await tx.supplierCriteriaTemplate.findFirst({
        where: { tenantId: input.tenantId, supplierType: input.supplierType },
        include: templateInclude,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { version: "desc" }],
      });
      const max = await tx.supplierCriteriaTemplate.aggregate({
        where: { tenantId: input.tenantId, supplierType: input.supplierType },
        _max: { version: true },
      });
      const draft = await tx.supplierCriteriaTemplate.create({
        data: {
          tenantId: input.tenantId,
          supplierType: input.supplierType,
          version: (max._max.version ?? 0) + 1,
          status: "draft",
          approvedMin: base?.approvedMin ?? 80,
          conditionalMin: base?.conditionalMin ?? 60,
          createdByUserId: input.actorUserId,
          criteria: {
            create: (base?.criteria ?? []).map((c) => ({
              tenantId: input.tenantId,
              position: c.position,
              name: c.name,
              description: c.description,
              descriptor1: c.descriptor1,
              descriptor3: c.descriptor3,
              descriptor5: c.descriptor5,
              weight: c.weight,
              excluding: c.excluding,
              allowNA: c.allowNA,
              phase: c.phase,
              basic: c.basic,
            })),
          },
        },
        include: templateInclude,
      });
      return draft;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SupplierError("Otra persona está creando el borrador. Recargá la página.");
    }
    throw error;
  }
}

export type TemplateDraftInput = {
  approvedMin: number;
  conditionalMin: number;
  changeNote: string;
  criteria: TemplateCriterionInput[];
};

function cleanCriteria(criteria: readonly TemplateCriterionInput[]): TemplateCriterionInput[] {
  return criteria.map((c) => {
    const name = cleanName(c.name);
    if (!name) throw new SupplierError("Todos los criterios necesitan un nombre");
    if (!Number.isInteger(c.weight) || c.weight <= 0 || c.weight > 100) {
      throw new SupplierError(`El peso de «${name}» tiene que ser un número entero entre 1 y 100`);
    }
    if (!CRITERION_PHASES.includes(c.phase)) throw new SupplierError(`La fase de «${name}» no es válida`);
    return {
      name,
      description: c.description.trim(),
      descriptor1: c.descriptor1.trim(),
      descriptor3: c.descriptor3.trim(),
      descriptor5: c.descriptor5.trim(),
      weight: c.weight,
      excluding: c.excluding,
      // Un excluyente nunca admite «No aplica»: se corrige acá y además se rechaza al publicar.
      allowNA: c.excluding ? false : c.allowNA,
      phase: c.phase,
      basic: c.basic,
    };
  });
}

async function loadDraft(tenantId: string, templateId: string, db: Tx) {
  const template = await db.supplierCriteriaTemplate.findFirst({ where: { id: templateId, tenantId }, include: templateInclude });
  if (!template) throw new SupplierError("Plantilla no encontrada");
  if (template.status !== "draft") throw new SupplierError("Solo se edita un borrador: una versión publicada no se modifica");
  return template;
}

export async function saveTemplateDraft(
  input: { tenantId: string; actorUserId: string; templateId: string } & TemplateDraftInput,
  db: PrismaClient = prisma,
) {
  const criteria = cleanCriteria(input.criteria);
  if (!Number.isInteger(input.approvedMin) || !Number.isInteger(input.conditionalMin) || input.conditionalMin < 0 || input.approvedMin > 100 || input.conditionalMin > input.approvedMin) {
    throw new SupplierError("El umbral de «con condiciones» no puede superar al de «aprobado», y ninguno puede pasar de 100");
  }
  await db.$transaction(async (tx) => {
    const draft = await loadDraft(input.tenantId, input.templateId, tx);
    await tx.supplierCriterion.deleteMany({ where: { templateId: draft.id, tenantId: input.tenantId } });
    await tx.supplierCriterion.createMany({
      data: criteria.map((c, i) => ({ ...c, tenantId: input.tenantId, templateId: draft.id, position: i + 1 })),
    });
    await tx.supplierCriteriaTemplate.update({
      where: { id: draft.id },
      data: { approvedMin: input.approvedMin, conditionalMin: input.conditionalMin, changeNote: input.changeNote.trim() || null },
    });
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: draft.id,
      action: "save_template",
      actorUserId: input.actorUserId,
      summary: `Se guardó el borrador v${draft.version} de criterios de ${SUPPLIER_TYPE_LABELS[draft.supplierType].toLowerCase()}`,
    });
  });
}

/** Publica el borrador: valida, retira la versión vigente y lo vuelve vigente. Las evaluaciones pasadas no se tocan. */
export async function publishTemplateDraft(
  input: { tenantId: string; actorUserId: string; templateId: string },
  db: PrismaClient = prisma,
) {
  try {
    return await db.$transaction(async (tx) => {
      const draft = await loadDraft(input.tenantId, input.templateId, tx);
      const check = validateTemplateForPublish({ approvedMin: draft.approvedMin, conditionalMin: draft.conditionalMin, criteria: draft.criteria });
      if (!check.ok) throw new SupplierError(check.errors.map((e) => e.message).join(". "));
      const hasPrevious = await tx.supplierCriteriaTemplate.count({
        where: { tenantId: input.tenantId, supplierType: draft.supplierType, status: { in: ["published", "retired"] } },
      });
      if (hasPrevious > 0 && !draft.changeNote?.trim()) throw new SupplierError("Contá qué cambió en esta versión: queda como respaldo ante una auditoría");

      await tx.supplierCriteriaTemplate.updateMany({
        where: { tenantId: input.tenantId, supplierType: draft.supplierType, status: "published" },
        data: { status: "retired" },
      });
      const published = await tx.supplierCriteriaTemplate.update({
        where: { id: draft.id },
        data: { status: "published", publishedAt: new Date(), publishedByUserId: input.actorUserId },
      });
      await audit(tx, {
        tenantId: input.tenantId,
        entityId: draft.id,
        action: "publish_template",
        actorUserId: input.actorUserId,
        summary: `Se publicó la v${draft.version} de criterios de ${SUPPLIER_TYPE_LABELS[draft.supplierType].toLowerCase()}`,
      });
      return published;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SupplierError("Otra persona publicó una versión al mismo tiempo. Recargá la página.");
    }
    throw error;
  }
}

export async function discardTemplateDraft(input: { tenantId: string; actorUserId: string; templateId: string }, db: PrismaClient = prisma) {
  await db.$transaction(async (tx) => {
    const draft = await loadDraft(input.tenantId, input.templateId, tx);
    await tx.supplierCriteriaTemplate.delete({ where: { id: draft.id } });
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: draft.id,
      action: "discard_template",
      actorUserId: input.actorUserId,
      summary: `Se descartó el borrador v${draft.version} de criterios de ${SUPPLIER_TYPE_LABELS[draft.supplierType].toLowerCase()}`,
    });
  });
}

// ─── Tipos de documento ────────────────────────────────────────────────────

export async function listDocumentTypes(tenantId: string, db: Tx = prisma) {
  return db.supplierDocumentType.findMany({ where: { tenantId }, orderBy: [{ position: "asc" }, { name: "asc" }], take: 200 });
}

export type DocumentTypeFormInput = {
  id?: string;
  name: string;
  appliesTo: SupplierTypeValue[];
  required: boolean;
  blocksEnablement: boolean;
  validityMonths: number | null;
  recurrence: DocumentRecurrenceValue;
  note: string;
};

function slugKey(name: string): string {
  return normalizeKey(name).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "documento";
}

/** Recalcula el resumen de todos los proveedores de la empresa (cuando cambia el juego de tipos de documento). */
export async function recomputeAllSupplierSummaries(tenantId: string, db: PrismaClient = prisma) {
  const ids = await db.supplier.findMany({ where: { tenantId }, select: { id: true } });
  for (const { id } of ids) await recomputeSupplierSummary(tenantId, id, db);
  return ids.length;
}

export async function saveDocumentType(input: DocumentTypeFormInput & { tenantId: string; actorUserId: string }, db: PrismaClient = prisma) {
  const name = cleanName(input.name);
  if (name.length < 3) throw new SupplierError("Escribí el nombre del documento");
  const appliesTo = [...new Set(input.appliesTo)].filter((t) => SUPPLIER_TYPES.includes(t));
  if (appliesTo.length === 0) throw new SupplierError("Elegí a qué tipos de proveedor se le pide");
  if (!DOCUMENT_RECURRENCES.includes(input.recurrence)) throw new SupplierError("La recurrencia no es válida");
  if (input.validityMonths !== null && (!Number.isInteger(input.validityMonths) || input.validityMonths < 1 || input.validityMonths > 120)) {
    throw new SupplierError("La vigencia sugerida tiene que ser de 1 a 120 meses");
  }
  // Lo que bloquea la habilitación necesariamente se exige.
  const required = input.required || input.blocksEnablement;
  const data = {
    name,
    appliesTo,
    required,
    blocksEnablement: input.blocksEnablement,
    validityMonths: input.validityMonths,
    recurrence: input.recurrence,
    note: input.note.trim(),
  };

  await db.$transaction(async (tx) => {
    if (input.id) {
      const current = await tx.supplierDocumentType.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
      if (!current) throw new SupplierError("Tipo de documento no encontrado");
      await tx.supplierDocumentType.update({ where: { id: current.id }, data });
    } else {
      const base = slugKey(name);
      const taken = new Set(
        (await tx.supplierDocumentType.findMany({ where: { tenantId: input.tenantId, key: { startsWith: base } }, select: { key: true } })).map((k) => k.key),
      );
      let key = base;
      for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
      const last = await tx.supplierDocumentType.aggregate({ where: { tenantId: input.tenantId }, _max: { position: true } });
      await tx.supplierDocumentType.create({ data: { ...data, key, tenantId: input.tenantId, position: (last._max.position ?? -1) + 1 } });
    }
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: input.id ?? "document-types",
      action: "save_document_type",
      actorUserId: input.actorUserId,
      summary: `${input.id ? "Se editó" : "Se agregó"} el tipo de documento «${name}»${required ? " (obligatorio)" : ""}${input.blocksEnablement ? " (impide la habilitación)" : ""}`,
    });
  });
  await recomputeAllSupplierSummaries(input.tenantId, db);
}

export async function setDocumentTypeActive(
  input: { tenantId: string; actorUserId: string; id: string; active: boolean },
  db: PrismaClient = prisma,
) {
  await db.$transaction(async (tx) => {
    const current = await tx.supplierDocumentType.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
    if (!current) throw new SupplierError("Tipo de documento no encontrado");
    await tx.supplierDocumentType.update({ where: { id: current.id }, data: { active: input.active } });
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: current.id,
      action: "save_document_type",
      actorUserId: input.actorUserId,
      summary: `${input.active ? "Se reactivó" : "Se desactivó"} el tipo de documento «${current.name}»`,
    });
  });
  await recomputeAllSupplierSummaries(input.tenantId, db);
}
