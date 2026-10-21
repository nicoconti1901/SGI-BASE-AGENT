import { describe, expect, it } from "vitest";
import {
  applicableItems,
  deriveInspectionResult,
  evaluateCondition,
  resolveAutoConform,
} from "@/domain/inspections/result";
import { InspectionDomainError, type Criticality, type EvalAnswer, type EvalItem } from "@/domain/inspections/types";

let seq = 0;
function check(criticality: Criticality = "minor", extra: Partial<EvalItem> = {}): EvalItem {
  return { id: `i${++seq}`, criticality, kind: "check", naAllowed: true, required: true, ...extra };
}
const ans = (item: EvalItem, value: EvalAnswer["value"]): EvalAnswer => ({ itemId: item.id, value });

function many(n: number, criticality: Criticality = "minor") {
  return Array.from({ length: n }, () => check(criticality));
}

describe("deriveInspectionResult (tabla del SPEC)", () => {
  it("1. 20 conformes → apto, 100,0", () => {
    const items = many(20);
    const r = deriveInspectionResult(items, items.map((i) => ans(i, "conform")));
    expect(r).toMatchObject({ complete: true, result: "fit", scorePct: 100, applicable: 20, conform: 20, nonconform: 0 });
  });

  it("2. 19 conformes + 1 NC menor → apto con observaciones, 95,0", () => {
    const items = many(20);
    const answers = items.map((i, idx) => ans(i, idx === 0 ? "nonconform" : "conform"));
    const r = deriveInspectionResult(items, answers);
    expect(r).toMatchObject({ result: "fit_with_observations", scorePct: 95 });
    expect(r.nonconformByCriticality).toEqual({ critical: 0, major: 0, minor: 1 });
  });

  it("3. 18 conformes + 1 NC mayor + 1 NC crítica → no apto, 90,0", () => {
    const items = [...many(18), check("major"), check("critical")];
    const answers = items.map((i, idx) => ans(i, idx >= 18 ? "nonconform" : "conform"));
    const r = deriveInspectionResult(items, answers);
    expect(r).toMatchObject({ result: "unfit", scorePct: 90 });
    expect(r.nonconformByCriticality).toEqual({ critical: 1, major: 1, minor: 0 });
  });

  it("4. 10 N/A + 5 conformes + 1 NC crítica → no apto, 83,3 (5 de 6)", () => {
    const items = [...many(10), ...many(5), check("critical")];
    const answers = items.map((i, idx) => ans(i, idx < 10 ? "na" : idx < 15 ? "conform" : "nonconform"));
    const r = deriveInspectionResult(items, answers);
    expect(r).toMatchObject({ result: "unfit", scorePct: 83.3, applicable: 6, conform: 5 });
  });

  it("5. 2 conformes + 1 NC menor → apto con observaciones, 66,7", () => {
    const items = many(3);
    const r = deriveInspectionResult(items, [ans(items[0], "conform"), ans(items[1], "conform"), ans(items[2], "nonconform")]);
    expect(r).toMatchObject({ result: "fit_with_observations", scorePct: 66.7 });
  });

  it("6. todo N/A → error no_applicable_items", () => {
    const items = many(3);
    expect(() => deriveInspectionResult(items, items.map((i) => ans(i, "na")))).toThrowError(
      expect.objectContaining({ code: "no_applicable_items" }),
    );
  });

  it("7. un ítem sin responder → incompleta, sin resultado", () => {
    const items = many(3);
    const r = deriveInspectionResult(items, [ans(items[0], "conform"), ans(items[1], "conform")]);
    expect(r.complete).toBe(false);
    expect(r.result).toBeNull();
    expect(r.missingItemIds).toEqual([items[2].id]);
  });

  it("8. presión 14 bar con rango 12–15 → conforme", () => {
    const p = check("critical", { kind: "number", minValue: 12, maxValue: 15 });
    const r = deriveInspectionResult([p], [{ itemId: p.id, numberValue: 14 }]);
    expect(r).toMatchObject({ result: "fit", conform: 1 });
  });

  it("9. presión 16 bar con rango 12–15 en ítem crítico → NC crítica, no apto", () => {
    const p = check("critical", { kind: "number", minValue: 12, maxValue: 15 });
    const r = deriveInspectionResult([p], [{ itemId: p.id, numberValue: 16 }]);
    expect(r).toMatchObject({ result: "unfit" });
    expect(r.nonconformByCriticality.critical).toBe(1);
  });

  it("10. presión sin cargar con rango definido → incompleta", () => {
    const p = check("critical", { kind: "number", minValue: 12, maxValue: 15 });
    const r = deriveInspectionResult([p], [{ itemId: p.id }]);
    expect(r.complete).toBe(false);
    expect(r.missingItemIds).toEqual([p.id]);
  });

  it("11. un ítem automático vencido pisa lo que marque el inspector", () => {
    const auto = check("critical", { autoSource: { dueKind: "hydrostatic_test" }, autoConform: false });
    const other = check("minor");
    const r = deriveInspectionResult([auto, other], [ans(auto, "conform"), ans(other, "conform")]);
    expect(r.result).toBe("unfit");
    expect(r.nonconformByCriticality.critical).toBe(1);
  });

  it("11b. un ítem automático vigente cuenta como conforme aunque no tenga respuesta", () => {
    const auto = check("critical", { autoSource: { dueKind: "maintenance" }, autoConform: true });
    const other = check("minor");
    const r = deriveInspectionResult([auto, other], [ans(other, "conform")]);
    expect(r).toMatchObject({ complete: true, result: "fit", conform: 2 });
  });

  it("12. lecturas y textos no cuentan ni puntúan", () => {
    const reading = check("minor", { kind: "reading", required: true });
    const text = check("minor", { kind: "text", required: false });
    const c = check("minor");
    const r = deriveInspectionResult(
      [reading, text, c],
      [{ itemId: reading.id, numberValue: 1200 }, { itemId: text.id, textValue: "todo bien" }, ans(c, "conform")],
    );
    expect(r).toMatchObject({ complete: true, applicable: 1, conform: 1, scorePct: 100, result: "fit" });
  });

  it("12b. una lectura obligatoria vacía bloquea el cierre; un texto opcional vacío no", () => {
    const reading = check("minor", { kind: "reading", required: true });
    const text = check("minor", { kind: "text", required: false });
    const c = check("minor");
    const r = deriveInspectionResult([reading, text, c], [ans(c, "conform")]);
    expect(r.missingItemIds).toEqual([reading.id]);
  });

  it("13. N/A en un ítem con naAllowed = false → error de entrada", () => {
    const i = check("major", { naAllowed: false });
    expect(() => deriveInspectionResult([i, check()], [ans(i, "na")])).toThrowError(
      expect.objectContaining({ code: "na_not_allowed" }),
    );
  });

  it("14. dos respuestas para el mismo ítem → error de entrada", () => {
    const i = check();
    expect(() => deriveInspectionResult([i], [ans(i, "conform"), ans(i, "nonconform")])).toThrowError(
      expect.objectContaining({ code: "duplicate_answer" }),
    );
  });

  it("una respuesta para un ítem desconocido es un error de entrada", () => {
    expect(() => deriveInspectionResult([check()], [{ itemId: "nope", value: "conform" }])).toThrow(InspectionDomainError);
  });

  it("incompleta no lanza aunque todo lo respondido sea N/A", () => {
    const items = many(2);
    expect(deriveInspectionResult(items, [ans(items[0], "na")]).complete).toBe(false);
  });
});

describe("appliesWhen y autoSource", () => {
  it("evalúa igual, distinto, dentro y fuera de una lista", () => {
    const attrs = { agent: "co2", wheels: true, years: 5 };
    expect(evaluateCondition({ source: "asset", key: "agent", equals: "co2" }, { asset: attrs })).toBe(true);
    expect(evaluateCondition({ source: "asset", key: "agent", notEquals: "co2" }, { asset: attrs })).toBe(false);
    expect(evaluateCondition({ source: "asset", key: "agent", in: ["abc", "co2"] }, { asset: attrs })).toBe(true);
    expect(evaluateCondition({ source: "asset", key: "agent", notIn: ["co2"] }, { asset: attrs })).toBe(false);
    expect(evaluateCondition({ source: "asset", key: "wheels", equals: true }, { asset: attrs })).toBe(true);
    expect(evaluateCondition({ source: "context", key: "task", equals: "lifting" }, { asset: attrs, context: { task: "height" } })).toBe(false);
  });

  it("un atributo ausente no cumple un equals pero sí un notEquals", () => {
    expect(evaluateCondition({ source: "asset", key: "x", equals: "a" }, { asset: {} })).toBe(false);
    expect(evaluateCondition({ source: "asset", key: "x", notEquals: "a" }, { asset: {} })).toBe(true);
  });

  it("un ítem de izaje no aparece en un equipo sin izaje", () => {
    const items = [
      { code: "A", appliesWhen: null },
      { code: "B", appliesWhen: { source: "asset", key: "hasLifting", equals: true } as const },
    ];
    expect(applicableItems(items, { asset: { hasLifting: false } }).map((i) => i.code)).toEqual(["A"]);
    expect(applicableItems(items, { asset: { hasLifting: true } }).map((i) => i.code)).toEqual(["A", "B"]);
  });

  it("«vigente» sale NC si el vencimiento ya pasó, o si no existe", () => {
    const due = [{ kind: "hydrostatic_test", dueAt: "2026-10-20" }];
    expect(resolveAutoConform({ dueKind: "hydrostatic_test" }, due, "2026-10-21")).toBe(false);
    expect(resolveAutoConform({ dueKind: "hydrostatic_test" }, due, "2026-10-20")).toBe(true);
    expect(resolveAutoConform({ dueKind: "maintenance" }, due, "2026-10-21")).toBe(false);
  });
});
