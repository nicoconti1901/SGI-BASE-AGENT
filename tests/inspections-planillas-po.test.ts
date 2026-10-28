import { describe, expect, it } from "vitest";
import { applicableItems, deriveInspectionResult } from "@/domain/inspections/result";
import { DEFAULT_TEMPLATES, getDefaultTemplate } from "@/domain/inspections/templates";
import { WASTE_SEGREGATION } from "@/domain/inspections/templates/waste-segregation";
import { validateTemplate } from "@/domain/inspections/templates/validate";
import type { EvalAnswer, EvalItem } from "@/domain/inspections/types";

describe("planillas del PO: sin registros repetidos", () => {
  it("cada plantilla tiene clave y nombre propios", () => {
    expect(new Set(DEFAULT_TEMPLATES.map((t) => t.key)).size).toBe(DEFAULT_TEMPLATES.length);
    expect(new Set(DEFAULT_TEMPLATES.map((t) => t.name)).size).toBe(DEFAULT_TEMPLATES.length);
  });

  it("el control de vehículos, la inspección de seguridad general y el control de extintores siguen siendo las plantillas existentes", () => {
    for (const key of ["light_periodic", "field_audit", "extinguisher_periodic"]) expect(getDefaultTemplate(key)).toBeDefined();
    expect(DEFAULT_TEMPLATES.map((t) => t.key).filter((k) => /general|vehicle_control|vehiculos/i.test(k))).toEqual([]);
  });
});

describe("RE 01 PE 06 segregación de residuos", () => {
  const t = WASTE_SEGREGATION;

  it("está registrada como área por sede, con hallazgo en crítica y sin estado de activo", () => {
    expect(getDefaultTemplate("waste_segregation")).toBe(t);
    expect(DEFAULT_TEMPLATES).toContain(t);
    expect(t).toMatchObject({ scope: "area", assetTypeKey: null, findingOnCritical: true, canReinstate: false, retireOnUnfit: false });
  });

  it("tiene los 10 ítems de la planilla, todos conformes / no conformes / no aplica, y se valida sola", () => {
    expect(t.items).toHaveLength(10);
    expect(t.items.every((i) => i.kind === "check" && i.naAllowed)).toBe(true);
    expect(validateTemplate(t)).toEqual([]);
    expect(applicableItems(t.items, {})).toHaveLength(10);
  });

  it("la segregación según el procedimiento es el único ítem crítico", () => {
    expect(t.items.filter((i) => i.criticality === "critical").map((i) => i.code)).toEqual(["content_segregated"]);
  });

  it("la foto es obligatoria en crítico y mayor y opcional en menor", () => {
    for (const i of t.items) expect(i.photoOnNc).toBe(i.criticality !== "minor");
  });

  const evals: EvalItem[] = t.items.map((it, i) => ({ id: `i${i}`, criticality: it.criticality, kind: it.kind, naAllowed: it.naAllowed, required: it.required }));
  const answers = (overrides: Record<string, EvalAnswer["value"]>): EvalAnswer[] =>
    t.items.map((it, i) => ({ itemId: `i${i}`, value: overrides[it.code] ?? "conform" }));

  it("los NA cuentan como cumplidos: todo en NA o conforme da «Apto»", () => {
    const r = deriveInspectionResult(evals, answers({ containers_enough: "na", bags_removed: "na" }));
    expect(r.result).toBe("fit");
    expect(r.nonconform).toBe(0);
  });

  it("un contenido mal segregado es «No apto»; una tapa rota sola, «Apto con observaciones»", () => {
    expect(deriveInspectionResult(evals, answers({ content_segregated: "nonconform" })).result).toBe("unfit");
    expect(deriveInspectionResult(evals, answers({ containers_condition: "nonconform" })).result).toBe("fit_with_observations");
  });
});
