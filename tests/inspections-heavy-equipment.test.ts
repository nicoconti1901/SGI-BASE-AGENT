import { describe, expect, it } from "vitest";
import { ASSET_TYPES, getAssetType, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { assetCsvTemplate, parseAssetCsv } from "@/domain/inspections/asset-types/csv";
import { heavyEquipmentAttributes } from "@/domain/inspections/asset-types/heavy-equipment";
import { resolveDueDates } from "@/domain/inspections/asset-types/resolve";
import { assetStatusAfter } from "@/domain/inspections/asset-status";
import { planFollowUp } from "@/domain/inspections/consequences";
import { applicableItems, deriveInspectionResult, resolveAutoConform } from "@/domain/inspections/result";
import { nextInspectionDue } from "@/domain/inspections/schedule";
import { getDefaultTemplate } from "@/domain/inspections/templates";
import { validateTemplate } from "@/domain/inspections/templates/validate";
import type { EvalAnswer, EvalItem, TemplateItemDef } from "@/domain/inspections/types";

const TODAY = "2026-10-26";
/** Un camión que circula, una grúa con izaje que no circula, una hidrogrúa con las dos cosas y una pala sin nada. */
const truck = { equipmentKind: "truck", circulatesOnPublicRoad: true, hasLiftingGear: false };
const crane = { equipmentKind: "crane", circulatesOnPublicRoad: false, hasLiftingGear: true };
const both = { equipmentKind: "hydro_crane", circulatesOnPublicRoad: true, hasLiftingGear: true };
const shovel = { equipmentKind: "shovel", circulatesOnPublicRoad: false, hasLiftingGear: false };

function evalItems(items: TemplateItemDef[], dueDates: { kind: string; dueAt: string }[]): EvalItem[] {
  return items.map((it, i) => ({
    id: `i${i}`,
    criticality: it.criticality,
    kind: it.kind,
    naAllowed: it.naAllowed,
    required: it.required,
    minValue: it.minValue,
    maxValue: it.maxValue,
    autoSource: it.autoSource ?? null,
    autoConform: it.autoSource ? resolveAutoConform(it.autoSource, dueDates, TODAY) : undefined,
  }));
}

function answers(items: TemplateItemDef[], overrides: Record<string, EvalAnswer["value"]> = {}): EvalAnswer[] {
  return items.map((it, i) => ({
    itemId: `i${i}`,
    value: it.kind === "check" && !it.autoSource ? (overrides[it.code] ?? "conform") : undefined,
    numberValue: it.kind === "check" ? undefined : 1200,
  }));
}

describe("tipo de activo: equipo pesado", () => {
  it("está en el registro y apunta a sus dos plantillas", () => {
    expect(isAssetTypeKey("heavy_equipment")).toBe(true);
    expect(ASSET_TYPES.heavy_equipment).toMatchObject({ key: "heavy_equipment", periodicTemplateKey: "heavy_periodic", preUseTemplateKey: "heavy_pre_use" });
    expect(getDefaultTemplate("heavy_pre_use")?.assetTypeKey).toBe("heavy_equipment");
    expect(getDefaultTemplate("heavy_periodic")?.assetTypeKey).toBe("heavy_equipment");
  });

  it("exige el tipo de equipo y rechaza año futuro o lectura negativa", () => {
    expect(heavyEquipmentAttributes.safeParse({}).success).toBe(false);
    expect(heavyEquipmentAttributes.safeParse({ equipmentKind: "dragon" }).success).toBe(false);
    expect(heavyEquipmentAttributes.safeParse({ equipmentKind: "crane", year: 2999 }).success).toBe(false);
    expect(heavyEquipmentAttributes.safeParse({ equipmentKind: "crane", initialReading: -1 }).success).toBe(false);
    expect(heavyEquipmentAttributes.parse({ equipmentKind: "crane" })).toMatchObject({ circulatesOnPublicRoad: false, hasLiftingGear: false });
  });

  it("los vencimientos dependen de si circula y de si tiene izaje", () => {
    const type = getAssetType("heavy_equipment");
    const kinds = (a: Record<string, unknown>) => type.dueKinds(a).map((s) => s.kind);
    expect(kinds(shovel)).toEqual(["insurance", "service"]);
    expect(kinds(truck)).toEqual(["insurance", "service", "rto"]);
    expect(kinds(crane)).toEqual(["insurance", "service", "lifting_certification", "lifting_review"]);
    expect(kinds(both)).toEqual(["insurance", "service", "rto", "lifting_certification", "lifting_review"]);
    const review = type.dueKinds(crane).find((s) => s.kind === "lifting_review")!;
    expect(review).toMatchObject({ intervalMonths: 3, blocking: true, required: true });
    expect(type.dueKinds(crane).find((s) => s.kind === "lifting_certification")).toMatchObject({ intervalMonths: 12 });
  });

  it("resuelve los vencimientos de izaje desde la última fecha y exige los obligatorios", () => {
    const type = getAssetType("heavy_equipment");
    const ok = resolveDueDates(type, crane, [
      { kind: "insurance", dueAt: "2027-03-01" },
      { kind: "service", lastDoneAt: "2026-09-01" },
      { kind: "lifting_certification", lastDoneAt: "2026-06-01" },
      { kind: "lifting_review", lastDoneAt: "2026-09-15" },
    ]);
    expect(ok.issues).toEqual([]);
    expect(ok.dueDates.map((d) => [d.kind, d.dueAt])).toEqual([
      ["insurance", "2027-03-01"],
      ["service", "2027-03-01"],
      ["lifting_certification", "2027-06-01"],
      ["lifting_review", "2026-12-15"],
    ]);
    const missing = resolveDueDates(type, both, [{ kind: "insurance", dueAt: "2027-03-01" }]);
    expect(missing.issues.map((i) => i.field)).toEqual(["service", "rto", "lifting_certification", "lifting_review"]);
  });

  it("el CSV lee el tipo de equipo por nombre, sí/no y rechaza un tipo desconocido", () => {
    const type = getAssetType("heavy_equipment");
    const header = assetCsvTemplate(type).trim();
    const cols = header.split(",");
    expect(cols).toEqual(expect.arrayContaining(["tipo_equipo", "circula_via_publica", "tiene_izaje", "vence_revision_izaje", "ultima_certificacion_izaje"]));
    const row = (cells: Record<string, string>) => cols.map((c) => cells[c] ?? "").join(",");
    const csv = [
      header,
      row({ codigo: "EQ-01", descripcion: "Grúa móvil", sede: "Base", tipo_equipo: "Grúa", marca: "Liebherr", circula_via_publica: "no", tiene_izaje: "sí", lectura_inicial: "3.200", vence_seguro: "2027-03-01", vence_service: "2027-03-01", vence_certificacion_izaje: "2027-06-01", vence_revision_izaje: "2026-12-15" }),
      row({ codigo: "EQ-02", descripcion: "Tipo roto", sede: "Base", tipo_equipo: "nave espacial", vence_seguro: "2027-03-01", vence_service: "2027-03-01" }),
    ].join("\n");
    const { rows, errors } = parseAssetCsv(type, csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].attributes).toMatchObject({ equipmentKind: "crane", brand: "Liebherr", circulatesOnPublicRoad: false, hasLiftingGear: true, initialReading: 3200 });
    expect(errors.map((e) => [e.line, e.field])).toEqual([[3, "tipo_equipo"]]);
  });
});

describe("T3 control previo al uso, equipos pesados", () => {
  const t = getDefaultTemplate("heavy_pre_use")!;

  it("no libera, no tiene calendario, crea hallazgo si hay una crítica y no pasa de 20 ítems", () => {
    expect(t).toMatchObject({ scope: "asset", intervalUnit: null, intervalValue: null, canReinstate: false, retireOnUnfit: false, findingOnCritical: true, maxApplicableItems: 20 });
    expect(t.items.some((i) => i.autoSource)).toBe(false);
  });

  it("se valida sola y el izaje y el odómetro solo aplican cuando corresponde", () => {
    expect(validateTemplate(t, [truck, crane, both, shovel])).toEqual([]);
    const checks = (a: Record<string, unknown>) => applicableItems(t.items, { asset: a }).filter((i) => i.kind === "check");
    expect(checks(shovel)).toHaveLength(13);
    expect(checks(truck)).toHaveLength(13);
    expect(checks(crane)).toHaveLength(17);
    expect(checks(both).length).toBeLessThanOrEqual(20);
    const codes = (a: Record<string, unknown>) => applicableItems(t.items, { asset: a }).map((i) => i.code);
    expect(codes(shovel)).not.toContain("reading_odometer");
    expect(codes(truck)).toContain("reading_odometer");
    expect(codes(crane).filter((c) => c.startsWith("lift_"))).toHaveLength(4);
    expect(codes(truck).filter((c) => c.startsWith("lift_"))).toHaveLength(0);
  });

  it("las lecturas son opcionales: horómetro en horas, odómetro en km", () => {
    const readings = t.items.filter((i) => i.kind === "reading");
    expect(readings.map((r) => [r.readingKey, r.unit, r.required])).toEqual([
      ["hours", "h", false],
      ["odometer_km", "km", false],
    ]);
  });

  it("los críticos del operador son frenos, dirección, cinturón, protección y los dos de izaje", () => {
    expect(t.items.filter((i) => i.criticality === "critical").map((i) => i.code)).toEqual([
      "safety_brakes",
      "safety_steering",
      "safety_belt",
      "safety_operator_protection",
      "lift_load_limiter",
      "lift_hooks_cables",
    ]);
  });

  it("un limitador de carga fuera de servicio deja la grúa no apta; en una pala ese ítem no existe", () => {
    const itemsCrane = applicableItems(t.items, { asset: crane });
    const bad = deriveInspectionResult(evalItems(itemsCrane, []), answers(itemsCrane, { lift_load_limiter: "nonconform" }));
    expect(bad.result).toBe("unfit");
    const itemsShovel = applicableItems(t.items, { asset: shovel });
    expect(deriveInspectionResult(evalItems(itemsShovel, []), answers(itemsShovel)).result).toBe("fit");
  });

  it("no apto: fuera de servicio, nunca libera y crea acción y hallazgo", () => {
    const policy = { retireOnUnfit: t.retireOnUnfit, canReinstate: t.canReinstate };
    expect(assetStatusAfter({ current: "in_service", result: "unfit", policy, canRelease: true, origin: "close" }).status).toBe("out_of_service");
    expect(assetStatusAfter({ current: "out_of_service", result: "fit", policy, canRelease: true, origin: "close" }).status).toBe("out_of_service");
    expect(nextInspectionDue({ inspectedAt: TODAY, result: "fit", interval: null, reinspectionDays: 1, retireOnUnfit: false, assetRetired: false }).dueAt).toBeNull();
    const plan = planFollowUp({
      subjectLabel: "Equipo EQ-01",
      nonconforming: [{ code: "safety_brakes", text: "Frenos de servicio y de estacionamiento funcionan", criticality: "critical", comment: "No frena" }],
      statusChange: null,
      typeKey: "heavy_equipment",
      findingOnCritical: t.findingOnCritical,
    });
    expect(plan.action).toBeTruthy();
    expect(plan.finding).toBeTruthy();
  });
});

describe("T4 inspección mensual, equipos pesados", () => {
  const t = getDefaultTemplate("heavy_periodic")!;
  const allDue = (lifting = "2027-01-01") => [
    { kind: "insurance", dueAt: "2027-01-01" },
    { kind: "rto", dueAt: "2027-01-01" },
    { kind: "service", dueAt: "2027-01-01" },
    { kind: "lifting_certification", dueAt: "2027-01-01" },
    { kind: "lifting_review", dueAt: lifting },
  ];

  it("es mensual con aviso a 7 días, libera y crea hallazgo si hay una crítica", () => {
    expect(t).toMatchObject({ scope: "asset", intervalUnit: "months", intervalValue: 1, leadDays: 7, reinspectionDays: 7, findingOnCritical: true, canReinstate: true, retireOnUnfit: false, maxApplicableItems: 25 });
  });

  it("se valida sola, no pasa de 25 ítems en el peor caso y respeta circula / izaje", () => {
    expect(validateTemplate(t, [truck, crane, both, shovel])).toEqual([]);
    const count = (a: Record<string, unknown>) => applicableItems(t.items, { asset: a }).filter((i) => i.kind !== "reading").length;
    expect(count(both)).toBeLessThanOrEqual(25);
    expect(count(both)).toBe(19);
    expect(count(shovel)).toBe(11);
    expect(count(truck)).toBe(12);
    expect(count(crane)).toBe(18);
  });

  it("los automáticos salen de los vencimientos y los de RTO e izaje solo aplican si corresponde", () => {
    expect(t.items.filter((i) => i.autoSource).map((i) => [i.code, i.autoSource!.dueKind, i.criticality])).toEqual([
      ["docs_insurance", "insurance", "critical"],
      ["docs_rto", "rto", "critical"],
      ["docs_service", "service", "major"],
      ["docs_lifting_certification", "lifting_certification", "critical"],
      ["docs_lifting_review", "lifting_review", "critical"],
    ]);
    const codes = (a: Record<string, unknown>) => applicableItems(t.items, { asset: a }).map((i) => i.code);
    expect(codes(shovel)).toEqual(expect.not.arrayContaining(["docs_rto", "docs_lifting_review", "docs_lifting_certification"]));
    expect(codes(truck)).toContain("docs_rto");
    expect(codes(crane)).toEqual(expect.arrayContaining(["docs_lifting_review", "docs_lifting_certification"]));
  });

  it("una revisión trimestral de izaje vencida deja la inspección no apta con una crítica", () => {
    const applicable = applicableItems(t.items, { asset: both });
    const ok = deriveInspectionResult(evalItems(applicable, allDue()), answers(applicable));
    expect(ok.result).toBe("fit");
    const expired = deriveInspectionResult(evalItems(applicable, allDue("2026-10-01")), answers(applicable));
    expect(expired.result).toBe("unfit");
    expect(expired.nonconformByCriticality.critical).toBe(1);
  });

  it("no apto: reinspección a los 7 días, fuera de servicio y solo libera quien puede", () => {
    const policy = { retireOnUnfit: t.retireOnUnfit, canReinstate: t.canReinstate };
    const next = nextInspectionDue({ inspectedAt: TODAY, result: "unfit", interval: { unit: "months", value: 1 }, reinspectionDays: t.reinspectionDays, retireOnUnfit: false, assetRetired: false });
    expect(next).toMatchObject({ dueAt: "2026-11-02", kind: "reinspection" });
    expect(assetStatusAfter({ current: "in_service", result: "unfit", policy, canRelease: false, origin: "close" }).status).toBe("out_of_service");
    expect(assetStatusAfter({ current: "out_of_service", result: "fit", policy, canRelease: true, origin: "close" }).status).toBe("in_service");
    expect(assetStatusAfter({ current: "out_of_service", result: "fit", policy, canRelease: false, origin: "close" }).status).toBe("out_of_service");
  });

  it("la foto es obligatoria en crítico y mayor y opcional en menor, salvo los automáticos", () => {
    for (const i of t.items.filter((x) => x.kind === "check" && !x.autoSource)) expect(i.photoOnNc).toBe(i.criticality !== "minor");
    for (const i of t.items.filter((x) => x.autoSource)) expect(i.photoOnNc).toBe(false);
  });
});
