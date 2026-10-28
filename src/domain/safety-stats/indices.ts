import { diffDays } from "@/domain/safety-stats/period";
import type {
  EmployerKind,
  IncidentClassification,
  IsoDay,
  MonthKey,
  SafetySettings,
} from "@/domain/safety-stats/types";

/**
 * Índices de siniestralidad (SPEC-accident-stats.md § Fórmulas).
 * Reciben filas ya agregadas por la base, nunca eventos. Siempre se suman numeradores y
 * denominadores de la ventana antes de dividir; la división y el redondeo usan enteros
 * (BigInt) para no arrastrar errores de punto flotante.
 */

export type Segment = { siteId: string; employerKind: EmployerKind };

export type ExposureRow = Segment & { month: MonthKey; hours: number; headcountAvg: number };

/** Una fila de `groupBy` sobre los incidentes (sede, mes, grupo, clasificación, trayecto, tareas restringidas). */
export type EventAggregate = Segment & {
  month: MonthKey;
  classification: IncidentClassification | string;
  inItinere: boolean;
  restrictedWork: boolean;
  count: number;
  /** Suma de días reales cargados. */
  lostDays: number;
  /** Suma de los porcentajes de cargo (un fatal aporta 100). */
  chargePct: number;
};

/** Casos con baja laborales todavía sin fecha de reintegro, por sede, mes y grupo. */
export type OpenCaseAggregate = Segment & { month: MonthKey; count: number };

export type SegmentMonthStatus = "ok" | "empty" | "missing" | "inconsistent";

/**
 * - Sin fila de exposición: `missing` (sigue pendiente de carga, aunque haya casos).
 * - 0 horas y 0 dotación sin casos con baja ni fatales: `empty` («sin actividad»).
 * - 0 horas con casos con baja o fatales (o con dotación): `inconsistent`.
 * - Con horas: `ok`.
 */
export function classifySegmentMonth(
  row: { hours: number; headcountAvg: number } | undefined,
  raw: { lostOrFatal: number },
): SegmentMonthStatus {
  if (!row) return "missing";
  if (row.hours > 0) return "ok";
  if (raw.lostOrFatal > 0 || row.headcountAvg > 0) return "inconsistent";
  return "empty";
}

export type Totals = {
  hours: number;
  /** Suma, sobre los meses válidos y los grupos, de la dotación promedio mensual. */
  headcountSum: number;
  monthCount: number;
  lostTimeCases: number;
  fatalCases: number;
  noLostTimeCases: number;
  /** Sin baja con tareas restringidas. */
  restrictedCases: number;
  /** Días reales de los casos con baja (los fatales no suman días). */
  lostDays: number;
  chargePctSum: number;
};

export type IndexValues = {
  if: number | null;
  /** Con cargo por fatales e incapacidad permanente. */
  ig: number | null;
  /** Solo días reales. */
  igReal: number | null;
  ii: number | null;
  id: number | null;
  /** Hay datos pero ningún caso con baja no fatal. */
  idNoCases: boolean;
  trir: number | null;
  dart: number | null;
};

const NO_INDICES: IndexValues = {
  if: null,
  ig: null,
  igReal: null,
  ii: null,
  id: null,
  idNoCases: false,
  trir: null,
  dart: null,
};

// El target del proyecto es ES2017: sin literales `0n`.
const big = (n: number) => BigInt(Math.round(n));
const ZERO = big(0);
const TWO = big(2);

/** num/den redondeado (mitad hacia arriba) a `decimals`, con enteros. Solo no negativos. */
function ratio(num: bigint, den: bigint, decimals: number): number | null {
  if (den <= ZERO) return null;
  const scale = big(10 ** decimals);
  const q = (num * scale * TWO + den) / (TWO * den);
  return Number(q) / Number(scale);
}

const PER_MILLION = big(1_000_000);
const PER_THOUSAND = big(1000);
const PER_200K = big(200_000);
/** Escala interna de porcentajes (×100) y de dotación (×10.000). */
const PCT_SCALE = big(10_000);
const HEADCOUNT_SCALE = big(10_000);

export function computeIndices(totals: Totals, settings: Pick<SafetySettings, "fatalChargeDays" | "severityBase">): IndexValues {
  if (totals.monthCount <= 0) return NO_INDICES;

  const lostFatal = totals.lostTimeCases + totals.fatalCases;
  const hours = big(totals.hours);
  const base = big(settings.severityBase);

  const idCases = totals.lostTimeCases;
  const out: IndexValues = {
    ...NO_INDICES,
    id: ratio(big(totals.lostDays), big(idCases), 1),
    idNoCases: idCases === 0,
  };

  if (hours > ZERO) {
    // Σ de porcentajes ×100: el cargo es fatalChargeDays × Σ% / 100 = fatalChargeDays × pct / 10.000.
    const pct = big(totals.chargePctSum * 100);
    const charged = big(totals.lostDays) * PCT_SCALE + big(settings.fatalChargeDays) * pct;
    out.if = ratio(big(lostFatal) * PER_MILLION, hours, 2);
    out.ig = ratio(charged * base, PCT_SCALE * hours, 2);
    out.igReal = ratio(big(totals.lostDays) * base, hours, 2);
    out.trir = ratio(big(totals.fatalCases + totals.lostTimeCases + totals.noLostTimeCases) * PER_200K, hours, 2);
    out.dart = ratio(big(totals.lostTimeCases + totals.restrictedCases) * PER_200K, hours, 2);
  }

  const headcount = big(totals.headcountSum * 10000);
  if (headcount > ZERO) {
    out.ii = ratio(big(lostFatal) * PER_THOUSAND * big(totals.monthCount) * HEADCOUNT_SCALE, headcount, 2);
  }
  return out;
}

export type RawCounts = Record<IncidentClassification, number> & { lostDays: number };

export type WindowResult = {
  status: "ok" | "partial" | "no_data";
  monthsUsed: MonthKey[];
  monthsExcluded: { month: MonthKey; segment: Segment; reason: "missing" | "inconsistent" }[];
  totals: Totals & {
    /** Numerador de IF e II: con baja + fatales laborales. */
    cases: number;
    /** Dotación promedio de la ventana: suma por grupo del promedio de los meses válidos. */
    headcount: number;
  };
  indices: IndexValues;
  /** Meses del rango con algún caso con baja abierto: los días todavía pueden crecer. */
  provisionalMonths: MonthKey[];
  /** Conteos laborales de todo el rango, con o sin exposición. */
  rawCounts: RawCounts;
  /** Accidentes in itinere: aparte, no entran en ningún índice. */
  inItinere: { cases: number; lostDays: number };
};

const segKey = (s: Segment) => `${s.siteId}|${s.employerKind}`;

function emptyRawCounts(): RawCounts {
  return {
    near_miss: 0,
    first_aid: 0,
    no_lost_time: 0,
    lost_time: 0,
    fatal: 0,
    occupational_disease: 0,
    property_damage_only: 0,
    lostDays: 0,
  };
}

export function aggregateWindow(input: {
  exposure: readonly ExposureRow[];
  events: readonly EventAggregate[];
  openCases?: readonly OpenCaseAggregate[];
  months: readonly MonthKey[];
  segments: readonly Segment[];
  settings: Pick<SafetySettings, "fatalChargeDays" | "severityBase">;
}): WindowResult {
  const { months, segments, settings } = input;
  const inScope = new Set(segments.map(segKey));
  const inRange = new Set(months);

  const exposureBy = new Map<string, ExposureRow>();
  for (const row of input.exposure) {
    if (inScope.has(segKey(row)) && inRange.has(row.month)) exposureBy.set(`${segKey(row)}|${row.month}`, row);
  }

  const eventsBy = new Map<string, EventAggregate[]>();
  const rawCounts = emptyRawCounts();
  const inItinere = { cases: 0, lostDays: 0 };
  const lostFatalBy = new Map<string, number>();
  for (const e of input.events) {
    if (!inScope.has(segKey(e)) || !inRange.has(e.month)) continue;
    if (e.inItinere) {
      if (e.classification === "lost_time" || e.classification === "fatal") {
        inItinere.cases += e.count;
        inItinere.lostDays += e.classification === "lost_time" ? e.lostDays : 0;
      }
      continue;
    }
    const key = `${segKey(e)}|${e.month}`;
    eventsBy.set(key, [...(eventsBy.get(key) ?? []), e]);
    if (e.classification in rawCounts && e.classification !== "lostDays") {
      rawCounts[e.classification as IncidentClassification] += e.count;
    }
    if (e.classification === "lost_time") rawCounts.lostDays += e.lostDays;
    if (e.classification === "lost_time" || e.classification === "fatal") {
      lostFatalBy.set(key, (lostFatalBy.get(key) ?? 0) + e.count);
    }
  }

  const totals: Totals = {
    hours: 0,
    headcountSum: 0,
    monthCount: 0,
    lostTimeCases: 0,
    fatalCases: 0,
    noLostTimeCases: 0,
    restrictedCases: 0,
    lostDays: 0,
    chargePctSum: 0,
  };
  const monthsUsed: MonthKey[] = [];
  const monthsExcluded: WindowResult["monthsExcluded"] = [];

  for (const month of months) {
    const statuses = segments.map((segment) => {
      const key = `${segKey(segment)}|${month}`;
      return { segment, key, status: classifySegmentMonth(exposureBy.get(key), { lostOrFatal: lostFatalBy.get(key) ?? 0 }) };
    });
    const bad = statuses.filter((s) => s.status === "missing" || s.status === "inconsistent");
    for (const b of bad) {
      monthsExcluded.push({ month, segment: b.segment, reason: b.status as "missing" | "inconsistent" });
    }
    // El mes cuenta solo si todos los grupos están cargados (ok o sin actividad) y al menos uno tiene horas.
    if (bad.length > 0 || !statuses.some((s) => s.status === "ok")) continue;

    monthsUsed.push(month);
    totals.monthCount += 1;
    for (const s of statuses) {
      if (s.status !== "ok") continue;
      const exp = exposureBy.get(s.key)!;
      totals.hours += exp.hours;
      totals.headcountSum += exp.headcountAvg;
      for (const e of eventsBy.get(s.key) ?? []) {
        switch (e.classification) {
          case "lost_time":
            totals.lostTimeCases += e.count;
            totals.lostDays += e.lostDays;
            totals.chargePctSum += e.chargePct;
            break;
          case "fatal":
            totals.fatalCases += e.count;
            totals.chargePctSum += e.chargePct;
            break;
          case "no_lost_time":
            totals.noLostTimeCases += e.count;
            if (e.restrictedWork) totals.restrictedCases += e.count;
            break;
          default:
            break;
        }
      }
    }
  }

  const provisional = new Set<MonthKey>();
  for (const o of input.openCases ?? []) {
    if (o.count > 0 && inScope.has(segKey(o)) && inRange.has(o.month)) provisional.add(o.month);
  }

  const status: WindowResult["status"] =
    monthsUsed.length === 0 ? "no_data" : monthsExcluded.length > 0 ? "partial" : "ok";

  return {
    status,
    monthsUsed,
    monthsExcluded,
    totals: {
      ...totals,
      cases: totals.lostTimeCases + totals.fatalCases,
      headcount: monthsUsed.length > 0 ? Math.round((totals.headcountSum / monthsUsed.length) * 100) / 100 : 0,
    },
    indices: status === "no_data" ? NO_INDICES : computeIndices(totals, settings),
    provisionalMonths: months.filter((m) => provisional.has(m)),
    rawCounts,
    inItinere,
  };
}

/** Flecha de tendencia contra la ventana anterior: solo si ambas son completas (`ok`) y el índice existe. */
export function compareTrend(
  current: WindowResult,
  previous: WindowResult,
  key: "if" | "ig" | "ii" | "id",
): "up" | "down" | "flat" | null {
  if (current.status !== "ok" || previous.status !== "ok") return null;
  const a = current.indices[key];
  const b = previous.indices[key];
  if (a === null || b === null) return null;
  if (a === b) return "flat";
  return a > b ? "up" : "down";
}

export type LastLostTimeInput = { lastLostTimeOn: IsoDay | null; firstExposureMonth: MonthKey | null };
export type DaysSince =
  | { kind: "days"; days: number }
  | { kind: "none_since"; since: MonthKey }
  | { kind: "no_data" };

/** Días sin accidentes con baja (con baja o fatal laborales) por sede, a la fecha de consulta. */
export function daysSinceLastLostTime(bySite: Record<string, LastLostTimeInput>, asOf: IsoDay): Record<string, DaysSince> {
  const out: Record<string, DaysSince> = {};
  for (const [siteId, info] of Object.entries(bySite)) {
    if (info.lastLostTimeOn) out[siteId] = { kind: "days", days: Math.max(diffDays(info.lastLostTimeOn, asOf), 0) };
    else if (info.firstExposureMonth) out[siteId] = { kind: "none_since", since: info.firstExposureMonth };
    else out[siteId] = { kind: "no_data" };
  }
  return out;
}
