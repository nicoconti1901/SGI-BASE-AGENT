import { EXTINGUISHER_PERIODIC } from "./extinguisher";
import { DRILL } from "./drill";
import { FALL_PROTECTION_PERIODIC } from "./fall-protection";
import { FIELD_AUDIT } from "./field-audit";
import { FUNCTIONAL_CHECK } from "./functional-check";
import { HEAVY_PERIODIC, HEAVY_PRE_USE } from "./heavy-equipment";
import { SITE_OBRADOR } from "./obrador";
import { LIFTING_GEAR_PERIODIC } from "./lifting-gear";
import { LIGHT_PERIODIC, LIGHT_PRE_USE } from "./light-vehicle";
import { MACHINERY_TOOLS } from "./machinery-tools";
import type { TemplateDefinition } from "./types";
import { WASTE_SEGREGATION } from "./waste-segregation";

/**
 * Plantillas precargadas. Agregar un tipo = una línea acá (y su tipo de activo en `asset-types/`).
 * Las demás del anexo (livianos, pesados, campo) se suman en los tramos siguientes.
 */
export const DEFAULT_TEMPLATES: readonly TemplateDefinition[] = [EXTINGUISHER_PERIODIC, SITE_OBRADOR, FALL_PROTECTION_PERIODIC, LIGHT_PRE_USE, LIGHT_PERIODIC, HEAVY_PRE_USE, HEAVY_PERIODIC, FUNCTIONAL_CHECK, FIELD_AUDIT, WASTE_SEGREGATION, MACHINERY_TOOLS, LIFTING_GEAR_PERIODIC, DRILL];

export function getDefaultTemplate(key: string): TemplateDefinition | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}

export type { TemplateDefinition } from "./types";
