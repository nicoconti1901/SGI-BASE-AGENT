/** Riesgos del SGC — ISO 9001:2026 §6.1 (objeto semántico distinto de Opportunity). */

export type RiskStatus =
  | "identified"
  | "analyzing"
  | "evaluated"
  | "response_planned"
  | "implementing"
  | "effectiveness_review"
  | "monitored"
  | "closed";

export type SourceKind =
  | "process"
  | "finding"
  | "supplier"
  | "change"
  | "objective"
  | "stakeholder"
  | "indicator"
  | "other";

export type AssessmentMethod = "qualitative" | "probability_impact";

export type QualitativeLevel = "low" | "medium" | "high" | "critical";

export type RiskResponseDecision =
  | "mitigate"
  | "accept"
  | "transfer"
  | "avoid"
  | "monitor"
  | "retain";

export type RiskCloseReason =
  | "no_longer_relevant"
  | "absorbed"
  | "retained_under_conditions"
  | "transferred"
  | "other";

export const RISK_STATUSES: RiskStatus[] = [
  "identified",
  "analyzing",
  "evaluated",
  "response_planned",
  "implementing",
  "effectiveness_review",
  "monitored",
  "closed",
];

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  identified: "Identificado",
  analyzing: "Analizando",
  evaluated: "Evaluado",
  response_planned: "Respuesta planificada",
  implementing: "Implementando",
  effectiveness_review: "Revisión de efectividad",
  monitored: "Monitoreado",
  closed: "Cerrado",
};

export const RISK_STATUS_TONE: Record<
  RiskStatus,
  { bg: string; fg: string }
> = {
  identified: { bg: "var(--color-surface)", fg: "var(--color-ink-muted)" },
  analyzing: { bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
  evaluated: { bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
  response_planned: {
    bg: "var(--color-warning-soft)",
    fg: "var(--color-warning)",
  },
  implementing: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  effectiveness_review: {
    bg: "var(--color-warning-soft)",
    fg: "var(--color-warning)",
  },
  monitored: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  closed: { bg: "var(--color-surface)", fg: "var(--color-ink-muted)" },
};

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  process: "Proceso",
  finding: "Hallazgo",
  supplier: "Proveedor",
  change: "Cambio",
  objective: "Objetivo",
  stakeholder: "Parte interesada",
  indicator: "Indicador",
  other: "Otro",
};

export const SOURCE_KINDS: SourceKind[] = [
  "process",
  "finding",
  "supplier",
  "change",
  "objective",
  "stakeholder",
  "indicator",
  "other",
];

export const QUALITATIVE_LEVELS: QualitativeLevel[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const QUALITATIVE_LEVEL_LABELS: Record<QualitativeLevel, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  critical: "Crítico",
};

export const ASSESSMENT_METHOD_LABELS: Record<AssessmentMethod, string> = {
  qualitative: "Cualitativo",
  probability_impact: "Probabilidad × Impacto",
};

export const RISK_RESPONSE_LABELS: Record<RiskResponseDecision, string> = {
  mitigate: "Mitigar",
  accept: "Aceptar",
  transfer: "Transferir",
  avoid: "Evitar",
  monitor: "Monitorear",
  retain: "Retener",
};

/** Qué significa cada respuesta, en palabras del usuario (se muestra junto a cada opción). */
export const RISK_RESPONSE_HINTS: Record<RiskResponseDecision, string> = {
  mitigate: "Bajar la probabilidad o el impacto con acciones. Pide cargar al menos una acción.",
  avoid: "Dejar de hacer la actividad o eliminar la condición que lo genera. Pide al menos una acción.",
  transfer: "Pasar el impacto a un tercero: seguro, contrato o proveedor. Pide al menos una acción.",
  accept: "Asumirlo sin acciones nuevas porque el nivel es tolerable. Se revisa en la próxima fecha.",
  retain: "Asumirlo con recursos propios previstos (ej.: stock de seguridad, fondo de contingencia).",
  monitor: "Todavía no actuar, pero seguirlo de cerca con fecha de revisión.",
};

export const QUALITATIVE_LEVEL_HINTS: Record<QualitativeLevel, string> = {
  low: "Poco probable y de impacto menor. Alcanza con los controles actuales.",
  medium: "Puede ocurrir y afectaría el proceso, sin llegar al cliente.",
  high: "Probable o con impacto en clientes, entregas o requisitos legales.",
  critical: "Muy probable o con impacto grave: pide respuesta inmediata.",
};

/** Statement canvas: causa → evento → efecto. */
export type RiskStatement = {
  cause: string;
  event: string;
  effect: string;
};

export type RiskDraft = {
  title: string;
  statement: RiskStatement;
  existingControls: string[];
  sourceKind: SourceKind;
  sourceLabel: string;
  findingId?: string | null;
};

export type QualitativeAssessmentInput = {
  method: "qualitative";
  level: QualitativeLevel;
  rationale: string;
};

export type ProbabilityImpactAssessmentInput = {
  method: "probability_impact";
  probability: number;
  impact: number;
  score: number;
  rationale: string;
};

export type AssessmentInput =
  | QualitativeAssessmentInput
  | ProbabilityImpactAssessmentInput;

export const RISK_ENTITY_TYPE = "risk";
