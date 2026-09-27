/** Objetivos e indicadores del SGI — §6.2 y §9.1 (SPEC-indicators.md). */

export type IndicatorDirection = "higher_better" | "lower_better";
export type IndicatorFrequency = "monthly" | "quarterly" | "semiannual" | "annual";
export type IndicatorKind = "leading" | "lagging";
export type MeasurementStatus = "on_target" | "alert" | "off_target" | "no_data";
export type ObjectiveStatus = "active" | "achieved" | "not_achieved" | "cancelled";

export const DIRECTION_LABELS: Record<IndicatorDirection, string> = {
  higher_better: "Mayor es mejor",
  lower_better: "Menor es mejor",
};

export const FREQUENCY_LABELS: Record<IndicatorFrequency, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export const KIND_LABELS: Record<IndicatorKind, string> = {
  leading: "Proactivo",
  lagging: "Reactivo",
};

export const KIND_HINTS: Record<IndicatorKind, string> = {
  leading: "Mide la prevención, antes del resultado (inspecciones hechas, capacitaciones).",
  lagging: "Mide resultados ya ocurridos (accidentes, reclamos, no conformidades).",
};

export const MEASUREMENT_STATUS_LABELS: Record<MeasurementStatus, string> = {
  on_target: "En meta",
  alert: "Alerta",
  off_target: "Fuera de meta",
  no_data: "Sin datos",
};

export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  active: "Vigente",
  achieved: "Cumplido",
  not_achieved: "No cumplido",
  cancelled: "Cancelado",
};

/** Tono de los chips de estado (tokens de tokens.css). */
export const MEASUREMENT_STATUS_TONE: Record<MeasurementStatus, string> = {
  on_target: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  alert: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  off_target: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  no_data: "bg-[var(--color-surface)] text-[var(--color-ink-muted)]",
};

/** La carga de un período vence N días después de que termina (supuesto 1). */
export const MEASUREMENT_GRACE_DAYS = 10;
export const INDICATOR_MEASUREMENT_ENTITY_TYPE = "indicator_measurement";
