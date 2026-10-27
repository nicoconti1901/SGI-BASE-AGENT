import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureDefaultTemplates, getTemplateByKey } from "@/lib/inspection-templates";
import { InspectionError, closeOpenDueItems, syncOpenDueItem, writeAudit, type Db } from "@/lib/inspection-support";
import { applicableItems } from "@/domain/inspections/result";
import { dateFromIso, endOfDayInstant, isIsoDate, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { addInterval } from "@/domain/inspections/schedule";
import type { AppliesWhen } from "@/domain/inspections/types";

/** Plantilla de las inspecciones de área (sin activo) que hoy existe: la zona de obradores. */
export const OBRADOR_TEMPLATE_KEY = "site_obrador";

async function requireAreaTemplate(tenantId: string, key: string, db: Db) {
  await ensureDefaultTemplates(tenantId, db);
  const template = await getTemplateByKey(tenantId, key, db);
  if (!template || template.scope !== "area" || !template.active || !template.activeVersionId) {
    throw new InspectionError("No se encontró la plantilla de inspección del área");
  }
  return template as typeof template & { activeVersionId: string };
}

async function requireActiveSite(tenantId: string, siteId: string, db: Db) {
  const site = await db.site.findFirst({ where: { id: siteId, tenantId, active: true }, select: { id: true, name: true } });
  if (!site) throw new InspectionError("La sede no existe o está dada de baja");
  return site;
}

/**
 * Abre el borrador de la inspección de un área (la zona de obradores) en una sede. Igual que sobre un activo: si el
 * inspector ya tiene uno abierto de esa sede y plantilla lo devuelve, así un doble toque no crea dos.
 */
export async function startSiteInspection(
  input: { tenantId: string; actorUserId: string; siteId: string; templateKey?: string; inspectedAt?: string },
  db: Db = prisma,
) {
  const site = await requireActiveSite(input.tenantId, input.siteId, db);
  const inspectedAt = input.inspectedAt ?? todayIso();
  if (!isIsoDate(inspectedAt)) throw new InspectionError("Fecha inválida");
  const template = await requireAreaTemplate(input.tenantId, input.templateKey ?? OBRADOR_TEMPLATE_KEY, db);

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
    {},
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
          inspectorUserId: input.actorUserId,
          inspectedAt: dateFromIso(inspectedAt),
        },
        select: { id: true },
      });
      await tx.inspectionAnswer.createMany({
        data: applicable.map((item) => ({ tenantId: input.tenantId, inspectionId: inspection.id, itemId: item.id, autoDerived: false })),
      });
      await writeAudit(tx, { tenantId: input.tenantId, entityType: "inspection", entityId: inspection.id, action: "start", actorUserId: input.actorUserId, summary: `Inspección iniciada sobre ${template.name.toLowerCase()} de ${site.name}` });
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

/**
 * Programa la inspección periódica del área en una sede: crea (o reactiva) su programa y deja un único vencimiento
 * abierto a un intervalo de hoy. Programar de nuevo una sede ya programada no cambia nada.
 */
export async function scheduleSiteInspection(
  input: { tenantId: string; actorUserId: string; siteId: string; templateKey?: string },
  db: Db = prisma,
) {
  const site = await requireActiveSite(input.tenantId, input.siteId, db);
  const template = await requireAreaTemplate(input.tenantId, input.templateKey ?? OBRADOR_TEMPLATE_KEY, db);
  if (!template.intervalUnit || !template.intervalValue) throw new InspectionError("La plantilla no tiene frecuencia: no se puede programar");
  const subjectKey = `site:${site.id}`;
  const interval = { unit: template.intervalUnit, value: template.intervalValue };

  return db.$transaction(async (tx) => {
    const existing = await tx.inspectionPlan.findFirst({ where: { templateId: template.id, subjectKey, tenantId: input.tenantId } });
    if (existing?.active && existing.nextDueAt) return existing;
    const nextDueAt = addInterval(todayIso(), interval);
    const data = { active: true, nextDueAt: dateFromIso(nextDueAt) };
    let plan;
    try {
      plan = existing
        ? await tx.inspectionPlan.update({ where: { id: existing.id }, data })
        : await tx.inspectionPlan.create({ data: { tenantId: input.tenantId, templateId: template.id, subjectKey, siteId: site.id, ...data } });
    } catch (error) {
      // Dos pedidos a la vez: gana el primero y el segundo devuelve su programa.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new InspectionError("La sede ya estaba programada");
      }
      throw error;
    }
    await syncOpenDueItem(tx, {
      tenantId: input.tenantId,
      entityType: "inspection_plan",
      entityId: plan.id,
      title: `Inspección de ${template.name.toLowerCase()} · ${site.name}`,
      dueAt: endOfDayInstant(nextDueAt),
      leadDays: template.leadDays,
      ownerUserId: null,
      siteId: site.id,
      personId: null,
    });
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "inspection_plan", entityId: plan.id, action: "schedule", actorUserId: input.actorUserId, summary: `${template.name} programada en ${site.name}` });
    return plan;
  });
}

/** Saca la sede del programa de esa plantilla: se cierra su vencimiento y deja de figurar como pendiente. */
export async function unscheduleSiteInspection(
  input: { tenantId: string; actorUserId: string; siteId: string; templateKey?: string },
  db: Db = prisma,
) {
  const template = await getTemplateByKey(input.tenantId, input.templateKey ?? OBRADOR_TEMPLATE_KEY, db);
  if (!template) return;
  await db.$transaction(async (tx) => {
    const plan = await tx.inspectionPlan.findFirst({ where: { templateId: template.id, subjectKey: `site:${input.siteId}`, tenantId: input.tenantId } });
    if (!plan || !plan.active) return;
    await tx.inspectionPlan.update({ where: { id: plan.id }, data: { active: false, nextDueAt: null } });
    await closeOpenDueItems(tx, input.tenantId, "inspection_plan", [plan.id]);
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "inspection_plan", entityId: plan.id, action: "unschedule", actorUserId: input.actorUserId, summary: `${template.name} quitada del programa de la sede` });
  });
}

export const SITE_LIST_SIZE = 50;

/**
 * Las sedes activas con el estado de su programa de la zona de obradores: una consulta de sedes y una de programas
 * (no una por sede). `q` filtra por nombre.
 */
export async function listSiteSchedule(tenantId: string, input: { q?: string; templateKey?: string } = {}, db: Db = prisma) {
  const template = await getTemplateByKey(tenantId, input.templateKey ?? OBRADOR_TEMPLATE_KEY, db);
  const q = input.q?.trim();
  const sites = await db.site.findMany({
    where: { tenantId, active: true, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
    orderBy: { name: "asc" },
    take: SITE_LIST_SIZE,
    select: { id: true, name: true },
  });
  const plans = template
    ? await db.inspectionPlan.findMany({
        where: { tenantId, templateId: template.id, active: true, siteId: { in: sites.map((s) => s.id) } },
        select: { siteId: true, nextDueAt: true, lastInspectedAt: true, lastResult: true },
      })
    : [];
  const bySite = new Map(plans.map((p) => [p.siteId, p]));
  const today = todayIso();
  return sites.map((s) => {
    const plan = bySite.get(s.id);
    const nextDue = plan?.nextDueAt ? isoFromDate(plan.nextDueAt) : null;
    return {
      id: s.id,
      name: s.name,
      scheduled: Boolean(plan),
      nextDueAt: nextDue,
      overdue: Boolean(nextDue && nextDue < today),
      lastInspectedAt: plan?.lastInspectedAt ? isoFromDate(plan.lastInspectedAt) : null,
      lastResult: plan?.lastResult ?? null,
    };
  });
}

/**
 * Para el ítem de extintores del obrador: cuántos extintores en servicio tiene la sede y cuántos tienen algún vencimiento
 * vencido (mantenimiento, prueba hidráulica o de manguera). Dos conteos en la base.
 */
export async function siteExtinguisherStatus(tenantId: string, siteId: string, today: string = todayIso(), db: Db = prisma) {
  const base = { tenantId, siteId, typeKey: "extinguisher", status: { not: "retired" as const } };
  const [total, expired] = await Promise.all([
    db.asset.count({ where: base }),
    db.asset.count({ where: { ...base, dueDates: { some: { dueAt: { lt: dateFromIso(today) } } } } }),
  ]);
  return { total, expired };
}
