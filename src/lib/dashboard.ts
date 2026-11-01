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

type ShownDueItem = {
  id: string;
  title: string;
  entityType: string;
  entityId: string | null;
  dueAt: Date;
  leadDays: number;
};

/** Etiqueta, destino y semáforo de cada vencimiento; resuelve el padre cuando la ruta de detalle lo pide. */
async function toDueViews(
  shown: ShownDueItem[],
  tenantId: string,
  now: Date,
  slug: string,
  db: PrismaClient,
) {
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

  return shown.map((item) => {
    const parent = item.entityId
      ? {
          objectiveId: objectiveByIndicator.get(item.entityId),
          findingId: findingByMeasure.get(item.entityId),
        }
      : {};
    return {
      id: item.id,
      title: item.title,
      dueAt: item.dueAt,
      ...describeDueItem(item, slug, now, item.leadDays, parent),
    };
  });
}

/** Datos del panel de una empresa: cumplimiento de requisitos y próximos vencimientos. */
export async function getTenantDashboard(
  tenantId: string,
  now: Date,
  slug: string,
  db: PrismaClient = prisma,
): Promise<TenantDashboard> {
  // Los conteos salen de la base: con la Fase 5 una empresa puede tener miles de vencimientos abiertos.
  // "Por vencer" ⇔ remindAt ≤ ahora ≤ dueAt, igual que classifyDueWindow.
  const open = { tenantId, status: "open" as const };
  const [requirements, shown, overdue, soon, openCount] = await Promise.all([
    db.tenantRequirement.findMany({ where: { tenantId }, select: { status: true } }),
    db.dueItem.findMany({
      where: open,
      orderBy: { dueAt: "asc" },
      take: DUE_LIST_SIZE,
      select: {
        id: true,
        title: true,
        entityType: true,
        entityId: true,
        dueAt: true,
        leadDays: true,
      },
    }),
    db.dueItem.count({ where: { ...open, dueAt: { lt: now } } }),
    db.dueItem.count({ where: { ...open, dueAt: { gte: now }, remindAt: { lte: now } } }),
    db.dueItem.count({ where: open }),
  ]);

  const views = await toDueViews(shown, tenantId, now, slug, db);

  return {
    compliance: summarizeCompliance(
      requirements.map((r) => r.status as RequirementStatus),
    ),
    dueItems: views,
    dueCounts: { overdue, soon, open: openCount },
  };
}

const MODULE_DUE_LIST_SIZE = 3;

export type ModuleTelemetry = Pick<TenantDashboard, "dueItems" | "dueCounts">;

/** Tablero chico de un módulo: sus vencimientos abiertos (por entityType) y los tres más próximos. */
export async function getModuleTelemetry(
  tenantId: string,
  entityTypes: readonly string[],
  now: Date,
  slug: string,
  db: PrismaClient = prisma,
): Promise<ModuleTelemetry> {
  if (entityTypes.length === 0) {
    return { dueItems: [], dueCounts: { overdue: 0, soon: 0, open: 0 } };
  }
  const open = {
    tenantId,
    status: "open" as const,
    entityType: { in: [...entityTypes] },
  };
  const [shown, overdue, soon, openCount] = await Promise.all([
    db.dueItem.findMany({
      where: open,
      orderBy: { dueAt: "asc" },
      take: MODULE_DUE_LIST_SIZE,
      select: {
        id: true,
        title: true,
        entityType: true,
        entityId: true,
        dueAt: true,
        leadDays: true,
      },
    }),
    db.dueItem.count({ where: { ...open, dueAt: { lt: now } } }),
    db.dueItem.count({ where: { ...open, dueAt: { gte: now }, remindAt: { lte: now } } }),
    db.dueItem.count({ where: open }),
  ]);
  return {
    dueItems: await toDueViews(shown, tenantId, now, slug, db),
    dueCounts: { overdue, soon, open: openCount },
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
