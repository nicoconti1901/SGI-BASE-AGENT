import { describe, expect, it } from "vitest";
import {
  MODULE_CATALOG,
  MODULE_SECTIONS,
  canDisableModule,
  clauseSummary,
  enabledModuleKeys,
  tenantNavSections,
} from "@/domain/modules/catalog";
import { ESSENTIAL_CATALOG_SEED } from "@/domain/ims/seed-data";

describe("catálogo de módulos", () => {
  it("cada cláusula declarada existe en el catálogo ISO sembrado", () => {
    const keys = new Set(ESSENTIAL_CATALOG_SEED.map((r) => r.clauseKey));
    for (const mod of MODULE_CATALOG) {
      for (const c of mod.clauses) {
        expect(keys.has(`${c.standard}:${c.clause}`), `${mod.key} → ${c.standard}:${c.clause}`).toBe(true);
      }
    }
  });

  it("claves y rutas únicas, y toda sección declarada existe", () => {
    expect(new Set(MODULE_CATALOG.map((m) => m.key)).size).toBe(MODULE_CATALOG.length);
    expect(new Set(MODULE_CATALOG.map((m) => m.path)).size).toBe(MODULE_CATALOG.length);
    const sections = new Set(MODULE_SECTIONS.map((s) => s.key));
    for (const mod of MODULE_CATALOG) expect(sections.has(mod.section)).toBe(true);
  });

  it("sin activaciones: los módulos construidos vienen activos y los planificados no", () => {
    const enabled = enabledModuleKeys([]);
    expect(enabled.has("findings")).toBe(true);
    expect(enabled.has("master_data")).toBe(true);
    expect(enabled.has("inspections")).toBe(false);
  });

  it("una activación pisa el valor por defecto, pero un planificado nunca se activa", () => {
    const enabled = enabledModuleKeys([
      { moduleKey: "risks", enabled: false },
      { moduleKey: "inspections", enabled: true },
    ]);
    expect(enabled.has("risks")).toBe(false);
    expect(enabled.has("inspections")).toBe(false);
  });

  it("Usuarios no se puede desactivar", () => {
    expect(canDisableModule("users")).toBe(false);
    expect(canDisableModule("risks")).toBe(true);
    expect(enabledModuleKeys([{ moduleKey: "users", enabled: false }]).has("users")).toBe(true);
  });

  it("arma el menú por secciones, con el Panel primero y sin secciones vacías", () => {
    const sections = tenantNavSections("acme", enabledModuleKeys([{ moduleKey: "audits", enabled: false }]));
    expect(sections[0]).toEqual({ label: null, items: [{ href: "/t/acme", label: "Panel" }] });
    expect(sections.map((s) => s.label)).toEqual([null, "Cumplimiento", "Mejora", "Personas y terceros", "Administración"]);
    expect(sections[1].items).toEqual([{ href: "/t/acme/documents", label: "Documentos" }]);
    expect(sections[2].items.map((i) => i.label)).toEqual(["Hallazgos", "Riesgos y oportunidades", "Objetivos"]);
  });
});

describe("clauseSummary", () => {
  it("agrupa las normas por cláusula", () => {
    expect(
      clauseSummary([
        { standard: "ISO9001", clause: "6.2" },
        { standard: "ISO14001", clause: "6.2" },
        { standard: "ISO45001", clause: "9.1.1" },
      ]),
    ).toBe("§6.2 (9001 · 14001) / §9.1.1 (45001)");
  });
});
