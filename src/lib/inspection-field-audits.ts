import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureDefaultTemplates, getTemplateByKey } from "@/lib/inspection-templates";
import { InspectionError, writeAudit, type Db } from "@/lib/inspection-support";
import { applicableItems } from "@/domain/inspections/result";
import { dateFromIso, isIsoDate, todayIso } from "@/domain/inspections/dates";
import { FIELD_AUDIT_KEY, auditContext, monthOf, monthRange, normalizeSpecialTasks, programCompliance } from "@/domain/inspections/field-audit";
import type { AppliesWhen } from "@/domain/inspections/types";

export const MAX_MONTHLY_TARGET = 200;
const MAX_CONTRACTOR_LENGTH = 120;
/** Tope de sedes del tablero de cumplimiento: una consulta por tabla, nunca una por sede. */
export const PROGRAM_SITE_LIMIT = 200;

async function requireFieldAuditTemplate(tenantId: string, db: Db) {
  await ensureDefaultTemplates(tenantId, db);
  const template = await getTemplateByKey(tenantId, FIELD_AUDIT_KEY, db);
  if (!template || template.scope !== "activity" || !template.active || !template.activeVersionId) {
    throw new InspectionError("No se encontró la plantilla de la auditoría de campo");
  }
  return template as typeof template & { activeVersionId: string };
}

async function requireActiveSite(tenantId: string, siteId: string, db: Db) {
  const site = await db.site.findFirst({ where: { id: siteId, tenantId, active: true }, select: { id: true, name: true } });
  if (!site) throw new InspectionError("La sede no existe o está dada de baja");
  return site;
}

export type FieldAuditInput = {
  tenantId: string;
  actorUserId: string;
  siteId: string;
  /** Tarea que se audita (datos maestros). */
  jobTaskId?: string | null;
  contractorName?: string | null;
  /** Persona que supervisa el frente (datos maestros; puede no tener usuario). */
  supervisorPersonId?: string | null;
  specialTasks?: readonly string[];
  inspectedAt?: string;
};

/**
 * Abre el borrador de una auditoría de seguridad en campo. Las tareas especiales marcadas deciden qué ítems aplican
 * (altura, espacio confinado, izaje). Igual que en las demás inspecciones, si el auditor ya tiene un borrador abierto de esa
 * sede lo devuelve (`resumed`), así un doble toque no crea dos.
 */
export async function startFieldAudit(input: FieldAuditInput, db: Db = prisma) {
  const site = await requireActiveSite(input.tenantId, input.siteId, db);
  const inspectedAt = input.inspectedAt ?? todayIso();
  if (!isIsoDate(inspectedAt)) throw new InspectionError("Fecha inválida");
  const template = await requireFieldAuditTemplate(input.tenantId, db);

  const jobTaskId = input.jobTaskId || null;
  if (jobTaskId && !(await db.jobTask.findFirst({ where: { id: jobTaskId, tenantId: input.tenantId, active: true }, select: { id: true } }))) {
    throw new InspectionError("La tarea no existe o está dada de baja");
  }
  const supervisorPersonId = input.supervisorPersonId || null;
  if (supervisorPersonId && !(await db.person.findFirst({ where: { id: supervisorPersonId, tenantId: input.tenantId, status: "active" }, select: { id: true } }))) {
    throw new InspectionError("El supervisor no existe o está dado de baja");
  }
  const contractorName = input.contractorName?.trim().replace(/\s+/g, " ") || null;
  if (contractorName && contractorName.length > MAX_CONTRACTOR_LENGTH) throw new InspectionError("El nombre del contratista es demasiado largo");
  const specialTasks = normalizeSpecialTasks(input.specialTasks ?? []);

  const findOpen = () =>
    db.inspection.findFirst({
      where: { tenantId: input.tenantId, assetId: null, siteId: site.id, templateId: template.id, inspectorUserId: input.actorUserId, status: "draft" },
      select: { id: true },
    });
  const existing = await findOpen();
  if (existing) return { ...existing, resumed: true };

  const allItems = await db.inspectionTemplateItem.findMany({ where: { versionId: template.activeVersionId }, orderBy: { sortOrder: "asc" } });
  const applicable = applicableItems(
    allItems.map((i) => ({ ...i, appliesWhen: i.appliesWhen as AppliesWhen | null })),
    { context: auditContext(specialTasks) },
  );
  if (applicable.length === 0) throw new InspectionError("La plantilla no tiene ítems aplicables");

  try {
    const created = await db.$transaction(async (tx) => {
      const inspection = await tx.inspection.create({
        data: {
          tenantId: input.tenantId,
          templateId: template.id,
          versionId: template.activeVersionId,
          siteId: site.id,
          inspectorUserId: input.actorUserId,
          inspectedAt: dateFromIso(inspectedAt),
          jobTaskId,
          contractorName,
          supervisorPersonId,
          specialTasks,
        },
        select: { id: true },
      });
      await tx.inspectionAnswer.createMany({
        data: applicable.map((item) => ({ tenantId: input.tenantId, inspectionId: inspection.id, itemId: item.id, autoDerived: false })),
      });
      await writeAudit(tx, {
        tenantId: input.tenantId,
        entityType: "inspection",
        entityId: inspection.id,
        action: "start",
        actorUserId: input.actorUserId,
        summary: `Auditoría de seguridad en campo iniciada en ${site.name}`,
      });
      return inspection;
    });
    return { ...created, resumed: false };
  } catch (error) {
    // Otra solicitud abrió el mismo borrador un instante antes: se devuelve ese.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const again = await findOpen();
      if (again) return { ...again, resumed: true };
    }
    throw error;
  }
}

/**
 * Fija (o quita, con `target` nulo o 0) la meta mensual de auditorías de campo de una sede. Sin meta la sede no se mide.
 */
export async function setMonthlyTarget(input: { tenantId: string; actorUserId: string; siteId: string; target: number | null }, db: Db = prisma) {
  const site = await requireActiveSite(input.tenantId, input.siteId, db);
  const template = await requireFieldAuditTemplate(input.tenantId, db);
  const target = input.target ?? 0;
  if (!Number.isInteger(target) || target < 0 || target > MAX_MONTHLY_TARGET) {
    throw new InspectionError(`La meta mensual debe ser un número entero entre 1 y ${MAX_MONTHLY_TARGET} (o vacía para no medir la sede)`);
  }
  await db.$transaction(async (tx) => {
    const where = { templateId_siteId: { templateId: template.id, siteId: site.id } };
    const current = await tx.inspectionTarget.findUnique({ where });
    if (target === 0) {
      if (!current) return;
      await tx.inspectionTarget.delete({ where });
    } else {
      if (current?.monthlyTarget === target) return;
      await tx.inspectionTarget.upsert({
        where,
        create: { tenantId: input.tenantId, templateId: template.id, siteId: site.id, monthlyTarget: target },
        update: { monthlyTarget: target },
      });
    }
    await writeAudit(tx, {
      tenantId: input.tenantId,
      entityType: "inspection_target",
      entityId: site.id,
      action: target === 0 ? "clear_target" : "set_target",
      actorUserId: input.actorUserId,
      summary: target === 0 ? `Meta mensual de auditorías de campo quitada en ${site.name}` : `Meta mensual de auditorías de campo en ${site.name}: ${target}`,
    });
  });
}

export type ProgramRow = {
  siteId: string;
  siteName: string;
  done: number;
  target: number | null;
  missing: number;
  pct: number | null;
  status: "no_target" | "pending" | "met";
};

/**
 * Cumplimiento del programa de auditorías de campo por sede en un mes (AAAA-MM): auditorías cerradas sobre la meta mensual.
 * Tres consultas (sedes, metas y un `groupBy` de auditorías), sin importar cuántas sedes haya. Las sedes con meta van primero,
 * las más atrasadas arriba.
 */
export async function fieldAuditProgram(tenantId: string, month: string = monthOf(todayIso()), db: Db = prisma) {
  const { from, to } = monthRange(month);
  const template = await getTemplateByKey(tenantId, FIELD_AUDIT_KEY, db);
  const sites = await db.site.findMany({ where: { tenantId, active: true }, orderBy: { name: "asc" }, take: PROGRAM_SITE_LIMIT, select: { id: true, name: true } });
  const siteIds = sites.map((s) => s.id);
  // Una empresa que todavía no empezó ninguna auditoría puede no tener la plantilla sembrada: sus sedes figuran sin meta.
  const [targets, counts] = template
    ? await Promise.all([
        db.inspectionTarget.findMany({ where: { tenantId, templateId: template.id, siteId: { in: siteIds } }, select: { siteId: true, monthlyTarget: true } }),
        db.inspection.groupBy({
          by: ["siteId"],
          where: { tenantId, templateId: template.id, status: "closed", siteId: { in: siteIds }, inspectedAt: { gte: dateFromIso(from), lt: dateFromIso(to) } },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const targetBySite = new Map(targets.map((t) => [t.siteId, t.monthlyTarget]));
  const doneBySite = new Map(counts.map((c) => [c.siteId, c._count._all]));

  const rows: ProgramRow[] = sites.map((s) => {
    const done = doneBySite.get(s.id) ?? 0;
    const c = programCompliance(done, targetBySite.get(s.id));
    return { siteId: s.id, siteName: s.name, done, target: c.target, missing: c.missing, pct: c.pct, status: c.status };
  });
  const rank = { pending: 0, met: 1, no_target: 2 } as const;
  rows.sort((a, b) => rank[a.status] - rank[b.status] || (a.pct ?? 0) - (b.pct ?? 0) || a.siteName.localeCompare(b.siteName, "es"));

  const measured = rows.filter((r) => r.target !== null);
  return {
    month,
    rows,
    summary: {
      withTarget: measured.length,
      met: measured.filter((r) => r.status === "met").length,
      done: measured.reduce((n, r) => n + r.done, 0),
      target: measured.reduce((n, r) => n + (r.target ?? 0), 0),
    },
  };
}
