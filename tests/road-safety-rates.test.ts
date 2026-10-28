import { describe, expect, it } from "vitest";
import {
  aggregateRoadWindow,
  classifyRoadEvent,
  classifyVehicleMonth,
  computeRoadIndices,
  type RoadEventFacts,
  type VehicleMonth,
} from "@/domain/road-safety/rates";
import {
  fleetInspectionCompliance,
  intermediateFactors,
  repeatDrivers,
} from "@/domain/road-safety/factors";
import { validateRoadEvent } from "@/domain/road-safety/validation";

const ev = (over: Partial<RoadEventFacts> & Pick<RoadEventFacts, "id" | "month">): RoadEventFacts => ({
  classification: "no_lost_time",
  inItinere: false,
  vehicleKind: "own",
  assetId: "V1",
  driverPersonId: "D1",
  eventType: "collision_vehicle",
  seatbelt: "unknown",
  mainCause: "undetermined",
  injuredCount: 0,
  hospitalizedCount: 0,
  fatalCount: 0,
  reportFiled: false,
  ...over,
});

// Dataset del SPEC: ventana ene–mar, V1 y V2.
const E1 = ev({ id: "E1", month: "2027-01", classification: "property_damage_only" });
const E2 = ev({ id: "E2", month: "2027-02", assetId: "V2", driverPersonId: "D2", eventType: "rollover", classification: "lost_time", injuredCount: 2, hospitalizedCount: 1 });
const E3 = ev({ id: "E3", month: "2027-02", assetId: "V2", driverPersonId: "D2", eventType: "run_off_road", classification: "near_miss" });
const E4 = ev({ id: "E4", month: "2027-03", eventType: "collision_fixed_object", injuredCount: 1 });
const E5 = ev({ id: "E5", month: "2027-03", vehicleKind: "private", assetId: null, driverPersonId: "D3", inItinere: true, classification: "lost_time", injuredCount: 1 });
const events = [E1, E2, E3, E4, E5];

const vm = (assetId: string, month: string, km: number | null, state: VehicleMonth["state"] = "ok"): VehicleMonth => ({ assetId, month, state, km });
const fullKm: VehicleMonth[] = [
  vm("V1", "2027-01", 10_000), vm("V1", "2027-02", 12_000), vm("V1", "2027-03", 8_000),
  vm("V2", "2027-01", 20_000), vm("V2", "2027-02", 18_000), vm("V2", "2027-03", 12_000),
];
const months = ["2027-01", "2027-02", "2027-03"];
const settings = { minExposureKm: 100_000 };

describe("classifyRoadEvent", () => {
  it("separa tasas, sin daño y fuera del control", () => {
    expect(events.map((e) => classifyRoadEvent(e))).toEqual(["rate", "rate", "no_damage", "rate", "outside_control"]);
  });

  it("contratista con vehículo cargado entra en la tasa; sin vehículo, no (D17)", () => {
    expect(classifyRoadEvent(ev({ id: "x", month: "2027-01", vehicleKind: "contractor", assetId: "C1" }))).toBe("rate");
    expect(classifyRoadEvent(ev({ id: "y", month: "2027-01", vehicleKind: "contractor", assetId: null }))).toBe("unattributed");
  });

  it("un propio sin vehículo no entra en la tasa (D15)", () => {
    expect(classifyRoadEvent(ev({ id: "z", month: "2027-01", assetId: null }))).toBe("unattributed");
  });
});

describe("classifyVehicleMonth", () => {
  it("km manual manda sobre lo calculado", () => {
    expect(classifyVehicleMonth({ computed: { status: "no_data", km: null }, stored: { km: 900, source: "manual" }, rateEvents: 0 })).toEqual({ state: "manual", km: 900 });
  });

  it("km 0 con eventos es inconsistente; sin eventos es válido", () => {
    expect(classifyVehicleMonth({ computed: { status: "ok", km: 0 }, stored: null, rateEvents: 1 })).toEqual({ state: "inconsistent", km: null });
    expect(classifyVehicleMonth({ computed: { status: "ok", km: 0 }, stored: null, rateEvents: 0 })).toEqual({ state: "ok", km: 0 });
  });

  it("conserva `allocated` y `no_data`", () => {
    expect(classifyVehicleMonth({ computed: { status: "allocated", km: 9_492 }, stored: null, rateEvents: 0 })).toEqual({ state: "allocated", km: 9_492 });
    expect(classifyVehicleMonth({ computed: { status: "no_data", km: null }, stored: null, rateEvents: 2 })).toEqual({ state: "no_data", km: null });
  });
});

describe("aggregateRoadWindow / computeRoadIndices", () => {
  it("AR-01: dataset → 37,50 / 25,00 / 12,50; graves 1; muertes 0", () => {
    const agg = aggregateRoadWindow({ months, vehicleMonths: fullKm, events, ...settings });
    expect(agg.status).toBe("ok");
    expect(agg.totalKm).toBe(80_000);
    const idx = computeRoadIndices(agg)!;
    expect(idx.eventsPerMillionKm).toBeCloseTo(37.5, 2);
    expect(idx.injuryEventsPerMillionKm).toBeCloseTo(25, 2);
    expect(idx.rolloversPerMillionKm).toBeCloseTo(12.5, 2);
    expect(agg.hospitalized).toBe(1);
    expect(agg.fatalities).toBe(0);
  });

  it("AR-10 / D11: E3 cuenta como sin daño y E5 como fuera del control, ambos fuera de las tasas", () => {
    const agg = aggregateRoadWindow({ months, vehicleMonths: fullKm, events, ...settings });
    expect(agg.nearMisses).toBe(1);
    expect(agg.outsideControl).toBe(1);
    expect(agg.events).toBe(3);
  });

  it("AR-02: mensual → 33,33 / 33,33 / 50,00", () => {
    const monthly = months.map((m) => computeRoadIndices(aggregateRoadWindow({ months: [m], vehicleMonths: fullKm, events, ...settings }))!.eventsPerMillionKm);
    expect(monthly[0]).toBeCloseTo(33.33, 2);
    expect(monthly[1]).toBeCloseTo(33.33, 2);
    expect(monthly[2]).toBeCloseTo(50, 2);
  });

  it("AR-03: sin km de V2 en marzo la ventana es parcial: 68.000 km, 44,12; marzo 125,00", () => {
    const partial = fullKm.map((x) => (x.assetId === "V2" && x.month === "2027-03" ? vm("V2", "2027-03", null, "no_data") : x));
    const win = aggregateRoadWindow({ months, vehicleMonths: partial, events, ...settings });
    expect(win.status).toBe("partial");
    expect(win.totalKm).toBe(68_000);
    expect(win.missing).toEqual([{ assetId: "V2", month: "2027-03" }]);
    expect(computeRoadIndices(win)!.eventsPerMillionKm).toBeCloseTo(44.12, 2);
    const mar = aggregateRoadWindow({ months: ["2027-03"], vehicleMonths: partial, events, ...settings });
    expect(computeRoadIndices(mar)!.eventsPerMillionKm).toBeCloseTo(125, 2);
  });

  it("los eventos de un vehículo-mes sin km salen del numerador", () => {
    const partial = fullKm.map((x) => (x.assetId === "V1" && x.month === "2027-03" ? vm("V1", "2027-03", null, "no_data") : x));
    const agg = aggregateRoadWindow({ months, vehicleMonths: partial, events, ...settings });
    expect(agg.events).toBe(2); // E4 sale con su vehículo-mes
  });

  it("AR-04: km total 0 → índices null; sin ningún dato → no_data", () => {
    const zero = [vm("V1", "2027-01", 0)];
    const agg = aggregateRoadWindow({ months: ["2027-01"], vehicleMonths: zero, events: [], ...settings });
    expect(agg.totalKm).toBe(0);
    expect(computeRoadIndices(agg)).toBeNull();
    const none = aggregateRoadWindow({ months, vehicleMonths: [], events, ...settings });
    expect(none.status).toBe("no_data");
    expect(computeRoadIndices(none)).toBeNull();
  });

  it("eventos 0 con km > 0 → tasa 0", () => {
    const agg = aggregateRoadWindow({ months: ["2027-01"], vehicleMonths: [vm("V1", "2027-01", 5_000)], events: [], ...settings });
    expect(computeRoadIndices(agg)!.eventsPerMillionKm).toBe(0);
  });

  it("AR-18: bajo 100.000 km avisa poca exposición", () => {
    const agg = aggregateRoadWindow({ months, vehicleMonths: fullKm, events, ...settings });
    expect(agg.lowExposure).toBe(true);
    const big = aggregateRoadWindow({ months, vehicleMonths: fullKm, events, minExposureKm: 50_000 });
    expect(big.lowExposure).toBe(false);
  });

  it("muertes y graves cuentan aunque el vehículo no tenga km, pero no los hechos in itinere", () => {
    const fatal = ev({ id: "F", month: "2027-01", assetId: "V9", classification: "fatal", fatalCount: 1, injuredCount: 1, hospitalizedCount: 1 });
    const itinereFatal = ev({ id: "G", month: "2027-01", inItinere: true, classification: "fatal", fatalCount: 1 });
    const agg = aggregateRoadWindow({ months: ["2027-01"], vehicleMonths: fullKm, events: [fatal, itinereFatal], ...settings });
    expect(agg.fatalities).toBe(1);
    expect(agg.hospitalized).toBe(1);
  });
});

describe("repeatDrivers", () => {
  it("AR-13: D1 aparece con 2 eventos en la ventana; D2 (casi accidente) y D3 (in itinere) no", () => {
    const flagged = repeatDrivers({ events, threshold: 2, windowMonths: 12, asOfMonth: "2027-03" });
    expect(flagged).toEqual([{ personId: "D1", count: 2 }]);
  });

  it("respeta la ventana en meses", () => {
    const old = ev({ id: "old", month: "2025-01" });
    expect(repeatDrivers({ events: [old, E1], threshold: 2, windowMonths: 12, asOfMonth: "2027-03" })).toEqual([]);
  });
});

describe("fleetInspectionCompliance", () => {
  const asOf = "2027-03-31";
  it("AR-16: sin inspección cuenta como vencido", () => {
    const res = fleetInspectionCompliance({
      asOf,
      vehicles: [
        { assetId: "V1", lastInspectionOn: "2027-03-20", intervalDays: 30, toleranceDays: 0 },
        { assetId: "V2", lastInspectionOn: null, intervalDays: 30, toleranceDays: 0 },
        { assetId: "V3", lastInspectionOn: "2027-01-01", intervalDays: 30, toleranceDays: 5 },
      ],
    });
    expect(res).toEqual({ total: 3, upToDate: 1, overdueAssetIds: ["V2", "V3"] });
  });

  it("la tolerancia suma al plazo", () => {
    const res = fleetInspectionCompliance({ asOf, vehicles: [{ assetId: "V1", lastInspectionOn: "2027-02-25", intervalDays: 30, toleranceDays: 5 }] });
    expect(res.upToDate).toBe(1);
  });
});

describe("intermediateFactors", () => {
  it("AR-19: cinturón es % sobre eventos con dato (excluye no aplica y desconocido)", () => {
    const list = [
      ev({ id: "a", month: "2027-01", seatbelt: "all" }),
      ev({ id: "b", month: "2027-01", seatbelt: "all" }),
      ev({ id: "c", month: "2027-01", seatbelt: "some_not" }),
      ev({ id: "d", month: "2027-01", seatbelt: "not_applicable" }),
      ev({ id: "e", month: "2027-01", seatbelt: "unknown" }),
      ev({ id: "f", month: "2027-01", classification: "near_miss", seatbelt: "none" }),
    ];
    const f = intermediateFactors({ events: list });
    expect(f.seatbeltBase).toBe(3);
    expect(f.seatbeltPct).toBeCloseTo(66.67, 2);
  });

  it("sin eventos con dato no hay porcentaje", () => {
    expect(intermediateFactors({ events: [] }).seatbeltPct).toBeNull();
  });

  it("cuenta fatiga/alcohol como causa principal y denuncias hechas", () => {
    const list = [
      ev({ id: "a", month: "2027-01", mainCause: "fatigue_distraction", reportFiled: true }),
      ev({ id: "b", month: "2027-01", mainCause: "alcohol_drugs" }),
      ev({ id: "c", month: "2027-01", mainCause: "speed", reportFiled: true }),
    ];
    const f = intermediateFactors({ events: list });
    expect(f.fatigueOrAlcoholCount).toBe(2);
    expect(f.reportFiledCount).toBe(2);
    expect(f.eventCount).toBe(3);
  });
});

describe("validateRoadEvent", () => {
  const base = {
    classification: "lost_time" as const,
    vehicleKind: "own" as const,
    assetId: "V1",
    eventType: "rollover" as const,
    roadSurface: "dry" as const,
    light: "day" as const,
    weather: "clear" as const,
    seatbelt: "all" as const,
    mainCause: "speed" as const,
    propertyDamage: "minor" as const,
    injuredCount: 2,
    hospitalizedCount: 1,
    fatalCount: 0,
    estimatedSpeedKmh: 80,
    reportFiled: false,
    reportRef: null,
  };

  it("un evento válido no tiene errores", () => {
    expect(validateRoadEvent(base)).toEqual({});
  });

  it("AR-11: internados > lesionados es error", () => {
    expect(validateRoadEvent({ ...base, hospitalizedCount: 3 }).hospitalizedCount).toBeDefined();
  });

  it("AR-11: fallecidos con clasificación no fatal es error, y fatal sin fallecidos también", () => {
    expect(validateRoadEvent({ ...base, fatalCount: 1 }).fatalCount).toBeDefined();
    expect(validateRoadEvent({ ...base, classification: "fatal", fatalCount: 0 }).fatalCount).toBeDefined();
    expect(validateRoadEvent({ ...base, classification: "fatal", fatalCount: 1 }).fatalCount).toBeUndefined();
  });

  it("propio sin vehículo es error", () => {
    expect(validateRoadEvent({ ...base, assetId: null }).assetId).toBeDefined();
    expect(validateRoadEvent({ ...base, vehicleKind: "private", assetId: null }).assetId).toBeUndefined();
  });

  it("solo daño material y casi accidente no admiten lesionados", () => {
    expect(validateRoadEvent({ ...base, classification: "property_damage_only", hospitalizedCount: 0 }).injuredCount).toBeDefined();
    expect(validateRoadEvent({ ...base, classification: "near_miss", injuredCount: 0, hospitalizedCount: 0, propertyDamage: "none" })).toEqual({});
    expect(validateRoadEvent({ ...base, classification: "near_miss", injuredCount: 1, hospitalizedCount: 0 }).injuredCount).toBeDefined();
  });

  it("velocidad fuera de 0–250 y recuentos negativos son error", () => {
    expect(validateRoadEvent({ ...base, estimatedSpeedKmh: 300 }).estimatedSpeedKmh).toBeDefined();
    expect(validateRoadEvent({ ...base, estimatedSpeedKmh: -1 }).estimatedSpeedKmh).toBeDefined();
    expect(validateRoadEvent({ ...base, injuredCount: -1 }).injuredCount).toBeDefined();
  });
});
