import { describe, expect, it } from "vitest";
import { ASSET_TYPES, getAssetType, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { parseAssetCsv, assetCsvTemplate } from "@/domain/inspections/asset-types/csv";
import { fallProtectionAttributes } from "@/domain/inspections/asset-types/fall-protection";
import { resolveDueDates } from "@/domain/inspections/asset-types/resolve";
import { assetStatusAfter } from "@/domain/inspections/asset-status";
import { planFollowUp } from "@/domain/inspections/consequences";
import { applicableItems, deriveInspectionResult, resolveAutoConform } from "@/domain/inspections/result";
import { nextInspectionDue } from "@/domain/inspections/schedule";
import { getDefaultTemplate } from "@/domain/inspections/templates";
import { validateTemplate } from "@/domain/inspections/templates/validate";
import type { EvalAnswer, EvalItem, TemplateItemDef } from "@/domain/inspections/types";

const harness = { kind: "harness", serialNumber: "SN-1", manufacturedAt: "2022-03-10", serviceLifeYears: 5 };

function evalItems(items: TemplateItemDef[], today: string, dueDates: { kind: string; dueAt: string }[]) {
  const evals: EvalItem[] = items.map((it, i) => ({
    id: `i${i}`,
    criticality: it.criticality,
    kind: it.kind,
    naAllowed: it.naAllowed,
    required: it.required,
    autoSource: it.autoSource ?? null,
    autoConform: it.autoSource ? resolveAutoConform(it.autoSource, dueDates, today) : undefined,
  }));
  return evals;
}

describe("T2 zona de obradores", () => {
  const t = getDefaultTemplate("site_obrador")!;

  it("es un área semanal con aviso a 2 días, hallazgo en crítica y sin estado de activo", () => {
    expect(t).toMatchObject({ scope: "area", assetTypeKey: null, intervalUnit: "days", intervalValue: 7, leadDays: 2, findingOnCritical: true, canReinstate: false, retireOnUnfit: false });
  });

  it("tiene 24 ítems, ninguno por encima de 25, y se valida sola", () => {
    expect(t.items).toHaveLength(24);
    expect(validateTemplate(t)).toEqual([]);
    expect(applicableItems(t.items, {}).length).toBeLessThanOrEqual(25);
  });

  it("los críticos son tableros, diferencial, puesta a tierra y medios de escape", () => {
    expect(t.items.filter((i) => i.criticality === "critical").map((i) => i.code)).toEqual(["power_panels", "power_rcd", "power_earth", "fire_escape"]);
  });

  it("la foto es obligatoria en crítico y mayor y opcional en menor", () => {
    for (const i of t.items) expect(i.photoOnNc).toBe(i.criticality !== "minor");
  });

  it("un tablero sin tapa deja la zona no apta; con una sola observación menor queda apta con observaciones", () => {
    const items = evalItems(t.items, "2026-10-26", []);
    const all = (overrides: Record<string, EvalAnswer["value"]>): EvalAnswer[] =>
      t.items.map((it, i) => ({ itemId: `i${i}`, value: overrides[it.code] ?? "conform" }));
    expect(deriveInspectionResult(items, all({ power_panels: "nonconform" })).result).toBe("unfit");
    expect(deriveInspectionResult(items, all({ order_waste: "nonconform" })).result).toBe("fit_with_observations");
    expect(deriveInspectionResult(items, all({})).result).toBe("fit");
  });

  it("el calendario: apta, a los 7 días; no apta, reinspección a los 7 días", () => {
    const base = { inspectedAt: "2026-10-26", interval: { unit: "days" as const, value: 7 }, reinspectionDays: 7, retireOnUnfit: false };
    expect(nextInspectionDue({ ...base, result: "fit" })).toEqual({ dueAt: "2026-11-02", kind: "periodic" });
    expect(nextInspectionDue({ ...base, result: "unfit" })).toEqual({ dueAt: "2026-11-02", kind: "reinspection" });
  });

  it("un no apto abre acción y, por la crítica, un hallazgo borrador", () => {
    const plan = planFollowUp({
      subjectLabel: "Zona de obradores",
      nonconforming: [{ code: "power_panels", text: "Tableros con tapa", criticality: "critical", comment: null }],
      statusChange: null,
      typeKey: null,
      findingOnCritical: t.findingOnCritical,
    });
    expect(plan.action?.criticality).toBe("critical");
    expect(plan.finding).not.toBeNull();
  });
});

describe("arneses y cabos de vida: tipo de activo", () => {
  it("está en el registro", () => {
    expect(isAssetTypeKey("fall_protection")).toBe(true);
    expect(getAssetType("fall_protection").periodicTemplateKey).toBe("fall_protection_periodic");
    expect(Object.keys(ASSET_TYPES)).toContain("fall_protection");
  });

  it("acepta un arnés válido y completa 5 años de vida útil", () => {
    const parsed = fallProtectionAttributes.parse({ kind: "harness", serialNumber: "SN-1", manufacturedAt: "2022-03-10" });
    expect(parsed.serviceLifeYears).toBe(5);
  });

  it("rechaza la falta de n.º de serie, de fabricación o de tipo, y valores imposibles", () => {
    const bad = (v: Record<string, unknown>) => fallProtectionAttributes.safeParse(v).success;
    expect(bad({ kind: "harness", manufacturedAt: "2022-03-10" })).toBe(false);
    expect(bad({ kind: "harness", serialNumber: "  ", manufacturedAt: "2022-03-10" })).toBe(false);
    expect(bad({ kind: "harness", serialNumber: "S" })).toBe(false);
    expect(bad({ serialNumber: "S", manufacturedAt: "2022-03-10" })).toBe(false);
    expect(bad({ ...harness, kind: "chaleco" })).toBe(false);
    expect(bad({ ...harness, manufacturedAt: "2022-02-31" })).toBe(false);
    expect(bad({ ...harness, serviceLifeYears: 0 })).toBe(false);
    expect(bad({ ...harness, serviceLifeYears: 2.5 })).toBe(false);
  });

  it("el fin de la vida útil sale de fabricación + años y manda la fecha del fabricante si se carga", () => {
    const type = getAssetType("fall_protection");
    const derived = resolveDueDates(type, harness, []);
    expect(derived.issues).toEqual([]);
    expect(derived.dueDates).toEqual([expect.objectContaining({ kind: "service_life_end", dueAt: "2027-03-10", blocking: true, leadDays: 30 })]);
    const own = resolveDueDates(type, { ...harness, serviceLifeYears: 10 }, []);
    expect(own.dueDates[0].dueAt).toBe("2032-03-10");
    const manual = resolveDueDates(type, harness, [{ kind: "service_life_end", dueAt: "2030-01-31" }]);
    expect(manual.dueDates[0].dueAt).toBe("2030-01-31");
  });

  it("CSV: lee tipos por nombre, usa 5 años si falta la vida útil y avisa cada error", () => {
    const type = getAssetType("fall_protection");
    const header = "codigo,descripcion,sede,tipo_equipo,serie,fabricacion,vida_util_anios";
    const csv = [header, "ARN-1,Arnés de Pedro,Base,Arnés de cuerpo completo,S1,2023-01-15,", "ARN-2,Cabo,Base,cabo doble con absorbedor,S2,15/01/2023,8", "ARN-3,Raro,Base,chaleco,S3,2023-01-15,5", "ARN-4,Sin serie,Base,retractil,,2023-01-15,5"].join("\n");
    const { rows, errors } = parseAssetCsv(type, csv);
    expect(rows.map((r) => r.code)).toEqual(["ARN-1", "ARN-2"]);
    expect(rows[0].attributes).toMatchObject({ kind: "harness", serviceLifeYears: 5 });
    expect(rows[0].dueDates[0].dueAt).toBe("2028-01-15");
    expect(rows[1].attributes).toMatchObject({ kind: "lanyard_double", serviceLifeYears: 8 });
    expect(errors.map((e) => e.line)).toEqual([4, 5]);
  });

  it("la plantilla del CSV trae los encabezados del tipo y falta una columna obligatoria se informa", () => {
    const type = getAssetType("fall_protection");
    expect(assetCsvTemplate(type).trim().split(",")).toEqual(expect.arrayContaining(["serie", "fabricacion", "tipo_equipo", "vida_util_anios", "vence_vida_util"]));
    const { errors } = parseAssetCsv(type, "codigo,descripcion,sede,tipo_equipo,fabricacion\nA,B,C,arnes,2023-01-01");
    expect(errors[0].message).toMatch(/serie/);
  });
});

describe("T8 arneses y cabos de vida: plantilla", () => {
  const t = getDefaultTemplate("fall_protection_periodic")!;
  const samples = ["harness", "lanyard_single", "lanyard_double", "positioning_lanyard", "retractable", "carabiner"].map((kind) => ({ kind }));

  it("política: baja definitiva, sin liberación, sin hallazgo automático, cada 6 meses con aviso a 15 días", () => {
    expect(t).toMatchObject({ scope: "asset", assetTypeKey: "fall_protection", intervalUnit: "months", intervalValue: 6, leadDays: 15, retireOnUnfit: true, canReinstate: false, findingOnCritical: false });
  });

  it("tiene 12 ítems, se valida sola para todos los tipos y el automático apunta al vencimiento del tipo", () => {
    expect(t.items).toHaveLength(12);
    expect(validateTemplate(t, samples)).toEqual([]);
    const auto = t.items.filter((i) => i.autoSource);
    expect(auto.map((i) => i.autoSource!.dueKind)).toEqual(["service_life_end"]);
    expect(getAssetType("fall_protection").dueKinds(harness).map((d) => d.kind)).toContain("service_life_end");
    expect(auto[0].naAllowed).toBe(false);
  });

  it("retráctil y antitrauma aparecen solo cuando corresponden", () => {
    const codes = (kind: string) => applicableItems(t.items, { asset: { kind } }).map((i) => i.code);
    expect(codes("retractable")).toContain("retractable_brake");
    expect(codes("harness")).not.toContain("retractable_brake");
    expect(codes("harness")).toContain("harness_antitrauma");
    expect(codes("lanyard_single")).not.toContain("harness_antitrauma");
  });

  it("todos los ítems críticos salvo el antitrauma (mayor) y la conservación (menor)", () => {
    for (const i of t.items) {
      const expected = i.code === "harness_antitrauma" ? "major" : i.code === "care_storage" ? "minor" : "critical";
      expect(i.criticality).toBe(expected);
    }
  });

  it("con la vida útil vencida el equipo no puede ser apto aunque el inspector marque todo conforme", () => {
    const items = evalItems(t.items, "2027-04-01", [{ kind: "service_life_end", dueAt: "2027-03-10" }]);
    const answers: EvalAnswer[] = t.items.map((it, i) => ({ itemId: `i${i}`, value: it.autoSource ? undefined : "conform" }));
    expect(deriveInspectionResult(items, answers).result).toBe("unfit");
    const vigente = evalItems(t.items, "2027-03-10", [{ kind: "service_life_end", dueAt: "2027-03-10" }]);
    expect(deriveInspectionResult(vigente, answers).result).toBe("fit");
  });

  it("un no apto da la baja definitiva, sin vencimiento futuro, con acción de destrucción y sin hallazgo", () => {
    const { status, change } = assetStatusAfter({ current: "in_service", result: "unfit", policy: { retireOnUnfit: t.retireOnUnfit, canReinstate: t.canReinstate }, canRelease: true, origin: "close" });
    expect(status).toBe("retired");
    expect(change?.reasonCode).toBe("inspection_unfit_retired");
    expect(nextInspectionDue({ inspectedAt: "2026-10-26", result: "unfit", interval: { unit: "months", value: 6 }, reinspectionDays: 7, retireOnUnfit: true })).toEqual({ dueAt: null, kind: "none" });
    const plan = planFollowUp({
      subjectLabel: "Arnés / cabo de vida ARN-1",
      nonconforming: [{ code: "webbing_cuts", text: "Cintas sin cortes", criticality: "critical", comment: "Corte en la cinta dorsal" }],
      statusChange: change,
      typeKey: "fall_protection",
      findingOnCritical: t.findingOnCritical,
    });
    expect(plan.finding).toBeNull();
    expect(plan.action?.description).toContain("destruirlo y adjuntar la foto");
  });

  it("un arnés ya dado de baja no vuelve ni con una inspección apta", () => {
    const { status } = assetStatusAfter({ current: "retired", result: "fit", policy: { retireOnUnfit: true, canReinstate: false }, canRelease: true, origin: "close" });
    expect(status).toBe("retired");
  });
});
