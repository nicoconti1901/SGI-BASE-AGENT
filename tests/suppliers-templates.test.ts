import { describe, expect, it } from "vitest";
import {
  DEFAULT_CRITERIA,
  DEFAULT_DOCUMENT_TYPES,
  validateTemplateForPublish,
  type TemplateCriterionInput,
  type TemplateInput,
} from "@/domain/suppliers/templates";
import { scoreEvaluation } from "@/domain/suppliers/scoring";
import { SUPPLIER_TYPES } from "@/domain/suppliers/types";

const crit = (name: string, weight: number, extra: Partial<TemplateCriterionInput> = {}): TemplateCriterionInput => ({
  name,
  description: "",
  descriptor1: "",
  descriptor3: "",
  descriptor5: "",
  weight,
  excluding: false,
  allowNA: false,
  phase: "both",
  basic: false,
  ...extra,
});

const valid = (criteria: TemplateCriterionInput[]): TemplateInput => ({ approvedMin: 80, conditionalMin: 60, criteria });
const codes = (t: TemplateInput) => {
  const r = validateTemplateForPublish(t);
  return r.ok ? [] : r.errors.map((e) => e.code);
};

describe("validateTemplateForPublish", () => {
  it("pesos que suman 100: ok", () => {
    expect(validateTemplateForPublish(valid([crit("A", 60), crit("B", 40)]))).toEqual({ ok: true });
  });

  it("pesos que no suman 100", () => {
    expect(codes(valid([crit("A", 60), crit("B", 30)]))).toEqual(["WEIGHTS_SUM"]);
    expect(codes(valid([crit("A", 60), crit("B", 50)]))).toEqual(["WEIGHTS_SUM"]);
  });

  it("un excluyente no admite N/A", () => {
    expect(codes(valid([crit("A", 60, { excluding: true, allowNA: true }), crit("B", 40)]))).toEqual(["EXCLUDING_NA"]);
  });

  it("al menos un criterio", () => {
    expect(codes(valid([]))).toContain("NO_CRITERIA");
  });

  it("nombres únicos dentro de la versión (sin distinguir mayúsculas ni tildes)", () => {
    expect(codes(valid([crit("Calidad", 50), crit(" calidad ", 50)]))).toEqual(["DUPLICATE_NAME"]);
    expect(codes(valid([crit("Gestión", 50), crit("gestion", 50)]))).toEqual(["DUPLICATE_NAME"]);
  });

  it("nombre vacío y peso inválido", () => {
    expect(codes(valid([crit("", 50), crit("B", 50)]))).toContain("EMPTY_NAME");
    expect(codes(valid([crit("A", 0), crit("B", 100)]))).toContain("INVALID_WEIGHT");
    expect(codes(valid([crit("A", 2.5), crit("B", 97.5)]))).toContain("INVALID_WEIGHT");
  });

  it("umbrales inconsistentes", () => {
    expect(codes({ approvedMin: 60, conditionalMin: 80, criteria: [crit("A", 100)] })).toEqual(["INVALID_THRESHOLDS"]);
    expect(codes({ approvedMin: 120, conditionalMin: 60, criteria: [crit("A", 100)] })).toEqual(["INVALID_THRESHOLDS"]);
  });
});

describe("plantillas v1 sembradas", () => {
  it.each(SUPPLIER_TYPES)("la de %s pasa la validación de publicación", (type) => {
    expect(validateTemplateForPublish(valid(DEFAULT_CRITERIA[type]))).toEqual({ ok: true });
  });

  it.each(SUPPLIER_TYPES)("la de %s tiene descriptores y se puede puntuar en una evaluación completa", (type) => {
    for (const c of DEFAULT_CRITERIA[type]) {
      expect(c.descriptor1.length).toBeGreaterThan(5);
      expect(c.descriptor3.length).toBeGreaterThan(5);
      expect(c.descriptor5.length).toBeGreaterThan(5);
    }
    const items = DEFAULT_CRITERIA[type].map((c) => ({ ...c, score: 5 }));
    expect(scoreEvaluation(items, "full", "critical")).toMatchObject({ ok: true, total: 100 });
  });

  it("la de contratista exige seguridad y salud como excluyente; calidad es excluyente en producto y servicio", () => {
    expect(DEFAULT_CRITERIA.contractor.find((c) => /Seguridad/.test(c.name))?.excluding).toBe(true);
    expect(DEFAULT_CRITERIA.product.find((c) => /Calidad/.test(c.name))?.excluding).toBe(true);
    expect(DEFAULT_CRITERIA.service.find((c) => /Calidad/.test(c.name))?.excluding).toBe(true);
  });

  it("la evaluación simplificada tiene al menos un criterio básico además de los excluyentes", () => {
    for (const type of SUPPLIER_TYPES) {
      expect(DEFAULT_CRITERIA[type].filter((c) => c.basic).length).toBeGreaterThan(0);
    }
  });
});

describe("tipos de documento sugeridos", () => {
  it("claves únicas y al menos un bloqueante, solo para contratistas", () => {
    const keys = DEFAULT_DOCUMENT_TYPES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const blocking = DEFAULT_DOCUMENT_TYPES.filter((t) => t.blocksEnablement);
    expect(blocking.map((t) => t.key).sort()).toEqual(["art_certificate", "f931", "life_insurance", "personnel_roster"]);
    for (const t of blocking) {
      expect(t.required).toBe(true);
      expect(t.appliesTo).toEqual(["contractor"]);
    }
  });

  it("el F.931 se renueva todos los meses", () => {
    const f931 = DEFAULT_DOCUMENT_TYPES.find((t) => t.key === "f931")!;
    expect(f931.recurrence).toBe("monthly");
    expect(f931.validityMonths).toBe(1);
  });

  it("todos llevan el aviso de que es orientativo", () => {
    for (const t of DEFAULT_DOCUMENT_TYPES) expect(t.note).toMatch(/orientativo|validar/i);
  });
});
