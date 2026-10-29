import { monthsBetween } from "@/domain/safety-stats/period";
import type { IsoDay, MonthKey } from "@/domain/safety-stats/types";

/**
 * Km por vehículo y mes a partir de los odómetros (SPEC-road-safety D12 a D14). Funciones puras: reciben las
 * lecturas ya traídas y no consultan la base.
 */

export type OdometerReading = {
  day: IsoDay;
  km: number;
  /** Orden de carga: con dos lecturas el mismo día vale la última cargada. */
  seq: number;
};

/** Reinicio o cambio de tablero: corta la serie desde esa fecha (inclusive). */
export type OdometerReset = { effectiveOn: IsoDay };

export type VehicleMonthKmStatus = "ok" | "allocated" | "no_data" | "inconsistent";
export type VehicleMonthKm = { status: VehicleMonthKmStatus; km: number | null };

function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Reparte `total` en enteros proporcionales a `weights` por el método del mayor resto: la suma se conserva
 * y, ante empate de restos, el tramo anterior se queda con la unidad.
 */
export function allocateByDays(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const base = weights.map((w) => Math.floor((total * w) / sum));
  let left = total - base.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, index) => ({ index, rest: (total * w) % sum }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    base[index] += 1;
    left -= 1;
  }
  return base;
}

type Closing = { month: MonthKey; km: number; segment: number };

/** Una lectura de cierre por mes (la última del mes), con el tramo de serie al que pertenece. */
function closingReadings(readings: readonly OdometerReading[], resets: readonly OdometerReset[]): Closing[] {
  const byDay = new Map<IsoDay, OdometerReading>();
  for (const reading of readings) {
    const current = byDay.get(reading.day);
    if (!current || reading.seq >= current.seq) byDay.set(reading.day, reading);
  }
  const sorted = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const closings = new Map<MonthKey, Closing>();
  for (const reading of sorted) {
    const segment = resets.filter((r) => r.effectiveOn <= reading.day).length;
    closings.set(reading.day.slice(0, 7), { month: reading.day.slice(0, 7), km: reading.km, segment });
  }
  return [...closings.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}

/**
 * Km del mes = lectura de cierre menos la del mes anterior. Si entre dos lecturas hay meses sin lectura, el
 * tramo se reparte entre ellos proporcional a los días (`allocated`). Una lectura que baja sin reinicio es
 * `inconsistent`; un reinicio corta la serie sin estimar (`no_data`).
 */
export function computeVehicleMonthKm(input: {
  month: MonthKey;
  readings: readonly OdometerReading[];
  resets: readonly OdometerReset[];
}): VehicleMonthKm {
  const closings = closingReadings(input.readings, input.resets);
  const previous = [...closings].reverse().find((c) => c.month < input.month);
  const next = closings.find((c) => c.month >= input.month);
  if (!previous || !next || previous.segment !== next.segment) return { status: "no_data", km: null };

  const delta = next.km - previous.km;
  if (delta < 0) return { status: "inconsistent", km: null };

  const span = monthsBetween(previous.month, next.month).slice(1);
  if (span.length === 1) return { status: "ok", km: delta };
  const parts = allocateByDays(delta, span.map(daysInMonth));
  return { status: "allocated", km: parts[span.indexOf(input.month)] };
}
