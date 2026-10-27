import { EXTINGUISHER_PERIODIC } from "./extinguisher";
import { FUNCTIONAL_CHECK } from "./functional-check";
import { LIGHT_PERIODIC, LIGHT_PRE_USE } from "./light-vehicle";
import type { TemplateDefinition } from "./types";

/**
 * Plantillas precargadas. Agregar un tipo = una línea acá (y su tipo de activo en `asset-types/`).
 * Las demás del anexo (obrador, livianos, arneses, pesados, campo) se suman en los tramos siguientes.
 */
export const DEFAULT_TEMPLATES: readonly TemplateDefinition[] = [EXTINGUISHER_PERIODIC, LIGHT_PRE_USE, LIGHT_PERIODIC, FUNCTIONAL_CHECK];

export function getDefaultTemplate(key: string): TemplateDefinition | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}

export type { TemplateDefinition } from "./types";
