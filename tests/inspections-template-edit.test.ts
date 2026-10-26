import { describe, expect, it } from "vitest";
import { EXTINGUISHER_PERIODIC } from "@/domain/inspections/templates/extinguisher";
import {
  applyItemEdits,
  editContextFor,
  nextItemCode,
  templateChanged,
  validateTemplateEdit,
  type ItemEdit,
  type TemplateEditInput,
} from "@/domain/inspections/templates/edit";
import type { TemplateItemDef } from "@/domain/inspections/types";

const ctx = editContextFor(EXTINGUISHER_PERIODIC);

/** Una edición «sin cambios» de cada ítem de la plantilla original. */
const asEdits = (items: readonly TemplateItemDef[]): ItemEdit[] =>
  items.map((i) => ({ code: i.code, section: i.section, text: i.text, help: i.help ?? null, criticality: i.criticality, naAllowed: i.naAllowed, photoOnNc: i.photoOnNc }));

const base = (): TemplateEditInput => ({
  name: EXTINGUISHER_PERIODIC.name,
  intervalUnit: "months",
  intervalValue: 1,
  findingOnCritical: false,
  items: applyItemEdits(EXTINGUISHER_PERIODIC.items, asEdits(EXTINGUISHER_PERIODIC.items)),
});

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe("applyItemEdits", () => {
  it("sin cambios devuelve los mismos ítems, con todos sus campos", () => {
    expect(applyItemEdits(EXTINGUISHER_PERIODIC.items, asEdits(EXTINGUISHER_PERIODIC.items))).toEqual(EXTINGUISHER_PERIODIC.items);
  });

  it("conserva lo que el cliente no puede tocar: tipo, condición de aplicabilidad y origen automático", () => {
    const edits = asEdits(EXTINGUISHER_PERIODIC.items).map((e) => ({ ...e, naAllowed: true }));
    const out = applyItemEdits(EXTINGUISHER_PERIODIC.items, edits);
    const gauge = out.find((i) => i.code === "state_gauge")!;
    expect(gauge.appliesWhen).toEqual({ source: "asset", key: "agent", notEquals: "co2" });
    const ph = out.find((i) => i.code === "docs_hydrostatic")!;
    expect(ph.autoSource).toEqual({ dueKind: "hydrostatic_test" });
    expect(ph.naAllowed).toBe(false); // un ítem automático no admite «No aplica» aunque lo pida el cliente
  });

  it("respeta el orden recibido y cambia texto, sección, criticidad y foto", () => {
    const edits = asEdits(EXTINGUISHER_PERIODIC.items).reverse();
    edits[0] = { ...edits[0], text: "  Nuevo texto  ", criticality: "minor", photoOnNc: false, section: "Otra" };
    const out = applyItemEdits(EXTINGUISHER_PERIODIC.items, edits);
    expect(out[0]).toMatchObject({ text: "Nuevo texto", criticality: "minor", photoOnNc: false, section: "Otra" });
    expect(out.map((i) => i.code)).toEqual(edits.map((e) => e.code));
  });

  it("agrega ítems nuevos de tipo conforme/no conforme con un código estable y único", () => {
    const edits: ItemEdit[] = [...asEdits(EXTINGUISHER_PERIODIC.items), { section: "Extra", text: "Cartel de uso", criticality: "major", naAllowed: true, photoOnNc: true }];
    const out = applyItemEdits(EXTINGUISHER_PERIODIC.items, edits);
    const added = out.at(-1)!;
    expect(added).toMatchObject({ kind: "check", required: true, text: "Cartel de uso", criticality: "major" });
    expect(added.code).toMatch(/^custom_\d+$/);
    expect(new Set(out.map((i) => i.code)).size).toBe(out.length);
  });

  it("quitar un ítem simplemente lo omite; un código desconocido se rechaza", () => {
    const edits = asEdits(EXTINGUISHER_PERIODIC.items).filter((e) => e.code !== "loc_mount");
    expect(applyItemEdits(EXTINGUISHER_PERIODIC.items, edits).some((i) => i.code === "loc_mount")).toBe(false);
    expect(() => applyItemEdits(EXTINGUISHER_PERIODIC.items, [{ code: "inventado", section: "x", text: "y", criticality: "minor", naAllowed: true, photoOnNc: false }])).toThrow();
  });
});

describe("nextItemCode", () => {
  it("sigue la serie custom_N sin reutilizar números", () => {
    expect(nextItemCode([])).toBe("custom_1");
    expect(nextItemCode([{ code: "custom_1" }, { code: "custom_7" }, { code: "otro" }])).toBe("custom_8");
  });
});

describe("validateTemplateEdit", () => {
  it("la plantilla original es válida y sin avisos", () => {
    expect(validateTemplateEdit(base(), ctx)).toEqual({ errors: [], warnings: [] });
  });

  it("pide nombre, ítems con texto y al menos un ítem crítico", () => {
    const input = base();
    input.name = "  ";
    expect(codes(validateTemplateEdit(input, ctx).errors)).toContain("empty_name");

    const noText = base();
    noText.items = noText.items.map((i, n) => (n === 0 ? { ...i, text: " " } : i));
    expect(codes(validateTemplateEdit(noText, ctx).errors)).toContain("empty_text");

    const noCritical = base();
    noCritical.items = noCritical.items.map((i) => (i.criticality === "critical" && !i.autoSource ? { ...i, criticality: "major" } : i));
    noCritical.items = noCritical.items.map((i) => (i.autoSource ? { ...i, criticality: "major" } : i));
    expect(codes(validateTemplateEdit(noCritical, ctx).errors)).toContain("no_critical_item");
  });

  it("no deja quitar los ítems que el sistema completa solo (vencimientos del activo)", () => {
    const input = base();
    input.items = input.items.filter((i) => i.code !== "docs_hydrostatic");
    expect(codes(validateTemplateEdit(input, ctx).errors)).toContain("locked_item_removed");
  });

  it("avisa a partir de 25 ítems aplicables y bloquea sobre 40", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i): TemplateItemDef => ({ code: `custom_${i + 1}`, section: "Extra", text: `Ítem ${i + 1}`, criticality: "minor", kind: "check", naAllowed: true, photoOnNc: false, required: true }));
    const warn = base();
    warn.items = [...warn.items, ...many(15)];
    const r = validateTemplateEdit(warn, ctx);
    expect(r.errors).toEqual([]);
    expect(codes(r.warnings)).toContain("many_items");

    const over = base();
    over.items = [...over.items, ...many(30)];
    expect(codes(validateTemplateEdit(over, ctx).errors)).toContain("too_many_items");
  });

  describe("frecuencia", () => {
    const withInterval = (unit: "days" | "months" | null, value: number | null) => ({ ...base(), intervalUnit: unit, intervalValue: value });
    it.each([
      ["months", 1, true],
      ["months", 3, true],
      ["days", 7, true],
      ["days", 90, true],
      ["months", 4, false],
      ["days", 120, false],
      ["months", 0, false],
      ["days", -5, false],
      ["days", 1.5, false],
    ] as const)("extintores: %s %s → %s", (unit, value, ok) => {
      expect(codes(validateTemplateEdit(withInterval(unit, value), ctx).errors).includes("bad_interval")).toBe(!ok);
    });

    it("una plantilla con calendario no puede quedarse sin frecuencia", () => {
      expect(codes(validateTemplateEdit(withInterval(null, null), ctx).errors)).toContain("bad_interval");
    });

    it("el control previo al uso (sin calendario) no admite frecuencia", () => {
      const pre = editContextFor({ ...EXTINGUISHER_PERIODIC, intervalUnit: null });
      expect(codes(validateTemplateEdit(withInterval("months", 1), pre).errors)).toContain("bad_interval");
      expect(validateTemplateEdit(withInterval(null, null), pre).errors).toEqual([]);
    });

    it("las demás plantillas con calendario aceptan hasta 24 meses", () => {
      const other = editContextFor({ ...EXTINGUISHER_PERIODIC, key: "site_obrador" });
      expect(codes(validateTemplateEdit(withInterval("months", 24), other).errors)).not.toContain("bad_interval");
      expect(codes(validateTemplateEdit(withInterval("months", 25), other).errors)).toContain("bad_interval");
    });
  });
});

describe("templateChanged", () => {
  const current = (): TemplateEditInput => ({ ...base() });
  it("sin diferencias no hay cambio", () => {
    expect(templateChanged(current(), base())).toBe(false);
  });
  it("detecta cambios de nombre, frecuencia, hallazgo, texto, orden, alta y baja de ítems", () => {
    expect(templateChanged(current(), { ...base(), name: "Otro" })).toBe(true);
    expect(templateChanged(current(), { ...base(), intervalValue: 2 })).toBe(true);
    expect(templateChanged(current(), { ...base(), findingOnCritical: true })).toBe(true);
    const text = base();
    text.items = text.items.map((i, n) => (n === 2 ? { ...i, text: i.text + "." } : i));
    expect(templateChanged(current(), text)).toBe(true);
    const order = base();
    order.items = [order.items[1], order.items[0], ...order.items.slice(2)];
    expect(templateChanged(current(), order)).toBe(true);
    const fewer = base();
    fewer.items = fewer.items.slice(0, -1);
    expect(templateChanged(current(), fewer)).toBe(true);
  });
  it("ignora diferencias de espacios", () => {
    expect(templateChanged(current(), { ...base(), name: `  ${EXTINGUISHER_PERIODIC.name} ` })).toBe(false);
  });
});
