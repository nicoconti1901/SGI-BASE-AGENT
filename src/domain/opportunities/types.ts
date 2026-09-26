/** Oportunidades del SGC — distintas de riesgo; no son “riesgo positivo”. */

export type OpportunityStatus =
  | "discovered"
  | "analyzing"
  | "evaluated"
  | "decision"
  | "pursuing"
  | "implementing"
  | "benefit_review"
  | "realized"
  | "closed";

export type OpportunityPursuitDecision =
  | "pursue_now"
  | "pursue_later"
  | "monitor"
  | "investigate"
  | "do_not_pursue"
  | "close";

export const OPPORTUNITY_STATUSES: OpportunityStatus[] = [
  "discovered",
  "analyzing",
  "evaluated",
  "decision",
  "pursuing",
  "implementing",
  "benefit_review",
  "realized",
  "closed",
];

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  discovered: "Descubierta",
  analyzing: "Analizando",
  evaluated: "Evaluada",
  decision: "Decisión",
  pursuing: "Persiguiendo",
  implementing: "Implementando",
  benefit_review: "Revisión de beneficio",
  realized: "Realizada",
  closed: "Cerrada",
};

export const OPPORTUNITY_STATUS_TONE: Record<
  OpportunityStatus,
  { bg: string; fg: string }
> = {
  discovered: { bg: "var(--color-surface)", fg: "var(--color-ink-muted)" },
  analyzing: { bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
  evaluated: { bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
  decision: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  pursuing: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  implementing: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  benefit_review: {
    bg: "var(--color-warning-soft)",
    fg: "var(--color-warning)",
  },
  realized: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  closed: { bg: "var(--color-surface)", fg: "var(--color-ink-muted)" },
};

export const OPPORTUNITY_PURSUIT_LABELS: Record<
  OpportunityPursuitDecision,
  string
> = {
  pursue_now: "Perseguir ahora",
  pursue_later: "Más tarde",
  monitor: "Monitorear",
  investigate: "Investigar",
  do_not_pursue: "No perseguir",
  close: "Cerrar",
};

/** Hipótesis: condición → circunstancia → beneficio. */
export type OpportunityHypothesis = {
  condition: string;
  circumstance: string;
  benefit: string;
};

export type OpportunityDraft = {
  title: string;
  hypothesis: OpportunityHypothesis;
  sourceKind: import("@/domain/risks/types").SourceKind;
  sourceLabel: string;
  findingId?: string | null;
};

export const OPPORTUNITY_ENTITY_TYPE = "opportunity";
