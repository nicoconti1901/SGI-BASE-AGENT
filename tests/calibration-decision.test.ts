import { describe, expect, it } from "vitest";
import {
  assessmentRequired,
  calibrationDecision,
  evaluateRecord,
  formatDecimal,
  nextCalibrationDue,
  parseDecimal,
  resolveEmp,
  validUntil,
  type Channel,
  type DecisionRule,
  type LabStatement,
  type PointInput,
} from "@/domain/calibration";

const channel = (over: Omit<Partial<Channel>, "emp"> & { emp?: Partial<Channel["emp"]> } = {}): Channel => ({
  key: "h2s",
  label: "H₂S",
  unit: "ppm",
  rangeMin: 0,
  rangeMax: 100,
  active: true,
  ...over,
  emp: { abs: 0, pctReading: 0, pctFullScale: 0, ...over.emp },
});

const run = (rule: DecisionRule, channels: Channel[], points: PointInput[], extra: { criticalUse?: boolean; labStatement?: LabStatement } = {}) =>
  calibrationDecision({ rule, criticalUse: extra.criticalUse ?? false, channels, points, labStatement: extra.labStatement });

const abs05 = channel({ emp: { abs: 0.5 } });
const pt = (nominal: number, measured: number, uncertainty?: number | null, channelKey = "h2s"): PointInput => ({ channelKey, nominal, measured, uncertainty });

describe("decimal exacto", () => {
  it("lee comas y puntos, y rechaza basura", () => {
    expect(parseDecimal("10,5")).toBe(parseDecimal("10.5"));
    expect(parseDecimal(0.1)).not.toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal(Number.NaN)).toBeNull();
    expect(formatDecimal(parseDecimal("-0,30")!)).toBe("-0.3");
  });
});

describe("resolveEmp", () => {
  it("suma el piso absoluto, el porcentaje de la lectura y el del fondo de escala", () => {
    expect(resolveEmp({ abs: 0.5, pctReading: 5, pctFullScale: 1 }, 20, 100)).toBe("2.5"); // 0,5 + 1 + 1
    expect(resolveEmp({ abs: 0, pctReading: 10, pctFullScale: 0 }, -25, 100)).toBe("2.5");
  });
  it("usa el valor absoluto del nominal", () => {
    expect(resolveEmp({ abs: 0, pctReading: 10, pctFullScale: 0 }, "-50", 0)).toBe("5");
  });
});

describe("calibrationDecision · regla de banda de guarda (tabla del SPEC)", () => {
  it("1 · apto: 0,2 + 0,2 = 0,4 ≤ 0,5", () => {
    const d = run("guard_band", [abs05], [pt(10, 10.2, 0.2)]);
    expect(d.result).toBe("apt");
    expect(d.points[0]).toMatchObject({ error: "0.2", emp: "0.5", ok: true, reason: "within", margin: "0.1" });
  });
  it("2 · apto en el límite: |e| + U = EMP es inclusivo", () => {
    expect(run("guard_band", [abs05], [pt(10, 10.3, 0.2)]).result).toBe("apt");
  });
  it("3 · no apto: 0,51 > 0,5 aunque el error solo entre en el EMP", () => {
    const d = run("guard_band", [abs05], [pt(10, 10.3, 0.21)]);
    expect(d.result).toBe("not_apt");
    expect(d.points[0].reason).toBe("in_guard_band");
  });
  it("4 · error negativo simétrico", () => {
    expect(run("guard_band", [abs05], [pt(10, 9.7, 0.2)]).result).toBe("apt");
  });
  it("5 · el error supera el EMP", () => {
    const d = run("guard_band", [abs05], [pt(10, 10.6, 0.1)]);
    expect(d.result).toBe("not_apt");
    expect(d.points[0].reason).toBe("error_exceeds_emp");
  });
  it("6 · decimal exacto: 0,4 − 0,1 = 0,3 y 0,3 + 0,2 = 0,5 pasa", () => {
    expect(0.4 - 0.1).not.toBe(0.3); // en binario el error ya sale torcido (0,30000000000000004)
    expect(0.4 - 0.1 <= 0.3).toBe(false); // y una comparación en el límite fallaría
    const d = run("guard_band", [abs05], [pt(0.1, 0.4, 0.2)]);
    expect(d.result).toBe("apt");
    expect(d.points[0].error).toBe("0.3");
  });
  it("7 · la incertidumbre sola supera el EMP: no pasa ni con error cero", () => {
    const d = run("guard_band", [abs05], [pt(10, 10, 0.6)]);
    expect(d.result).toBe("not_apt");
    expect(d.points[0].reason).toBe("uncertainty_exceeds_emp");
  });
  it("8 · sin incertidumbre queda incompleto", () => {
    const d = run("guard_band", [abs05], [pt(10, 10.1, null)]);
    expect(d.result).toBe("incomplete");
    expect(d.incompleteReasons[0].code).toBe("missing_uncertainty");
  });
  it("9 · detector de H₂S con 3 puntos y EMP de 10 % de la lectura: apto", () => {
    const h2s = channel({ emp: { pctReading: 10 } });
    const d = run("guard_band", [h2s], [pt(10, 10.5, 0.3), pt(25, 27.2, 0.3), pt(50, 53, 0.5)]);
    expect(d.result).toBe("apt");
    expect(d.points.map((p) => p.emp)).toEqual(["1", "2.5", "5"]);
    expect(d.points[1].margin).toBe("0"); // 2,2 + 0,3 = 2,5: justo en el límite
  });
  it("10 · igual al 9 pero 50 → 55,6: falla solo el tercer punto", () => {
    const h2s = channel({ emp: { pctReading: 10 } });
    const d = run("guard_band", [h2s], [pt(10, 10.5, 0.3), pt(25, 27.2, 0.3), pt(50, 55.6, 0.5)]);
    expect(d.result).toBe("not_apt");
    expect(d.points.map((p) => p.ok)).toEqual([true, true, false]);
    expect(d.points[2].reason).toBe("error_exceeds_emp");
  });
  it("11 · el piso absoluto sostiene el EMP en el cero", () => {
    const c = channel({ emp: { abs: 0.5, pctReading: 5 } });
    const d = run("guard_band", [c], [pt(0, 0.4, 0.1)]);
    expect(d.result).toBe("apt");
    expect(d.points[0].emp).toBe("0.5");
  });
  it("12 · EMP en cero en el punto cero: incompleto", () => {
    const c = channel({ emp: { pctReading: 10 } });
    const d = run("guard_band", [c], [pt(0, 0.1, 0.05)]);
    expect(d.result).toBe("incomplete");
    expect(d.incompleteReasons[0].code).toBe("emp_zero_at_point");
  });
  it("un valor que no es número deja el registro incompleto", () => {
    const d = run("guard_band", [abs05], [{ channelKey: "h2s", nominal: "diez", measured: 10, uncertainty: 0.1 }]);
    expect(d.result).toBe("incomplete");
    expect(d.incompleteReasons[0].code).toBe("invalid_value");
  });
});

describe("calibrationDecision · aceptación simple", () => {
  it("13 · apto con advertencia: 0,4 ≤ 0,5 pero 0,4 + 0,3 > 0,5", () => {
    const d = run("simple_acceptance", [abs05], [pt(10, 10.4, 0.3)]);
    expect(d.result).toBe("apt");
    expect(d.points[0]).toMatchObject({ ok: true, reason: "in_guard_band" });
  });
  it("14 · no apto: el error supera el EMP", () => {
    const d = run("simple_acceptance", [abs05], [pt(10, 10.6, 0.3)]);
    expect(d.result).toBe("not_apt");
    expect(d.points[0].reason).toBe("error_exceeds_emp");
  });
  it("no pide incertidumbre", () => {
    expect(run("simple_acceptance", [abs05], [pt(10, 10.1)]).result).toBe("apt");
  });
});

describe("calibrationDecision · declaración del laboratorio", () => {
  const ok: LabStatement = { statement: "conforme", spec: "±0,5 ppm", decisionRule: "ILAC-G8 aceptación simple" };
  it("15 · conforme, con especificación y regla, uso no crítico: apto", () => {
    const d = run("certificate_statement", [], [], { labStatement: ok });
    expect(d).toMatchObject({ result: "apt", basis: "certificate_statement" });
  });
  it("16 · conforme sin especificación o sin regla: incompleto", () => {
    expect(run("certificate_statement", [], [], { labStatement: { statement: "conforme", spec: "x" } }).result).toBe("incomplete");
    expect(run("certificate_statement", [], [], { labStatement: { statement: "conforme", decisionRule: "x" } }).result).toBe("incomplete");
  });
  it("17 · conforme en un equipo de uso crítico: incompleto", () => {
    const d = run("certificate_statement", [], [], { labStatement: ok, criticalUse: true });
    expect(d.result).toBe("incomplete");
    expect(d.incompleteReasons.map((r) => r.code)).toContain("certificate_not_allowed_for_critical_use");
  });
  it("18 · no conforme: no apto", () => {
    expect(run("certificate_statement", [], [], { labStatement: { statement: "no_conforme" } }).result).toBe("not_apt");
  });
  it("sin declaración: incompleto", () => {
    expect(run("certificate_statement", [], []).result).toBe("incomplete");
  });
});

describe("calibrationDecision · canales y cobertura", () => {
  const four = ["o2", "co", "h2s", "lel"].map((key) => channel({ key, label: key, emp: { abs: 1 } }));
  it("19 · multigás con 4 canales activos y puntos de 3: falta un canal", () => {
    const d = run("simple_acceptance", four, [pt(1, 1, null, "o2"), pt(1, 1, null, "co"), pt(1, 1, null, "h2s")]);
    expect(d.result).toBe("incomplete");
    expect(d.incompleteReasons).toEqual([expect.objectContaining({ code: "missing_channel", channelKey: "lel" })]);
  });
  it("20 · canal con requiredPoints = 3 y 2 puntos: faltan puntos", () => {
    const c = channel({ emp: { abs: 1 }, requiredPoints: 3 });
    const d = run("simple_acceptance", [c], [pt(10, 10), pt(20, 20)]);
    expect(d.result).toBe("incomplete");
    expect(d.incompleteReasons[0].code).toBe("missing_points");
  });
  it("20b · puntos repetidos en el mismo nominal no suman", () => {
    const c = channel({ emp: { abs: 1 }, requiredPoints: 2 });
    expect(run("simple_acceptance", [c], [pt(10, 10), pt(10, 10.1)]).result).toBe("incomplete");
    expect(run("simple_acceptance", [c], [pt(10, 10), pt(20, 20)]).result).toBe("apt");
  });
  it("21 · un canal inactivo sin puntos no bloquea", () => {
    const retired = channel({ key: "co", emp: { abs: 1 }, active: false });
    const d = run("simple_acceptance", [channel({ emp: { abs: 1 } }), retired], [pt(10, 10)]);
    expect(d.result).toBe("apt");
  });
  it("un punto de un canal que no existe deja el registro incompleto", () => {
    const d = run("simple_acceptance", [abs05], [pt(10, 10), pt(1, 1, null, "zzz")]);
    expect(d.result).toBe("incomplete");
    expect(d.incompleteReasons[0].code).toBe("unknown_channel");
  });
  it("no apto manda sobre incompleto", () => {
    const d = run("simple_acceptance", four.map((c) => ({ ...c, emp: { ...c.emp, abs: 0.5 } })), [pt(10, 12, null, "o2")]);
    expect(d.result).toBe("not_apt");
  });
});

describe("evaluateRecord", () => {
  const c = [abs05];
  const base = { rule: "guard_band" as const, criticalUse: false, channels: c };
  const good = [pt(10, 10.1, 0.1)];
  const bad = [pt(10, 11, 0.1)];

  it("1 · sin ajuste, todo dentro: apto / apto", () => {
    expect(evaluateRecord({ ...base, adjusted: false, asFoundPoints: good })).toMatchObject({ complete: true, asFoundResult: "apt", asLeftResult: "apt" });
  });
  it("2 · sin ajuste, un punto fuera: no apto / no apto", () => {
    expect(evaluateRecord({ ...base, adjusted: false, asFoundPoints: bad })).toMatchObject({ complete: true, asFoundResult: "not_apt", asLeftResult: "not_apt" });
  });
  it("3 · ajustado, as-found fuera y as-left dentro", () => {
    expect(evaluateRecord({ ...base, adjusted: true, asFoundPoints: bad, asLeftPoints: good })).toMatchObject({ complete: true, asFoundResult: "not_apt", asLeftResult: "apt" });
  });
  it("4 · ajustado, as-found dentro", () => {
    expect(evaluateRecord({ ...base, adjusted: true, asFoundPoints: good, asLeftPoints: good })).toMatchObject({ asFoundResult: "apt", asLeftResult: "apt" });
  });
  it("5 y 6 · ajustado sin as-found: no evaluado", () => {
    const r = evaluateRecord({ ...base, adjusted: true, asFoundPoints: [], asLeftPoints: good });
    expect(r).toMatchObject({ complete: true, asFoundResult: "not_evaluated", asLeftResult: "apt", missingAsFound: true });
  });
  it("7 · as-left fuera: no apto", () => {
    expect(evaluateRecord({ ...base, adjusted: true, asFoundPoints: good, asLeftPoints: bad })).toMatchObject({ asLeftResult: "not_apt" });
  });
  it("ajustado sin as-left: no se puede cerrar", () => {
    const r = evaluateRecord({ ...base, adjusted: true, asFoundPoints: good, asLeftPoints: [] });
    expect(r.complete).toBe(false);
    expect(r.asLeftResult).toBeNull();
  });
});

describe("assessmentRequired", () => {
  const w = { previousAptDate: "2026-03-10", performedAt: "2026-10-01" };
  it("as-found no apto: abre la evaluación con la ventana desde el último registro apto", () => {
    expect(assessmentRequired({ asFoundResult: "not_apt", adjusted: true, criticalUse: false, ...w })).toEqual({
      required: true,
      trigger: "as_found_not_apt",
      windowFrom: "2026-03-10",
      windowTo: "2026-10-01",
    });
  });
  it("ajustado sin as-found: solo si es de uso crítico", () => {
    expect(assessmentRequired({ asFoundResult: "not_evaluated", adjusted: true, criticalUse: true, previousAptDate: null, performedAt: "2026-10-01" })).toMatchObject({
      required: true,
      trigger: "adjusted_without_as_found",
      windowFrom: null,
    });
    expect(assessmentRequired({ asFoundResult: "not_evaluated", adjusted: true, criticalUse: false, ...w })).toEqual({ required: false });
  });
  it("todo dentro: no hay evaluación", () => {
    expect(assessmentRequired({ asFoundResult: "apt", adjusted: false, criticalUse: true, ...w })).toEqual({ required: false });
  });
});

describe("vigencia", () => {
  it.each([
    ["2026-10-21", 12, "2027-10-21"],
    ["2026-01-31", 1, "2026-02-28"],
    ["2024-02-29", 12, "2025-02-28"],
    ["2026-08-31", 6, "2027-02-28"],
  ])("%s + %i meses = %s", (performedAt, intervalMonths, expected) => {
    expect(nextCalibrationDue({ performedAt, intervalMonths })).toBe(expected);
    expect(validUntil({ performedAt, intervalMonths, asLeftResult: "apt" })).toBe(expected);
  });
  it("sin intervalo, o no apto, no hay vigencia", () => {
    expect(nextCalibrationDue({ performedAt: "2026-10-21", intervalMonths: null })).toBeNull();
    expect(validUntil({ performedAt: "2026-10-21", intervalMonths: 12, asLeftResult: "not_apt" })).toBeNull();
  });
});
