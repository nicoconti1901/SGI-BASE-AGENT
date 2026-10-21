import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TEMPLATES } from "@/domain/inspections/templates";
import type { TemplateDefinition } from "@/domain/inspections/templates";
import type { Db } from "@/lib/inspection-support";

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
