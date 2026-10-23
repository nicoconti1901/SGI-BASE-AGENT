/**
 * Tablero de accidentabilidad (SPEC-accident-stats.md, slice 17.4). Todo se agrega en la base (`groupBy`) y se
 * calcula con las funciones puras del dominio; nunca se traen eventos a memoria. Siempre filtra por `tenantId`.
 * El tablero solo lee la meta de un Indicador vinculado: no escribe mediciones.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SafetyStatsError, aggregateIncidentEvents, getSafetySettings, listExposurePeriods, type SafetyUser } from "@/lib/safety-stats";
import { canManageHealthData } from "@/domain/safety-stats/access";
import {
  describeGaps,
  goalStatus,
  hourBlock,
  resolveWindow,
  segmentsFor,
  WEEKDAY_LABELS,
  type GroupFilter,
  type ResolvedWindow,
  type WindowKind,
} from "@/domain/safety-stats/dashboard";
import {
  aggregateWindow,
  compareTrend,
  daysSinceLastLostTime,
  type DaysSince,
  type WindowResult,
} from "@/domain/safety-stats/indices";
import { localDay } from "@/domain/safety-stats/period";
import { shiftMonth } from "@/domain/safety-stats/exposure-import";
import {
  labelAccidentForm,
  labelBodyPart,
  labelMaterialAgent,
  type IsoDay,
  type MonthKey,
  type SafetySettings,
} from "@/domain/safety-stats/types";

type Db = PrismaClient;

export const SAFETY_METRICS = ["if", "ig", "ii", "id"] as const;
export type SafetyMetric = (typeof SAFETY_METRICS)[number];
export const METRIC_LABELS: Record<SafetyMetric, string> = {
  if: "Índice de frecuencia (IF)",
  ig: "Índice de gravedad (IG)",
  ii: "Índice de incidencia (II)",
  id: "Duración media (ID)",
};

const monthStart = (m: MonthKey) => new Date(`${m}-01T00:00:00.000Z`);
/** Tope de sedes que el tablero considera (una empresa con más agrupa por importación). */
const SITE_LIMIT = 200;

export type DashboardFilter = {
  kind: WindowKind;
  /** Último mes de la ventana. */
  anchor: MonthKey;
  siteId?: string;
  group: GroupFilter;
  today?: IsoDay;
};

export type Distribution = { key: string; label: string; count: number };

export type GoalView = {
  indicatorName: string;
  target: number;
  unit: string;
  direction: "higher_better" | "lower_better";
  status: "met" | "off" | "no_data";
};

export type SafetyDashboard = {
  window: ResolvedWindow;
  settings: SafetySettings;
  sites: { id: string; name: string }[];
  current: WindowResult;
  previous: WindowResult;
  trends: Record<SafetyMetric, "up" | "down" | "flat" | null>;
  /** Por qué faltan datos o el cálculo es parcial, en frases para mostrar. */
  gaps: string[];
  distributions: { form: Distribution[]; agent: Distribution[]; bodyPart: Distribution[]; weekday: Distribution[]; hour: Distribution[] };
  daysSince: { siteId: string; siteName: string; value: DaysSince }[];
  goals: Partial<Record<SafetyMetric, GoalView>>;
};

/** El último mes con horas cargadas (o el mes anterior al actual si todavía no hay nada): el tablero abre ahí. */
export async function defaultAnchorMonth(tenantId: string, today: IsoDay = localDay(new Date()), db: Db = prisma): Promise<MonthKey> {
  const last = await db.exposurePeriod.findFirst({ where: { tenantId }, orderBy: { periodMonth: "desc" }, select: { periodMonth: true } });
  const current = today.slice(0, 7);
  const fallback = shiftMonth(current, -1);
  const found = last?.periodMonth.toISOString().slice(0, 7);
  return found && found <= current ? found : fallback;
}

export async function getSafetyDashboard(tenantId: string, filter: DashboardFilter, db: Db = prisma): Promise<SafetyDashboard> {
  const today = filter.today ?? localDay(new Date());
  const window = resolveWindow(filter.kind, filter.anchor);
  const settings = await getSafetySettings(tenantId, db);

  const allSites = await db.site.findMany({
    where: { tenantId, ...(filter.siteId ? { id: filter.siteId } : {}) },
    orderBy: { name: "asc" },
    take: SITE_LIMIT,
    select: { id: true, name: true, active: true },
  });
  const siteIds = allSites.map((s) => s.id);

  const fromMonth = [...window.previousMonths, ...window.months].sort()[0];
  const toMonth = window.months[window.months.length - 1];
  const range = { tenantId, fromMonth, toMonth, siteIds };
  const [exposure, aggregates] = await Promise.all([listExposurePeriods(range, db), aggregateIncidentEvents(range, db)]);

  // Sedes dadas de baja: solo cuentan si tienen horas o accidentes en el rango (el historial queda).
  const withData = new Set([...exposure.map((e) => e.siteId), ...aggregates.events.map((e) => e.siteId)]);
  const sites = allSites.filter((s) => s.active || withData.has(s.id));
  const segments = segmentsFor(sites, filter.group);
  const settingsForCalc = { fatalChargeDays: settings.fatalChargeDays, severityBase: settings.severityBase };
  const compute = (months: MonthKey[]) =>
    aggregateWindow({ exposure, events: aggregates.events, openCases: aggregates.openCases, months, segments, settings: settingsForCalc });
  const current = compute(window.months);
  const previous = compute(window.previousMonths);

  const siteNames = new Map(sites.map((s) => [s.id, s.name]));
  const trends = Object.fromEntries(SAFETY_METRICS.map((m) => [m, compareTrend(current, previous, m)])) as SafetyDashboard["trends"];

  const [distributions, daysSince, goals] = await Promise.all([
    getDistributions(tenantId, { months: window.months, siteIds: filter.siteId ? [filter.siteId] : undefined, group: filter.group }, db),
    getDaysSince(tenantId, sites.filter((s) => s.active), today, db),
    getGoals(tenantId, current, db),
  ]);

  return {
    window,
    settings,
    sites: sites.map((s) => ({ id: s.id, name: s.name })),
    current,
    previous,
    trends,
    gaps: describeGaps(current, siteNames),
    distributions,
    daysSince,
    goals,
  };
}

// ─── Distribuciones (todo agregado, sin nombres) ────────────────────────────

async function getDistributions(
  tenantId: string,
  input: { months: MonthKey[]; siteIds?: string[]; group: GroupFilter },
  db: Db,
): Promise<SafetyDashboard["distributions"]> {
  const where: Prisma.IncidentRecordWhereInput = {
    tenantId,
    inItinere: false,
    periodMonth: { gte: monthStart(input.months[0]), lte: monthStart(input.months[input.months.length - 1]) },
    finding: { status: { not: "cancelled" } },
    ...(input.siteIds ? { siteId: { in: input.siteIds } } : {}),
    ...(input.group !== "total" ? { employerKind: input.group } : {}),
  };
  const [form, agent, weekday, hour, body] = await Promise.all([
    db.incidentRecord.groupBy({ by: ["accidentForm"], where, _count: { _all: true } }),
    db.incidentRecord.groupBy({ by: ["materialAgent"], where, _count: { _all: true } }),
    db.incidentRecord.groupBy({ by: ["weekday"], where, _count: { _all: true } }),
    db.incidentRecord.groupBy({ by: ["hourOfDay"], where, _count: { _all: true } }),
    db.incidentHealth.groupBy({ by: ["bodyPart"], where: { tenantId, bodyPart: { not: null }, incidentRecord: where }, _count: { _all: true } }),
  ]);
  const sorted = (rows: Distribution[]) => rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));

  const byHour = new Map<string, number>();
  for (const h of hour) byHour.set(hourBlock(h.hourOfDay), (byHour.get(hourBlock(h.hourOfDay)) ?? 0) + h._count._all);
  const byWeekday = new Map(weekday.map((w) => [w.weekday, w._count._all]));

  return {
    form: sorted(form.map((r) => ({ key: r.accidentForm, label: labelAccidentForm(r.accidentForm), count: r._count._all }))),
    agent: sorted(agent.map((r) => ({ key: r.materialAgent, label: labelMaterialAgent(r.materialAgent), count: r._count._all }))),
    bodyPart: sorted(body.flatMap((r) => (r.bodyPart ? [{ key: r.bodyPart, label: labelBodyPart(r.bodyPart), count: r._count._all }] : []))),
    // Lunes a domingo, con los días sin accidentes en cero para que la forma de la semana se lea de un vistazo.
    weekday: [1, 2, 3, 4, 5, 6, 0].map((d) => ({ key: String(d), label: WEEKDAY_LABELS[d], count: byWeekday.get(d) ?? 0 })),
    hour: [...byHour.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ key: label, label, count })),
  };
}

// ─── Días sin accidentes con baja ───────────────────────────────────────────

async function getDaysSince(tenantId: string, sites: { id: string; name: string }[], today: IsoDay, db: Db) {
  if (sites.length === 0) return [];
  const ids = sites.map((s) => s.id);
  const [lastLost, firstExposure] = await Promise.all([
    db.incidentRecord.groupBy({
      by: ["siteId"],
      where: { tenantId, siteId: { in: ids }, inItinere: false, classification: { in: ["lost_time", "fatal"] }, finding: { status: { not: "cancelled" } } },
      _max: { occurredOn: true },
    }),
    db.exposurePeriod.groupBy({ by: ["siteId"], where: { tenantId, siteId: { in: ids } }, _min: { periodMonth: true } }),
  ]);
  const last = new Map(lastLost.map((r) => [r.siteId, r._max.occurredOn]));
  const first = new Map(firstExposure.map((r) => [r.siteId, r._min.periodMonth]));
  const result = daysSinceLastLostTime(
    Object.fromEntries(
      ids.map((id) => [id, { lastLostTimeOn: last.get(id)?.toISOString().slice(0, 10) ?? null, firstExposureMonth: first.get(id)?.toISOString().slice(0, 7) ?? null }]),
    ),
    today,
  );
  return sites.map((s) => ({ siteId: s.id, siteName: s.name, value: result[s.id] }));
}

// ─── Meta de un Indicador vinculado ─────────────────────────────────────────

async function getGoals(tenantId: string, current: WindowResult, db: Db): Promise<SafetyDashboard["goals"]> {
  const links = await db.safetyIndicatorLink.findMany({
    where: { tenantId, indicator: { active: true } },
    select: { metric: true, indicator: { select: { name: true, target: true, unit: true, direction: true } } },
  });
  const out: SafetyDashboard["goals"] = {};
  for (const link of links) {
    if (!(SAFETY_METRICS as readonly string[]).includes(link.metric)) continue;
    const metric = link.metric as SafetyMetric;
    out[metric] = {
      indicatorName: link.indicator.name,
      target: link.indicator.target,
      unit: link.indicator.unit,
      direction: link.indicator.direction,
      status: goalStatus(current.indices[metric], { target: link.indicator.target, direction: link.indicator.direction }),
    };
  }
  return out;
}

// ─── Vínculo índice ↔ Indicador (Ajustes) ───────────────────────────────────

export async function listLinkableIndicators(tenantId: string, db: Db = prisma) {
  return db.indicator.findMany({
    where: { tenantId, active: true },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, unit: true, target: true },
  });
}

export async function getIndicatorLinks(tenantId: string, db: Db = prisma): Promise<Partial<Record<SafetyMetric, string>>> {
  const rows = await db.safetyIndicatorLink.findMany({ where: { tenantId }, select: { metric: true, indicatorId: true } });
  return Object.fromEntries(rows.map((r) => [r.metric, r.indicatorId]));
}

/** Vincula (o desvincula, con `null`) cada índice con un Indicador de la empresa. Solo lee su meta. */
export async function setIndicatorLinks(
  input: { tenantId: string; actor: SafetyUser; links: Partial<Record<SafetyMetric, string | null>> },
  db: Db = prisma,
): Promise<void> {
  if (!canManageHealthData(input.actor)) throw new SafetyStatsError("Sin permiso para cambiar los ajustes");
  const wanted = Object.entries(input.links).filter((e): e is [SafetyMetric, string | null] => (SAFETY_METRICS as readonly string[]).includes(e[0]));
  const ids = [...new Set(wanted.flatMap(([, id]) => (id ? [id] : [])))];
  if (ids.length > 0) {
    const found = await db.indicator.count({ where: { tenantId: input.tenantId, active: true, id: { in: ids } } });
    if (found !== ids.length) throw new SafetyStatsError("Alguno de los indicadores no existe o está dado de baja");
  }
  await db.$transaction(async (tx) => {
    for (const [metric, indicatorId] of wanted) {
      if (indicatorId) {
        await tx.safetyIndicatorLink.upsert({
          where: { tenantId_metric: { tenantId: input.tenantId, metric } },
          create: { tenantId: input.tenantId, metric, indicatorId },
          update: { indicatorId },
        });
      } else {
        await tx.safetyIndicatorLink.deleteMany({ where: { tenantId: input.tenantId, metric } });
      }
    }
    await tx.masterDataAudit.create({
      data: {
        tenantId: input.tenantId,
        entityType: "safety_settings",
        entityId: input.tenantId,
        action: "update",
        actorUserId: input.actor.userId,
        summary: "Cambio de los indicadores vinculados al tablero de accidentabilidad",
      },
    });
  });
}
