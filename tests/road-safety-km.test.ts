import { describe, expect, it } from "vitest";
import { allocateByDays, computeVehicleMonthKm, type OdometerReading } from "@/domain/road-safety/km";

const r = (day: string, km: number, seq = 0): OdometerReading => ({ day, km, seq });

describe("allocateByDays", () => {
  it("AR-06: reparte 20.000 km entre febrero (28) y marzo (31) con mayor resto", () => {
    expect(allocateByDays(20_000, [28, 31])).toEqual([9_492, 10_508]);
  });

  it("conserva la suma", () => {
    for (const total of [1, 7, 99, 12_345]) {
      const parts = allocateByDays(total, [31, 28, 31]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("un solo tramo recibe todo; cero reparte ceros", () => {
    expect(allocateByDays(500, [30])).toEqual([500]);
    expect(allocateByDays(0, [30, 31])).toEqual([0, 0]);
  });
});

describe("computeVehicleMonthKm", () => {
  const dataset = [r("2026-12-31", 50_000), r("2027-01-31", 60_000), r("2027-02-28", 72_000), r("2027-03-31", 80_000)];

  it("AR-05: odómetro del dataset → 10.000, 12.000, 8.000", () => {
    const months = ["2027-01", "2027-02", "2027-03"].map((m) => computeVehicleMonthKm({ month: m, readings: dataset, resets: [] }));
    expect(months).toEqual([
      { status: "ok", km: 10_000 },
      { status: "ok", km: 12_000 },
      { status: "ok", km: 8_000 },
    ]);
  });

  it("AR-06: sin la lectura de febrero reparte por días y marca `allocated`", () => {
    const readings = dataset.filter((x) => x.day !== "2027-02-28");
    const feb = computeVehicleMonthKm({ month: "2027-02", readings, resets: [] });
    const mar = computeVehicleMonthKm({ month: "2027-03", readings, resets: [] });
    expect(feb).toEqual({ status: "allocated", km: 9_492 });
    expect(mar).toEqual({ status: "allocated", km: 10_508 });
  });

  it("sin lectura anterior o sin lecturas posteriores → no_data", () => {
    expect(computeVehicleMonthKm({ month: "2027-01", readings: [r("2027-01-31", 60_000)], resets: [] }).status).toBe("no_data");
    expect(computeVehicleMonthKm({ month: "2027-04", readings: dataset, resets: [] }).status).toBe("no_data");
    expect(computeVehicleMonthKm({ month: "2027-01", readings: [], resets: [] })).toEqual({ status: "no_data", km: null });
  });

  it("AR-07: una lectura que baja sin reinicio es `inconsistent`", () => {
    const readings = [r("2027-01-31", 60_000), r("2027-02-28", 55_000)];
    expect(computeVehicleMonthKm({ month: "2027-02", readings, resets: [] })).toEqual({ status: "inconsistent", km: null });
  });

  it("AR-07: con reinicio el 15/02, febrero es `no_data` y marzo cuenta desde la lectura del reinicio", () => {
    const readings = [r("2027-01-31", 60_000), r("2027-02-28", 55_000), r("2027-03-31", 61_000)];
    const resets = [{ effectiveOn: "2027-02-15" }];
    expect(computeVehicleMonthKm({ month: "2027-02", readings, resets })).toEqual({ status: "no_data", km: null });
    expect(computeVehicleMonthKm({ month: "2027-03", readings, resets })).toEqual({ status: "ok", km: 6_000 });
  });

  it("dos lecturas el mismo día: vale la última cargada", () => {
    const readings = [r("2027-01-31", 60_000, 1), r("2027-01-31", 59_000, 2), r("2027-02-28", 71_000)];
    expect(computeVehicleMonthKm({ month: "2027-02", readings, resets: [] })).toEqual({ status: "ok", km: 12_000 });
  });

  it("varias lecturas en el mes: cierra con la última del mes", () => {
    const readings = [r("2027-01-31", 60_000), r("2027-02-10", 64_000), r("2027-02-27", 70_000)];
    expect(computeVehicleMonthKm({ month: "2027-02", readings, resets: [] })).toEqual({ status: "ok", km: 10_000 });
  });

  it("km 0 con lecturas iguales es válido", () => {
    const readings = [r("2027-01-31", 60_000), r("2027-02-28", 60_000)];
    expect(computeVehicleMonthKm({ month: "2027-02", readings, resets: [] })).toEqual({ status: "ok", km: 0 });
  });

  it("un tramo inconsistente que cubre varios meses los marca a todos", () => {
    const readings = [r("2027-01-31", 60_000), r("2027-03-31", 50_000)];
    expect(computeVehicleMonthKm({ month: "2027-02", readings, resets: [] }).status).toBe("inconsistent");
    expect(computeVehicleMonthKm({ month: "2027-03", readings, resets: [] }).status).toBe("inconsistent");
  });
});
