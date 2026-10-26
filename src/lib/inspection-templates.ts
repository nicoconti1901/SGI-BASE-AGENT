import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TEMPLATES, getDefaultTemplate } from "@/domain/inspections/templates";
import type { TemplateDefinition } from "@/domain/inspections/templates";
import {
  applyItemEdits,
  editContextFor,
  templateChanged,
  validateTemplateEdit,
  type ItemEdit,
  type TemplateEditInput,
} from "@/domain/inspections/templates/edit";
import type { TemplateIssue } from "@/domain/inspections/templates/validate";
import type { IntervalUnit, TemplateItemDef } from "@/domain/inspections/types";
import { InspectionError, writeAudit, type Db } from "@/lib/inspection-support";

function templateData(def: TemplateDefinition) {
  return {
    key: def.key,
    name: def.name,
    scope: def.scope,
    assetTypeKey: def.assetTypeKey,
    intervalUnit: def.intervalUnit,
    intervalValue: def.intervalValue,
    leadDays: def.leadDays,
    reinspectionDays: def.reinspectionDays,
    findingOnCritical: def.findingOnCritical,
    canReinstate: def.canReinstate,
    retireOnUnfit: def.retireOnUnfit,
  };
}

/**
 * Siembra las plantillas precargadas de la empresa (versión 1). Es idempotente: no toca las que ya existen,
 * así que se puede llamar cada vez que se necesita una plantilla. Dos llamadas simultáneas no duplican nada
 * (el índice único `[tenantId, key]` lo impide).
 */
export async function ensureDefaultTemplates(tenantId: string, db: Db = prisma): Promise<void> {
  const existing = await db.inspectionTemplate.findMany({ where: { tenantId }, select: { key: true } });
  const have = new Set(existing.map((t) => t.key));
  for (const def of DEFAULT_TEMPLATES) {
    if (have.has(def.key)) continue;
    try {
      await db.$transaction(async (tx) => {
        const template = await tx.inspectionTemplate.create({ data: { tenantId, ...templateData(def) } });
        const version = await tx.inspectionTemplateVersion.create({
          data: { tenantId, templateId: template.id, version: 1, note: "Plantilla precargada" },
        });
        await tx.inspectionTemplateItem.createMany({
          data: def.items.map((item, index) => ({
            tenantId,
            versionId: version.id,
            code: item.code,
            section: item.section,
            sortOrder: index,
            text: item.text,
            help: item.help ?? null,
            criticality: item.criticality,
            kind: item.kind,
            unit: item.unit ?? null,
            minValue: item.minValue ?? null,
            maxValue: item.maxValue ?? null,
            naAllowed: item.naAllowed,
            photoOnNc: item.photoOnNc,
            required: item.required,
            readingKey: item.readingKey ?? null,
            autoSource: item.autoSource ?? Prisma.DbNull,
            appliesWhen: item.appliesWhen ?? Prisma.DbNull,
          })),
        });
        await tx.inspectionTemplate.update({ where: { id: template.id }, data: { activeVersionId: version.id } });
      });
    } catch (error) {
      // Otra solicitud la sembró primero: está bien.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
}

export async function getTemplateByKey(tenantId: string, key: string, db: Db = prisma) {
  return db.inspectionTemplate.findUnique({ where: { tenantId_key: { tenantId, key } } });
}

type ItemRow = Awaited<ReturnType<typeof prisma.inspectionTemplateItem.findMany>>[number];

/** Fila de la base → ítem de dominio (los campos que el motor y el editor usan). */
export function itemRowToDef(row: ItemRow): TemplateItemDef {
  return {
    code: row.code,
    section: row.section,
    text: row.text,
    help: row.help,
    criticality: row.criticality,
    kind: row.kind,
    naAllowed: row.naAllowed,
    photoOnNc: row.photoOnNc,
    required: row.required,
    unit: row.unit,
    minValue: row.minValue,
    maxValue: row.maxValue,
    readingKey: row.readingKey as TemplateItemDef["readingKey"],
    autoSource: row.autoSource as TemplateItemDef["autoSource"],
    appliesWhen: row.appliesWhen as TemplateItemDef["appliesWhen"],
  };
}

function itemCreateData(tenantId: string, versionId: string, items: readonly TemplateItemDef[]) {
  return items.map((item, index) => ({
    tenantId,
    versionId,
    code: item.code,
    section: item.section,
    sortOrder: index,
    text: item.text,
    help: item.help ?? null,
    criticality: item.criticality,
    kind: item.kind,
    unit: item.unit ?? null,
    minValue: item.minValue ?? null,
    maxValue: item.maxValue ?? null,
    naAllowed: item.naAllowed,
    photoOnNc: item.photoOnNc,
    required: item.required,
    readingKey: item.readingKey ?? null,
    autoSource: item.autoSource ?? Prisma.DbNull,
    appliesWhen: item.appliesWhen ?? Prisma.DbNull,
  }));
}

/** Plantillas de la empresa con su versión vigente y la cantidad de ítems: tres consultas, sin importar cuántas sean. */
export async function listTemplates(tenantId: string, db: Db = prisma) {
  await ensureDefaultTemplates(tenantId, db);
  const templates = await db.inspectionTemplate.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: { activeVersion: { select: { id: true, version: true, createdAt: true } } },
  });
  const versionIds = templates.map((t) => t.activeVersionId).filter((id): id is string => id != null);
  const counts = await db.inspectionTemplateItem.groupBy({ by: ["versionId"], where: { tenantId, versionId: { in: versionIds } }, _count: { _all: true } });
  const countByVersion = new Map(counts.map((c) => [c.versionId, c._count._all]));
  return templates.map((t) => ({ ...t, itemCount: t.activeVersionId ? (countByVersion.get(t.activeVersionId) ?? 0) : 0 }));
}

/** La plantilla con los ítems de su versión vigente y el historial de versiones, para el editor. */
export async function getTemplateForEdit(tenantId: string, templateId: string, db: Db = prisma) {
  const template = await db.inspectionTemplate.findFirst({ where: { id: templateId, tenantId } });
  if (!template?.activeVersionId) return null;
  const [rows, versions] = await Promise.all([
    db.inspectionTemplateItem.findMany({ where: { tenantId, versionId: template.activeVersionId }, orderBy: { sortOrder: "asc" } }),
    db.inspectionTemplateVersion.findMany({
      where: { tenantId, templateId },
      orderBy: { version: "desc" },
      take: 10,
      select: { id: true, version: true, note: true, createdAt: true, _count: { select: { inspections: true } } },
    }),
  ]);
  const def = getDefaultTemplate(template.key);
  return {
    template,
    versionId: template.activeVersionId,
    items: rows.map(itemRowToDef),
    versions,
    hasDefault: def != null,
  };
}

export type TemplateEditValues = {
  name: string;
  intervalUnit: IntervalUnit | null;
  intervalValue: number | null;
  findingOnCritical: boolean;
};

export type SaveTemplateResult = { changed: boolean; version: number; warnings: TemplateIssue[] };

type VersionRequest = {
  tenantId: string;
  actorUserId: string;
  templateId: string;
  /** Versión vigente que el editor tenía abierta: si cambió, otra persona guardó antes. */
  expectedVersionId: string;
  note: string;
  /** Valores y ítems de la versión nueva, a partir de los vigentes. */
  build: (current: TemplateItemDef[]) => TemplateEditValues & { items: TemplateItemDef[] };
};

/**
 * Crea la versión siguiente de una plantilla. No toca ninguna versión anterior (son inmutables), así que las
 * inspecciones ya hechas y los borradores abiertos conservan los ítems con los que empezaron. Sin cambios reales
 * no crea nada. El intervalo y el hallazgo se leen de la plantilla al cerrar cada inspección: rigen hacia adelante.
 */
async function createNextVersion(req: VersionRequest, db: Db): Promise<SaveTemplateResult> {
  return db.$transaction(async (tx) => {
    // Bloquea la fila: dos guardados simultáneos se serializan y el segundo ve la versión nueva.
    await tx.$queryRaw`SELECT id FROM inspection_template WHERE id = ${req.templateId} AND "tenantId" = ${req.tenantId} FOR UPDATE`;
    const template = await tx.inspectionTemplate.findFirst({ where: { id: req.templateId, tenantId: req.tenantId } });
    if (!template?.activeVersionId) throw new InspectionError("No se encontró la plantilla");
    if (template.activeVersionId !== req.expectedVersionId) {
      throw new InspectionError("Otra persona modificó esta plantilla mientras la editabas. Recargá la página para ver la última versión.", "conflict");
    }
    const def = getDefaultTemplate(template.key);
    if (!def) throw new InspectionError("Esta plantilla no se puede editar");

    const currentRows = await tx.inspectionTemplateItem.findMany({ where: { versionId: template.activeVersionId }, orderBy: { sortOrder: "asc" } });
    const currentItems = currentRows.map(itemRowToDef);
    let next: TemplateEditInput;
    try {
      const built = req.build(currentItems);
      next = { ...built, name: built.name.trim() };
    } catch (error) {
      throw new InspectionError(error instanceof Error ? error.message : "Los ítems no son válidos");
    }
    const { errors, warnings } = validateTemplateEdit(next, editContextFor(def));
    if (errors.length > 0) throw new InspectionError(errors[0].message, "invalid", { issues: errors });

    const current: TemplateEditInput = {
      name: template.name,
      intervalUnit: template.intervalUnit,
      intervalValue: template.intervalValue,
      findingOnCritical: template.findingOnCritical,
      items: currentItems,
    };
    if (!templateChanged(current, next)) {
      const active = await tx.inspectionTemplateVersion.findUniqueOrThrow({ where: { id: template.activeVersionId } });
      return { changed: false, version: active.version, warnings };
    }

    const last = await tx.inspectionTemplateVersion.aggregate({ where: { templateId: template.id }, _max: { version: true } });
    const version = await tx.inspectionTemplateVersion.create({
      data: { tenantId: req.tenantId, templateId: template.id, version: (last._max.version ?? 0) + 1, createdByUserId: req.actorUserId, note: req.note },
    });
    await tx.inspectionTemplateItem.createMany({ data: itemCreateData(req.tenantId, version.id, next.items) });
    await tx.inspectionTemplate.update({
      where: { id: template.id },
      data: {
        name: next.name,
        intervalUnit: next.intervalUnit,
        intervalValue: next.intervalValue,
        findingOnCritical: next.findingOnCritical,
        activeVersionId: version.id,
      },
    });
    await writeAudit(tx, {
      tenantId: req.tenantId,
      entityType: "inspection_template",
      entityId: template.id,
      action: "version_created",
      actorUserId: req.actorUserId,
      summary: `Plantilla «${next.name}»: versión ${version.version} (${next.items.length} ítems). ${req.note}`,
    });
    return { changed: true, version: version.version, warnings };
  });
}

export async function saveTemplate(
  input: Omit<VersionRequest, "build" | "note"> & TemplateEditValues & { items: ItemEdit[] },
  db: Db = prisma,
): Promise<SaveTemplateResult> {
  const { items, name, intervalUnit, intervalValue, findingOnCritical, ...rest } = input;
  return createNextVersion(
    { ...rest, note: "Editada por la empresa", build: (current) => ({ name, intervalUnit, intervalValue, findingOnCritical, items: applyItemEdits(current, items) }) },
    db,
  );
}

/** «Restaurar la original»: vuelve a los valores precargados como una versión nueva (el historial no se pierde). */
export async function restoreTemplate(input: Omit<VersionRequest, "build" | "note">, db: Db = prisma): Promise<SaveTemplateResult> {
  const template = await db.inspectionTemplate.findFirst({ where: { id: input.templateId, tenantId: input.tenantId }, select: { key: true } });
  const def = template ? getDefaultTemplate(template.key) : undefined;
  if (!def) throw new InspectionError("No se encontró la plantilla original");
  return createNextVersion(
    {
      ...input,
      note: "Restaurada a la original",
      build: () => ({ name: def.name, intervalUnit: def.intervalUnit, intervalValue: def.intervalValue, findingOnCritical: def.findingOnCritical, items: def.items.map((i) => ({ ...i })) }),
    },
    db,
  );
}
