import type { VehicleMonthKm } from "@/domain/road-safety/km";
import {
  ROAD_RATE_BASE,
  type RoadEventType,
  type RoadMainCause,
  type RoadSeatbelt,
  type RoadVehicleKind,
} from "@/domain/road-safety/types";
import type { IncidentClassification, MonthKey } from "@/domain/safety-stats/types";

/** Datos mínimos de un evento vial para las tasas y los factores. Ya traídos de la base. */
export type RoadEventFacts = {
  id: string;
  month: MonthKey;
  classification: IncidentClassification;
  inItinere: boolean;
  vehicleKind: RoadVehicleKind;
  assetId: string | null;
  driverPersonId: string | null;
  eventType: RoadEventType;
  seatbelt: RoadSeatbelt;
  mainCause: RoadMainCause;
  injuredCount: number;
  hospitalizedCount: number;
  fatalCount: number;
  reportFiled: boolean;
};

/**
 * Dónde cuenta un evento:
 * - `no_damage`: casi accidente; no entra en las tasas (D6, D10).
 * - `outside_control`: in itinere o vehículo particular/sin vehículo; cuenta como evento, sin tasa por km (D11).
 * - `rate`: en misión con vehículo cargado (propio, o de contratista con vehículo; D17).
 * - `unattributed`: en misión sin vehículo cargado; cuenta como evento, sin tasa (D15).
 */
export type RoadEventBucket = "no_damage" | "outside_control" | "rate" | "unattributed";

export function classifyRoadEvent(e: Pick<RoadEventFacts, "classification" | "inItinere" | "vehicleKind" | "assetId">): RoadEventBucket {
  if (e.classification === "near_miss") return "no_damage";
  if (e.inItinere || e.vehicleKind === "private" || e.vehicleKind === "none") return "outside_control";
  return e.assetId ? "rate" : "unattributed";
}

/** D6: todo evento de la flota en misión que no es un casi accidente. */
export const isRoadEventCounted = (e: RoadEventFacts) => classifyRoadEvent(e) !== "no_damage";

/** D6, D11, D17: solo los eventos con vehículo cargado entran en las tasas por km. */
export const isRoadRateEligible = (e: RoadEventFacts) => classifyRoadEvent(e) === "rate";

export type VehicleMonthState = "ok" | "allocated" | "manual" | "no_data" | "inconsistent";
export type VehicleMonth = { assetId: string; month: MonthKey; state: VehicleMonthState; km: number | null };

/**
 * Estado final de un vehículo-mes. Un km cargado a mano manda sobre lo calculado; km = 0 con eventos de la
 * tasa es inconsistente (se excluye hasta corregirlo) y sin eventos es válido (SPEC § Casos borde).
 */
export function classifyVehicleMonth(input: {
  computed: VehicleMonthKm;
  stored: { km: number; source: "odometer" | "manual" } | null;
  rateEvents: number;
}): { state: VehicleMonthState; km: number | null } {
  const { computed, stored, rateEvents } = input;
  if (stored?.source === "manual") return { state: "manual", km: stored.km };
  const km = stored ? stored.km : computed.km;
  const state: VehicleMonthState = stored ? (computed.status === "allocated" ? "allocated" : "ok") : computed.status;
  if (state === "no_data" || state === "inconsistent" || km === null) {
    return { state: state === "inconsistent" ? "inconsistent" : "no_data", km: null };
  }
  if (km === 0 && rateEvents > 0) return { state: "inconsistent", km: null };
  return { state, km };
}

export type RoadWindowAggregate = {
  /** `ok`: todos los vehículos-mes tienen km; `partial`: faltan algunos; `no_data`: ninguno sirve. */
  status: "ok" | "partial" | "no_data";
  totalKm: number;
  /** Eventos de la tasa (numerador): D6 elegibles de vehículos-mes válidos. */
  events: number;
  injuryEvents: number;
  rollovers: number;
  /** Vehículos-mes sin km utilizable, para el aviso «parcial (falta marzo de V2)». */
  missing: { assetId: string; month: MonthKey }[];
  lowExposure: boolean;
  /** Conteos absolutos de eventos en misión de la ventana, con o sin km (D11, R§1). */
  fatalities: number;
  hospitalized: number;
  nearMisses: number;
  outsideControl: number;
  unattributed: number;
};

const VALID_STATES: readonly VehicleMonthState[] = ["ok", "allocated", "manual"];

/**
 * Suma antes de dividir sobre una ventana de meses. Los eventos de un vehículo-mes sin km salen del
 * numerador junto con su denominador (D15).
 */
export function aggregateRoadWindow(input: {
  months: readonly MonthKey[];
  vehicleMonths: readonly VehicleMonth[];
  events: readonly RoadEventFacts[];
  minExposureKm: number;
}): RoadWindowAggregate {
  const inWindow = new Set(input.months);
  const valid = new Map<string, number>();
  const missing: { assetId: string; month: MonthKey }[] = [];
  let totalKm = 0;
  for (const v of input.vehicleMonths) {
    if (!inWindow.has(v.month)) continue;
    if (VALID_STATES.includes(v.state) && v.km !== null) {
      valid.set(`${v.assetId}|${v.month}`, v.km);
      totalKm += v.km;
    } else {
      missing.push({ assetId: v.assetId, month: v.month });
    }
  }

  const agg: RoadWindowAggregate = {
    status: valid.size === 0 ? "no_data" : missing.length > 0 ? "partial" : "ok",
    totalKm,
    events: 0,
    injuryEvents: 0,
    rollovers: 0,
    missing,
    lowExposure: totalKm < input.minExposureKm,
    fatalities: 0,
    hospitalized: 0,
    nearMisses: 0,
    outsideControl: 0,
    unattributed: 0,
  };

  for (const e of input.events) {
    if (!inWindow.has(e.month)) continue;
    const bucket = classifyRoadEvent(e);
    if (bucket === "no_damage") {
      agg.nearMisses += 1;
      continue;
    }
    if (bucket === "outside_control") agg.outsideControl += 1;
    else {
      if (bucket === "unattributed") agg.unattributed += 1;
      // Muertes y graves en misión cuentan siempre (conteo absoluto, R§1).
      agg.fatalities += e.fatalCount;
      agg.hospitalized += e.hospitalizedCount;
    }
    if (bucket === "rate" && e.assetId && valid.has(`${e.assetId}|${e.month}`)) {
      agg.events += 1;
      if (e.injuredCount >= 1) agg.injuryEvents += 1;
      if (e.eventType === "rollover") agg.rollovers += 1;
    }
  }
  return agg;
}

export type RoadIndices = {
  eventsPerMillionKm: number;
  injuryEventsPerMillionKm: number;
  rolloversPerMillionKm: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Tasas por millón de km con dos decimales; `null` si no hay km (nunca 0 por falta de dato). */
export function computeRoadIndices(agg: Pick<RoadWindowAggregate, "totalKm" | "events" | "injuryEvents" | "rollovers">): RoadIndices | null {
  if (agg.totalKm <= 0) return null;
  const per = (n: number) => round2((n * ROAD_RATE_BASE) / agg.totalKm);
  return {
    eventsPerMillionKm: per(agg.events),
    injuryEventsPerMillionKm: per(agg.injuryEvents),
    rolloversPerMillionKm: per(agg.rollovers),
  };
}
