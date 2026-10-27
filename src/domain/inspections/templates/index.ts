import { EXTINGUISHER_PERIODIC } from "./extinguisher";
import { FALL_PROTECTION_PERIODIC } from "./fall-protection";
import { FUNCTIONAL_CHECK } from "./functional-check";
import { LIGHT_PERIODIC, LIGHT_PRE_USE } from "./light-vehicle";
import { SITE_OBRADOR } from "./obrador";
import type { TemplateDefinition } from "./types";

/**
 * Plantillas precargadas. Agregar un tipo = una línea acá (y su tipo de activo en `asset-types/`).
 * Las demás del anexo (pesados, campo) se suman en los tramos siguientes.
 */
export const DEFAULT_TEMPLATES: readonly TemplateDefinition[] = [
  EXTINGUISHER_PERIODIC,
  SITE_OBRADOR,
  LIGHT_PRE_USE,
  LIGHT_PERIODIC,
  FALL_PROTECTION_PERIODIC,
  FUNCTIONAL_CHECK,
];

export function getDefaultTemplate(key: string): TemplateDefinition | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}

export type { TemplateDefinition } from "./types";
