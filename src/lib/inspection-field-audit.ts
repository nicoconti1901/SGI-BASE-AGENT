import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureDefaultTemplates, getTemplateByKey } from "@/lib/inspection-templates";
import { InspectionError, writeAudit, type Db } from "@/lib/inspection-support";
import { applicableItems } from "@/domain/inspections/result";
import { dateFromIso, isIsoDate, todayIso } from "@/domain/inspections/dates";
import { monthRangeOf, programCompliance, validateMonthlyTarget } from "@/domain/inspections/field-audit";
import { auditContext, isSpecialTask } from "@/domain/inspections/templates/field-audit";
import type { AppliesWhen } from "@/domain/inspections/types";

/** Plantilla de la auditoría de seguridad en campo (T7). */
export const FIELD_AUDIT_TEMPLATE_KEY = "field_audit";

export const PROGRAM_PAGE_SIZE = 50;

async function requireAuditTemplate(tenantId: string, db: Db) {
  await ensureDefaultTemplates(tenantId, db);
  const template = await getTemplateByKey(tenantId, FIELD_AUDIT_TEMPLATE_KEY, db);
  if (!template || !template.active || !template.activeVersionId) throw new InspectionError("No se encontró la plantilla de auditoría en campo");
  return template as typeof template & { activeVersionId: string };
}

async function requireActiveSite(tenantId: string, siteId: string, db: Db) {
  const site = await db.site.findFirst({ where: { id: siteId, tenantId, active: true }, select: { id: true, name: true } });
  if (!site) throw new InspectionError("La sede no existe o está dada de baja");
  return site;
}

export type StartFieldAuditInput = {
  tenantId: string;
  actorUserId: string;
  siteId: string;
  jobTaskId?: string | null;
  contractorName?: string | null;
  supervisorPersonId?: string | null;
  specialTasks?: readonly string[];
  inspectedAt?: string;
};

/**
 * Abre el borrador de una auditoría de campo: sede + tarea + contratista + supervisor y las tareas especiales que
 * decidirán qué ítems aplican. Igual que en una inspección de área, si el inspector ya tiene un borrador abierto en esa
 * sede lo devuelve (un doble toque no crea dos).
 */
export async function startFieldAudit(input: StartFieldAuditInput, db: Db = prisma) {
  const site = await requireActiveSite(input.tenantId, input.siteId, db);
  const inspectedAt = input.inspectedAt ?? todayIso();
  if (!isIsoDate(inspectedAt)) throw new InspectionError("Fecha inválida");
  const specialTasks = [...new Set(input.specialTasks ?? [])];
  if (specialTasks.some((t) => !isSpecialTask(t))) throw new InspectionError("Tarea especial desconocida");
  const contractorName = input.contractorName?.trim() || null;
  if (contractorName && contractorName.length > 120) throw new InspectionError("El nombre del contratista es demasiado largo");

  if (input.jobTaskId) {
    const task = await db.jobTask.findFirst({ where: { id: input.jobTaskId, tenantId: input.tenantId, active: true }, select: { id: true } });
    if (!task) throw new InspectionError("La tarea no existe o está dada de baja");
  }
  if (input.supervisorPersonId) {
    const person = await db.person.findFirst({ where: { id: input.supervisorPersonId, tenantId: input.tenantId, status: "active" }, select: { id: true } });
    if (!person) throw new InspectionError("El supervisor no existe o está dado de baja");
  }

  const template = await requireAuditTemplate(input.tenantId, db);
  const findOpen = () =>
    db.inspection.findFirst({
      where: { tenantId: input.tenantId, assetId: null, siteId: site.id, templateId: template.id, inspectorUserId: input.actorUserId, status: "draft" },
      select: { id: true },
    });
  const existing = await findOpen();
  if (existing) return existing;

  const allItems = await db.inspectionTemplateItem.findMany({ where: { versionId: template.activeVersionId }, orderBy: { sortOrder: "asc" } });
  const applicable = applicableItems(
    allItems.map((i) => ({ ...i, appliesWhen: i.appliesWhen as AppliesWhen | null })),
    { context: auditContext(specialTasks) },
  );
  if (applicable.length === 0) throw new InspectionError("La plantilla no tiene ítems aplicables");

  try {
    return await db.$transaction(async (tx) => {
      const inspection = await tx.inspection.create({
        data: {
          tenantId: input.tenantId,
          templateId: template.id,
          versionId: template.activeVersionId,
          siteId: site.id,
          jobTaskId: input.jobTaskId || null,
          contractorName,
          supervisorPersonId: input.supervisorPersonId || null,
          specialTasks,
          inspectorUserId: input.actorUserId,
          inspectedAt: dateFromIso(inspectedAt),
        },
        select: { id: true },
      });
      await tx.inspectionAnswer.createMany({
        data: applicable.map((item) => ({ tenantId: input.tenantId, inspectionId: inspection.id, itemId: item.id, autoDerived: false })),
      });
      await writeAudit(tx, { tenantId: input.tenantId, entityType: "inspection", entityId: inspection.id, action: "start", actorUserId: input.actorUserId, summary: `Auditoría en campo iniciada en ${site.name}` });
      return inspection;
    });
  } catch (error) {
    // Otra solicitud abrió el mismo borrador un instante antes: se devuelve ese.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const again = await findOpen();
      if (again) return again;
    }
    throw error;
  }
}

/** Fija (o, con `null`, quita) la meta mensual de auditorías de una sede. */
export async function setMonthlyTarget(
  input: { tenantId: string; actorUserId: string; siteId: string; target: number | string | null },
  db: Db = prisma,
) {
  const site = await requireActiveSite(input.tenantId, input.siteId, db);
  const template = await requireAuditTemplate(input.tenantId, db);
  if (input.target === null || input.target === "") {
    const removed = await db.inspectionTarget.deleteMany({ where: { tenantId: input.tenantId, templateId: template.id, siteId: site.id } });
    if (removed.count > 0) {
      await writeAudit(db, { tenantId: input.tenantId, entityType: "inspection_target", entityId: site.id, action: "delete", actorUserId: input.actorUserId, summary: `Meta mensual de auditorías en campo quitada de ${site.name}` });
    }
    return null;
  }
  const checked = validateMonthlyTarget(input.target);
  if (!checked.ok) throw new InspectionError(checked.message);
  const row = await db.inspectionTarget.upsert({
    where: { templateId_siteId: { templateId: template.id, siteId: site.id } },
    create: { tenantId: input.tenantId, templateId: template.id, siteId: site.id, monthlyTarget: checked.value },
    update: { monthlyTarget: checked.value },
  });
  await writeAudit(db, { tenantId: input.tenantId, entityType: "inspection_target", entityId: row.id, action: "set", actorUserId: input.actorUserId, summary: `Meta mensual de auditorías en campo de ${site.name}: ${checked.value}` });
  return row;
}

/**
 * Cumplimiento del programa por sede en el mes de `today`: auditorías cerradas contra la meta mensual. Son tres consultas
 * (sedes, metas y un `groupBy` de auditorías), sin importar cuántas sedes haya en la página. `q` filtra por nombre.
 */
export async function getFieldAuditProgram(tenantId: string, input: { q?: string; today?: string } = {}, db: Db = prisma) {
  const today = input.today ?? todayIso();
  const range = monthRangeOf(today);
  const template = await getTemplateByKey(tenantId, FIELD_AUDIT_TEMPLATE_KEY, db);
  const q = input.q?.trim();
  const sites = await db.site.findMany({
    where: { tenantId, active: true, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
    orderBy: { name: "asc" },
    take: PROGRAM_PAGE_SIZE,
    select: { id: true, name: true },
  });
  const siteIds = sites.map((s) => s.id);
  const [targets, counts] = template
    ? await Promise.all([
        db.inspectionTarget.findMany({ where: { tenantId, templateId: template.id, siteId: { in: siteIds } }, select: { siteId: true, monthlyTarget: true } }),
        db.inspection.groupBy({
          by: ["siteId"],
          where: { tenantId, templateId: template.id, status: "closed", siteId: { in: siteIds }, inspectedAt: { gte: dateFromIso(range.from), lt: dateFromIso(range.to) } },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const targetBySite = new Map(targets.map((t) => [t.siteId, t.monthlyTarget]));
  const doneBySite = new Map(counts.map((c) => [c.siteId, c._count._all]));
  return {
    month: range.month,
    sites: sites.map((s) => ({ id: s.id, name: s.name, ...programCompliance({ target: targetBySite.get(s.id), done: doneBySite.get(s.id) ?? 0 }) })),
  };
}

/** Tareas y personas elegibles para el formulario de inicio: una consulta cada una, con tope. */
export async function getFieldAuditFormOptions(tenantId: string, db: Db = prisma) {
  const [tasks, people] = await Promise.all([
    db.jobTask.findMany({ where: { tenantId, active: true }, orderBy: { name: "asc" }, take: 200, select: { id: true, name: true } }),
    db.person.findMany({ where: { tenantId, status: "active" }, orderBy: { name: "asc" }, take: 500, select: { id: true, name: true, employeeCode: true } }),
  ]);
  return { tasks, people };
}
