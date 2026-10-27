import { describe, expect, it } from "vitest";
import { ASSET_TYPES, getAssetType, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { assetCsvTemplate, parseAssetCsv } from "@/domain/inspections/asset-types/csv";
import { lightVehicleAttributes, normalizePlate } from "@/domain/inspections/asset-types/light-vehicle";
import { resolveDueDates } from "@/domain/inspections/asset-types/resolve";
import { assetStatusAfter } from "@/domain/inspections/asset-status";
import { validateInspectionForClose } from "@/domain/inspections/close";
import { planFollowUp } from "@/domain/inspections/consequences";
import { applicableItems, deriveInspectionResult, itemOutcome, resolveAutoConform } from "@/domain/inspections/result";
import { nextInspectionDue } from "@/domain/inspections/schedule";
import { getDefaultTemplate } from "@/domain/inspections/templates";
import { validateTemplate } from "@/domain/inspections/templates/validate";
import type { EvalAnswer, EvalItem, TemplateItemDef } from "@/domain/inspections/types";

const plain = { plate: "AB123CD", hasRollbar: false, hasSatelliteMonitoring: false };
const full = { plate: "AB123CD", hasRollbar: true, hasSatelliteMonitoring: true };
const TODAY = "2026-10-26";

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

/** Todo conforme (y los números/lecturas en un valor sano), salvo lo indicado. */
function answers(items: TemplateItemDef[], overrides: Record<string, EvalAnswer["value"]> = {}, numbers: Record<string, number> = {}): EvalAnswer[] {
  return items.map((it, i) => ({
    itemId: `i${i}`,
    value: it.kind === "check" ? (overrides[it.code] ?? "conform") : undefined,
    numberValue: it.kind === "check" ? undefined : (numbers[it.code] ?? (it.kind === "reading" ? 45_000 : 5)),
  }));
}

describe("tipo de activo: vehículo liviano", () => {
  it("está en el registro y apunta a sus dos plantillas", () => {
    expect(isAssetTypeKey("light_vehicle")).toBe(true);
    expect(ASSET_TYPES.light_vehicle).toMatchObject({ key: "light_vehicle", periodicTemplateKey: "light_periodic", preUseTemplateKey: "light_pre_use" });
    expect(getAssetType("light_vehicle").label).toBe("Vehículo liviano");
    expect(getDefaultTemplate("light_pre_use")?.assetTypeKey).toBe("light_vehicle");
    expect(getDefaultTemplate("light_periodic")?.assetTypeKey).toBe("light_vehicle");
  });

  it("acepta un vehículo válido y normaliza el dominio", () => {
    const parsed = lightVehicleAttributes.parse({ plate: " ab-123 cd ", brand: "Toyota", model: "Hilux", year: 2021, initialOdometerKm: 45000 });
    expect(parsed.plate).toBe("AB123CD");
    expect(parsed).toMatchObject({ hasRollbar: false, hasSatelliteMonitoring: false });
    expect(normalizePlate("abc 123")).toBe("ABC123");
  });

  it("rechaza lo que falta o está mal: dominio, año futuro, km negativos", () => {
    expect(lightVehicleAttributes.safeParse({}).success).toBe(false);
    expect(lightVehicleAttributes.safeParse({ plate: "AB1" }).success).toBe(false);
    expect(lightVehicleAttributes.safeParse({ plate: "AB123CD", year: 2999 }).success).toBe(false);
    expect(lightVehicleAttributes.safeParse({ plate: "AB123CD", initialOdometerKm: -5 }).success).toBe(false);
    expect(lightVehicleAttributes.safeParse({ plate: "AB123CD", initialOdometerKm: 10.5 }).success).toBe(false);
  });

  it("seguro, RTO y service son obligatorios; el monitoreo solo si el vehículo lo tiene", () => {
    const type = getAssetType("light_vehicle");
    expect(type.dueKinds(plain).map((s) => [s.kind, s.required, s.blocking])).toEqual([
      ["insurance", true, true],
      ["rto", true, true],
      ["service", true, false],
    ]);
    expect(type.dueKinds(full).map((s) => s.kind)).toEqual(["insurance", "rto", "service", "satellite_monitoring"]);
  });

  it("resuelve los vencimientos desde la última fecha o desde el vencimiento, y exige los obligatorios", () => {
    const type = getAssetType("light_vehicle");
    const ok = resolveDueDates(type, plain, [
      { kind: "insurance", dueAt: "2027-03-01" },
      { kind: "rto", lastDoneAt: "2026-04-15" },
      { kind: "service", lastDoneAt: "2026-09-01" },
    ]);
    expect(ok.issues).toEqual([]);
    expect(ok.dueDates.map((d) => [d.kind, d.dueAt])).toEqual([
      ["insurance", "2027-03-01"],
      ["rto", "2027-04-15"],
      ["service", "2027-03-01"],
    ]);
    const missing = resolveDueDates(type, full, [{ kind: "insurance", dueAt: "2027-03-01" }]);
    expect(missing.issues.map((i) => i.field)).toEqual(["rto", "service", "satellite_monitoring"]);
  });

  it("el CSV trae las columnas del tipo, lee sí/no y rechaza un dominio inválido", () => {
    const type = getAssetType("light_vehicle");
    const header = assetCsvTemplate(type).trim();
    expect(header.split(",")).toEqual(expect.arrayContaining(["dominio", "vence_seguro", "vence_rto", "ultimo_service", "antivuelco", "monitoreo_satelital"]));
    const csv = [
      header,
      "CAM-01,Camioneta de obra,Base,,ab 123 cd,Toyota,Hilux,2021,45.000,sí,no,,2027-03-01,,2027-04-01,2026-09-01,,,,,,,",
      "CAM-02,Dominio roto,Base,,x,,,,,,,,2027-03-01,,2027-04-01,2026-09-01,,,,,,,",
    ].join("\n");
    const { rows, errors } = parseAssetCsv(type, csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].attributes).toMatchObject({ plate: "AB123CD", brand: "Toyota", year: 2021, initialOdometerKm: 45000, hasRollbar: true, hasSatelliteMonitoring: false });
    expect(errors.map((e) => [e.line, e.field])).toEqual([[3, "dominio"]]);
  });
});

describe("T5 control previo al uso, vehículos livianos", () => {
  const t = getDefaultTemplate("light_pre_use")!;

  it("no libera, no tiene calendario ni hallazgo y es corto (tope 15)", () => {
    expect(t).toMatchObject({ scope: "asset", intervalUnit: null, intervalValue: null, canReinstate: false, retireOnUnfit: false, findingOnCritical: false, maxApplicableItems: 15 });
  });

  it("tiene 9 controles y la lectura del odómetro, se valida sola y ningún ítem es automático", () => {
    expect(t.items).toHaveLength(10);
    expect(t.items.filter((i) => i.kind === "check")).toHaveLength(9);
    expect(validateTemplate(t, [plain, full])).toEqual([]);
    expect(applicableItems(t.items, { asset: full }).filter((i) => i.kind === "check")).toHaveLength(9);
    expect(t.items.some((i) => i.autoSource)).toBe(false);
  });

  it("el odómetro es una lectura obligatoria en km", () => {
    const reading = t.items.find((i) => i.kind === "reading")!;
    expect(reading).toMatchObject({ readingKey: "odometer_km", unit: "km", required: true, naAllowed: false });
  });

  it("los críticos son licencia, frenos, dirección, neumáticos y cinturones", () => {
    expect(t.items.filter((i) => i.criticality === "critical").map((i) => i.code)).toEqual(["docs_license", "safety_brakes", "safety_steering", "safety_tires", "safety_belts"]);
  });

  it("sin la lectura no se puede cerrar; un freno en mal estado deja el control no apto", () => {
    const items = evalItems(t.items, []);
    expect(deriveInspectionResult(items, answers(t.items).slice(0, 9)).complete).toBe(false);
    const bad = deriveInspectionResult(items, answers(t.items, { safety_brakes: "nonconform" }));
    expect(bad.result).toBe("unfit");
    expect(deriveInspectionResult(items, answers(t.items, { vis_lights: "nonconform" })).result).toBe("fit_with_observations");
    expect(deriveInspectionResult(items, answers(t.items)).result).toBe("fit");
  });

  it("no apto: deja el vehículo fuera de servicio, no tiene próxima fecha y nunca lo libera", () => {
    const policy = { retireOnUnfit: t.retireOnUnfit, canReinstate: t.canReinstate };
    expect(assetStatusAfter({ current: "in_service", result: "unfit", policy, canRelease: true, origin: "close" }).status).toBe("out_of_service");
    // Aunque lo cierre un process_owner, un control previo apto no libera lo que dejó parado SST.
    expect(assetStatusAfter({ current: "out_of_service", result: "fit", policy, canRelease: true, origin: "close" }).status).toBe("out_of_service");
    expect(nextInspectionDue({ inspectedAt: TODAY, result: "fit", interval: null, reinspectionDays: 1, retireOnUnfit: false, assetRetired: false }).dueAt).toBeNull();
  });

  it("la acción de seguimiento sale siempre; el hallazgo no (lo escala la inspección mensual)", () => {
    const plan = planFollowUp({
      subjectLabel: "Vehículo AB123CD",
      nonconforming: [{ code: "safety_brakes", text: "Frenos", criticality: "critical", comment: "Pedal blando" }],
      statusChange: null,
      typeKey: "light_vehicle",
      findingOnCritical: t.findingOnCritical,
    });
    expect(plan.action).toBeTruthy();
    expect(plan.finding).toBeFalsy();
  });

  it("una lectura menor que la anterior pide confirmación", () => {
    const base = { items: evalItems(t.items, []), answers: answers(t.items), photoCounts: {}, inspectedAt: TODAY, today: TODAY };
    const check = validateInspectionForClose({ ...base, readings: [{ current: 40_000, previous: 45_000, confirmedLower: false, label: "Odómetro" }] });
    expect(check.blockers.map((b) => b.code)).toContain("reading_lower_than_previous");
    const confirmed = validateInspectionForClose({ ...base, readings: [{ current: 40_000, previous: 45_000, confirmedLower: true, label: "Odómetro" }] });
    expect(confirmed.blockers.map((b) => b.code)).not.toContain("reading_lower_than_previous");
  });
});

describe("T6 inspección mensual, vehículos livianos", () => {
  const t = getDefaultTemplate("light_periodic")!;
  const due = (insurance = "2027-01-01") => [
    { kind: "insurance", dueAt: insurance },
    { kind: "rto", dueAt: "2027-01-01" },
    { kind: "service", dueAt: "2027-01-01" },
    { kind: "satellite_monitoring", dueAt: "2027-01-01" },
  ];

  it("es mensual con aviso a 7 días, libera, y crea hallazgo si hay una crítica", () => {
    expect(t).toMatchObject({ scope: "asset", intervalUnit: "months", intervalValue: 1, leadDays: 7, reinspectionDays: 7, findingOnCritical: true, canReinstate: true, retireOnUnfit: false, maxApplicableItems: 25 });
  });

  it("no pasa de 25 ítems aplicables en el peor caso y se valida sola", () => {
    expect(validateTemplate(t, [plain, full])).toEqual([]);
    const worst = applicableItems(t.items, { asset: full }).filter((i) => i.kind !== "reading");
    expect(worst.length).toBeLessThanOrEqual(25);
    expect(worst).toHaveLength(16);
    expect(applicableItems(t.items, { asset: plain }).filter((i) => i.kind !== "reading")).toHaveLength(14);
  });

  it("la barra antivuelco y el monitoreo satelital solo aplican si el vehículo los tiene", () => {
    const codes = (asset: Record<string, unknown>) => applicableItems(t.items, { asset }).map((i) => i.code);
    expect(codes(plain)).not.toContain("safety_rollbar");
    expect(codes(plain)).not.toContain("docs_satellite");
    expect(codes(full)).toEqual(expect.arrayContaining(["safety_rollbar", "docs_satellite"]));
  });

  it("seguro, RTO, service y monitoreo salen de los vencimientos del vehículo", () => {
    const auto = t.items.filter((i) => i.autoSource);
    expect(auto.map((i) => [i.code, i.autoSource!.dueKind, i.criticality])).toEqual([
      ["docs_insurance", "insurance", "critical"],
      ["docs_rto", "rto", "critical"],
      ["docs_service", "service", "major"],
      ["docs_satellite", "satellite_monitoring", "minor"],
    ]);
  });

  it("un seguro vencido deja la inspección no apta aunque todo lo demás esté bien", () => {
    const applicable = applicableItems(t.items, { asset: full });
    const ok = evalItems(applicable, due());
    const expired = evalItems(applicable, due("2026-10-01"));
    const ans = (items: TemplateItemDef[]) => items.map((it, i) => ({ itemId: `i${i}`, value: it.autoSource || it.kind !== "check" ? undefined : ("conform" as const), numberValue: it.kind === "reading" ? 45_000 : it.kind === "number" ? 4 : undefined }));
    expect(deriveInspectionResult(ok, ans(applicable)).result).toBe("fit");
    const result = deriveInspectionResult(expired, ans(applicable));
    expect(result.result).toBe("unfit");
    expect(result.nonconformByCriticality.critical).toBe(1);
  });

  it("un dibujo de neumático por debajo del mínimo es una no conformidad mayor", () => {
    const tread = t.items.find((i) => i.code === "safety_tread")!;
    expect(tread).toMatchObject({ kind: "number", unit: "mm", minValue: 1.6, criticality: "major" });
    const item: EvalItem = { id: "x", criticality: "major", kind: "number", naAllowed: false, required: true, minValue: tread.minValue, maxValue: tread.maxValue };
    expect(itemOutcome(item, { itemId: "x", numberValue: 1.5 })).toBe("nonconform");
    expect(itemOutcome(item, { itemId: "x", numberValue: 1.6 })).toBe("conform");
    expect(itemOutcome(item, { itemId: "x", numberValue: 6 })).toBe("conform");
  });

  it("no apto con una crítica: reinspección a los 7 días, fuera de servicio, acción y hallazgo", () => {
    const policy = { retireOnUnfit: t.retireOnUnfit, canReinstate: t.canReinstate };
    const next = nextInspectionDue({ inspectedAt: TODAY, result: "unfit", interval: { unit: "months", value: 1 }, reinspectionDays: t.reinspectionDays, retireOnUnfit: false, assetRetired: false });
    expect(next).toMatchObject({ dueAt: "2026-11-02", kind: "reinspection" });
    expect(assetStatusAfter({ current: "in_service", result: "unfit", policy, canRelease: false, origin: "close" }).status).toBe("out_of_service");
    const plan = planFollowUp({
      subjectLabel: "Vehículo AB123CD",
      nonconforming: [{ code: "safety_tires", text: "Neumáticos sin daño estructural", criticality: "critical", comment: "Corte lateral" }],
      statusChange: null,
      typeKey: "light_vehicle",
      findingOnCritical: t.findingOnCritical,
    });
    expect(plan.action).toBeTruthy();
    expect(plan.finding).toBeTruthy();
  });

  it("la reinspección apta libera al vehículo solo si quien cierra puede liberar", () => {
    const policy = { retireOnUnfit: t.retireOnUnfit, canReinstate: t.canReinstate };
    expect(assetStatusAfter({ current: "out_of_service", result: "fit", policy, canRelease: true, origin: "close" }).status).toBe("in_service");
    expect(assetStatusAfter({ current: "out_of_service", result: "fit", policy, canRelease: false, origin: "close" }).status).toBe("out_of_service");
  });

  it("la foto es obligatoria en crítico y mayor y opcional en menor, salvo los automáticos", () => {
    for (const i of t.items.filter((x) => x.kind === "check" && !x.autoSource)) expect(i.photoOnNc).toBe(i.criticality !== "minor");
    for (const i of t.items.filter((x) => x.autoSource)) expect(i.photoOnNc).toBe(false);
  });
});
