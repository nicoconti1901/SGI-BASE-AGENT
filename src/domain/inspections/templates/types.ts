import type { Criticality, IntervalUnit, TemplateItemDef, TemplateScope } from "../types";

/** Plantilla precargada: se siembra por empresa con `ensureDefaultTemplates`. */
export type TemplateDefinition = {
  key: string;
  name: string;
  scope: TemplateScope;
  assetTypeKey: string | null;
  /** Nulo: control previo al uso o sin calendario. */
  intervalUnit: IntervalUnit | null;
  intervalValue: number | null;
  /** Días de anticipación del aviso del programa. */
  leadDays: number;
  reinspectionDays: number;
  /** Con una NC crítica, además de la acción se crea un hallazgo borrador. */
  findingOnCritical: boolean;
  /** Una inspección apta de esta plantilla puede devolver el activo a servicio. */
  canReinstate: boolean;
  /** Un no apto da de baja el activo para siempre. */
  retireOnUnfit: boolean;
  /** Tope de ítems aplicables a la vez (SPEC: 25; 15 o 20 en el control previo al uso). */
  maxApplicableItems: number;
  items: TemplateItemDef[];
};

/** Construye un ítem de tipo «check» con los valores por defecto del SPEC. */
export function checkItem(
  code: string,
  section: string,
  text: string,
  criticality: Criticality,
  extra: Partial<TemplateItemDef> = {},
): TemplateItemDef {
  return {
    code,
    section,
    text,
    criticality,
    kind: "check",
    naAllowed: true,
    // Decisión 13: la foto es obligatoria en NC crítica y mayor; opcional en menor.
    photoOnNc: criticality !== "minor",
    required: true,
    ...extra,
  };
}
