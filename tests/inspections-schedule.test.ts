import { describe, expect, it } from "vitest";
import { assetCompliance, dueState, nextInspectionDue, type Interval } from "@/domain/inspections/schedule";
import { assetStatusAfter, isPendingRelease } from "@/domain/inspections/asset-status";
import { validateInspectionForClose } from "@/domain/inspections/close";
import { addDays, addMonths, diffDays, endOfDayInstant, isIsoDate, todayIso } from "@/domain/inspections/dates";
import type { AssetStatus, EvalItem, InspectionResult } from "@/domain/inspections/types";

const monthly: Interval = { unit: "months", value: 1 };
const base = { reinspectionDays: 7, retireOnUnfit: false };

describe("nextInspectionDue (tabla del SPEC)", () => {
  it("1. apto, mensual, 2026-03-15 → 2026-04-15", () => {
    expect(nextInspectionDue({ ...base, inspectedAt: "2026-03-15", result: "fit", interval: monthly })).toEqual({ dueAt: "2026-04-15", kind: "periodic" });
  });
  it("2. apto con observaciones, mensual, 2026-01-31 → 2026-02-28", () => {
    expect(nextInspectionDue({ ...base, inspectedAt: "2026-01-31", result: "fit_with_observations", interval: monthly }).dueAt).toBe("2026-02-28");
  });
  it("3. 6 meses desde 2026-08-31 → 2027-02-28", () => {
    expect(nextInspectionDue({ ...base, inspectedAt: "2026-08-31", result: "fit", interval: { unit: "months", value: 6 } }).dueAt).toBe("2027-02-28");
  });
  it("4. semanal desde 2026-10-21 → 2026-10-28", () => {
    expect(nextInspectionDue({ ...base, inspectedAt: "2026-10-21", result: "fit", interval: { unit: "days", value: 7 } }).dueAt).toBe("2026-10-28");
  });
  it("5. no apto → reinspección a los 7 días", () => {
    expect(nextInspectionDue({ ...base, inspectedAt: "2026-10-21", result: "unfit", interval: monthly })).toEqual({ dueAt: "2026-10-28", kind: "reinspection" });
  });
  it("6. reinspección apta el 2026-10-27 → 2026-11-27, cuenta desde esa fecha", () => {
    expect(nextInspectionDue({ ...base, inspectedAt: "2026-10-27", result: "fit", interval: monthly })).toEqual({ dueAt: "2026-11-27", kind: "periodic" });
  });
  it("7 y 8. cerrada tarde o antes de tiempo: siempre fecha de inspección + intervalo", () => {
    // La función no recibe el vencimiento anterior: el calendario se reinicia.
    expect(nextInspectionDue({ ...base, inspectedAt: "2026-05-20", result: "fit", interval: monthly }).dueAt).toBe("2026-06-20");
  });
  it("9. intervalo nulo (control previo al uso) → sin próxima", () => {
    expect(nextInspectionDue({ ...base, inspectedAt: "2026-10-21", result: "fit", interval: null })).toEqual({ dueAt: null, kind: "none" });
  });
  it("10. no apto con baja definitiva → el programa se cierra", () => {
    expect(nextInspectionDue({ ...base, retireOnUnfit: true, inspectedAt: "2026-10-21", result: "unfit", interval: monthly })).toEqual({ dueAt: null, kind: "none" });
  });
  it("11. activo dado de baja → sin próxima", () => {
    expect(nextInspectionDue({ ...base, inspectedAt: "2026-10-21", result: "fit", interval: monthly, assetRetired: true })).toEqual({ dueAt: null, kind: "none" });
  });
});

describe("assetStatusAfter (tabla del SPEC)", () => {
  const norm = { retireOnUnfit: false, canReinstate: true };
  const run = (
    current: AssetStatus,
    result: InspectionResult,
    over: Partial<{ policy: typeof norm; canRelease: boolean; origin: "close" | "correction" }> = {},
  ) => assetStatusAfter({ current, result, policy: norm, canRelease: true, origin: "close", ...over });

  it("1 y 2. en servicio con apto / con observaciones: sin cambio", () => {
    expect(run("in_service", "fit")).toEqual({ status: "in_service", change: null });
    expect(run("in_service", "fit_with_observations")).toEqual({ status: "in_service", change: null });
  });
  it("3. en servicio + no apto → fuera de servicio", () => {
    expect(run("in_service", "unfit")).toEqual({ status: "out_of_service", change: { from: "in_service", to: "out_of_service", reasonCode: "inspection_unfit" } });
  });
  it("4. en servicio + no apto con baja definitiva → dado de baja", () => {
    const r = run("in_service", "unfit", { policy: { retireOnUnfit: true, canReinstate: false } });
    expect(r.status).toBe("retired");
    expect(r.change?.reasonCode).toBe("inspection_unfit_retired");
  });
  it("5. fuera de servicio + no apto → sin cambio ni evento duplicado", () => {
    expect(run("out_of_service", "unfit")).toEqual({ status: "out_of_service", change: null });
  });
  it("6 y 7. fuera de servicio + apto, con permiso → vuelve a servicio", () => {
    expect(run("out_of_service", "fit").change).toEqual({ from: "out_of_service", to: "in_service", reasonCode: "reinstated" });
    expect(run("out_of_service", "fit_with_observations").status).toBe("in_service");
  });
  it("8. fuera de servicio + apto, sin permiso → queda pendiente de liberación", () => {
    expect(run("out_of_service", "fit", { canRelease: false })).toEqual({ status: "out_of_service", change: null });
    expect(isPendingRelease({ status: "out_of_service", lastResult: "fit", policy: norm })).toBe(true);
    expect(isPendingRelease({ status: "in_service", lastResult: "fit", policy: norm })).toBe(false);
  });
  it("9. control previo al uso nunca libera", () => {
    expect(run("out_of_service", "fit", { policy: { retireOnUnfit: false, canReinstate: false } })).toEqual({ status: "out_of_service", change: null });
  });
  it("10. el operador puede parar un equipo con el control previo", () => {
    const r = run("in_service", "unfit", { policy: { retireOnUnfit: false, canReinstate: false } });
    expect(r.status).toBe("out_of_service");
  });
  it("11. dado de baja es terminal", () => {
    for (const result of ["fit", "unfit"] as const) expect(run("retired", result)).toEqual({ status: "retired", change: null });
  });
  it("12. una corrección que empeora a no apto se comporta como el cierre", () => {
    const r = run("in_service", "unfit", { origin: "correction" });
    expect(r.change?.reasonCode).toBe("correction_unfit");
    const retired = run("in_service", "unfit", { origin: "correction", policy: { retireOnUnfit: true, canReinstate: false } });
    expect(retired.change?.reasonCode).toBe("correction_unfit_retired");
  });
  it("13. una corrección que mejora no libera el activo", () => {
    expect(run("out_of_service", "fit", { origin: "correction" })).toEqual({ status: "out_of_service", change: null });
  });
});

describe("assetCompliance y dueState", () => {
  const today = "2026-10-21";
  it("ok cuando todo está lejos del vencimiento", () => {
    expect(assetCompliance([{ dueAt: "2027-01-01", leadDays: 30, blocking: true }], today)).toBe("ok");
    expect(assetCompliance([], today)).toBe("ok");
  });
  it("expiring desde dueAt − leadDays, la misma regla que el aviso", () => {
    expect(assetCompliance([{ dueAt: "2026-11-20", leadDays: 30, blocking: true }], today)).toBe("expiring");
    expect(assetCompliance([{ dueAt: "2026-11-21", leadDays: 30, blocking: true }], today)).toBe("ok");
    expect(dueState({ dueAt: "2026-11-20", leadDays: 30 }, today)).toBe("expiring");
  });
  it("vence a fin del día: el día del vencimiento todavía vale", () => {
    expect(assetCompliance([{ dueAt: today, leadDays: 0, blocking: true }], today)).toBe("expiring");
  });
  it("blocked si alguno bloqueante venció; uno no bloqueante vencido solo avisa", () => {
    expect(assetCompliance([{ dueAt: "2026-10-20", leadDays: 7, blocking: true }, { dueAt: "2027-01-01", leadDays: 7, blocking: false }], today)).toBe("blocked");
    expect(assetCompliance([{ dueAt: "2026-10-20", leadDays: 7, blocking: false }], today)).toBe("expiring");
  });
});

describe("validateInspectionForClose", () => {
  const item = (over: Partial<EvalItem>): EvalItem => ({ id: "x", criticality: "critical", kind: "check", naAllowed: true, required: true, photoOnNc: true, ...over });
  const run = (over: Partial<Parameters<typeof validateInspectionForClose>[0]> = {}) =>
    validateInspectionForClose({
      items: [item({})],
      answers: [{ itemId: "x", value: "conform" }],
      photoCounts: {},
      inspectedAt: "2026-10-21",
      today: "2026-10-21",
      ...over,
    });

  it("una inspección sin novedades cierra", () => {
    expect(run()).toEqual({ ok: true, blockers: [] });
  });
  it("NC crítica sin foto ni comentario bloquea", () => {
    const r = run({ answers: [{ itemId: "x", value: "nonconform" }] });
    expect(r.blockers.map((b) => b.code)).toEqual(["photo_required", "comment_required"]);
  });
  it("con foto y comentario cierra; en una NC menor la foto no se pide", () => {
    expect(run({ answers: [{ itemId: "x", value: "nonconform", comment: "precinto roto" }], photoCounts: { x: 1 } }).ok).toBe(true);
    const minor = run({ items: [item({ criticality: "minor", photoOnNc: false })], answers: [{ itemId: "x", value: "nonconform", comment: "etiqueta rota" }] });
    expect(minor.ok).toBe(true);
  });
  it("un número fuera de rango también es una NC", () => {
    const r = run({ items: [item({ kind: "number", minValue: 12, maxValue: 15 })], answers: [{ itemId: "x", numberValue: 16 }] });
    expect(r.blockers.map((b) => b.code)).toContain("comment_required");
  });
  it("los ítems automáticos no piden foto", () => {
    const r = run({ items: [item({ autoSource: { dueKind: "maintenance" }, autoConform: false })], answers: [] });
    expect(r.ok).toBe(true);
  });
  it("lectura menor que la anterior exige confirmación", () => {
    const reading = { current: 900, previous: 1000, confirmedLower: false, label: "Odómetro" };
    expect(run({ readings: [reading] }).blockers[0].code).toBe("reading_lower_than_previous");
    expect(run({ readings: [{ ...reading, confirmedLower: true }] }).ok).toBe(true);
  });
  it("fecha futura o con más de 7 días de antigüedad", () => {
    expect(run({ inspectedAt: "2026-10-22" }).blockers[0].code).toBe("date_in_future");
    expect(run({ inspectedAt: "2026-10-14" }).ok).toBe(true);
    expect(run({ inspectedAt: "2026-10-13" }).blockers[0].code).toBe("date_too_old");
  });
  it("activo dado de baja", () => {
    expect(run({ assetStatus: "retired" }).blockers[0].code).toBe("asset_retired");
  });
});

describe("fechas de calendario", () => {
  it("suma meses con ajuste a fin de mes, también en bisiestos", () => {
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("suma días y calcula diferencias", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(diffDays("2026-10-14", "2026-10-21")).toBe(7);
  });
  it("valida fechas y calcula hoy en hora argentina", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(todayIso(new Date("2026-10-22T01:30:00Z"))).toBe("2026-10-21");
  });
  it("un vencimiento vale hasta el último instante del día argentino", () => {
    expect(endOfDayInstant("2026-10-21").toISOString()).toBe("2026-10-22T02:59:59.999Z");
  });
});
