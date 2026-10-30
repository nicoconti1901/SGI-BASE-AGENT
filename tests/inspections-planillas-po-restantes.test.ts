import { describe, expect, it } from "vitest";
import { ASSET_TYPES, getAssetType, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { DEFAULT_TEMPLATES, getDefaultTemplate } from "@/domain/inspections/templates";
import { DRILL } from "@/domain/inspections/templates/drill";
import { LIFTING_GEAR_PERIODIC } from "@/domain/inspections/templates/lifting-gear";
import { MACHINERY_TOOLS } from "@/domain/inspections/templates/machinery-tools";
import { validateTemplate } from "@/domain/inspections/templates/validate";
import { applicableItems, deriveInspectionResult } from "@/domain/inspections/result";
import type { EvalAnswer, EvalItem } from "@/domain/inspections/types";

const evalItems = (items: { criticality: EvalItem["criticality"]; kind: EvalItem["kind"]; naAllowed: boolean; required: boolean }[]): EvalItem[] =>
  items.map((it, i) => ({ id: `i${i}`, criticality: it.criticality, kind: it.kind, naAllowed: it.naAllowed, required: it.required }));

describe("planillas del PO que faltaban: registro", () => {
  it("las tres plantillas están registradas, con clave y nombre propios", () => {
    for (const t of [MACHINERY_TOOLS, LIFTING_GEAR_PERIODIC, DRILL]) {
      expect(getDefaultTemplate(t.key)).toBe(t);
      expect(DEFAULT_TEMPLATES).toContain(t);
      expect(validateTemplate(t)).toEqual([]);
    }
    expect(new Set(DEFAULT_TEMPLATES.map((t) => t.key)).size).toBe(DEFAULT_TEMPLATES.length);
    expect(new Set(DEFAULT_TEMPLATES.map((t) => t.name)).size).toBe(DEFAULT_TEMPLATES.length);
  });

  it("la foto es obligatoria en crítico y mayor y opcional en menor, salvo el ítem que completa el sistema", () => {
    for (const t of [MACHINERY_TOOLS, LIFTING_GEAR_PERIODIC, DRILL]) {
      for (const i of t.items.filter((x) => x.kind === "check" && !x.autoSource)) expect(i.photoOnNc, `${t.key}.${i.code}`).toBe(i.criticality !== "minor");
    }
  });
});

describe("RE 01 PE 12 control de máquinas y herramientas", () => {
  const t = MACHINERY_TOOLS;

  it("es un área mensual con hallazgo en crítica y un listado de texto que no puntúa", () => {
    expect(t).toMatchObject({ scope: "area", assetTypeKey: null, intervalUnit: "months", intervalValue: 1, findingOnCritical: true });
    const list = t.items.find((i) => i.code === "equipment_list");
    expect(list).toMatchObject({ kind: "text", required: false, criticality: "minor" });
  });

  it("un cable con empalme precario o un resguardo sacado es «No apto»; un mango flojo, «Apto con observaciones»", () => {
    const ev = evalItems(t.items);
    const answers = (over: Record<string, EvalAnswer["value"]>): EvalAnswer[] =>
      t.items.filter((i) => i.kind === "check").map((it) => ({ itemId: `i${t.items.indexOf(it)}`, value: over[it.code] ?? "conform" }));
    expect(deriveInspectionResult(ev, answers({ cables_plugs: "nonconform" })).result).toBe("unfit");
    expect(deriveInspectionResult(ev, answers({ guards_in_place: "nonconform" })).result).toBe("unfit");
    expect(deriveInspectionResult(ev, answers({ handles: "nonconform" })).result).toBe("fit_with_observations");
  });
});

describe("RG 02 PG 10 simulacro", () => {
  const t = DRILL;

  it("es un área anual: no seguir el procedimiento de emergencia es la única crítica", () => {
    expect(t).toMatchObject({ scope: "area", assetTypeKey: null, intervalUnit: "months", intervalValue: 12, findingOnCritical: true });
    expect(t.items.filter((i) => i.criticality === "critical" && i.kind === "check").map((i) => i.code)).toEqual(["procedure_followed"]);
  });

  it("la contingencia, los participantes y las correcciones son texto libre", () => {
    expect(t.items.filter((i) => i.kind === "text").map((i) => i.code)).toEqual(["scenario", "participants", "corrections"]);
    expect(applicableItems(t.items, {}).length).toBeLessThanOrEqual(t.maxApplicableItems);
  });
});

describe("RE 03 PE 12 elementos de izaje", () => {
  const type = ASSET_TYPES.lifting_gear;
  const t = LIFTING_GEAR_PERIODIC;

  it("es un tipo de activo registrado que enlaza con su plantilla periódica", () => {
    expect(isAssetTypeKey("lifting_gear")).toBe(true);
    expect(getAssetType("lifting_gear")).toBe(type);
    expect(type.periodicTemplateKey).toBe(t.key);
    expect(t).toMatchObject({ scope: "asset", assetTypeKey: "lifting_gear", canReinstate: true, retireOnUnfit: false });
  });

  it("la certificación es el vencimiento bloqueante y su frecuencia sale del activo", () => {
    expect(type.dueKinds({ certificationMonths: 6 })).toEqual([
      { kind: "certification", label: "Certificación", intervalMonths: 6, leadDays: 30, blocking: true, required: true },
    ]);
    expect(type.dueKinds({})[0].intervalMonths).toBe(12);
    const cert = t.items.find((i) => i.code === "ident_certification");
    expect(cert?.autoSource).toEqual({ dueKind: "certification" });
  });

  it("pide tipo y descripción; la frecuencia vale 12 meses si no se indica", () => {
    expect(type.attributesSchema.safeParse({}).success).toBe(false);
    const ok = type.attributesSchema.safeParse({ kind: "sling", description: "Eslinga de poliéster 3 m" });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.certificationMonths).toBe(12);
    expect(type.attributesSchema.safeParse({ kind: "sling", description: "x", certificationMonths: 0 }).success).toBe(false);
    expect(type.summarize({ kind: "sling", capacity: "2 t" })).toBe("Eslinga · 2 t");
  });

  it("el control del aparejo solo aplica a los aparejos", () => {
    const item = t.items.find((i) => i.code === "hoist_works");
    expect(item?.appliesWhen).toEqual({ source: "asset", key: "kind", equals: "hoist" });
  });

  it("sin ganchos con traba el elemento es «No apto»; sin guardarlo bien, «Apto con observaciones»", () => {
    const ev = evalItems(t.items);
    const answers = (over: Record<string, EvalAnswer["value"]>): EvalAnswer[] =>
      t.items.map((it, i) => ({ itemId: `i${i}`, value: over[it.code] ?? (it.code === "hoist_works" ? "na" : "conform") }));
    expect(deriveInspectionResult(ev, answers({ hardware_hooks: "nonconform" })).result).toBe("unfit");
    expect(deriveInspectionResult(ev, answers({ care_storage: "nonconform" })).result).toBe("fit_with_observations");
  });
});
