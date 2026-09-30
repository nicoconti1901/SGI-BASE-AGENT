import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RequirementStatus } from "@/domain/assessment/gap";
import {
  describeDueItem,
  summarizeCompliance,
  type DueItemView,
} from "@/domain/dashboard/summary";
import { FINDING_MEASURE_ENTITY_TYPE } from "@/domain/findings/types";
import { INDICATOR_MEASUREMENT_ENTITY_TYPE } from "@/domain/indicators/types";

const DUE_LIST_SIZE = 8;

export type TenantDashboard = {
  compliance: ReturnType<typeof summarizeCompliance>;
  dueItems: (DueItemView & { id: string; title: string; dueAt: Date })[];
  dueCounts: { overdue: number; soon: number; open: number };
};

/** Datos del panel de una empresa: cumplimiento de requisitos y próximos vencimientos. */
export async function getTenantDashboard(
  tenantId: string,
  now: Date,
  slug: string,
  db: PrismaClient = prisma,
): Promise<TenantDashboard> {
  const [requirements, open] = await Promise.all([
    db.tenantRequirement.findMany({ where: { tenantId }, select: { status: true } }),
    db.dueItem.findMany({
      where: { tenantId, status: "open" },
      orderBy: { dueAt: "asc" },
      select: { id: true, title: true, entityType: true, entityId: true, dueAt: true, leadDays: true },
    }),
  ]);

  // Solo para los que se muestran: los conteos no necesitan el enlace.
  const shown = open.slice(0, DUE_LIST_SIZE);
  const idsOf = (type: string) =>
    shown.flatMap((i) => (i.entityType === type && i.entityId ? [i.entityId] : []));
  const [indicators, measures] = await Promise.all([
    db.indicator.findMany({
      where: { tenantId, id: { in: idsOf(INDICATOR_MEASUREMENT_ENTITY_TYPE) } },
      select: { id: true, objectiveId: true },
    }),
    db.findingMeasure.findMany({
      where: { tenantId, id: { in: idsOf(FINDING_MEASURE_ENTITY_TYPE) } },
      select: { id: true, findingId: true },
    }),
  ]);
  const objectiveByIndicator = new Map(indicators.map((i) => [i.id, i.objectiveId]));
  const findingByMeasure = new Map(measures.map((m) => [m.id, m.findingId]));

  const views = open.map((item, index) => {
    const parent =
      index >= DUE_LIST_SIZE || !item.entityId
        ? {}
        : {
            objectiveId: objectiveByIndicator.get(item.entityId),
            findingId: findingByMeasure.get(item.entityId),
          };
    return {
      id: item.id,
      title: item.title,
      dueAt: item.dueAt,
      ...describeDueItem(item, slug, now, item.leadDays, parent),
    };
  });

  return {
    compliance: summarizeCompliance(requirements.map((r) => r.status as RequirementStatus)),
    dueItems: views.slice(0, DUE_LIST_SIZE),
    dueCounts: {
      overdue: views.filter((v) => v.tone === "overdue").length,
      soon: views.filter((v) => v.tone === "soon").length,
      open: views.length,
    },
  };
}

export type PlatformOverview = { tenants: number; openDue: number; overdue: number };

/** Conteos globales para el panel del superusuario (todas las empresas). */
export async function getPlatformOverview(
  now: Date,
  db: PrismaClient = prisma,
): Promise<PlatformOverview> {
  const [tenants, openDue, overdue] = await Promise.all([
    db.tenant.count(),
    db.dueItem.count({ where: { status: "open" } }),
    db.dueItem.count({ where: { status: "open", dueAt: { lt: now } } }),
  ]);
  return { tenants, openDue, overdue };
}
