import { describe, expect, it } from "vitest";
import {
  evaluateSupplier,
  resultFromScore,
  scoreEvaluation,
  type ScoreItem,
} from "@/domain/suppliers/scoring";

const T = { approvedMin: 80, conditionalMin: 60 };

/** Fixture F del SPEC: A(40, excl) · B(30) · C(20) · D(10, excl). Sin N/A. */
function fixtureF(scores: (number | null)[]): ScoreItem[] {
  const base = [
    { name: "A", weight: 40, excluding: true, basic: false },
    { name: "B", weight: 30, excluding: false, basic: true },
    { name: "C", weight: 20, excluding: false, basic: false },
    { name: "D", weight: 10, excluding: true, basic: false },
  ];
  return base.map((b, i) => ({ ...b, allowNA: false, score: scores[i] }));
}

/** Fixture F': como F pero D no excluyente y con N/A permitido. */
function fixtureFPrime(scores: (number | null)[]): ScoreItem[] {
  return fixtureF(scores).map((it) => (it.name === "D" ? { ...it, excluding: false, allowNA: true } : it));
}

const item = (weight: number, score: number | null, extra: Partial<ScoreItem> = {}): ScoreItem => ({
  weight,
  score,
  excluding: false,
  allowNA: false,
  basic: false,
  ...extra,
});

describe("tabla de casos del SPEC (scoreEvaluation + resultFromScore)", () => {
  const cases: [string, ScoreItem[], number, string, string][] = [
    ["1 todo 5", fixtureF([5, 5, 5, 5]), 100, "approved", "score"],
    ["2 todo 4 (límite inclusivo)", fixtureF([4, 4, 4, 4]), 80, "approved", "score"],
    ["3 todo 3 (límite inclusivo)", fixtureF([3, 3, 3, 3]), 60, "conditional", "score"],
    ["4 todo 2", fixtureF([2, 2, 2, 2]), 40, "not_approved", "score"],
    ["5 todo 1", fixtureF([1, 1, 1, 1]), 20, "not_approved", "score"],
    ["6 el puntaje oculta un 1 excluyente", fixtureF([5, 5, 5, 1]), 92, "not_approved", "excluding_criterion"],
    ["7 excluyente en 2 con total alto", fixtureF([5, 5, 5, 2]), 94, "conditional", "excluding_criterion"],
    ["8 excluyente en 2 con total bajo", fixtureF([2, 5, 5, 5]), 76, "conditional", "score"],
    ["9 un 1 en criterio no excluyente", fixtureF([5, 1, 5, 5]), 76, "conditional", "score"],
    ["10 justo bajo el umbral", fixtureF([4, 4, 4, 3]), 78, "conditional", "score"],
    ["11 sobre el umbral", fixtureF([4, 4, 4, 5]), 82, "approved", "score"],
    ["12 F' con D sin responder", fixtureFPrime([4, 4, 4, null]), 80, "approved", "score"],
    ["13 F' truncado, no redondeado", fixtureFPrime([4, 4, 3, null]), 75.5, "conditional", "score"],
    ["14 truncado en el límite (399 y 1)", [item(399, 4), item(1, 3)], 79.9, "conditional", "score"],
    ["15 pesos 99 y 1", [item(99, 4), item(1, 3)], 79.8, "conditional", "score"],
  ];

  it.each(cases)("%s", (_name, items, total, result, reason) => {
    const score = scoreEvaluation(items, "full", "standard");
    expect(score).toMatchObject({ ok: true, total });
    const outcome = evaluateSupplier(items, "full", "standard", T);
    expect(outcome).toMatchObject({ ok: true, total, result, resultReason: reason });
  });

  it("resultFromScore directo: los mismos casos", () => {
    expect(resultFromScore(92, [{ index: 3, score: 1 }], T)).toEqual({ ok: true, result: "not_approved", reason: "excluding_criterion" });
    expect(resultFromScore(94, [{ index: 3, score: 2 }], T)).toEqual({ ok: true, result: "conditional", reason: "excluding_criterion" });
    expect(resultFromScore(40, [{ index: 0, score: 2 }], T)).toEqual({ ok: true, result: "not_approved", reason: "score" });
    expect(resultFromScore(76, [{ index: 0, score: 2 }], T)).toEqual({ ok: true, result: "conditional", reason: "score" });
    expect(resultFromScore(80, [], T)).toEqual({ ok: true, result: "approved", reason: "score" });
    expect(resultFromScore(79.9, [], T)).toEqual({ ok: true, result: "conditional", reason: "score" });
    expect(resultFromScore(59.9, [], T)).toEqual({ ok: true, result: "not_approved", reason: "score" });
  });

  it("umbral configurado en 85: 80,0 es condicional", () => {
    expect(resultFromScore(80, [], { approvedMin: 85, conditionalMin: 60 })).toMatchObject({ result: "conditional" });
  });

  it("umbrales inconsistentes", () => {
    expect(resultFromScore(80, [], { approvedMin: 60, conditionalMin: 80 })).toEqual({ ok: false, error: "INVALID_THRESHOLDS" });
  });

  it("devuelve cobertura, pesos y los fallos de excluyentes", () => {
    const r = scoreEvaluation(fixtureFPrime([4, 4, 4, null]), "full", "standard");
    expect(r).toMatchObject({ ok: true, applicableWeight: 100, answeredWeight: 90, coverage: 90, excludingFailures: [] });
    const f = scoreEvaluation(fixtureF([5, 5, 5, 1]), "full", "standard");
    expect(f).toMatchObject({ ok: true, excludingFailures: [{ index: 3, name: "D", score: 1 }] });
  });
});

describe("errores tipados", () => {
  const code = (items: ScoreItem[], mode: "full" | "simplified" | "declared" = "full", crit: "critical" | "standard" | "low" = "standard") => {
    const r = scoreEvaluation(items, mode, crit);
    return r.ok ? "OK" : r.error;
  };

  it("nota inválida", () => {
    for (const bad of [0, 6, 3.5, Number.NaN, "4" as unknown as number, undefined as unknown as number]) {
      expect(code([item(10, bad)])).toBe("INVALID_SCORE");
    }
  });

  it("N/A en criterio que no lo permite, o en un excluyente aunque la plantilla lo marque", () => {
    expect(code([item(10, null)])).toBe("NA_NOT_ALLOWED");
    expect(code([item(10, null, { allowNA: true, excluding: true }), item(10, 4)])).toBe("NA_NOT_ALLOWED");
  });

  it("peso 0, negativo o no entero", () => {
    expect(code([item(0, 3)])).toBe("INVALID_WEIGHT");
    expect(code([item(-5, 3)])).toBe("INVALID_WEIGHT");
    expect(code([item(2.5, 3)])).toBe("INVALID_WEIGHT");
  });

  it("lista vacía o sin respuestas", () => {
    expect(code([])).toBe("NO_ITEMS");
    expect(code([item(10, null, { allowNA: true })])).toBe("NO_ITEMS");
  });

  it("cobertura mínima de 60 %", () => {
    const na = (w: number, s: number | null, ex = false) => item(w, s, { allowNA: true, excluding: ex });
    // solo A respondido: 40 % del peso aplicable
    expect(code([na(40, 4), na(30, null), na(20, null), na(10, null)])).toBe("INSUFFICIENT_COVERAGE");
    // 60 % exacto alcanza
    expect(code([na(60, 4), na(40, null)])).toBe("OK");
    expect(code([na(59, 4), na(41, null)])).toBe("INSUFFICIENT_COVERAGE");
  });

  it("simplificada con proveedor crítico y declarada con otra criticidad", () => {
    expect(code(fixtureF([4, 4, 4, 4]), "simplified", "critical")).toBe("SIMPLIFIED_NOT_ALLOWED");
    expect(code([], "declared", "standard")).toBe("DECLARED_NOT_ALLOWED");
    expect(code([], "declared", "critical")).toBe("DECLARED_NOT_ALLOWED");
  });
});

describe("evaluación simplificada", () => {
  it("todo 4: solo cuentan B (básico) y los excluyentes A y D", () => {
    const items = fixtureF([4, 4, null, 4]); // C no cuenta: puede venir sin nota
    const r = evaluateSupplier(items, "simplified", "standard", T);
    expect(r).toMatchObject({ ok: true, total: 80, result: "approved", mode: "simplified" });
  });

  it("con D = 1: total 72,5, no aprobado por excluyente", () => {
    const r = evaluateSupplier(fixtureF([4, 4, null, 1]), "simplified", "standard", T);
    expect(r).toMatchObject({ ok: true, total: 72.5, result: "not_approved", resultReason: "excluding_criterion" });
  });

  it("proveedor crítico: no se permite", () => {
    expect(evaluateSupplier(fixtureF([4, 4, 4, 4]), "simplified", "critical", T)).toEqual({ ok: false, error: "SIMPLIFIED_NOT_ALLOWED" });
  });

  it("ignora criterios fuera de alcance aunque traigan una nota inválida", () => {
    const r = scoreEvaluation(fixtureF([4, 4, 99, 4]), "simplified", "standard");
    expect(r).toMatchObject({ ok: true, total: 80 });
  });
});

describe("evaluación declarada (bajo impacto)", () => {
  it("sin notas: aprobado, razón declarada, sin puntaje", () => {
    const r = evaluateSupplier([], "declared", "low", T);
    expect(r).toMatchObject({ ok: true, total: null, coverage: null, result: "approved", resultReason: "declared", mode: "declared" });
  });
});
