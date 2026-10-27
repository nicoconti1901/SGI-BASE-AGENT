import { describe, expect, it } from "vitest";
import { MAX_MONTHLY_TARGET, monthRangeOf, programCompliance, validateMonthlyTarget } from "@/domain/inspections/field-audit";
import { FIELD_AUDIT, auditContext, isSpecialTask } from "@/domain/inspections/templates/field-audit";
import { DEFAULT_TEMPLATES, getDefaultTemplate } from "@/domain/inspections/templates";
import { validateTemplate } from "@/domain/inspections/templates/validate";
import { applicableItems } from "@/domain/inspections/result";

describe("auditoría de campo: plantilla", () => {
  it("está registrada, es una actividad sin calendario y abre hallazgo con una crítica", () => {
    expect(getDefaultTemplate("field_audit")).toBe(FIELD_AUDIT);
    expect(DEFAULT_TEMPLATES).toContain(FIELD_AUDIT);
    expect(FIELD_AUDIT.scope).toBe("activity");
    expect(FIELD_AUDIT.intervalUnit).toBeNull();
    expect(FIELD_AUDIT.findingOnCritical).toBe(true);
  });

  it("se valida sola (≤ 25 aplicables, códigos únicos, hay críticos)", () => {
    expect(validateTemplate(FIELD_AUDIT, [{}])).toEqual([]);
  });

  it("sin tareas especiales no aparecen los ítems de altura, espacio confinado ni izaje", () => {
    const codes = applicableItems(FIELD_AUDIT.items, { context: auditContext([]) }).map((i) => i.code);
    expect(codes).toContain("docs_pts");
    expect(codes).not.toContain("height_harness");
    expect(codes).not.toContain("confined_gas");
    expect(codes).not.toContain("lifting_plan");
  });

  it("cada tarea especial suma solo sus ítems", () => {
    const codes = (tasks: string[]) => applicableItems(FIELD_AUDIT.items, { context: auditContext(tasks) }).map((i) => i.code);
    expect(codes(["height"])).toEqual(expect.arrayContaining(["height_harness", "height_anchor"]));
    expect(codes(["height"])).not.toContain("lifting_zone");
    expect(codes(["confined_space"])).toEqual(expect.arrayContaining(["confined_gas", "confined_rescue"]));
    expect(codes(["lifting"])).toEqual(expect.arrayContaining(["lifting_plan", "lifting_zone"]));
  });

  it("con las tres tareas especiales sigue por debajo de 25 ítems puntuables", () => {
    const all = applicableItems(FIELD_AUDIT.items, { context: auditContext(["height", "confined_space", "lifting"]) });
    expect(all.filter((i) => i.kind === "check")).toHaveLength(16);
    expect(all.length).toBeLessThanOrEqual(25);
  });

  it("las observaciones son texto y no puntúan", () => {
    const texts = FIELD_AUDIT.items.filter((i) => i.kind === "text");
    expect(texts.map((i) => i.code)).toEqual(["notes_unsafe", "notes_positive"]);
    expect(texts.every((i) => !i.required)).toBe(true);
  });

  it("reconoce solo las tareas especiales conocidas", () => {
    expect(isSpecialTask("height")).toBe(true);
    expect(isSpecialTask("toString")).toBe(false);
    expect(isSpecialTask("diving")).toBe(false);
  });
});

describe("auditoría de campo: programa por sede", () => {
  it("calcula el mes calendario", () => {
    expect(monthRangeOf("2026-10-27")).toEqual({ month: "2026-10", from: "2026-10-01", to: "2026-11-01" });
    expect(monthRangeOf("2026-12-05")).toEqual({ month: "2026-12", from: "2026-12-01", to: "2027-01-01" });
  });

  it("sin meta no hay porcentaje", () => {
    expect(programCompliance({ target: null, done: 3 })).toEqual({ target: 0, done: 3, remaining: 0, pct: 0, status: "no_target" });
    expect(programCompliance({ target: 0, done: 0 }).status).toBe("no_target");
  });

  it("pendiente, cumplida y superada", () => {
    expect(programCompliance({ target: 4, done: 1 })).toEqual({ target: 4, done: 1, remaining: 3, pct: 25, status: "pending" });
    expect(programCompliance({ target: 4, done: 4 })).toEqual({ target: 4, done: 4, remaining: 0, pct: 100, status: "met" });
    expect(programCompliance({ target: 4, done: 6 })).toEqual({ target: 4, done: 6, remaining: 0, pct: 150, status: "met" });
  });

  it("redondea el porcentaje", () => {
    expect(programCompliance({ target: 3, done: 1 }).pct).toBe(33);
    expect(programCompliance({ target: 3, done: 2 }).pct).toBe(67);
  });

  it("valida la meta mensual", () => {
    expect(validateMonthlyTarget(4)).toEqual({ ok: true, value: 4 });
    expect(validateMonthlyTarget("8")).toEqual({ ok: true, value: 8 });
    for (const bad of [0, -1, 1.5, "", "abc", null, MAX_MONTHLY_TARGET + 1]) expect(validateMonthlyTarget(bad).ok).toBe(false);
  });
});
