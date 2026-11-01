import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_CATALOG, enabledModuleKeys } from "@/domain/modules/catalog";
import {
  MODULE_HUB,
  crumbsFor,
  hubAreas,
  shortClauses,
  trailIndex,
} from "@/domain/modules/hub";

const TENANT_ROUTES = path.resolve(__dirname, "../src/app/(tenant)/t/[slug]");

describe("hub de módulos", () => {
  it("cada pantalla del hub apunta a una página que existe", () => {
    const missing = MODULE_CATALOG.flatMap((m) =>
      MODULE_HUB[m.key].screens
        .map((s) => path.join(TENANT_ROUTES, m.path, s.path, "page.tsx"))
        .filter((file) => !existsSync(file)),
    );
    expect(missing).toEqual([]);
  });

  it("agrupa por área solo los módulos activos y omite las áreas vacías", () => {
    const areas = hubAreas(
      "acme",
      enabledModuleKeys([{ moduleKey: "audits", enabled: false }]),
      true,
    );
    expect(areas.map((a) => a.label)).toEqual([
      "Cumplimiento",
      "Mejora",
      "Personas y terceros",
      "Administración",
    ]);
    expect(areas[0].modules.map((m) => m.label)).toEqual(["Documentos"]);
  });

  it("un módulo con varias pantallas abre su hub; con una sola entra directo", () => {
    const tiles = hubAreas("acme", enabledModuleKeys([]), true).flatMap((a) => a.modules);
    const byKey = new Map(tiles.map((t) => [t.key, t]));
    expect(byKey.get("risks")?.href).toBe("/t/acme/m/risks");
    expect(byKey.get("risks")?.meta).toBe("§6.1 · 4 accesos");
    expect(byKey.get("documents")?.href).toBe("/t/acme/documents");
    expect(byKey.get("documents")?.meta).toBe("§7.5");
  });

  it("solo lectura no ve pantallas de alta y, si queda una, entra directo", () => {
    const tiles = hubAreas("acme", enabledModuleKeys([]), false).flatMap(
      (a) => a.modules,
    );
    const findings = tiles.find((t) => t.key === "findings");
    expect(findings?.href).toBe("/t/acme/findings");
    const index = trailIndex("acme", enabledModuleKeys([]), false);
    const risks = index.modules.find((m) => m.label === "Riesgos y oportunidades");
    expect(risks?.screens.map((s) => s.label)).toEqual(["Registro de riesgos", "Guía"]);
  });

  it("las cláusulas cortas marcan la norma cuando es ISO 39001", () => {
    expect(
      shortClauses([
        { standard: "ISO39001", clause: "8.1" },
        { standard: "ISO45001", clause: "9.1.1" },
      ]),
    ).toBe("39001 §8.1 · §9.1.1");
  });
});

describe("ruta del encabezado", () => {
  const enabled = enabledModuleKeys([{ moduleKey: "safety_stats", enabled: true }]);
  const index = trailIndex("acme", enabled, true);
  const labels = (pathname: string) => crumbsFor(pathname, index).map((c) => c.label);

  it("ubica inicio, hub, pantalla y detalle", () => {
    expect(labels("/t/acme")).toEqual(["Inicio"]);
    expect(labels("/t/acme/m/risks")).toEqual(["Inicio", "Riesgos y oportunidades"]);
    expect(labels("/t/acme/risks/explore")).toEqual([
      "Inicio",
      "Riesgos y oportunidades",
      "Explorar contexto",
    ]);
    expect(labels("/t/acme/risks/abc123")).toEqual([
      "Inicio",
      "Riesgos y oportunidades",
      "Registro de riesgos",
    ]);
    expect(labels("/t/acme/safety/exposure/import")).toEqual([
      "Inicio",
      "Accidentabilidad",
      "Horas trabajadas",
    ]);
  });

  it("no repite el tramo cuando el módulo entra directo a su única pantalla", () => {
    expect(labels("/t/acme/documents")).toEqual(["Inicio", "Documentos"]);
    expect(crumbsFor("/t/acme/documents", index)[1].href).toBe("/t/acme/documents");
  });

  it("una ruta fuera de los módulos queda en Inicio", () => {
    expect(labels("/t/acme/operations")).toEqual(["Inicio"]);
  });
});
