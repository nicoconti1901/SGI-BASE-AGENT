/** Tipos del motor de inspecciones (Task 15). Todo es puro: sin base de datos ni framework. */

export type Criticality = "critical" | "major" | "minor";
export type ItemKind = "check" | "number" | "text" | "reading";
export type AnswerValue = "conform" | "nonconform" | "na";
export type InspectionResult = "fit" | "fit_with_observations" | "unfit";
export type AssetStatus = "in_service" | "out_of_service" | "retired";
export type ReadingKey = "odometer_km" | "hours";
export type TemplateScope = "asset" | "area" | "activity";
export type IntervalUnit = "days" | "months";

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  critical: "Crítico",
  major: "Mayor",
  minor: "Menor",
};

export const RESULT_LABELS: Record<InspectionResult, string> = {
  fit: "Apto",
  fit_with_observations: "Apto con observaciones",
  unfit: "No apto",
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  in_service: "En servicio",
  out_of_service: "Fuera de servicio",
  retired: "Dado de baja",
};

export const OWNERSHIP_LABELS = {
  own: "Propio",
  rented: "Alquilado",
  contractor: "De contratista",
} as const;
export type Ownership = keyof typeof OWNERSHIP_LABELS;

/** Condición sobre un atributo del activo o un dato de contexto. */
export type AppliesWhen = {
  source: "asset" | "context";
  key: string;
} & (
  | { equals: string | boolean | number }
  | { notEquals: string | boolean | number }
  | { in: (string | number)[] }
  | { notIn: (string | number)[] }
);

/** El valor del ítem lo deriva el sistema a partir de un vencimiento del activo. */
export type AutoSource = { dueKind: string };

/** Ítem de plantilla tal como lo usan las funciones puras. */
export type TemplateItemDef = {
  code: string;
  section: string;
  text: string;
  help?: string | null;
  criticality: Criticality;
  kind: ItemKind;
  naAllowed: boolean;
  photoOnNc: boolean;
  required: boolean;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  readingKey?: ReadingKey | null;
  autoSource?: AutoSource | null;
  appliesWhen?: AppliesWhen | null;
};

/** Ítem ya aplicable a una inspección concreta (lleva el id de la base). */
export type EvalItem = {
  id: string;
  criticality: Criticality;
  kind: ItemKind;
  naAllowed: boolean;
  required: boolean;
  photoOnNc?: boolean;
  minValue?: number | null;
  maxValue?: number | null;
  autoSource?: AutoSource | null;
  /** Para un `autoSource`: true si el vencimiento está vigente. Lo resuelve `resolveAutoConform`. */
  autoConform?: boolean;
};

export type EvalAnswer = {
  itemId: string;
  value?: AnswerValue | null;
  numberValue?: number | null;
  textValue?: string | null;
  comment?: string | null;
};

export class InspectionDomainError extends Error {
  constructor(
    readonly code:
      | "no_applicable_items"
      | "na_not_allowed"
      | "duplicate_answer"
      | "unknown_item"
      | "invalid_template",
    message: string,
  ) {
    super(message);
    this.name = "InspectionDomainError";
  }
}
