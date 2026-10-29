/**
 * Tablero de seguridad vial (SPEC-road-safety.md, 18.3): junta eventos, km y flota de la empresa y arma lo
 * que muestra `/road-safety`. Los nombres de los conductores solo salen para quien gestiona el módulo (D24).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { FLEET_KM_TYPE_KEYS, getFleetVehicleMonths, getRoadSafetySettings, type RoadUser } from "@/lib/road-safety";
import { getDriverSummary } from "@/lib/road-drivers";
import { canManageRoadSafety } from "@/domain/road-safety/access";
import {
  breakdownRoadEvents,
  exposureSummary,
  monthlyRoadSeries,
  roadCasesToCsv,
  type ExposureSummary,
  type RoadCaseRow,
  type RoadMonthPoint,
} from "@/domain/road-safety/dashboard";
import { fleetInspectionCompliance, intermediateFactors, repeatDrivers } from "@/domain/road-safety/factors";
import {
  aggregateRoadWindow,
  classifyRoadEvent,
  computeRoadIndices,
  type RoadEventFacts,
  type RoadIndices,
  type RoadWindowAggregate,
} from "@/domain/road-safety/rates";
import {
  labelRoadEventType,
  labelRoadMainCause,
  labelRoadSeatbelt,
  type RoadSafetySettings,
} from "@/domain/road-safety/types";
import { resolveWindow, type ResolvedWindow, type WindowKind } from "@/domain/safety-stats/dashboard";
import { shiftMonth } from "@/domain/safety-stats/exposure-import";
import { diffDays } from "@/domain/safety-stats/period";
import { CLASSIFICATION_LABELS, type IsoDay, type MonthKey } from "@/domain/safety-stats/types";

type Db = PrismaClient;

/** Tope de eventos viales que se traen por consulta; con 12 meses de una flota normal sobra. */
export const ROAD_EVENTS_LIMIT = 5000;

const monthDate = (month: MonthKey) => new Date(`${month}-01T00:00:00.000Z`);
const nextMonthStart = (month: MonthKey) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1));
};

const eventSelect = {
  id: true,
  vehicleKind: true,
  assetId: true,
  driverPersonId: true,
  eventType: true,
  seatbelt: true,
  mainCause: true,
  injuredCount: true,
  hospitalizedCount: true,
  fatalCount: true,
  reportFiled: true,
  incidentRecord: { select: { periodMonth: true, classification: true, inItinere: true } },
} satisfies Prisma.RoadEventDetailSelect;

type EventRow = Prisma.RoadEventDetailGetPayload<{ select: typeof eventSelect }>;

const toFacts = (r: EventRow): RoadEventFacts => ({
  id: r.id,
  month: r.incidentRecord.periodMonth.toISOString().slice(0, 7),
  classification: r.incidentRecord.classification,
  inItinere: r.incidentRecord.inItinere,
  vehicleKind: r.vehicleKind,
  assetId: r.assetId,
  driverPersonId: r.driverPersonId,
  eventType: r.eventType,
  seatbelt: r.seatbelt,
  mainCause: r.mainCause,
  injuredCount: r.injuredCount,
  hospitalizedCount: r.hospitalizedCount,
  fatalCount: r.fatalCount,
  reportFiled: r.reportFiled,
});

/** Eventos viales de la empresa entre dos meses (inclusive). Los hallazgos anulados no cuentan, igual que en accidentabilidad. */
async function loadRoadEvents(db: Db, tenantId: string, from: MonthKey, to: MonthKey) {
  return db.roadEventDetail.findMany({
    where: {
      tenantId,
      incidentRecord: { isRoad: true, periodMonth: { gte: monthDate(from), lt: nextMonthStart(to) }, finding: { status: { not: "cancelled" } } },
    },
    select: eventSelect,
    orderBy: [{ incidentRecord: { occurredOn: "desc" } }, { id: "asc" }],
    take: ROAD_EVENTS_LIMIT,
  });
}

/** Eventos de la tasa por «activo|mes», para detectar km = 0 con eventos. */
function rateEventCounts(events: readonly RoadEventFacts[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (classifyRoadEvent(e) !== "rate" || !e.assetId) continue;
    const key = `${e.assetId}|${e.month}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export type RoadRateBlock = { label: string; aggregate: RoadWindowAggregate; indices: RoadIndices | null; missingLabels: string[] };

export type RoadDashboard = {
  kind: WindowKind;
  anchor: MonthKey;
  window: ResolvedWindow;
  settings: RoadSafetySettings;
  /** Tasas del mes, del año y de los últimos 12 meses, siempre las tres (SPEC § Qué ve el cliente). */
  rates: { month: RoadRateBlock; ytd: RoadRateBlock; rolling12: RoadRateBlock };
  /** Resultado final y conteos de la ventana elegida. */
  result: RoadWindowAggregate;
  exposure: ExposureSummary & { vehicles: number };
  series: RoadMonthPoint[];
  intermediate: ReturnType<typeof intermediateFactors> & {
    fleet: { total: number; upToDate: number; overdue: { id: string; code: string }[] };
    speeding: { total: number; loadedMonths: number };
    /** Conductores habilitados (D20): solo el resumen, sin nombres. */
    drivers: { configured: boolean; taskName: string | null; total: number; enabled: number; pct: number | null };
  };
  breakdown: {
    byType: { key: string; label: string; count: number }[];
    byCause: { key: string; label: string; count: number }[];
    byVehicle: { key: string; label: string; count: number }[];
    withoutVehicle: number;
  };
  /** Solo para quien gestiona (D24); el resto recibe `null`. */
  review: { personId: string; name: string; count: number }[] | null;
  canSeeDrivers: boolean;
};

const vehicleLabel = (v: { code: string }) => v.code;

export async function getRoadDashboard(
  input: { tenantId: string; actor: RoadUser; kind: WindowKind; anchor: MonthKey; today: IsoDay },
  db: Db = prisma,
): Promise<RoadDashboard> {
  const { tenantId, actor, kind, anchor, today } = input;
  const canSeeDrivers = canManageRoadSafety(actor);
  const settings = await getRoadSafetySettings(tenantId, db);
  const window = resolveWindow(kind, anchor);
  const rolling = resolveWindow("rolling12", anchor);
  const yearToDate = resolveWindow("ytd", anchor);
  const eventsFrom = shiftMonth(anchor, -(Math.max(12, settings.repeatWindowMonths) - 1));

  const eventRows = await loadRoadEvents(db, tenantId, eventsFrom, anchor);
  const allEvents = eventRows.map(toFacts);
  const inRolling = new Set(rolling.months);
  const events12 = allEvents.filter((e) => inRolling.has(e.month));

  const { vehicleMonths, vehicles } = await getFleetVehicleMonths(tenantId, rolling.months, rateEventCounts(events12), db);
  const codeOf = new Map(vehicles.map((v) => [v.id, vehicleLabel(v)]));

  const block = (w: ResolvedWindow, label: string): RoadRateBlock => {
    const aggregate = aggregateRoadWindow({ months: w.months, vehicleMonths, events: events12, minExposureKm: settings.minExposureKm });
    return {
      label,
      aggregate,
      indices: computeRoadIndices(aggregate),
      missingLabels: aggregate.missing.map((m) => `${codeOf.get(m.assetId) ?? "vehículo"} (${m.month})`),
    };
  };
  const windowMonths = new Set(window.months);
  const windowEvents = events12.filter((e) => windowMonths.has(e.month));
  const result = aggregateRoadWindow({ months: window.months, vehicleMonths, events: events12, minExposureKm: settings.minExposureKm });

  const [fleet, speeding, drivers, review] = await Promise.all([
    loadFleetCompliance(db, tenantId, today),
    db.speedingPeriod.aggregate({
      where: { tenantId, periodMonth: { gte: monthDate(window.months[0]), lte: monthDate(window.months[window.months.length - 1]) } },
      _sum: { count: true },
      _count: { _all: true },
    }),
    getDriverSummary(tenantId, today, db),
    canSeeDrivers ? loadReviewList(db, tenantId, actor, allEvents, settings, anchor) : Promise.resolve(null),
  ]);

  const breakdown = breakdownRoadEvents(windowEvents);
  const label = (list: readonly { key: string; count: number }[], fn: (k: string) => string) => list.map((r) => ({ ...r, label: fn(r.key) }));
  return {
    kind,
    anchor,
    window,
    settings,
    rates: {
      month: block(resolveWindow("month", anchor), "Mes"),
      ytd: block(yearToDate, "Año"),
      rolling12: block(rolling, "Últimos 12 meses"),
    },
    result,
    exposure: { ...exposureSummary(vehicleMonths, windowMonths), vehicles: vehicles.length },
    series: monthlyRoadSeries({ months: rolling.months, vehicleMonths, events: events12, minExposureKm: settings.minExposureKm }),
    intermediate: {
      ...intermediateFactors({ events: windowEvents }),
      fleet: { total: fleet.total, upToDate: fleet.upToDate, overdue: fleet.overdue },
      speeding: { total: speeding._sum.count ?? 0, loadedMonths: speeding._count._all },
      drivers,
    },
    breakdown: {
      byType: label(breakdown.byType, labelRoadEventType),
      byCause: label(breakdown.byCause, labelRoadMainCause),
      byVehicle: label(breakdown.byVehicle, (id) => codeOf.get(id) ?? "Vehículo dado de baja"),
      withoutVehicle: breakdown.withoutVehicle,
    },
    review,
    canSeeDrivers,
  };
}

/** Flota al día (D19): vehículos livianos activos con inspección periódica no vencida. Sin inspección cuenta como vencido (AR-16). */
async function loadFleetCompliance(db: Db, tenantId: string, today: IsoDay) {
  const vehicles = await db.asset.findMany({
    where: { tenantId, typeKey: { in: FLEET_KM_TYPE_KEYS }, status: { not: "retired" } },
    select: { id: true, code: true, plans: { where: { active: true }, select: { lastInspectedAt: true, nextDueAt: true } } },
    orderBy: { code: "asc" },
    take: 500,
  });
  const result = fleetInspectionCompliance({
    asOf: today,
    vehicles: vehicles.map((v) => {
      const inspected = v.plans.flatMap((p) => (p.lastInspectedAt ? [p.lastInspectedAt.toISOString().slice(0, 10)] : []));
      const last = inspected.sort().at(-1) ?? null;
      const dues = v.plans.flatMap((p) => (p.nextDueAt ? [p.nextDueAt.toISOString().slice(0, 10)] : [])).sort();
      // La periodicidad sale del propio calendario: de la última inspección al próximo vencimiento.
      const intervalDays = last && dues[0] ? diffDays(last, dues[0]) : null;
      return { assetId: v.id, lastInspectionOn: last, intervalDays, toleranceDays: 0 };
    }),
  });
  const codes = new Map(vehicles.map((v) => [v.id, v.code]));
  return {
    total: result.total,
    upToDate: result.upToDate,
    overdue: result.overdueAssetIds.map((id) => ({ id, code: codes.get(id) ?? id })),
  };
}

/** Lista «para revisar» (D24, D25): conductores con eventos repetidos. Consultarla deja registro. */
async function loadReviewList(db: Db, tenantId: string, actor: RoadUser, events: readonly RoadEventFacts[], settings: RoadSafetySettings, anchor: MonthKey) {
  const flagged = repeatDrivers({ events, threshold: settings.repeatThreshold, windowMonths: settings.repeatWindowMonths, asOfMonth: anchor });
  if (flagged.length === 0) return [];
  const people = await db.person.findMany({ where: { tenantId, id: { in: flagged.map((f) => f.personId) } }, select: { id: true, name: true } });
  const names = new Map(people.map((p) => [p.id, p.name]));
  await db.masterDataAudit.create({
    data: {
      tenantId,
      entityType: "road_review_list",
      entityId: tenantId,
      action: "view",
      actorUserId: actor.userId,
      summary: `Consulta de la lista de conductores para revisar (${flagged.length})`,
    },
  });
  return flagged.map((f) => ({ ...f, name: names.get(f.personId) ?? "Persona dada de baja" }));
}

/** Meses con eventos viales o km, del más reciente al más antiguo: el selector del tablero. */
export function roadMonthOptions(today: IsoDay, count = 24): MonthKey[] {
  const current = today.slice(0, 7);
  return Array.from({ length: count }, (_, i) => shiftMonth(current, -(i + 1)));
}

/** Mes de cierre por defecto: el último mes cerrado (el actual todavía está en curso y no tiene km). */
export const defaultRoadAnchor = (today: IsoDay): MonthKey => shiftMonth(today.slice(0, 7), -1);

/**
 * Casos con el conductor (D24). Solo quien gestiona; deja registro de quién bajó la lista. Devuelve las filas
 * del CSV ya con las etiquetas en español.
 */
export async function exportRoadCases(
  input: { tenantId: string; actor: RoadUser; months: readonly MonthKey[] },
  db: Db = prisma,
): Promise<{ csv: string; rows: number; truncated: boolean }> {
  if (!canManageRoadSafety(input.actor)) throw new Error("Tu rol no permite exportar casos con nombre");
  const rows = await db.roadEventDetail.findMany({
    where: {
      tenantId: input.tenantId,
      incidentRecord: {
        isRoad: true,
        periodMonth: { gte: monthDate(input.months[0]), lt: nextMonthStart(input.months[input.months.length - 1]) },
        finding: { status: { not: "cancelled" } },
      },
    },
    select: {
      ...eventSelect,
      vehicleLabel: true,
      asset: { select: { code: true } },
      driver: { select: { name: true } },
      incidentRecord: { select: { periodMonth: true, classification: true, inItinere: true, occurredOn: true } },
    },
    orderBy: [{ incidentRecord: { occurredOn: "asc" } }, { id: "asc" }],
    take: ROAD_EVENTS_LIMIT + 1,
  });
  const truncated = rows.length > ROAD_EVENTS_LIMIT;
  const shown = rows.slice(0, ROAD_EVENTS_LIMIT);
  const csvRows: RoadCaseRow[] = shown.map((r) => ({
    date: r.incidentRecord.occurredOn.toISOString().slice(0, 10),
    classification: CLASSIFICATION_LABELS[r.incidentRecord.classification],
    eventType: labelRoadEventType(r.eventType),
    vehicle: r.asset?.code ?? r.vehicleLabel ?? "—",
    driver: r.driver?.name ?? "—",
    mainCause: labelRoadMainCause(r.mainCause),
    seatbelt: labelRoadSeatbelt(r.seatbelt),
    injured: r.injuredCount,
    hospitalized: r.hospitalizedCount,
    fatal: r.fatalCount,
    reportFiled: r.reportFiled,
    inItinere: r.incidentRecord.inItinere,
  }));
  await db.masterDataAudit.create({
    data: {
      tenantId: input.tenantId,
      entityType: "road_cases_export",
      entityId: input.tenantId,
      action: "view",
      actorUserId: input.actor.userId,
      summary: `Descarga de casos viales con nombre de conductor (${csvRows.length})`,
    },
  });
  return { csv: roadCasesToCsv(csvRows), rows: csvRows.length, truncated };
}

/** Serie para el CSV de totales: una fila por mes de la ventana, con los mismos km y reglas del tablero. */
export async function getRoadTotalsSeries(
  input: { tenantId: string; months: readonly MonthKey[] },
  db: Db = prisma,
): Promise<RoadMonthPoint[]> {
  const settings = await getRoadSafetySettings(input.tenantId, db);
  const rows = await loadRoadEvents(db, input.tenantId, input.months[0], input.months[input.months.length - 1]);
  const events = rows.map(toFacts);
  const { vehicleMonths } = await getFleetVehicleMonths(input.tenantId, input.months, rateEventCounts(events), db);
  return monthlyRoadSeries({ months: input.months, vehicleMonths, events, minExposureKm: settings.minExposureKm });
}
