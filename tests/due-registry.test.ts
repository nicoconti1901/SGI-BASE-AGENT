import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DUE_REGISTRY, dueDefinition, dueTypesOf, isDestinationEnabled, type DueEntityType } from "@/domain/due/registry";
import { MODULE_CATALOG } from "@/domain/modules/catalog";

const TENANT_ROUTES = path.resolve(__dirname, "../src/app/(tenant)/t/[slug]");
const PARENT = { objectiveId: "o1", findingId: "f1", assetId: "as1", supplierId: "s1" };
const types = Object.keys(DUE_REGISTRY) as DueEntityType[];

/** ¿La ruta relativa tiene una página? Un segmento que no existe como carpeta puede caer en una `[param]`. */
function pageExists(route: string): boolean {
  let dir = TENANT_ROUTES;
  for (const segment of route.split("?")[0].split("/")) {
    if (existsSync(path.join(dir, segment))) {
      dir = path.join(dir, segment);
      continue;
    }
    const dynamic = readdirSync(dir).find((name) => name.startsWith("["));
    if (!dynamic) return false;
    dir = path.join(dir, dynamic);
  }
  return existsSync(path.join(dir, "page.tsx"));
}

describe("registro de tipos de vencimiento", () => {
  it.each(types)("%s tiene módulo, etiqueta y un destino que existe", (type) => {
    const def = DUE_REGISTRY[type];

    expect(MODULE_CATALOG.map((m) => m.key)).toContain(def.module);
    expect(def.label.length).toBeGreaterThan(2);
    for (const route of [def.path("2026-09", PARENT), def.path("x1", {}), def.path(null, {})]) {
      expect(pageExists(route), `${type} → ${route}`).toBe(true);
    }
  });

  it("incluye todos los tipos que crean los módulos", () => {
    expect(types).toEqual(
      expect.arrayContaining([
        "document_validity",
        "audit_start",
        "audit_report",
        "audit_external_response",
        "finding_verification",
        "finding_measure",
        "operational_action",
        "indicator_measurement",
        "inspection_plan",
        "asset_due_date",
        "instrument_calibration",
        "instrument_verification",
        "instrument_impact",
        "incident_followup",
        "exposure_period",
        "road_km_period",
        "training_person",
        "training_session_effectiveness",
        "training_record_effectiveness",
        "supplier_evaluation",
        "supplier_document",
      ]),
    );
  });

  it("agrupa los tipos por módulo", () => {
    expect(dueTypesOf("training")).toEqual(["training_person", "training_session_effectiveness", "training_record_effectiveness"]);
    expect(dueTypesOf("suppliers")).toEqual(["supplier_evaluation", "supplier_document"]);
    expect(dueTypesOf("instruments")).toContain("instrument_impact");
    expect(dueTypesOf("users")).toEqual([]);
  });

  it("no reconoce un tipo desconocido ni propiedades heredadas de Object", () => {
    expect(dueDefinition("otra_cosa")).toBeUndefined();
    expect(dueDefinition("toString")).toBeUndefined();
  });

  it("un destino de un módulo inactivo no se puede abrir", () => {
    const enabled = new Set(["findings", "instruments"] as const);

    expect(isDestinationEnabled("findings/f1", enabled)).toBe(true);
    expect(isDestinationEnabled("training/people/p1", enabled)).toBe(false);
    expect(isDestinationEnabled("safety/exposure?mes=2026-09", enabled)).toBe(false);
    // Activos se comparte entre Inspecciones y Equipos de medición.
    expect(isDestinationEnabled("assets/a1", enabled)).toBe(true);
    expect(isDestinationEnabled("assets/a1", new Set(["findings"]))).toBe(false);
  });

  it.each([
    ["asset_due_date", "d1", { assetId: "as1" }, "assets/as1"],
    ["inspection_plan", "p1", { assetId: "as1" }, "assets/as1"],
    ["inspection_plan", "p1", { assetId: null }, "inspections"],
    ["instrument_calibration", "as1", {}, "instruments/as1"],
    ["instrument_impact", "ia1", { assetId: "as1" }, "instruments/as1"],
    ["exposure_period", "site1:2026-09", {}, "safety/exposure?mes=2026-09"],
    ["road_km_period", "2026-09", {}, "road-safety/km?mes=2026-09"],
    ["training_person", "p1", {}, "training/people/p1"],
    ["training_session_effectiveness", "se1", {}, "training/effectiveness"],
    ["training_record_effectiveness", "re1", {}, "training/effectiveness"],
    ["supplier_evaluation", "s1", {}, "suppliers/s1"],
    ["supplier_document", "doc1", { supplierId: "s1" }, "suppliers/s1"],
  ] as const)("%s lleva al registro donde se resuelve", (type, id, parent, expected) => {
    expect(DUE_REGISTRY[type].path(id, parent)).toBe(expected);
  });
});
