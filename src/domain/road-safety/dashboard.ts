/**
 * Tablero de seguridad vial (SPEC-road-safety.md, slices 18.3 y 18.4): serie mensual, estado de la
 * exposición, desgloses, habilitación del conductor y exportaciones. Funciones puras: reciben lo que
 * ya trajo la base.
 */
import { csvCell } from "@/domain/inspections/export";
import {
  aggregateRoadWindow,
  computeRoadIndices,
  isRoadEventCounted,
  type RoadEventFacts,
  type RoadIndices,
  type RoadWindowAggregate,
  type VehicleMonth,
} from "@/domain/road-safety/rates";
import { ROAD_EVENT_TYPES, ROAD_MAIN_CAUSES, ROAD_RATE_BASE } from "@/domain/road-safety/types";
import type { IsoDay, MonthKey } from "@/domain/safety-stats/types";

export type RoadMonthPoint = { month: MonthKey; aggregate: RoadWindowAggregate; indices: RoadIndices | null };

/** Una ventana de un mes por cada mes: la serie del tablero. Cada mes suma sus propios km antes de dividir. */
export function monthlyRoadSeries(input: {
  months: readonly MonthKey[];
  vehicleMonths: readonly VehicleMonth[];
  events: readonly RoadEventFacts[];
  minExposureKm: number;
}): RoadMonthPoint[] {
  return input.months.map((month) => {
    const aggregate = aggregateRoadWindow({ months: [month], vehicleMonths: input.vehicleMonths, events: input.events, minExposureKm: input.minExposureKm });
    return { month, aggregate, indices: computeRoadIndices(aggregate) };
  });
}

export type ExposureSummary = {
  totalKm: number;
  /** Vehículos-mes por origen del dato; `noData` suma también los inconsistentes. */
  calculated: number;
  allocated: number;
  manual: number;
  noData: number;
};

/** Estado de la exposición en la ventana: cuántos vehículos-mes salen de odómetros, repartidos, a mano o sin dato. */
export function exposureSummary(vehicleMonths: readonly VehicleMonth[], window: ReadonlySet<MonthKey>): ExposureSummary {
  const s: ExposureSummary = { totalKm: 0, calculated: 0, allocated: 0, manual: 0, noData: 0 };
  for (const v of vehicleMonths) {
    if (!window.has(v.month)) continue;
    if (v.km === null || v.state === "no_data" || v.state === "inconsistent") {
      s.noData += 1;
      continue;
    }
    s.totalKm += v.km;
    if (v.state === "allocated") s.allocated += 1;
    else if (v.state === "manual") s.manual += 1;
    else s.calculated += 1;
  }
  return s;
}

export type BreakdownRow = { key: string; count: number };

function tally(keys: readonly string[], order: readonly string[]): BreakdownRow[] {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i === -1 ? order.length : i;
  };
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
}

/** Desgloses de los eventos que cuentan (D6). Por vehículo va el id; la pantalla lo traduce a su código. */
export function breakdownRoadEvents(events: readonly RoadEventFacts[]) {
  const counted = events.filter(isRoadEventCounted);
  return {
    byType: tally(counted.map((e) => e.eventType), ROAD_EVENT_TYPES.map((o) => o.key)),
    byCause: tally(counted.map((e) => e.mainCause), ROAD_MAIN_CAUSES.map((o) => o.key)),
    byVehicle: tally(counted.flatMap((e) => (e.assetId ? [e.assetId] : [])), []),
    withoutVehicle: counted.filter((e) => !e.assetId).length,
  };
}

// ─── Conductor habilitado (D20, AR-17) ──────────────────────────────────────

export type DriverBlocker = "license_missing" | "license_expired" | "task_not_chosen" | "training_missing" | "task_without_course";

export const DRIVER_BLOCKER_LABELS: Record<DriverBlocker, string> = {
  license_missing: "Sin licencia cargada",
  license_expired: "Licencia vencida",
  task_not_chosen: "Falta elegir la tarea de conducción en Ajustes",
  training_missing: "Falta el manejo defensivo vigente",
  task_without_course: "La tarea de conducción no exige ningún curso",
};

export type DriverEligibilityInput = {
  licenseExpiresOn: IsoDay | null;
  /**
   * Habilitación de la persona para la tarea de conducción que eligió la empresa (Task 20, no depende de que
   * la tarea esté asignada); `null` si todavía no se eligió ninguna tarea.
   */
  qualification: { qualified: boolean; hasRequirements: boolean } | null;
};

/**
 * Habilitado = licencia vigente (hasta su vencimiento, inclusive) **y** manejo defensivo vigente. Sin tarea de
 * conducción elegida, o si la tarea no exige ningún curso, no hay con qué probar el manejo defensivo: no habilita.
 */
export function driverEligibility(input: DriverEligibilityInput, today: IsoDay): { enabled: boolean; blockers: DriverBlocker[] } {
  const blockers: DriverBlocker[] = [];
  if (input.licenseExpiresOn === null) blockers.push("license_missing");
  else if (input.licenseExpiresOn < today) blockers.push("license_expired");
  if (!input.qualification) blockers.push("task_not_chosen");
  else if (!input.qualification.hasRequirements) blockers.push("task_without_course");
  else if (!input.qualification.qualified) blockers.push("training_missing");
  return { enabled: blockers.length === 0, blockers };
}

export function summarizeEligibility(enabledFlags: readonly boolean[]): { total: number; enabled: number; pct: number | null } {
  const enabled = enabledFlags.filter(Boolean).length;
  return { total: enabledFlags.length, enabled, pct: enabledFlags.length === 0 ? null : Math.round((enabled * 10000) / enabledFlags.length) / 100 };
}

// ─── Exportación ────────────────────────────────────────────────────────────

const SEP = ";";
const csvLine = (cells: readonly (string | number | null | undefined)[]) => cells.map(csvCell).join(SEP);
/** CSV para Excel es-AR: UTF-8 con BOM y «;» como separador. */
const toCsv = (lines: readonly string[]) => `﻿${lines.join("\r\n")}\r\n`;
const decimal = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toFixed(2).replace(".", ","));
const STATUS_TEXT = { ok: "completo", partial: "parcial", no_data: "sin datos" } as const;

/** Totales por mes, sin nombres. La base de las tasas va en cada fila; sin km las tasas salen vacías, nunca 0. */
export function roadTotalsToCsv(series: readonly RoadMonthPoint[]): string {
  const header = csvLine([
    "Mes",
    "Km",
    "Eventos (tasa)",
    "Con lesionados",
    "Vuelcos",
    "Eventos por millón de km",
    "Con lesionados por millón de km",
    "Vuelcos por millón de km",
    "Estado",
    "Base",
  ]);
  const base = `por ${ROAD_RATE_BASE.toLocaleString("es-AR")} km`;
  const rows = series.map((p) =>
    csvLine([
      p.month,
      p.aggregate.totalKm,
      p.aggregate.events,
      p.aggregate.injuryEvents,
      p.aggregate.rollovers,
      decimal(p.indices?.eventsPerMillionKm),
      decimal(p.indices?.injuryEventsPerMillionKm),
      decimal(p.indices?.rolloversPerMillionKm),
      STATUS_TEXT[p.aggregate.status],
      base,
    ]),
  );
  return toCsv([header, ...rows]);
}

export type RoadCaseRow = {
  date: IsoDay;
  classification: string;
  eventType: string;
  vehicle: string;
  driver: string;
  mainCause: string;
  seatbelt: string;
  injured: number;
  hospitalized: number;
  fatal: number;
  reportFiled: boolean;
  inItinere: boolean;
};

/** Casos con el nombre del conductor: solo para quien gestiona la seguridad vial (D24); el servidor lo deja registrado. */
export function roadCasesToCsv(rows: readonly RoadCaseRow[]): string {
  const header = csvLine(["Fecha", "Clasificación", "Tipo de evento", "Vehículo", "Conductor", "Causa principal", "Cinturón", "Lesionados", "Internados", "Muertes", "Denuncia", "In itinere"]);
  const yesNo = (b: boolean) => (b ? "sí" : "no");
  const lines = rows.map((r) =>
    csvLine([r.date, r.classification, r.eventType, r.vehicle, r.driver, r.mainCause, r.seatbelt, r.injured, r.hospitalized, r.fatal, yesNo(r.reportFiled), yesNo(r.inItinere)]),
  );
  return toCsv([header, ...lines]);
}
