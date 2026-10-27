import { describe, expect, it } from "vitest";
import { ASSET_TYPES, getAssetType, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { assetCsvTemplate, parseAssetCsv } from "@/domain/inspections/asset-types/csv";
import { heavyEquipmentAttributes } from "@/domain/inspections/asset-types/heavy-equipment";
import { resolveDueDates } from "@/domain/inspections/asset-types/resolve";
import { assetStatusAfter } from "@/domain/inspections/asset-status";
import { validateInspectionForClose } from "@/domain/inspections/close";
import { planFollowUp } from "@/domain/inspections/consequences";
import { applicableItems, deriveInspectionResult, resolveAutoConform } from "@/domain/inspections/result";
import { getDefaultTemplate } from "@/domain/inspections/templates";
import { validateTemplate } from "@/domain/inspections/templates/validate";
import type { EvalAnswer, EvalItem, TemplateItemDef } from "@/domain/inspections/types";

const TODAY = "2026-10-26";
/** Un camión patentado, sin izaje; horas de trabajo. */
const plain = { kind: "truck", circulatesOnPublicRoad: false, hasLiftingGear: false, meterKind: "hours" };
const road = { kind: "truck", circulatesOnPublicRoad: true, hasLiftingGear: false, meterKind: "odometer" };
const crane = { kind: "hydro_crane", circulatesOnPublicRoad: true, hasLiftingGear: true, meterKind: "hours" };

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
    numberValue: it.kind === "reading" ? 4_500 : undefined,
  }));
}

const allDue = (overrides: Record<string, string> = {}) =>
  ["insurance", "service", "rto", "lifting_certification", "lifting_review"].map((kind) => ({ kind, dueAt: overrides[kind] ?? "2027-01-01" }));

describe("tipo de activo: equipo o vehículo pesado", () => {
  it("está en el registro y apunta a sus dos plantillas", () => {
    expect(isAssetTypeKey("heavy_equipment")).toBe(true);
    expect(ASSET_TYPES.heavy_equipment).toMatchObject({ key: "heavy_equipment", periodicTemplateKey: "heavy_periodic", preUseTemplateKey: "heavy_pre_use" });
    expect(getAssetType("heavy_equipment").plural).toBe("Equipos y vehículos pesados");
    expect(getDefaultTemplate("heavy_pre_use")?.assetTypeKey).toBe("heavy_equipment");
    expect(getDefaultTemplate("heavy_periodic")?.assetTypeKey).toBe("heavy_equipment");
  });

  it("acepta un equipo válido y deja las horas como medidor por defecto", () => {
    const parsed = heavyEquipmentAttributes.parse({ kind: "backhoe", circulatesOnPublicRoad: false, hasLiftingGear: false, plate: " ab-123 cd " });
    expect(parsed).toMatchObject({ meterKind: "hours", plate: "AB123CD" });
  });

  it("rechaza lo que falta o está mal: tipo, vía pública, izaje, dominio, lectura negativa", () => {
    expect(heavyEquipmentAttributes.safeParse({}).success).toBe(false);
    const base = { kind: "crane", circulatesOnPublicRoad: true, hasLiftingGear: true };
    expect(heavyEquipmentAttributes.safeParse(base).success).toBe(true);
    expect(heavyEquipmentAttributes.safeParse({ ...base, kind: "tractor" }).success).toBe(false);
    expect(heavyEquipmentAttributes.safeParse({ ...base, circulatesOnPublicRoad: undefined }).success).toBe(false);
    expect(heavyEquipmentAttributes.safeParse({ ...base, hasLiftingGear: undefined }).success).toBe(false);
    expect(heavyEquipmentAttributes.safeParse({ ...base, plate: "A1" }).success).toBe(false);
    expect(heavyEquipmentAttributes.safeParse({ ...base, initialMeterReading: -1 }).success).toBe(false);
  });

  it("los vencimientos dependen de si circula y de si tiene izaje", () => {
    const type = getAssetType("heavy_equipment");
    expect(type.dueKinds(plain).map((s) => s.kind)).toEqual(["insurance", "service"]);
    expect(type.dueKinds(road).map((s) => s.kind)).toEqual(["insurance", "service", "rto"]);
    expect(type.dueKinds(crane).map((s) => [s.kind, s.blocking])).toEqual([
      ["insurance", true],
      ["service", false],
      ["rto", true],
      ["lifting_certification", true],
      ["lifting_review", true],
    ]);
    expect(type.dueKinds(crane).find((s) => s.kind === "lifting_review")?.intervalMonths).toBe(3);
  });

  it("resuelve los vencimientos y exige los de izaje solo con izaje", () => {
    const type = getAssetType("heavy_equipment");
    const ok = resolveDueDates(type, crane, [
      { kind: "insurance", dueAt: "2027-03-01" },
      { kind: "service", lastDoneAt: "2026-09-01" },
      { kind: "rto", dueAt: "2027-04-01" },
      { kind: "lifting_certification", lastDoneAt: "2026-08-15" },
      { kind: "lifting_review", lastDoneAt: "2026-09-15" },
    ]);
    expect(ok.issues).toEqual([]);
    expect(ok.dueDates.find((d) => d.kind === "lifting_certification")?.dueAt).toBe("2027-08-15");
    expect(ok.dueDates.find((d) => d.kind === "lifting_review")?.dueAt).toBe("2026-12-15");
    const missing = resolveDueDates(type, crane, [{ kind: "insurance", dueAt: "2027-03-01" }]);
    expect(missing.issues.map((i) => i.field)).toEqual(["service", "rto", "lifting_certification", "lifting_review"]);
    expect(resolveDueDates(type, plain, [{ kind: "insurance", dueAt: "2027-03-01" }, { kind: "service", dueAt: "2027-03-01" }]).issues).toEqual([]);
  });

  it("el CSV trae las columnas del tipo, lee sí/no y el medidor, y rechaza un tipo de equipo desconocido", () => {
    const type = getAssetType("heavy_equipment");
    const header = assetCsvTemplate(type).trim();
    expect(header.split(",")).toEqual(expect.arrayContaining(["tipo_equipo", "circula_via_publica", "tiene_izaje", "medidor", "vence_revision_izaje"]));
    const cols = header.split(",");
    const line = (values: Record<string, string>) => cols.map((c) => values[c] ?? "").join(",");
    const csv = [
      header,
      line({ codigo: "GRU-01", descripcion: "Hidrogrúa", sede: "Base", tipo_equipo: "hidrogrua", circula_via_publica: "sí", tiene_izaje: "sí", medidor: "horas", lectura_inicial: "4.500", vence_seguro: "2027-03-01", vence_service: "2027-03-01", vence_rto: "2027-03-01", vence_certificacion_izaje: "2027-03-01", vence_revision_izaje: "2027-01-01" }),
      line({ codigo: "X-02", descripcion: "Rara", sede: "Base", tipo_equipo: "tractor", circula_via_publica: "no", tiene_izaje: "no", vence_seguro: "2027-03-01", vence_service: "2027-03-01" }),
    ].join("\n");
    const { rows, errors } = parseAssetCsv(type, csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].attributes).toMatchObject({ kind: "hydro_crane", circulatesOnPublicRoad: true, hasLiftingGear: true, meterKind: "hours", initialMeterReading: 4500 });
    expect(errors.map((e) => [e.line, e.field])).toEqual([[3, "tipo_equipo"]]);
  });
});

describe("T3 control previo al uso, equipos pesados", () => {
  const t = getDefaultTemplate("heavy_pre_use")!;

  it("no libera, no tiene calendario, escala a hallazgo con una crítica y es corto (tope 20)", () => {
    expect(t).toMatchObject({ scope: "asset", intervalUnit: null, intervalValue: null, canReinstate: false, retireOnUnfit: false, findingOnCritical: true, maxApplicableItems: 20 });
  });

  it("tiene 13 ítems, 17 con izaje, se valida solo y ninguno es automático", () => {
    expect(validateTemplate(t, [plain, road, crane])).toEqual([]);
    const count = (asset: Record<string, unknown>) => applicableItems(t.items, { asset }).filter((i) => i.kind === "check").length;
    expect(count(plain)).toBe(13);
    expect(count(crane)).toBe(17);
    expect(t.items.some((i) => i.autoSource)).toBe(false);
  });

  it("los ítems de izaje solo aparecen en un equipo con izaje", () => {
    const codes = (asset: Record<string, unknown>) => applicableItems(t.items, { asset }).map((i) => i.code);
    expect(codes(plain).filter((c) => c.startsWith("lift_"))).toEqual([]);
    expect(codes(crane).filter((c) => c.startsWith("lift_"))).toEqual(["lift_load_limiter", "lift_hooks_slings", "lift_load_chart", "lift_outriggers"]);
  });

  it("pide la lectura que corresponde al medidor del equipo: horas o km, nunca las dos", () => {
    const reading = (asset: Record<string, unknown>) => applicableItems(t.items, { asset }).filter((i) => i.kind === "reading");
    expect(reading(plain).map((i) => [i.code, i.readingKey, i.unit, i.required])).toEqual([["reading_hours", "hours", "h", true]]);
    expect(reading(road).map((i) => [i.code, i.readingKey, i.unit])).toEqual([["reading_odometer", "odometer_km", "km"]]);
  });

  it("los críticos son frenos, dirección, cinturón y protección del operador (más el izaje crítico)", () => {
    const critical = (asset: Record<string, unknown>) => applicableItems(t.items, { asset }).filter((i) => i.criticality === "critical").map((i) => i.code);
    expect(critical(plain)).toEqual(["safety_brakes", "safety_steering", "safety_belt", "safety_cabin"]);
    expect(critical(crane)).toEqual(["safety_brakes", "safety_steering", "safety_belt", "safety_cabin", "lift_load_limiter", "lift_hooks_slings"]);
  });

  it("sin la lectura no se puede cerrar; un freno en mal estado deja el control no apto", () => {
    const items = applicableItems(t.items, { asset: plain });
    const ev = evalItems(items, []);
    expect(deriveInspectionResult(ev, answers(items).slice(0, items.length - 1)).complete).toBe(false);
    expect(deriveInspectionResult(ev, answers(items, { safety_brakes: "nonconform" })).result).toBe("unfit");
    expect(deriveInspectionResult(ev, answers(items, { equip_chocks: "nonconform" })).result).toBe("fit_with_observations");
    expect(deriveInspectionResult(ev, answers(items)).result).toBe("fit");
  });

  it("no apto: deja el equipo fuera de servicio y nunca lo libera; con crítica crea acción y hallazgo", () => {
    const policy = { retireOnUnfit: t.retireOnUnfit, canReinstate: t.canReinstate };
    expect(assetStatusAfter({ current: "in_service", result: "unfit", policy, canRelease: false, origin: "close" }).status).toBe("out_of_service");
    expect(assetStatusAfter({ current: "out_of_service", result: "fit", policy, canRelease: true, origin: "close" }).status).toBe("out_of_service");
    const plan = planFollowUp({
      subjectLabel: "Hidrogrúa GRU-01",
      nonconforming: [{ code: "lift_hooks_slings", text: "Ganchos con traba; cables y eslingas sin daño", criticality: "critical", comment: "Eslinga cortada" }],
      statusChange: null,
      typeKey: "heavy_equipment",
      findingOnCritical: t.findingOnCritical,
    });
    expect(plan.action).toBeTruthy();
    expect(plan.finding).toBeTruthy();
  });

  it("una lectura de horómetro menor que la anterior pide confirmación", () => {
    const items = applicableItems(t.items, { asset: plain });
    const base = { items: evalItems(items, []), answers: answers(items), photoCounts: {}, inspectedAt: TODAY, today: TODAY };
    const check = validateInspectionForClose({ ...base, readings: [{ current: 4_000, previous: 4_500, confirmedLower: false, label: "Horómetro" }] });
    expect(check.blockers.map((b) => b.code)).toContain("reading_lower_than_previous");
  });
});

describe("T4 inspección mensual, equipos pesados", () => {
  const t = getDefaultTemplate("heavy_periodic")!;

  it("es mensual con aviso a 7 días, libera, y crea hallazgo si hay una crítica", () => {
    expect(t).toMatchObject({ scope: "asset", intervalUnit: "months", intervalValue: 1, leadDays: 7, reinspectionDays: 7, findingOnCritical: true, canReinstate: true, retireOnUnfit: false, maxApplicableItems: 25 });
  });

  it("no pasa de 25 ítems aplicables en el peor caso y se valida sola", () => {
    expect(validateTemplate(t, [plain, road, crane])).toEqual([]);
    const count = (asset: Record<string, unknown>) => applicableItems(t.items, { asset }).filter((i) => i.kind !== "reading").length;
    expect(count(plain)).toBe(11);
    expect(count(road)).toBe(12);
    expect(count(crane)).toBe(19);
  });

  it("la RTO solo aplica si circula y los ítems de izaje solo con izaje", () => {
    const codes = (asset: Record<string, unknown>) => applicableItems(t.items, { asset }).map((i) => i.code);
    expect(codes(plain)).not.toContain("docs_rto");
    expect(codes(road)).toContain("docs_rto");
    expect(codes(road).filter((c) => c.startsWith("lift_") || c.includes("lifting"))).toEqual([]);
    expect(codes(crane)).toEqual(expect.arrayContaining(["docs_lifting_cert", "docs_lifting_review", "lift_rope", "lift_hooks", "lift_slings_shackles", "lift_limiter_endstop", "lift_load_charts"]));
  });

  it("seguro, RTO, service y los dos de izaje salen de los vencimientos del equipo", () => {
    const auto = t.items.filter((i) => i.autoSource);
    expect(auto.map((i) => [i.code, i.autoSource!.dueKind, i.criticality])).toEqual([
      ["docs_insurance", "insurance", "critical"],
      ["docs_rto", "rto", "critical"],
      ["docs_service", "service", "major"],
      ["docs_lifting_cert", "lifting_certification", "critical"],
      ["docs_lifting_review", "lifting_review", "critical"],
    ]);
    for (const i of auto) expect(i).toMatchObject({ photoOnNc: false, naAllowed: false });
  });

  it("una revisión de izaje vencida deja la inspección no apta aunque todo lo demás esté bien", () => {
    const items = applicableItems(t.items, { asset: crane });
    expect(deriveInspectionResult(evalItems(items, allDue()), answers(items)).result).toBe("fit");
    const expired = deriveInspectionResult(evalItems(items, allDue({ lifting_review: "2026-10-01" })), answers(items));
    expect(expired.result).toBe("unfit");
    expect(expired.nonconformByCriticality.critical).toBe(1);
  });

  it("un service vencido es una no conformidad mayor: apta con observaciones", () => {
    const items = applicableItems(t.items, { asset: plain });
    const result = deriveInspectionResult(evalItems(items, allDue({ service: "2026-09-01" })), answers(items));
    expect(result.result).toBe("fit_with_observations");
  });

  it("la reinspección apta libera al equipo solo si quien cierra puede liberar", () => {
    const policy = { retireOnUnfit: t.retireOnUnfit, canReinstate: t.canReinstate };
    expect(assetStatusAfter({ current: "out_of_service", result: "fit", policy, canRelease: true, origin: "close" }).status).toBe("in_service");
    expect(assetStatusAfter({ current: "out_of_service", result: "fit", policy, canRelease: false, origin: "close" }).status).toBe("out_of_service");
  });

  it("la foto es obligatoria en crítico y mayor y opcional en menor, salvo los automáticos", () => {
    for (const i of t.items.filter((x) => x.kind === "check" && !x.autoSource)) expect(i.photoOnNc).toBe(i.criticality !== "minor");
  });
});
