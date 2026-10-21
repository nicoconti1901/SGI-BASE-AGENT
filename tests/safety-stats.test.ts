import { describe, expect, it } from "vitest";
import {
  aggregateWindow,
  classifySegmentMonth,
  compareTrend,
  computeIndices,
  daysSinceLastLostTime,
  type EventAggregate,
  type ExposureRow,
  type Segment,
  type WindowResult,
} from "@/domain/safety-stats/indices";
import {
  computeLostDays,
  deriveEventPeriod,
  instantToLocalInput,
  localDateTimeToInstant,
  monthsBetween,
} from "@/domain/safety-stats/period";
import {
  DEFAULT_SAFETY_SETTINGS,
  type EmployerKind,
  type SafetySettings,
} from "@/domain/safety-stats/types";
import { resolveSeverity, validateExposure, validateHealth, validateIncident } from "@/domain/safety-stats/validation";
import { AS_OF, EVENTS, EXPOSURE, SITE_A, SITE_B, aggregateEvents } from "./safety-stats-dataset";

const settings: SafetySettings = { ...DEFAULT_SAFETY_SETTINGS };
const { events, openCases } = aggregateEvents(EVENTS);

const seg = (siteId: string, ...kinds: EmployerKind[]): Segment[] => kinds.map((employerKind) => ({ siteId, employerKind }));
const BOTH: EmployerKind[] = ["own", "contractor"];

function run(segments: Segment[], months: string[], over?: { exposure?: ExposureRow[]; events?: EventAggregate[]; settings?: SafetySettings }) {
  return aggregateWindow({
    exposure: over?.exposure ?? EXPOSURE,
    events: over?.events ?? events,
    openCases,
    months,
    segments,
    settings: over?.settings ?? settings,
  });
}

const JAN = ["2026-01"];
const FEB = ["2026-02"];
const MAR = ["2026-03"];
const Q1 = monthsBetween("2026-01", "2026-03");

type Expected = {
  status: "ok" | "partial" | "no_data";
  hours?: number;
  headcount?: number;
  cases?: number;
  fatal?: number;
  days?: number;
  if?: number;
  ig?: number;
  ii?: number;
  /** número, "s/c" (sin casos) o undefined (sin datos) */
  id?: number | "s/c";
  trir?: number;
  dart?: number;
};

function expectRow(result: WindowResult, e: Expected) {
  expect(result.status).toBe(e.status);
  const i = result.indices;
  if (e.status === "no_data") {
    expect([i.if, i.ig, i.ii, i.id, i.trir, i.dart]).toEqual([null, null, null, null, null, null]);
    expect(i.idNoCases).toBe(false);
    return;
  }
  expect(result.totals.hours).toBe(e.hours);
  expect(result.totals.headcount).toBeCloseTo(e.headcount!, 2);
  expect(result.totals.cases).toBe(e.cases);
  expect(result.totals.fatalCases).toBe(e.fatal);
  expect(result.totals.lostDays).toBe(e.days);
  expect(i.if).toBeCloseTo(e.if!, 2);
  expect(i.ig).toBeCloseTo(e.ig!, 2);
  expect(i.ii).toBeCloseTo(e.ii!, 2);
  if (e.id === "s/c") {
    expect(i.id).toBeNull();
    expect(i.idNoCases).toBe(true);
  } else {
    expect(i.id).toBeCloseTo(e.id!, 1);
    expect(i.idNoCases).toBe(false);
  }
  expect(i.trir).toBeCloseTo(e.trir!, 2);
  expect(i.dart).toBeCloseTo(e.dart!, 2);
}

describe("AT-01: las 15 filas del dataset de referencia", () => {
  it("#1 A · propio · ene", () => {
    expectRow(run(seg(SITE_A, "own"), JAN), { status: "ok", hours: 20000, headcount: 110, cases: 2, fatal: 0, days: 30, if: 100, ig: 1.5, ii: 18.18, id: 15, trir: 20, dart: 20 });
  });
  it("#2 A · propio · feb", () => {
    expectRow(run(seg(SITE_A, "own"), FEB), { status: "ok", hours: 18000, headcount: 108, cases: 1, fatal: 1, days: 0, if: 55.56, ig: 333.33, ii: 9.26, id: "s/c", trir: 22.22, dart: 11.11 });
  });
  it("#3 A · propio · mar", () => {
    expectRow(run(seg(SITE_A, "own"), MAR), { status: "ok", hours: 22000, headcount: 112, cases: 0, fatal: 0, days: 0, if: 0, ig: 0, ii: 0, id: "s/c", trir: 0, dart: 0 });
  });
  it("#4 A · propio · ene–mar", () => {
    expectRow(run(seg(SITE_A, "own"), Q1), { status: "ok", hours: 60000, headcount: 110, cases: 3, fatal: 1, days: 30, if: 50, ig: 100.5, ii: 27.27, id: 15, trir: 13.33, dart: 10 });
  });
  it("#5 A · contratista · feb", () => {
    expectRow(run(seg(SITE_A, "contractor"), FEB), { status: "ok", hours: 4000, headcount: 25, cases: 1, fatal: 0, days: 5, if: 250, ig: 1.25, ii: 40, id: 5, trir: 50, dart: 50 });
  });
  it("#6 A · contratista · mar (sin fila): sin datos", () => {
    expectRow(run(seg(SITE_A, "contractor"), MAR), { status: "no_data" });
  });
  it("#7 A · contratista · ene–mar: parcial, falta marzo", () => {
    const r = run(seg(SITE_A, "contractor"), Q1);
    expectRow(r, { status: "partial", hours: 9000, headcount: 26.5, cases: 1, fatal: 0, days: 5, if: 111.11, ig: 0.56, ii: 37.74, id: 5, trir: 22.22, dart: 22.22 });
    expect(r.monthsUsed).toEqual(["2026-01", "2026-02"]);
    expect(r.monthsExcluded).toEqual([{ month: "2026-03", segment: { siteId: SITE_A, employerKind: "contractor" }, reason: "missing" }]);
  });
  it("#8 A · total · feb", () => {
    expectRow(run(seg(SITE_A, ...BOTH), FEB), { status: "ok", hours: 22000, headcount: 133, cases: 2, fatal: 1, days: 5, if: 90.91, ig: 272.95, ii: 15.04, id: 5, trir: 27.27, dart: 18.18 });
  });
  it("#9 A · total · mar: falta contratista", () => {
    expectRow(run(seg(SITE_A, ...BOTH), MAR), { status: "no_data" });
  });
  it("#10 A · total · ene–mar: parcial, usa ene y feb", () => {
    const r = run(seg(SITE_A, ...BOTH), Q1);
    expectRow(r, { status: "partial", hours: 47000, headcount: 135.5, cases: 4, fatal: 1, days: 35, if: 85.11, ig: 128.4, ii: 29.52, id: 11.7, trir: 21.28, dart: 17.02 });
    expect(r.monthsUsed).toEqual(["2026-01", "2026-02"]);
  });
  it("#11 B · propio · ene–mar", () => {
    expectRow(run(seg(SITE_B, "own"), Q1), { status: "ok", hours: 30000, headcount: 55, cases: 2, fatal: 0, days: 15, if: 66.67, ig: 0.5, ii: 36.36, id: 7.5, trir: 13.33, dart: 13.33 });
  });
  it("#12 B · contratista · ene: inconsistente, sin datos", () => {
    const r = run(seg(SITE_B, "contractor"), JAN);
    expectRow(r, { status: "no_data" });
    expect(r.monthsExcluded).toEqual([{ month: "2026-01", segment: { siteId: SITE_B, employerKind: "contractor" }, reason: "inconsistent" }]);
  });
  it("#13 B · contratista · ene–mar: parcial, usa feb y mar", () => {
    expectRow(run(seg(SITE_B, "contractor"), Q1), { status: "partial", hours: 6000, headcount: 15, cases: 0, fatal: 0, days: 0, if: 0, ig: 0, ii: 0, id: "s/c", trir: 0, dart: 0 });
  });
  it("#14 B · total · ene–mar: parcial, usa feb y mar", () => {
    const r = run(seg(SITE_B, ...BOTH), Q1);
    expectRow(r, { status: "partial", hours: 26000, headcount: 70, cases: 1, fatal: 0, days: 3, if: 38.46, ig: 0.12, ii: 14.29, id: 3, trir: 7.69, dart: 7.69 });
    expect(r.monthsUsed).toEqual(["2026-02", "2026-03"]);
  });
  it("#15 Empresa · total · ene–mar: parcial, solo feb", () => {
    const r = run([...seg(SITE_A, ...BOTH), ...seg(SITE_B, ...BOTH)], Q1);
    expectRow(r, { status: "partial", hours: 35000, headcount: 203, cases: 2, fatal: 1, days: 5, if: 57.14, ig: 171.57, ii: 9.85, id: 5, trir: 17.14, dart: 11.43 });
    expect(r.monthsUsed).toEqual(["2026-02"]);
  });
});

describe("conteos crudos, in itinere y meses provisorios", () => {
  const all = [...seg(SITE_A, ...BOTH), ...seg(SITE_B, ...BOTH)];

  it("los conteos crudos no dependen de la exposición", () => {
    const r = run(all, Q1);
    expect(r.rawCounts).toMatchObject({ near_miss: 1, first_aid: 1, no_lost_time: 1, lost_time: 6, fatal: 1, occupational_disease: 0 });
    expect(r.rawCounts.lostDays).toBe(57);
  });

  it("AT-08: el accidente in itinere no entra en ningún índice y tiene su propio conteo", () => {
    const r = run(all, Q1);
    expect(r.inItinere).toEqual({ cases: 1, lostDays: 30 });
    // Si E5 entrara, los días de A propio en febrero no serían 0 ni el IF cambiaría.
    expect(run(seg(SITE_A, "own"), FEB).totals.lostDays).toBe(0);
    expect(run(seg(SITE_A, "own"), FEB).totals.cases).toBe(1);
  });

  it("AT-07: E2 cruza de enero a febrero y sus 20 días quedan en enero", () => {
    expect(run(seg(SITE_A, "own"), JAN).totals.lostDays).toBe(30);
    expect(run(seg(SITE_A, "own"), FEB).totals.lostDays).toBe(0);
    expect(run(seg(SITE_A, "own"), JAN).provisionalMonths).toEqual([]);
  });

  it("AT-07: sin reintegro, enero queda provisorio", () => {
    const open = EVENTS.map((e) => (e.id === "E2" ? { ...e, returnToWorkDate: undefined } : e));
    const agg = aggregateEvents(open);
    const r = aggregateWindow({ exposure: EXPOSURE, events: agg.events, openCases: agg.openCases, months: Q1, segments: seg(SITE_A, "own"), settings });
    expect(r.provisionalMonths).toEqual(["2026-01"]);
  });
});

describe("AT-02 a AT-06: reglas de agregación", () => {
  it("AT-02: promediar las tasas mensuales da otro valor; se suman numeradores y denominadores", () => {
    const monthly = [JAN, FEB, MAR].map((m) => run(seg(SITE_A, "own"), m).indices.if!);
    const averaged = monthly.reduce((a, b) => a + b, 0) / monthly.length;
    const cumulative = run(seg(SITE_A, "own"), Q1).indices.if!;
    expect(cumulative).toBeCloseTo(50, 2);
    expect(averaged).toBeCloseTo(51.85, 2);
    expect(Math.abs(averaged - cumulative)).toBeGreaterThan(1);
  });

  it("AT-03: fila ausente da «sin datos», nunca 0", () => {
    const r = run(seg(SITE_A, "contractor"), MAR);
    expect(r.status).toBe("no_data");
    expect(r.indices.if).toBeNull();
    expect(r.indices.ig).toBeNull();
  });

  it("AT-04: con horas y sin casos el IF es 0,00, distinto de «sin datos»", () => {
    const r = run(seg(SITE_A, "own"), MAR);
    expect(r.status).toBe("ok");
    expect(r.indices.if).toBe(0);
  });

  it("AT-05: 0 horas con un accidente es inconsistente: sale de los índices pero suma en los conteos crudos", () => {
    const r = run(seg(SITE_B, "contractor"), JAN);
    expect(r.monthsExcluded[0].reason).toBe("inconsistent");
    expect(r.indices.if).toBeNull();
    expect(r.rawCounts.lost_time).toBe(1);
  });

  it("AT-06: solo fatales → ID «sin casos»; el IG incluye el cargo; con cargo 0 queda solo con días reales", () => {
    const only = EVENTS.filter((e) => e.id === "E3");
    const agg = aggregateEvents(only);
    const base = { exposure: EXPOSURE, events: agg.events, openCases: agg.openCases, months: FEB, segments: seg(SITE_A, "own") };
    const withCharge = aggregateWindow({ ...base, settings });
    expect(withCharge.indices.id).toBeNull();
    expect(withCharge.indices.idNoCases).toBe(true);
    expect(withCharge.indices.ig).toBeCloseTo(333.33, 2);
    const noCharge = aggregateWindow({ ...base, settings: { ...settings, fatalChargeDays: 0 } });
    expect(noCharge.indices.ig).toBe(0);
    expect(noCharge.indices.igReal).toBe(0);
  });

  it("un cargo proporcional por incapacidad permanente suma al IG", () => {
    // Un con baja de 10 días con 25 % de incapacidad permanente: (10 + 6.000 × 0,25) × 1.000 / 20.000.
    const ev: EventAggregate[] = [
      { siteId: SITE_A, month: "2026-01", employerKind: "own", classification: "lost_time", inItinere: false, restrictedWork: false, count: 1, lostDays: 10, chargePct: 25 },
    ];
    const r = aggregateWindow({ exposure: EXPOSURE, events: ev, months: JAN, segments: seg(SITE_A, "own"), settings });
    expect(r.indices.ig).toBeCloseTo(75.5, 2);
    expect(r.indices.igReal).toBeCloseTo(0.5, 2);
  });

  it("AT-14: con base 1.000.000 el IG de #1 es 1.500,00 y el de #2 es 333.333,33", () => {
    const big: SafetySettings = { ...settings, severityBase: 1000000 };
    expect(run(seg(SITE_A, "own"), JAN, { settings: big }).indices.ig).toBe(1500);
    expect(run(seg(SITE_A, "own"), FEB, { settings: big }).indices.ig).toBe(333333.33);
  });

  it("AT-11: horas con dotación 0 → IF calculado e II «sin datos»", () => {
    const exposure: ExposureRow[] = [{ siteId: SITE_A, employerKind: "own", month: "2026-01", hours: 20000, headcountAvg: 0 }];
    const r = run(seg(SITE_A, "own"), JAN, { exposure });
    expect(r.status).toBe("ok");
    expect(r.indices.if).toBe(100);
    expect(r.indices.ii).toBeNull();
  });

  it("el redondeo es comercial y sin errores de punto flotante", () => {
    // 1.005 en flotante es 1.00499999…: el IF exacto 1 × 1.000.000 / 995.024,875… no aplica; usamos un empate real.
    // 1 caso × 1.000.000 / 8.000 horas = 125 exacto; 1 × 1.000.000 / 160.000 = 6,25; 3 × 1.000.000 / 16.000 = 187,5.
    const exposure: ExposureRow[] = [{ siteId: SITE_A, employerKind: "own", month: "2026-01", hours: 128000, headcountAvg: 3 }];
    const ev: EventAggregate[] = [
      { siteId: SITE_A, month: "2026-01", employerKind: "own", classification: "lost_time", inItinere: false, restrictedWork: false, count: 1, lostDays: 1, chargePct: 0 },
    ];
    // 1.000.000 / 128.000 = 7,8125 → 7,81 ; ID = 1 día / 1 caso.
    const r = aggregateWindow({ exposure, events: ev, months: JAN, segments: seg(SITE_A, "own"), settings });
    expect(r.indices.if).toBe(7.81);
    // II = 1.000 / 3 = 333,333… → 333,33
    expect(r.indices.ii).toBe(333.33);
    // Empate exacto en el tercer decimal: 0,125 → 0,13 (redondeo comercial).
    const tie = computeIndices(
      { hours: 8_000_000, headcountSum: 1, monthCount: 1, lostTimeCases: 1, fatalCases: 0, noLostTimeCases: 0, restrictedCases: 0, lostDays: 1, chargePctSum: 0 },
      settings,
    );
    expect(tie.if).toBe(0.13);
  });
});

describe("classifySegmentMonth", () => {
  const row = (hours: number, headcountAvg: number) => ({ hours, headcountAvg });
  it("ok / empty / missing / inconsistent", () => {
    expect(classifySegmentMonth(row(100, 1), { lostOrFatal: 0 })).toBe("ok");
    expect(classifySegmentMonth(row(0, 0), { lostOrFatal: 0 })).toBe("empty");
    expect(classifySegmentMonth(undefined, { lostOrFatal: 0 })).toBe("missing");
    expect(classifySegmentMonth(undefined, { lostOrFatal: 2 })).toBe("missing");
    expect(classifySegmentMonth(row(0, 0), { lostOrFatal: 1 })).toBe("inconsistent");
    expect(classifySegmentMonth(row(0, 10), { lostOrFatal: 0 })).toBe("inconsistent");
    expect(classifySegmentMonth(row(500, 0), { lostOrFatal: 0 })).toBe("ok");
  });
});

describe("AT-12: tendencia", () => {
  const ok = run(seg(SITE_A, "own"), JAN);
  const better = run(seg(SITE_A, "own"), MAR);
  const partial = run(seg(SITE_A, "contractor"), Q1);

  it("compara con la ventana anterior solo si ambas son ok", () => {
    expect(compareTrend(better, ok, "if")).toBe("down");
    expect(compareTrend(ok, better, "if")).toBe("up");
    expect(compareTrend(ok, ok, "if")).toBe("flat");
  });
  it("sin flecha si alguna ventana no es ok", () => {
    expect(compareTrend(partial, ok, "if")).toBeNull();
    expect(compareTrend(ok, partial, "if")).toBeNull();
    expect(compareTrend(run(seg(SITE_A, "contractor"), MAR), ok, "if")).toBeNull();
  });
});

describe("AT-13: días sin accidentes con baja", () => {
  it("A = 54 y B = 29 al 31/03/2026", () => {
    const res = daysSinceLastLostTime(
      {
        [SITE_A]: { lastLostTimeOn: "2026-02-05", firstExposureMonth: "2026-01" },
        [SITE_B]: { lastLostTimeOn: "2026-03-02", firstExposureMonth: "2026-01" },
      },
      AS_OF,
    );
    expect(res[SITE_A]).toEqual({ kind: "days", days: 54 });
    expect(res[SITE_B]).toEqual({ kind: "days", days: 29 });
  });
  it("sin accidentes registrados dice desde cuándo hay exposición; sin exposición, «sin datos»", () => {
    const res = daysSinceLastLostTime(
      { c: { lastLostTimeOn: null, firstExposureMonth: "2026-01" }, d: { lastLostTimeOn: null, firstExposureMonth: null } },
      AS_OF,
    );
    expect(res.c).toEqual({ kind: "none_since", since: "2026-01" });
    expect(res.d).toEqual({ kind: "no_data" });
  });
});

describe("AT-09 y AT-10: días perdidos y período del hecho", () => {
  const base = { occurredOn: "2026-01-10", asOf: "2026-03-31", cap: 365 };
  it("AT-09: 11/01 → 0; 21/01 → 10", () => {
    expect(computeLostDays({ ...base, returnToWorkDate: "2026-01-11" }).days).toBe(0);
    expect(computeLostDays({ ...base, returnToWorkDate: "2026-01-21" }).days).toBe(10);
  });
  it("AT-09: tope en 365 y reintegro anterior es un error", () => {
    const r = computeLostDays({ ...base, returnToWorkDate: "2028-01-01" });
    expect(r).toMatchObject({ days: 365, capped: true });
    expect(() => computeLostDays({ ...base, returnToWorkDate: "2026-01-09" })).toThrow();
  });
  it("caso abierto: días hasta hoy, mínimo 1", () => {
    expect(computeLostDays({ ...base, returnToWorkDate: null })).toMatchObject({ days: 80, open: true });
    expect(computeLostDays({ ...base, returnToWorkDate: null, asOf: "2026-01-10" }).days).toBe(1);
  });
  it("AT-10: un accidente a las 23:30 del 31/01 hora local es de enero aunque en UTC sea febrero", () => {
    const at = localDateTimeToInstant("2026-01-31T23:30")!;
    expect(at.toISOString()).toBe("2026-02-01T02:30:00.000Z");
    expect(deriveEventPeriod(at)).toEqual({ occurredOn: "2026-01-31", periodMonth: "2026-01-01", weekday: 6, hourOfDay: 23 });
  });
  it("el campo de fecha y hora ida y vuelta conserva la hora local", () => {
    expect(instantToLocalInput(localDateTimeToInstant("2026-01-31T23:30")!)).toBe("2026-01-31T23:30");
    expect(localDateTimeToInstant("no es una fecha")).toBeNull();
  });
});

describe("validaciones del hecho, de la ficha de salud y de la exposición", () => {
  const now = new Date("2026-03-31T15:00:00.000Z");
  const fact = {
    classification: "lost_time" as const,
    inItinere: false,
    restrictedWork: false,
    occurredAt: new Date("2026-03-10T15:00:00.000Z"),
    now,
    accidentForm: "fall_same_level",
    materialAgent: "floor_stairs",
    returnToWorkDate: "2026-03-20",
  };

  it("un hecho válido no tiene errores", () => {
    expect(validateIncident(fact).errors).toEqual({});
  });
  it("con baja y 0 días es un error: sin días perdidos es «sin baja»", () => {
    expect(validateIncident({ ...fact, returnToWorkDate: "2026-03-11" }).errors.returnToWorkDate).toMatch(/sin baja/i);
  });
  it("el reintegro anterior al accidente es un error", () => {
    expect(validateIncident({ ...fact, returnToWorkDate: "2026-03-01" }).errors.returnToWorkDate).toBeDefined();
  });
  it("in itinere con casi accidente o enfermedad profesional es un error", () => {
    expect(validateIncident({ ...fact, classification: "near_miss", returnToWorkDate: null, inItinere: true }).errors.inItinere).toBeDefined();
    expect(validateIncident({ ...fact, classification: "occupational_disease", returnToWorkDate: null, inItinere: true }).errors.inItinere).toBeDefined();
  });
  it("la fecha futura es un error", () => {
    expect(validateIncident({ ...fact, occurredAt: new Date("2026-04-02T12:00:00.000Z"), returnToWorkDate: null }).errors.occurredAt).toBeDefined();
  });
  it("tareas restringidas solo en sin baja", () => {
    expect(validateIncident({ ...fact, restrictedWork: true }).errors.restrictedWork).toBeDefined();
    expect(validateIncident({ ...fact, classification: "no_lost_time", restrictedWork: true, returnToWorkDate: null }).errors).toEqual({});
  });
  it("días perdidos sobre el tope: advertencia", () => {
    const r = validateIncident({ ...fact, occurredAt: new Date("2024-01-10T15:00:00.000Z"), returnToWorkDate: "2026-03-01" });
    expect(r.errors).toEqual({});
    expect(r.warnings.join(" ")).toMatch(/365/);
  });
  it("un fatal con días cargados advierte que no se suman", () => {
    const r = validateIncident({ ...fact, classification: "fatal", returnToWorkDate: null, lostDaysEntered: 12 });
    expect(r.warnings.join(" ")).toMatch(/fatal/i);
  });

  it("la ficha de salud exige persona salvo en un casi accidente", () => {
    const h = { classification: "lost_time" as const, affectedPersonId: null, natureOfInjury: null, bodyPart: null, occurredOn: "2026-03-10", deathDate: null };
    expect(validateHealth(h).errors.affectedPersonId).toBeDefined();
    expect(validateHealth({ ...h, classification: "near_miss" }).errors).toEqual({});
  });
  it("muerte a más de un año: advertencia; antes del accidente: error", () => {
    const h = { classification: "fatal" as const, affectedPersonId: "p", natureOfInjury: null, bodyPart: null, occurredOn: "2026-03-10", deathDate: "2027-06-01" };
    expect(validateHealth(h).warnings.join(" ")).toMatch(/OIT/);
    expect(validateHealth({ ...h, deathDate: "2026-03-01" }).errors.deathDate).toBeDefined();
  });

  it("resolveSeverity: fatal = 100 % y 0 días; con baja abierta cuenta hasta hoy", () => {
    const common = { occurredOn: "2026-03-10", asOf: "2026-03-31", cap: 365 };
    expect(resolveSeverity({ ...common, classification: "fatal", returnToWorkDate: null })).toMatchObject({ lostDays: 0, chargePct: 100 });
    expect(resolveSeverity({ ...common, classification: "lost_time", returnToWorkDate: null })).toMatchObject({ lostDays: 21, open: true });
    expect(resolveSeverity({ ...common, classification: "no_lost_time", returnToWorkDate: null })).toMatchObject({ lostDays: 0, chargePct: 0 });
  });

  it("AT-11: horas > dotación × 744 es un error; fuera de 80–260 h por persona, advertencia", () => {
    expect(validateExposure({ hours: 8000, headcountAvg: 10 }).errors.hours).toBeDefined();
    expect(validateExposure({ hours: 3000, headcountAvg: 10 }).warnings.length).toBe(1);
    expect(validateExposure({ hours: 1700 * 2, headcountAvg: 20 })).toEqual({ errors: {}, warnings: [] });
    expect(validateExposure({ hours: 1600, headcountAvg: 10 })).toEqual({ errors: {}, warnings: [] });
    expect(validateExposure({ hours: 300, headcountAvg: 10 }).warnings.length).toBe(1);
    expect(validateExposure({ hours: 0, headcountAvg: 0 })).toEqual({ errors: {}, warnings: [] });
    expect(validateExposure({ hours: 5000, headcountAvg: 0 }).warnings.length).toBe(1);
    expect(validateExposure({ hours: -1, headcountAvg: 3 }).errors.hours).toBeDefined();
    expect(validateExposure({ hours: 10.5, headcountAvg: 3 }).errors.hours).toBeDefined();
  });
});
