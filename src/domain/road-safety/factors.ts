import { classifyRoadEvent, isRoadEventCounted, type RoadEventFacts } from "@/domain/road-safety/rates";
import { addDays, diffDays, monthsBetween } from "@/domain/safety-stats/period";
import type { IsoDay, MonthKey } from "@/domain/safety-stats/types";

/** Conductores con `threshold` o más eventos en misión en la ventana (D25). Es para revisión, no para sanción. */
export function repeatDrivers(input: {
  events: readonly RoadEventFacts[];
  threshold: number;
  windowMonths: number;
  asOfMonth: MonthKey;
}): { personId: string; count: number }[] {
  const [y, m] = input.asOfMonth.split("-").map(Number);
  const startIndex = y * 12 + (m - 1) - (input.windowMonths - 1);
  const from = `${Math.floor(startIndex / 12)}-${String((startIndex % 12) + 1).padStart(2, "0")}`;
  const window = new Set(monthsBetween(from, input.asOfMonth));
  const counts = new Map<string, number>();
  for (const e of input.events) {
    if (!e.driverPersonId || !window.has(e.month)) continue;
    const bucket = classifyRoadEvent(e);
    if (bucket !== "rate" && bucket !== "unattributed") continue;
    counts.set(e.driverPersonId, (counts.get(e.driverPersonId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= input.threshold)
    .map(([personId, count]) => ({ personId, count }))
    .sort((a, b) => b.count - a.count || a.personId.localeCompare(b.personId));
}

export type FleetVehicleInspection = {
  assetId: string;
  lastInspectionOn: IsoDay | null;
  /** Periodicidad del tipo de activo, en días; `null` si el tipo no tiene una. */
  intervalDays: number | null;
  toleranceDays: number;
};

/**
 * Flota al día (D19): vehículo activo con inspección periódica no vencida. Sin inspección cuenta como
 * vencido; si el tipo no define periodicidad, alcanza con haber sido inspeccionado alguna vez.
 */
export function fleetInspectionCompliance(input: { asOf: IsoDay; vehicles: readonly FleetVehicleInspection[] }): {
  total: number;
  upToDate: number;
  overdueAssetIds: string[];
} {
  const overdueAssetIds: string[] = [];
  for (const v of input.vehicles) {
    const upToDate =
      v.lastInspectionOn !== null &&
      (v.intervalDays === null || diffDays(addDays(v.lastInspectionOn, v.intervalDays + v.toleranceDays), input.asOf) <= 0);
    if (!upToDate) overdueAssetIds.push(v.assetId);
  }
  overdueAssetIds.sort();
  return { total: input.vehicles.length, upToDate: input.vehicles.length - overdueAssetIds.length, overdueAssetIds };
}

export type IntermediateFactors = {
  /** Eventos viales de la ventana que no son casi accidentes. */
  eventCount: number;
  /** Eventos con dato de cinturón (excluye «no aplica» y «no se sabe»). */
  seatbeltBase: number;
  seatbeltPct: number | null;
  fatigueOrAlcoholCount: number;
  reportFiledCount: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Medidas del grupo «resultados intermedios» que salen de los eventos (D18). Flota y habilitados las aporta el tablero. */
export function intermediateFactors(input: { events: readonly RoadEventFacts[] }): IntermediateFactors {
  const counted = input.events.filter(isRoadEventCounted);
  const withBelt = counted.filter((e) => e.seatbelt !== "not_applicable" && e.seatbelt !== "unknown");
  const allBelted = withBelt.filter((e) => e.seatbelt === "all").length;
  return {
    eventCount: counted.length,
    seatbeltBase: withBelt.length,
    seatbeltPct: withBelt.length === 0 ? null : round2((allBelted * 100) / withBelt.length),
    fatigueOrAlcoholCount: counted.filter((e) => e.mainCause === "fatigue_distraction" || e.mainCause === "alcohol_drugs").length,
    reportFiledCount: counted.filter((e) => e.reportFiled).length,
  };
}
