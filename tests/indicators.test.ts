import { describe, expect, it } from "vitest";
import {
  aggregateStatus,
  correctionIssues,
  dashboardCounts,
  indicatorDefinitionIssues,
  measurementDueAt,
  measurementIssues,
  measurementStatus,
  nextPendingPeriod,
  objectiveCode,
  pendingLoad,
  periodOf,
  previousPeriod,
} from "@/domain/indicators/rules";

describe("measurement status", () => {
  const higher = { direction: "higher_better" as const, target: 95, alertThreshold: 97 };
  const lower = { direction: "lower_better" as const, target: 2, alertThreshold: 1 };

  it("higher is better (SPEC acceptance 1)", () => {
    expect(measurementStatus(higher, 98)).toBe("on_target");
    expect(measurementStatus(higher, 97)).toBe("on_target");
    expect(measurementStatus(higher, 96)).toBe("alert");
    expect(measurementStatus(higher, 95)).toBe("alert");
    expect(measurementStatus(higher, 90)).toBe("off_target");
  });

  it("lower is better", () => {
    expect(measurementStatus(lower, 0)).toBe("on_target");
    expect(measurementStatus(lower, 1.5)).toBe("alert");
    expect(measurementStatus(lower, 2)).toBe("alert");
    expect(measurementStatus(lower, 3)).toBe("off_target");
  });

  it("works without an alert threshold", () => {
    const noAlert = { direction: "higher_better" as const, target: 95, alertThreshold: null };
    expect(measurementStatus(noAlert, 95)).toBe("on_target");
    expect(measurementStatus(noAlert, 94.9)).toBe("off_target");
  });

  it("validates that the alert warns before missing the target", () => {
    expect(
      indicatorDefinitionIssues({ ...higher, alertThreshold: 93, name: "Entregas a tiempo", unit: "%" }),
    ).toHaveLength(1);
    expect(
      indicatorDefinitionIssues({ ...lower, alertThreshold: 3, name: "Accidentes", unit: "casos" }),
    ).toHaveLength(1);
    expect(indicatorDefinitionIssues({ ...higher, name: "Entregas a tiempo", unit: "%" })).toEqual([]);
  });
});

describe("aggregation", () => {
  it("takes the worst status among indicators with data", () => {
    expect(aggregateStatus(["on_target", "alert", "no_data"])).toBe("alert");
    expect(aggregateStatus(["on_target", "off_target"])).toBe("off_target");
    expect(aggregateStatus(["no_data", "no_data"])).toBe("no_data");
    expect(aggregateStatus([])).toBe("no_data");
  });
});

describe("periods", () => {
  const d = new Date("2026-08-15T12:00:00Z");

  it("builds keys and labels per frequency", () => {
    expect(periodOf("monthly", d)).toMatchObject({ key: "2026-08", label: "ago 2026" });
    expect(periodOf("quarterly", d)).toMatchObject({ key: "2026-T3", label: "3.º trimestre 2026" });
    expect(periodOf("semiannual", d).key).toBe("2026-S2");
    expect(periodOf("annual", d).key).toBe("2026");
  });

  it("crosses year boundaries", () => {
    const jan = periodOf("monthly", new Date("2027-01-10T00:00:00Z"));
    expect(previousPeriod("monthly", jan).key).toBe("2026-12");
    const q1 = periodOf("quarterly", new Date("2027-02-01T00:00:00Z"));
    expect(previousPeriod("quarterly", q1).key).toBe("2026-T4");
  });

  it("proposes the next pending period", () => {
    const created = new Date("2026-06-20T00:00:00Z");
    expect(nextPendingPeriod({ frequency: "monthly", lastLoadedStart: null, createdAt: created }).key).toBe("2026-06");
    expect(
      nextPendingPeriod({
        frequency: "monthly",
        lastLoadedStart: new Date("2026-07-01T00:00:00Z"),
        createdAt: created,
      }).key,
    ).toBe("2026-08");
  });

  it("is due 10 days after the period ends", () => {
    expect(measurementDueAt(periodOf("monthly", d)).toISOString()).toBe("2026-09-11T00:00:00.000Z");
    expect(measurementDueAt(periodOf("quarterly", d)).toISOString()).toBe("2026-10-11T00:00:00.000Z");
  });
});

describe("loading rules", () => {
  const period = periodOf("monthly", new Date("2026-08-01T00:00:00Z"));
  const now = new Date("2026-09-05T00:00:00Z");

  it("requires analysis when off target (SPEC acceptance 2)", () => {
    expect(measurementIssues({ period, now, alreadyLoaded: false, status: "off_target", analysis: "" })).toHaveLength(1);
    expect(
      measurementIssues({ period, now, alreadyLoaded: false, status: "off_target", analysis: "Faltante de insumos" }),
    ).toEqual([]);
    expect(measurementIssues({ period, now, alreadyLoaded: false, status: "alert", analysis: null })).toEqual([]);
  });

  it("rejects duplicates and future periods (SPEC acceptance 3)", () => {
    expect(measurementIssues({ period, now, alreadyLoaded: true, status: "on_target", analysis: null })[0]).toMatch(/corregí/);
    const future = periodOf("monthly", new Date("2026-12-01T00:00:00Z"));
    expect(measurementIssues({ period: future, now, alreadyLoaded: false, status: "on_target", analysis: null })).toHaveLength(1);
  });

  it("requires a reason to correct", () => {
    expect(correctionIssues(" ")).toHaveLength(1);
    expect(correctionIssues("Error de tipeo")).toEqual([]);
  });

  it("formats objective codes", () => {
    expect(objectiveCode(2026, 4)).toBe("OBJ-2026-04");
  });
});

describe("dashboard rules", () => {
  it("marks a load overdue only after the 10-day grace period", () => {
    const base = { frequency: "monthly" as const, lastLoadedStart: null, createdAt: new Date("2026-08-15T00:00:00Z") };
    // Período pendiente: agosto → vence el 11 de septiembre.
    expect(pendingLoad({ ...base, now: new Date("2026-09-11T00:00:00Z") }).overdue).toBe(false);
    const late = pendingLoad({ ...base, now: new Date("2026-09-12T00:00:00Z") });
    expect(late.overdue).toBe(true);
    expect(late.period.key).toBe("2026-08");
  });

  it("moves to the following period after a load", () => {
    const load = pendingLoad({
      frequency: "monthly",
      lastLoadedStart: new Date("2026-08-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      now: new Date("2026-09-05T00:00:00Z"),
    });
    expect(load.period.key).toBe("2026-09");
    expect(load.overdue).toBe(false);
  });

  it("counts active objectives by their worst indicator and sums overdue loads", () => {
    const counts = dashboardCounts([
      { status: "active", indicatorStatuses: ["on_target", "alert"], overdueLoads: 1 },
      { status: "active", indicatorStatuses: ["off_target", "on_target"], overdueLoads: 0 },
      { status: "active", indicatorStatuses: [], overdueLoads: 2 },
      { status: "achieved", indicatorStatuses: ["off_target"], overdueLoads: 5 },
    ]);
    expect(counts).toEqual({ on_target: 0, alert: 1, off_target: 1, no_data: 1, overdueLoads: 3 });
  });
});
