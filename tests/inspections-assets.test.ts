import { describe, expect, it } from "vitest";
import { canTenantRole } from "@/domain/identity/authz";
import { ASSET_TYPES, getAssetType, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { extinguisherAttributes } from "@/domain/inspections/asset-types/extinguisher";
import { normalizeAssetCode, resolveDueDates } from "@/domain/inspections/asset-types/resolve";
import { assetCsvTemplate, parseAssetCsv } from "@/domain/inspections/asset-types/csv";
import { DEFAULT_TEMPLATES, getDefaultTemplate } from "@/domain/inspections/templates";
import { validateTemplate } from "@/domain/inspections/templates/validate";
import { applicableItems, deriveInspectionResult, resolveAutoConform } from "@/domain/inspections/result";
import type { EvalItem } from "@/domain/inspections/types";

const valid = { agent: "abc", capacityKg: 5, manufacturedAt: "2022-05-10" };

describe("esquema de atributos del extintor", () => {
  it("acepta un extintor válido y completa los valores por defecto", () => {
    const r = extinguisherAttributes.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ installedIn: "fixed", hoseWithValve: false, onWheels: false });
  });
  it("rechaza la falta de fecha de fabricación, agente o capacidad", () => {
    for (const key of ["manufacturedAt", "agent", "capacityKg"] as const) {
      const rest: Record<string, unknown> = { ...valid };
      delete rest[key];
      expect(extinguisherAttributes.safeParse(rest).success, key).toBe(false);
    }
  });
  it("rechaza agente desconocido, capacidad no positiva y fecha imposible", () => {
    expect(extinguisherAttributes.safeParse({ ...valid, agent: "polvo-magico" }).success).toBe(false);
    expect(extinguisherAttributes.safeParse({ ...valid, capacityKg: 0 }).success).toBe(false);
    expect(extinguisherAttributes.safeParse({ ...valid, manufacturedAt: "2022-02-30" }).success).toBe(false);
  });
});

describe("registro de tipos", () => {
  it("conoce el extintor y rechaza el resto", () => {
    expect(isAssetTypeKey("extinguisher")).toBe(true);
    expect(isAssetTypeKey("toString")).toBe(false);
    expect(() => getAssetType("crane")).toThrow();
  });
  it("cada tipo apunta a una plantilla precargada que existe y es de su tipo", () => {
    for (const type of Object.values(ASSET_TYPES)) {
      const template = getDefaultTemplate(type.periodicTemplateKey);
      expect(template?.assetTypeKey).toBe(type.key);
    }
  });
});

describe("vencimientos del extintor", () => {
  const type = getAssetType("extinguisher");
  it("mantenimiento anual; semestral para polvo en vehículo", () => {
    const fixed = type.dueKinds({ ...valid, installedIn: "fixed" }).find((d) => d.kind === "maintenance");
    const vehicle = type.dueKinds({ ...valid, installedIn: "vehicle" }).find((d) => d.kind === "maintenance");
    const coInVehicle = type.dueKinds({ ...valid, agent: "co2", installedIn: "vehicle" }).find((d) => d.kind === "maintenance");
    expect([fixed?.intervalMonths, vehicle?.intervalMonths, coInVehicle?.intervalMonths]).toEqual([12, 6, 12]);
  });
  it("prueba hidráulica a 5 años; 2 si es de agua", () => {
    expect(type.dueKinds(valid).find((d) => d.kind === "hydrostatic_test")?.intervalMonths).toBe(60);
    expect(type.dueKinds({ ...valid, agent: "water" }).find((d) => d.kind === "hydrostatic_test")?.intervalMonths).toBe(24);
  });
  it("prueba de manguera solo para CO₂ o con válvula de control", () => {
    expect(type.dueKinds(valid).some((d) => d.kind === "hose_test")).toBe(false);
    expect(type.dueKinds({ ...valid, agent: "co2" }).some((d) => d.kind === "hose_test")).toBe(true);
    expect(type.dueKinds({ ...valid, hoseWithValve: true }).some((d) => d.kind === "hose_test")).toBe(true);
  });
  it("calcula el vencimiento desde la última fecha, y la prueba hidráulica desde la fabricación", () => {
    const r = resolveDueDates(type, valid, [{ kind: "maintenance", lastDoneAt: "2026-03-31" }]);
    expect(r.issues).toEqual([]);
    expect(r.dueDates.find((d) => d.kind === "maintenance")?.dueAt).toBe("2027-03-31");
    expect(r.dueDates.find((d) => d.kind === "hydrostatic_test")?.dueAt).toBe("2027-05-10");
    expect(r.dueDates.find((d) => d.kind === "hydrostatic_test")?.blocking).toBe(true);
  });
  it("una fecha de vencimiento cargada manda sobre la calculada", () => {
    const r = resolveDueDates(type, valid, [{ kind: "maintenance", lastDoneAt: "2026-03-31", dueAt: "2026-12-01" }]);
    expect(r.dueDates.find((d) => d.kind === "maintenance")?.dueAt).toBe("2026-12-01");
  });
  it("el mantenimiento es obligatorio", () => {
    expect(resolveDueDates(type, valid, []).issues[0].field).toBe("maintenance");
  });
});

describe("código del activo", () => {
  it("se guarda en mayúsculas y rechaza vacíos, largos y símbolos raros", () => {
    expect(normalizeAssetCode("  ext - 001 ")).toEqual({ ok: true, code: "EXT - 001" });
    expect(normalizeAssetCode("   ").ok).toBe(false);
    expect(normalizeAssetCode("x".repeat(31)).ok).toBe(false);
    expect(normalizeAssetCode("EXT;1").ok).toBe(false);
  });
});

describe("plantillas precargadas", () => {
  const samples = [
    { agent: "abc", onWheels: false },
    { agent: "abc", onWheels: true },
    { agent: "co2", onWheels: true },
  ];
  for (const template of DEFAULT_TEMPLATES) {
    it(`${template.key}: se valida sola`, () => {
      expect(validateTemplate(template, samples)).toEqual([]);
    });
  }
  it("T1 tiene 15 ítems y los automáticos apuntan a vencimientos del tipo", () => {
    const t1 = getDefaultTemplate("extinguisher_periodic")!;
    expect(t1.items).toHaveLength(15);
    const kinds = new Set(getAssetType("extinguisher").dueKinds({ ...valid, agent: "co2", hoseWithValve: true }).map((d) => d.kind));
    for (const item of t1.items.filter((i) => i.autoSource)) expect(kinds.has(item.autoSource!.dueKind)).toBe(true);
  });
  it("el manómetro no aplica a CO₂ y el peso de la carga solo a CO₂", () => {
    const t1 = getDefaultTemplate("extinguisher_periodic")!;
    const codes = (agent: string) => applicableItems(t1.items, { asset: { agent } }).map((i) => i.code);
    expect(codes("abc")).toContain("state_gauge");
    expect(codes("abc")).not.toContain("state_weight");
    expect(codes("co2")).toContain("state_weight");
    expect(codes("co2")).not.toContain("state_gauge");
  });
  it("la foto es obligatoria en crítico y mayor y opcional en menor", () => {
    const t1 = getDefaultTemplate("extinguisher_periodic")!;
    for (const i of t1.items.filter((x) => !x.autoSource)) expect(i.photoOnNc).toBe(i.criticality !== "minor");
  });
  it("el validador detecta códigos repetidos, falta de críticos y rangos rotos", () => {
    const base = getDefaultTemplate("extinguisher_periodic")!.items[0];
    const issues = validateTemplate({
      maxApplicableItems: 1,
      items: [
        { ...base, criticality: "minor" },
        { ...base, criticality: "minor" },
        { ...base, code: "n", kind: "number", minValue: 5, maxValue: 1 },
      ],
    });
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(["duplicate_code", "no_critical_item", "bad_range", "too_many_applicable"]));
  });
  it("con la plantilla T1: PH vencida pisa el «conforme» del inspector y da no apto", () => {
    const t1 = getDefaultTemplate("extinguisher_periodic")!;
    const due = [
      { kind: "maintenance", dueAt: "2027-01-01" },
      { kind: "hydrostatic_test", dueAt: "2026-10-01" },
    ];
    const items: EvalItem[] = applicableItems(t1.items, { asset: { agent: "abc", onWheels: false } }).map((i, idx) => ({
      id: `it${idx}`,
      criticality: i.criticality,
      kind: i.kind,
      naAllowed: i.naAllowed,
      required: i.required,
      autoSource: i.autoSource,
      autoConform: i.autoSource ? resolveAutoConform(i.autoSource, due, "2026-10-21") : undefined,
    }));
    const r = deriveInspectionResult(items, items.filter((i) => !i.autoSource).map((i) => ({ itemId: i.id, value: "conform" })));
    expect(r.result).toBe("unfit");
    expect(r.nonconformByCriticality).toEqual({ critical: 1, major: 0, minor: 0 });
  });
});

describe("CSV de extintores", () => {
  const type = getAssetType("extinguisher");
  const header = "codigo,descripcion,sede,agente,capacidad_kg,fabricacion,ultimo_mantenimiento";
  it("lee filas válidas con fechas AAAA-MM-DD o DD/MM/AAAA y agente por nombre", () => {
    const { rows, errors } = parseAssetCsv(type, `${header}\next-1,Pasillo planta baja,Base Neuquén,Polvo ABC,"2,5",10/05/2022,2026-03-31\n`);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ code: "EXT-1", siteName: "Base Neuquén", ownership: "own", attributes: { agent: "abc", capacityKg: 2.5, manufacturedAt: "2022-05-10" } });
    expect(rows[0].dueDates.map((d) => d.kind)).toEqual(["maintenance", "hydrostatic_test"]);
  });
  it("informa el error de cada fila sin frenar a las demás", () => {
    const csv = [
      header,
      "A1,ok,Base,abc,5,2022-01-01,2026-01-01",
      "A2,sin sede,,abc,5,2022-01-01,2026-01-01",
      "A3,agente raro,Base,xyz,5,2022-01-01,2026-01-01",
      "A1,repetido,Base,abc,5,2022-01-01,2026-01-01",
      "A4,sin mantenimiento,Base,abc,5,2022-01-01,",
    ].join("\n");
    const { rows, errors } = parseAssetCsv(type, csv);
    expect(rows.map((r) => r.code)).toEqual(["A1"]);
    expect(errors.map((e) => [e.line, e.field])).toEqual([
      [3, "sede"],
      [4, "agente"],
      [5, "codigo"],
      [6, "maintenance"],
    ]);
  });
  it("falta una columna obligatoria o el archivo está vacío", () => {
    expect(parseAssetCsv(type, "codigo,sede\nA,B").errors[0].field).toBe("encabezado");
    expect(parseAssetCsv(type, "").errors[0].field).toBe("archivo");
  });
  it("el contratista exige nombre y la plantilla descargable tiene todos los encabezados", () => {
    const { errors } = parseAssetCsv(type, `${header},propiedad\nA,x,S,abc,5,2022-01-01,2026-01-01,contratista`);
    expect(errors[0].field).toBe("contratista");
    expect(assetCsvTemplate(type)).toContain("agente");
  });
  it("rechaza más de 1.000 filas", () => {
    const body = Array.from({ length: 1001 }, (_, i) => `E${i},d,S,abc,5,2022-01-01,2026-01-01`).join("\n");
    expect(parseAssetCsv(type, `${header}\n${body}`).errors[0].message).toContain("1000");
  });
});

describe("permisos de Inspecciones (SPEC)", () => {
  type Role = "viewer" | "contributor" | "process_owner" | "tenant_admin";
  const can = (role: Role, action: Parameters<typeof canTenantRole>[1]) => canTenantRole(role, action);
  const admin = ["manage_assets", "import_assets", "manage_inspection_templates", "release_assets"] as const;

  it("viewer no crea; contributor registra pero no gestiona activos ni libera", () => {
    expect(can("viewer", "write")).toBe(false);
    expect(can("contributor", "write")).toBe(true);
    for (const action of admin) expect(can("contributor", action)).toBe(false);
  });
  it("process_owner gestiona y libera, pero no importa ni edita plantillas; el admin hace todo", () => {
    expect(can("process_owner", "manage_assets")).toBe(true);
    expect(can("process_owner", "release_assets")).toBe(true);
    expect(can("process_owner", "import_assets")).toBe(false);
    expect(can("process_owner", "manage_inspection_templates")).toBe(false);
    for (const action of admin) expect(can("tenant_admin", action)).toBe(true);
  });
});
