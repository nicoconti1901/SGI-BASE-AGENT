export const SUPPLIER_TYPES = ["product", "service", "contractor"] as const;
export type SupplierTypeValue = (typeof SUPPLIER_TYPES)[number];

export const SUPPLIER_TYPE_LABELS: Record<SupplierTypeValue, string> = {
  product: "Producto",
  service: "Servicio",
  contractor: "Contratista",
};

export const SUPPLIER_CRITICALITIES = ["critical", "standard", "low"] as const;
export type SupplierCriticalityValue = (typeof SUPPLIER_CRITICALITIES)[number];

export const SUPPLIER_CRITICALITY_LABELS: Record<SupplierCriticalityValue, string> = {
  critical: "Crítico",
  standard: "Estándar",
  low: "Bajo impacto",
};

export const SUPPLIER_CRITICALITY_HINTS: Record<SupplierCriticalityValue, string> = {
  critical: "Afecta la conformidad del producto, la seguridad o el ambiente.",
  standard: "Importa para la operación, pero un fallo se corrige sin consecuencias graves.",
  low: "Compras ocasionales o de poco impacto: se acepta con un motivo escrito.",
};

export const SUPPLIER_STATUSES = ["potential", "approved", "conditional", "not_approved", "inactive"] as const;
export type SupplierStatusValue = (typeof SUPPLIER_STATUSES)[number];

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatusValue, string> = {
  potential: "Sin evaluar",
  approved: "Aprobado",
  conditional: "Con condiciones",
  not_approved: "No aprobado",
  inactive: "De baja",
};

export type EvaluationResultValue = "approved" | "conditional" | "not_approved";
export type EvaluationModeValue = "full" | "simplified" | "declared";
export type ResultReasonValue = "score" | "excluding_criterion" | "declared";

export const EVALUATION_RESULT_LABELS: Record<EvaluationResultValue, string> = {
  approved: "Aprobado",
  conditional: "Con condiciones",
  not_approved: "No aprobado",
};

export type Semaphore = "green" | "amber" | "red" | "gray";

export const SEMAPHORE_LABELS: Record<Semaphore, string> = {
  green: "Al día",
  amber: "Por vencer",
  red: "Requiere atención",
  gray: "Sin evaluar",
};

export const CRITERION_PHASES = ["selection", "performance", "both"] as const;
export type CriterionPhaseValue = (typeof CRITERION_PHASES)[number];

export const DOCUMENT_RECURRENCES = ["none", "monthly"] as const;
export type DocumentRecurrenceValue = (typeof DOCUMENT_RECURRENCES)[number];

/** Umbrales de aprobación de una plantilla (se copian a cada evaluación). */
export type Thresholds = { approvedMin: number; conditionalMin: number };

export const DEFAULT_THRESHOLDS: Thresholds = { approvedMin: 80, conditionalMin: 60 };

/** Ventana, en días, en que un vencimiento pasa a "por vencer". */
export const DEFAULT_WARN_DAYS = 30;
