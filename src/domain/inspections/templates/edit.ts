import type { Criticality, IntervalUnit, TemplateItemDef } from "../types";
import type { TemplateDefinition } from "./types";
import { MAX_TEMPLATE_ITEMS, validateTemplate, worstApplicableCount, type TemplateIssue } from "./validate";

/** Lo que el administrador puede cambiar de una plantilla (SPEC: nombre, frecuencia, hallazgo e ítems). */
export type TemplateEditInput = {
  name: string;
  intervalUnit: IntervalUnit | null;
  intervalValue: number | null;
  findingOnCritical: boolean;
  items: TemplateItemDef[];
};

/**
 * Edición de un ítem tal como llega del editor. Con `code` es un ítem existente: solo se aplican los campos
 * editables y se conserva el resto (tipo, rangos, origen automático y condición de aplicabilidad).
 * Sin `code` es un ítem nuevo, siempre de tipo conforme / no conforme.
 */
export type ItemEdit = {
  code?: string;
  section: string;
  text: string;
  help?: string | null;
  criticality: Criticality;
  naAllowed: boolean;
  photoOnNc: boolean;
};

export type TemplateEditContext = {
  /** Una plantilla sin calendario (control previo al uso) no admite frecuencia. */
  hasCalendar: boolean;
  /** Tope de la frecuencia en días aproximados (mes = 30); sin tope, el máximo general. */
  maxIntervalDays: number;
  /** Ítems que el sistema completa solo desde un vencimiento del activo: no se pueden quitar. */
  lockedCodes: readonly string[];
  /** Aviso de «demasiados ítems» (SPEC: 25). */
  maxApplicableItems: number;
};

/** Frecuencia máxima por plantilla. IRAM 3517-2 §8.2 exige control al menos trimestral (decisión 2). */
const MAX_INTERVAL_DAYS_BY_KEY: Record<string, number> = { extinguisher_periodic: 90 };
const MAX_INTERVAL_DAYS = 24 * 30;

/** La frecuencia en palabras: «Cada mes», «Cada 15 días», «Antes de cada uso». */
export function describeInterval(unit: IntervalUnit | null, value: number | null): string {
  if (!unit || !value) return "Antes de cada uso";
  if (unit === "days") return value === 1 ? "Todos los días" : value === 7 ? "Cada semana" : `Cada ${value} días`;
  return value === 1 ? "Cada mes" : `Cada ${value} meses`;
}

export const MAX_NAME_LENGTH = 80;
export const MAX_ITEM_TEXT_LENGTH = 300;

export function editContextFor(def: Pick<TemplateDefinition, "key" | "intervalUnit" | "maxApplicableItems" | "items">): TemplateEditContext {
  return {
    hasCalendar: def.intervalUnit != null,
    maxIntervalDays: MAX_INTERVAL_DAYS_BY_KEY[def.key] ?? MAX_INTERVAL_DAYS,
    lockedCodes: def.items.filter((i) => i.autoSource).map((i) => i.code),
    maxApplicableItems: def.maxApplicableItems,
  };
}

const CUSTOM_CODE = /^custom_(\d+)$/;

/** Código para un ítem nuevo: serie `custom_N` que no reutiliza números ya usados en la plantilla. */
export function nextItemCode(items: readonly { code: string }[]): string {
  const used = items.map((i) => CUSTOM_CODE.exec(i.code)).filter((m): m is RegExpExecArray => m != null).map((m) => Number(m[1]));
  return `custom_${Math.max(0, ...used) + 1}`;
}

const clean = (value: string) => value.trim();
const cleanOrNull = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

/**
 * Arma los ítems finales a partir de los vigentes y de las ediciones recibidas, en el orden recibido.
 * El cliente nunca define tipo, rangos, `autoSource` ni `appliesWhen` de un ítem existente: se toman de la versión vigente.
 * Quitar un ítem es no mencionarlo.
 */
export function applyItemEdits(current: readonly TemplateItemDef[], edits: readonly ItemEdit[]): TemplateItemDef[] {
  const byCode = new Map(current.map((i) => [i.code, i]));
  const out: TemplateItemDef[] = [];
  const seen = new Set<string>();
  for (const edit of edits) {
    const patch = {
      section: clean(edit.section),
      text: clean(edit.text),
      help: cleanOrNull(edit.help),
      criticality: edit.criticality,
      photoOnNc: edit.photoOnNc,
    };
    if (edit.code == null) {
      const code = nextItemCode([...current, ...out]);
      out.push({ code, kind: "check", required: true, naAllowed: edit.naAllowed, ...patch, help: patch.help });
      continue;
    }
    const prev = byCode.get(edit.code);
    if (!prev) throw new Error(`Ítem desconocido: ${edit.code}`);
    if (seen.has(edit.code)) throw new Error(`Ítem repetido: ${edit.code}`);
    seen.add(edit.code);
    // Un ítem automático no admite «No aplica»: manda el vencimiento del activo.
    const { help, ...rest } = { ...prev, ...patch, naAllowed: prev.autoSource ? false : edit.naAllowed };
    // Un ítem sin ayuda en la plantilla original sigue sin la clave (igual que antes de editar).
    out.push(help == null && prev.help === undefined ? rest : { ...rest, help });
  }
  return out;
}

function validInterval(unit: IntervalUnit | null, value: number | null, ctx: TemplateEditContext): boolean {
  if (!ctx.hasCalendar) return unit == null && value == null;
  if (unit !== "days" && unit !== "months") return false;
  if (value == null || !Number.isInteger(value) || value < 1) return false;
  return (unit === "months" ? value * 30 : value) <= ctx.maxIntervalDays;
}

/**
 * Controla una plantilla editada. `errors` impiden guardar; `warnings` solo avisan (p. ej. más de 25 ítems).
 * Los chequeos de ítems (códigos únicos, ítem crítico, rangos, tope de 40) son los de `validateTemplate`.
 */
export function validateTemplateEdit(input: TemplateEditInput, ctx: TemplateEditContext): { errors: TemplateIssue[]; warnings: TemplateIssue[] } {
  const errors: TemplateIssue[] = [];
  const warnings: TemplateIssue[] = [];
  const name = clean(input.name);
  if (!name) errors.push({ code: "empty_name", message: "La plantilla necesita un nombre" });
  else if (name.length > MAX_NAME_LENGTH) errors.push({ code: "long_name", message: `El nombre no puede pasar de ${MAX_NAME_LENGTH} caracteres` });

  if (!validInterval(input.intervalUnit, input.intervalValue, ctx)) {
    errors.push({
      code: "bad_interval",
      message: ctx.hasCalendar
        ? ctx.maxIntervalDays < MAX_INTERVAL_DAYS
          ? `La frecuencia tiene que ser un número entero positivo y no puede superar los ${Math.round(ctx.maxIntervalDays / 30)} meses`
          : "La frecuencia tiene que ser un número entero positivo, hasta 24 meses"
        : "Esta plantilla es un control previo al uso: no lleva frecuencia",
    });
  }

  for (const item of input.items) {
    if (item.text.length > MAX_ITEM_TEXT_LENGTH) errors.push({ code: "long_text", message: `${item.code}: el texto no puede pasar de ${MAX_ITEM_TEXT_LENGTH} caracteres` });
    if (!item.section.trim()) errors.push({ code: "empty_section", message: `${item.code}: falta la sección` });
  }

  for (const code of ctx.lockedCodes) {
    if (!input.items.some((i) => i.code === code && i.autoSource)) {
      errors.push({ code: "locked_item_removed", message: `El ítem «${code}» lo completa el sistema con un vencimiento del activo y no se puede quitar` });
    }
  }

  // El aviso de ítems aplicables lo damos nosotros (con el tope de 40 como único bloqueo).
  for (const issue of validateTemplate({ items: input.items, maxApplicableItems: MAX_TEMPLATE_ITEMS })) errors.push(issue);
  const count = worstApplicableCount(input.items);
  if (count > ctx.maxApplicableItems) {
    warnings.push({ code: "many_items", message: `La inspección va a tener ${count} ítems. Pasados los ${ctx.maxApplicableItems}, cuesta completarla con cuidado: conviene dejar solo lo que se controla de verdad` });
  }
  return { errors, warnings };
}

/** Los campos editables de un ítem, en orden fijo, para compararlos. */
const fingerprint = (i: TemplateItemDef) =>
  JSON.stringify([i.code, clean(i.section), clean(i.text), cleanOrNull(i.help), i.criticality, i.naAllowed, i.photoOnNc]);

/** ¿Hay algo distinto respecto de la versión vigente? Si no, guardar no crea una versión nueva. */
export function templateChanged(current: TemplateEditInput, next: TemplateEditInput): boolean {
  if (clean(current.name) !== clean(next.name)) return true;
  if (current.intervalUnit !== next.intervalUnit || current.intervalValue !== next.intervalValue) return true;
  if (current.findingOnCritical !== next.findingOnCritical) return true;
  if (current.items.length !== next.items.length) return true;
  return current.items.some((item, index) => fingerprint(item) !== fingerprint(next.items[index]));
}
