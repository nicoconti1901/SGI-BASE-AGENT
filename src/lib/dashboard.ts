import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RequirementStatus } from "@/domain/assessment/gap";
import {
  describeDueItem,
  summarizeCompliance,
  type DueItemView,
} from "@/domain/dashboard/summary";
import type { DueEntityType, DueParentRef } from "@/domain/due/registry";

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
  const idsOf = (type: DueEntityType) =>
    shown.flatMap((i) => (i.entityType === type && i.entityId ? [i.entityId] : []));
  /** Consulta los padres solo de los tipos presentes en la lista. */
  const parentsOf = async <K extends keyof DueParentRef>(
    type: DueEntityType,
    key: K,
    query: (where: { tenantId: string; id: { in: string[] } }) => Promise<({ id: string } & Pick<DueParentRef, K>)[]>,
  ) => {
    const ids = idsOf(type);
    if (ids.length === 0) return [];
    const rows = await query({ tenantId, id: { in: ids } });
    return rows.map((row) => [`${type}:${row.id}`, { [key]: row[key] } as DueParentRef] as const);
  };
  const found = await Promise.all([
    parentsOf("indicator_measurement", "objectiveId", (where) => db.indicator.findMany({ where, select: { id: true, objectiveId: true } })),
    parentsOf("finding_measure", "findingId", (where) => db.findingMeasure.findMany({ where, select: { id: true, findingId: true } })),
    parentsOf("asset_due_date", "assetId", (where) => db.assetDueDate.findMany({ where, select: { id: true, assetId: true } })),
    parentsOf("inspection_plan", "assetId", (where) => db.inspectionPlan.findMany({ where, select: { id: true, assetId: true } })),
    parentsOf("instrument_impact", "assetId", (where) => db.impactAssessment.findMany({ where, select: { id: true, assetId: true } })),
    parentsOf("supplier_document", "supplierId", (where) => db.supplierDocument.findMany({ where, select: { id: true, supplierId: true } })),
  ]);
  const parents = new Map<string, DueParentRef>(found.flat());

  return shown.map((item) => {
    const parent = parents.get(`${item.entityType}:${item.entityId}`) ?? {};
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
