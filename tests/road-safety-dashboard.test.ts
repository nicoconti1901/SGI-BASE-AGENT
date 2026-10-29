import { describe, expect, it } from "vitest";
import {
  breakdownRoadEvents,
  driverEligibility,
  exposureSummary,
  monthlyRoadSeries,
  roadCasesToCsv,
  roadTotalsToCsv,
  summarizeEligibility,
  type RoadCaseRow,
} from "@/domain/road-safety/dashboard";
import type { RoadEventFacts, VehicleMonth } from "@/domain/road-safety/rates";

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

const events = [
  ev({ id: "E1", month: "2027-01", classification: "property_damage_only" }),
  ev({ id: "E2", month: "2027-02", assetId: "V2", driverPersonId: "D2", eventType: "rollover", classification: "lost_time", injuredCount: 2, hospitalizedCount: 1, mainCause: "speed" }),
  ev({ id: "E3", month: "2027-02", assetId: "V2", driverPersonId: "D2", eventType: "run_off_road", classification: "near_miss" }),
  ev({ id: "E4", month: "2027-03", eventType: "collision_fixed_object", injuredCount: 1, mainCause: "speed" }),
  ev({ id: "E5", month: "2027-03", vehicleKind: "private", assetId: null, driverPersonId: "D3", inItinere: true, classification: "lost_time", injuredCount: 1 }),
];
const vm = (assetId: string, month: string, km: number | null, state: VehicleMonth["state"] = "ok"): VehicleMonth => ({ assetId, month, state, km });
const fullKm: VehicleMonth[] = [
  vm("V1", "2027-01", 10_000), vm("V1", "2027-02", 12_000), vm("V1", "2027-03", 8_000),
  vm("V2", "2027-01", 20_000), vm("V2", "2027-02", 18_000), vm("V2", "2027-03", 12_000),
];
const months = ["2027-01", "2027-02", "2027-03"];

describe("monthlyRoadSeries (AR-02, AR-03)", () => {
  it("da 33,33 / 33,33 / 50,00 con el dataset", () => {
    const series = monthlyRoadSeries({ months, vehicleMonths: fullKm, events, minExposureKm: 100_000 });
    expect(series.map((s) => s.month)).toEqual(months);
    expect(series.map((s) => s.indices?.eventsPerMillionKm)).toEqual([33.33, 33.33, 50]);
  });

  it("marzo sin km de V2: 125,00 con el aviso de parcial", () => {
    const partial = fullKm.map((v) => (v.assetId === "V2" && v.month === "2027-03" ? vm("V2", "2027-03", null, "no_data") : v));
    const march = monthlyRoadSeries({ months, vehicleMonths: partial, events, minExposureKm: 100_000 })[2];
    expect(march.indices?.eventsPerMillionKm).toBe(125);
    expect(march.aggregate.status).toBe("partial");
    expect(march.aggregate.missing).toEqual([{ assetId: "V2", month: "2027-03" }]);
  });

  it("un mes sin km no tiene tasa: null, nunca 0 (AR-04)", () => {
    const series = monthlyRoadSeries({ months: ["2027-04"], vehicleMonths: [], events, minExposureKm: 100_000 });
    expect(series[0].indices).toBeNull();
    expect(series[0].aggregate.status).toBe("no_data");
  });
});

describe("exposureSummary", () => {
  it("cuenta vehículos-mes por estado y suma solo los km válidos", () => {
    const summary = exposureSummary(
      [vm("V1", "2027-01", 10_000, "ok"), vm("V1", "2027-02", 9_492, "allocated"), vm("V2", "2027-01", 500, "manual"), vm("V2", "2027-02", null, "no_data"), vm("V3", "2027-02", null, "inconsistent")],
      new Set(["2027-01", "2027-02"]),
    );
    expect(summary).toEqual({ totalKm: 19_992, calculated: 1, allocated: 1, manual: 1, noData: 2 });
  });

  it("ignora los meses fuera de la ventana", () => {
    expect(exposureSummary([vm("V1", "2026-01", 5_000)], new Set(["2027-01"])).totalKm).toBe(0);
  });
});

describe("breakdownRoadEvents (AR-10)", () => {
  const b = breakdownRoadEvents(events);

  it("desglosa solo los eventos que cuentan: el casi accidente no entra (D6)", () => {
    expect(b.byType.find((r) => r.key === "run_off_road")).toBeUndefined();
    expect(b.byType.map((r) => [r.key, r.count])).toEqual([
      ["collision_vehicle", 2],
      ["collision_fixed_object", 1],
      ["rollover", 1],
    ]);
  });

  it("agrupa por causa principal, de mayor a menor", () => {
    expect(b.byCause[0]).toMatchObject({ key: "speed", count: 2 });
  });

  it("agrupa por vehículo y deja los eventos sin vehículo aparte", () => {
    expect(b.byVehicle).toEqual([
      { key: "V1", count: 2 },
      { key: "V2", count: 1 },
    ]);
    expect(b.withoutVehicle).toBe(1);
  });
});

describe("driverEligibility (AR-17)", () => {
  const today = "2027-03-15";
  const trained = { qualified: true, hasRequirements: true };

  it("habilitado: licencia vigente y manejo defensivo", () => {
    expect(driverEligibility({ licenseExpiresOn: "2027-12-31", qualification: trained }, today)).toEqual({ enabled: true, blockers: [] });
  });

  it("la licencia vale hasta el día de su vencimiento, inclusive", () => {
    expect(driverEligibility({ licenseExpiresOn: today, qualification: trained }, today).enabled).toBe(true);
    expect(driverEligibility({ licenseExpiresOn: "2027-03-14", qualification: trained }, today)).toEqual({ enabled: false, blockers: ["license_expired"] });
  });

  it("sin licencia cargada no está habilitado", () => {
    expect(driverEligibility({ licenseExpiresOn: null, qualification: trained }, today)).toEqual({ enabled: false, blockers: ["license_missing"] });
  });

  it("sin manejo defensivo vigente no está habilitado", () => {
    expect(driverEligibility({ licenseExpiresOn: "2027-12-31", qualification: { qualified: false, hasRequirements: true } }, today)).toEqual({
      enabled: false,
      blockers: ["training_missing"],
    });
  });

  it("una tarea sin curso exigido no prueba el manejo defensivo", () => {
    expect(driverEligibility({ licenseExpiresOn: "2027-12-31", qualification: { qualified: true, hasRequirements: false } }, today)).toEqual({
      enabled: false,
      blockers: ["task_without_course"],
    });
  });

  it("sin tarea de conducción elegida no hay con qué probar el manejo defensivo", () => {
    expect(driverEligibility({ licenseExpiresOn: "2027-12-31", qualification: null }, today)).toEqual({ enabled: false, blockers: ["task_not_chosen"] });
  });

  it("junta todos los motivos", () => {
    expect(driverEligibility({ licenseExpiresOn: "2027-01-01", qualification: { qualified: false, hasRequirements: true } }, today).blockers).toEqual(["license_expired", "training_missing"]);
  });

  it("resume el total y el porcentaje; sin conductores no hay porcentaje", () => {
    expect(summarizeEligibility([true, false, true, true])).toEqual({ total: 4, enabled: 3, pct: 75 });
    expect(summarizeEligibility([])).toEqual({ total: 0, enabled: 0, pct: null });
  });
});

describe("exportaciones", () => {
  it("el CSV de totales no lleva nombres y deja vacía la tasa sin km (AR-04)", () => {
    const series = monthlyRoadSeries({ months: ["2027-03", "2027-04"], vehicleMonths: fullKm, events, minExposureKm: 100_000 });
    const csv = roadTotalsToCsv(series);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe("Mes;Km;Eventos (tasa);Con lesionados;Vuelcos;Eventos por millón de km;Con lesionados por millón de km;Vuelcos por millón de km;Estado;Base");
    expect(lines[1]).toBe("2027-03;20000;1;1;0;50,00;50,00;0,00;completo;por 1.000.000 km");
    expect(lines[2]).toBe("2027-04;0;0;0;0;;;;sin datos;por 1.000.000 km");
    expect(csv).not.toMatch(/D\d/);
  });

  it("el CSV de casos lleva el conductor y escapa los separadores", () => {
    const rows: RoadCaseRow[] = [
      {
        date: "2027-02-10",
        classification: "Con baja",
        eventType: "Vuelco",
        vehicle: "AB-123; Hilux",
        driver: "Pérez, Ana",
        mainCause: "Velocidad",
        seatbelt: "Todos con cinturón",
        injured: 2,
        hospitalized: 1,
        fatal: 0,
        reportFiled: true,
        inItinere: false,
      },
    ];
    const lines = roadCasesToCsv(rows).replace("﻿", "").trim().split("\r\n");
    expect(lines[0].split(";")).toContain("Conductor");
    expect(lines[1]).toBe('2027-02-10;Con baja;Vuelco;"AB-123; Hilux";Pérez, Ana;Velocidad;Todos con cinturón;2;1;0;sí;no');
  });
});
