import { Prisma, type InspectionResult } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Db } from "@/lib/inspection-support";
import { addDays, dateFromIso, isIsoDate, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { MAX_EXPORT_ROWS, type InspectionCsvRow } from "@/domain/inspections/export";

export const INSPECTIONS_PAGE_SIZE = 25;

export type InspectionListFilter = {
  status?: "draft" | "closed";
  assetId?: string;
  /** Parte del código del activo, sin distinguir mayúsculas. */
  assetCode?: string;
  inspectorUserId?: string;
  templateId?: string;
  siteId?: string;
  result?: InspectionResult;
  /** AAAA-MM-DD, ambos incluidos. */
  from?: string;
  to?: string;
  after?: string;
  take?: number;
};

function dateRange(from?: string, to?: string): Prisma.InspectionWhereInput {
  const gte = from && isIsoDate(from) ? dateFromIso(from) : undefined;
  const lte = to && isIsoDate(to) ? dateFromIso(to) : undefined;
  return gte || lte ? { inspectedAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {};
}

function inspectionWhere(tenantId: string, filter: InspectionListFilter): Prisma.InspectionWhereInput {
  const code = filter.assetCode?.trim();
  const [afterDate, afterId] = filter.after?.split("_") ?? [];
  const cursor: Prisma.InspectionWhereInput =
    afterDate && afterId && isIsoDate(afterDate)
      ? { OR: [{ inspectedAt: { lt: dateFromIso(afterDate) } }, { inspectedAt: dateFromIso(afterDate), id: { lt: afterId } }] }
      : {};
  return {
    tenantId,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.assetId ? { assetId: filter.assetId } : {}),
    ...(code ? { asset: { code: { contains: code, mode: "insensitive" as const } } } : {}),
    ...(filter.inspectorUserId ? { inspectorUserId: filter.inspectorUserId } : {}),
    ...(filter.templateId ? { templateId: filter.templateId } : {}),
    ...(filter.siteId ? { siteId: filter.siteId } : {}),
    ...(filter.result ? { result: filter.result } : {}),
    AND: [dateRange(filter.from, filter.to), cursor],
  };
}

const listInclude = {
  asset: { select: { code: true, description: true } },
  template: { select: { name: true } },
  site: { select: { name: true } },
} satisfies Prisma.InspectionInclude;

async function namesOf(db: Db, userIds: string[]) {
  const ids = [...new Set(userIds)];
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  return new Map(users.map((u) => [u.id, u.name]));
}

/** Página por cursor `(fecha, id)`: la consulta no crece con el tamaño de la página ni con los filtros. */
export async function listInspections(tenantId: string, filter: InspectionListFilter = {}, db: Db = prisma) {
  const take = Math.min(filter.take ?? INSPECTIONS_PAGE_SIZE, 100);
  const rows = await db.inspection.findMany({
    where: inspectionWhere(tenantId, filter),
    orderBy: [{ inspectedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    include: listInclude,
  });
  const page = rows.slice(0, take);
  const names = await namesOf(db, page.map((r) => r.inspectorUserId));
  const last = page[page.length - 1];
  return {
    items: page.map((r) => ({ ...r, inspectorName: names.get(r.inspectorUserId) ?? "Usuario" })),
    nextCursor: rows.length > take && last ? `${isoFromDate(last.inspectedAt)}_${last.id}` : null,
  };
}

// ─── Contadores ────────────────────────────────────────────────────────────

/** Ventana de «no aptas»: las de los últimos 30 días. */
export const UNFIT_WINDOW_DAYS = 30;

/**
 * Los cuatro contadores de arriba de la lista. Todos son `count` indexados: «vencidas» y «próximas» salen del
 * programa (una fila por activo y plantilla), nunca de agregar sobre la tabla de inspecciones.
 */
export async function inspectionCounters(tenantId: string, db: Db = prisma) {
  const today = todayIso();
  const start = dateFromIso(today);
  const [overdue, upcoming, unfit, outOfService] = await Promise.all([
    db.inspectionPlan.count({ where: { tenantId, active: true, nextDueAt: { lt: start } } }),
    db.inspectionPlan.count({ where: { tenantId, active: true, nextDueAt: { gte: start, lte: dateFromIso(addDays(today, 7)) } } }),
    db.inspection.count({ where: { tenantId, status: "closed", result: "unfit", inspectedAt: { gte: dateFromIso(addDays(today, -UNFIT_WINDOW_DAYS)) } } }),
    db.asset.count({ where: { tenantId, status: "out_of_service" } }),
  ]);
  return { overdue, upcoming, unfit, outOfService, unfitSince: addDays(today, -UNFIT_WINDOW_DAYS) };
}

export type DuePlanKind = "overdue" | "upcoming";

/** Programas vencidos o por vencer en 7 días, del más atrasado al más próximo. Cursor `(fecha, id)`. */
export async function listDuePlans(tenantId: string, input: { kind: DuePlanKind; after?: string; take?: number }, db: Db = prisma) {
  const take = Math.min(input.take ?? INSPECTIONS_PAGE_SIZE, 100);
  const today = todayIso();
  const range: Prisma.InspectionPlanWhereInput =
    input.kind === "overdue"
      ? { nextDueAt: { lt: dateFromIso(today) } }
      : { nextDueAt: { gte: dateFromIso(today), lte: dateFromIso(addDays(today, 7)) } };
  const [afterDate, afterId] = input.after?.split("_") ?? [];
  const cursor: Prisma.InspectionPlanWhereInput =
    afterDate && afterId && isIsoDate(afterDate)
      ? { OR: [{ nextDueAt: { gt: dateFromIso(afterDate) } }, { nextDueAt: dateFromIso(afterDate), id: { gt: afterId } }] }
      : {};
  const rows = await db.inspectionPlan.findMany({
    where: { tenantId, active: true, AND: [range, cursor] },
    orderBy: [{ nextDueAt: "asc" }, { id: "asc" }],
    take: take + 1,
    include: {
      asset: { select: { id: true, code: true, description: true, status: true } },
      site: { select: { name: true } },
      template: { select: { name: true } },
    },
  });
  const page = rows.slice(0, take);
  const last = page[page.length - 1];
  return {
    items: page.map((p) => ({ ...p, dueIso: isoFromDate(p.nextDueAt!) })),
    nextCursor: rows.length > take && last?.nextDueAt ? `${isoFromDate(last.nextDueAt)}_${last.id}` : null,
  };
}

// ─── Exportación ───────────────────────────────────────────────────────────

const BATCH = 1000;
const ARGENTINA_DATETIME = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Filas para el CSV con los mismos filtros de la lista, en tandas por cursor y con tope. */
export async function exportInspectionRows(tenantId: string, filter: InspectionListFilter = {}, db: Db = prisma) {
  const rows: InspectionCsvRow[] = [];
  let after: string | undefined;
  let truncated = false;
  while (true) {
    const batch = await db.inspection.findMany({
      where: inspectionWhere(tenantId, { ...filter, after }),
      orderBy: [{ inspectedAt: "desc" }, { id: "desc" }],
      take: BATCH,
      include: { ...listInclude },
    });
    if (batch.length === 0) break;
    const names = await namesOf(db, batch.map((r) => r.inspectorUserId));
    for (const r of batch) {
      if (rows.length >= MAX_EXPORT_ROWS) {
        truncated = true;
        break;
      }
      rows.push({
        inspectedAt: isoFromDate(r.inspectedAt),
        templateName: r.template.name,
        assetCode: r.asset?.code ?? null,
        assetDescription: r.asset?.description ?? null,
        siteName: r.site.name,
        sector: r.sector,
        inspectorName: names.get(r.inspectorUserId) ?? "Usuario",
        status: r.status,
        result: r.result,
        scorePct: r.scorePct,
        conformCount: r.conformCount,
        applicableCount: r.applicableCount,
        nonconformCount: r.nonconformCount,
        closedAt: r.closedAt ? ARGENTINA_DATETIME.format(r.closedAt).replace(",", "") : null,
        hasAction: r.actionId !== null,
        hasFinding: r.findingId !== null,
      });
    }
    if (truncated || batch.length < BATCH) break;
    const last = batch[batch.length - 1];
    after = `${isoFromDate(last.inspectedAt)}_${last.id}`;
  }
  return { rows, truncated };
}
