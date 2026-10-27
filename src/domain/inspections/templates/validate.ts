import { applicableItems } from "../result";
import type { TemplateItemDef } from "../types";
import type { TemplateDefinition } from "./types";

export const MAX_TEMPLATE_ITEMS = 40;

export type TemplateIssue = { code: string; message: string };

/**
 * Chequea una plantilla (precargada o editada): códigos únicos, al menos un ítem crítico,
 * rangos coherentes y que ningún activo reciba más ítems aplicables que el tope.
 * `samples` son combinaciones de atributos para probar `appliesWhen`: el peor caso es el que cuenta.
 */
export function validateTemplate(
  template: Pick<TemplateDefinition, "items" | "maxApplicableItems">,
  samples: readonly Record<string, unknown>[] = [{}],
): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });
  const { items } = template;

  if (items.length === 0) add("empty", "La plantilla no tiene ítems");
  if (items.length > MAX_TEMPLATE_ITEMS) add("too_many_items", `La plantilla supera ${MAX_TEMPLATE_ITEMS} ítems`);

  const codes = new Set<string>();
  for (const item of items) {
    if (codes.has(item.code)) add("duplicate_code", `Código repetido: ${item.code}`);
    codes.add(item.code);
    issues.push(...validateItem(item));
  }

  const scoring = items.filter((i) => i.kind === "check" || i.kind === "number");
  if (!scoring.some((i) => i.criticality === "critical")) add("no_critical_item", "La plantilla necesita al menos un ítem crítico");

  const worst = Math.max(0, ...samples.map((asset) => applicableItems(items, { asset }).filter((i) => i.kind !== "text" && i.kind !== "reading").length));
  if (worst > template.maxApplicableItems) {
    add("too_many_applicable", `Un activo puede recibir ${worst} ítems aplicables y el máximo es ${template.maxApplicableItems}`);
  }
  return issues;
}

/** Cantidad de ítems que puntúan para el peor activo de la muestra. */
export function worstApplicableCount(items: readonly TemplateItemDef[], samples: readonly Record<string, unknown>[] = [{}]): number {
  return Math.max(0, ...samples.map((asset) => applicableItems(items, { asset }).filter((i) => i.kind !== "text" && i.kind !== "reading").length));
}

function validateItem(item: TemplateItemDef): TemplateIssue[] {
  const out: TemplateIssue[] = [];
  const add = (code: string, message: string) => out.push({ code, message: `${item.code}: ${message}` });
  if (!item.text.trim()) add("empty_text", "el ítem no tiene texto");
  if (item.kind === "number") {
    if (item.minValue == null && item.maxValue == null) add("number_without_range", "un ítem numérico necesita un rango");
    if (item.minValue != null && item.maxValue != null && item.minValue > item.maxValue) add("bad_range", "el mínimo supera al máximo");
  }
  if (item.kind === "reading" && !item.readingKey) add("reading_without_key", "una lectura necesita su tipo (odómetro u horómetro)");
  if (item.autoSource && item.kind !== "check") add("auto_not_check", "un ítem automático debe ser de tipo conforme / no conforme");
  if (item.autoSource && item.naAllowed) add("auto_na", "un ítem automático no admite «No aplica»");
  return out;
}
