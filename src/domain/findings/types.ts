export type FindingType =
  | "nonconformity"
  | "observation"
  | "incident"
  | "opportunity";

export type FindingStatus =
  | "draft"
  | "published"
  | "in_progress"
  | "closed"
  | "cancelled";

export type MeasureKind = "corrective" | "preventive";

export type WhyWarning =
  | "blame"
  | "vague"
  | "symptom"
  | "solution"
  | "logic_gap";

/** Un paso dentro de una rama causal del árbol de 5 Porqués. */
export type WhyStep = {
  id: string;
  /** Profundidad dentro de la rama (1 = causa inmediata de esa rama). */
  order: number;
  branchId: string;
  /** Ej.: "A — Condición peligrosa" */
  branchLabel: string;
  question: string;
  answer: string;
  /** Evidencia verificable que sustenta la respuesta (testimonio, registro, foto). */
  evidenceNote?: string;
  isRootCause: boolean;
  warningFlags?: WhyWarning[];
};

export type RootCauseAnalysis = {
  method: "five_whys";
  /** Hecho comprobado (no el título del hallazgo). */
  problemStatement: string;
  /** Ítems de la checklist de investigación marcados como reunidos. */
  investigationChecklist?: string[];
  /** Secuencia temporal / reconstrucción breve del evento. */
  investigationSequence?: string;
  steps: WhyStep[];
  /** Texto agregado de las causas raíz confirmadas (una o varias ramas). */
  rootCause: string | null;
  rootCauseConfirmedAt: Date | null;
  rootCauseConfirmedByUserId: string | null;
  status: "incomplete" | "confirmed";
};

export type FindingMeasureDraft = {
  kind: MeasureKind;
  title: string;
  description?: string;
  ownerUserId: string;
  dueAt: Date | null;
  linkedRootCause: boolean;
};

export type FindingDraft = {
  type: FindingType;
  title: string;
  description: string;
  detectedAt: Date;
  source?: string;
  location?: string;
  severity?: string;
  rca: RootCauseAnalysis;
  measures: FindingMeasureDraft[];
  notifyUserIds: string[];
};

export const FINDING_TYPES: FindingType[] = [
  "nonconformity",
  "observation",
  "incident",
  "opportunity",
];

export const FINDING_TYPE_LABELS: Record<FindingType, string> = {
  nonconformity: "No conformidad",
  observation: "Observación",
  incident: "Incidente",
  opportunity: "Oportunidad de mejora",
};

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  in_progress: "En curso",
  closed: "Cerrado",
  cancelled: "Anulado",
};

/** Colores de badge para la bandeja de seguimiento. */
export const FINDING_STATUS_TONE: Record<
  FindingStatus,
  { bg: string; fg: string }
> = {
  draft: { bg: "var(--color-surface)", fg: "var(--color-ink-muted)" },
  published: { bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
  in_progress: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  closed: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  cancelled: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
};

export const MEASURE_KIND_LABELS: Record<MeasureKind, string> = {
  corrective: "Correctiva",
  preventive: "Preventiva",
};

export type MeasureWorkflowStatus = "open" | "in_progress" | "closed";

export const MEASURE_STATUS_LABELS: Record<MeasureWorkflowStatus, string> = {
  open: "Abierta",
  in_progress: "En curso",
  closed: "Cerrada",
};

export const MEASURE_STATUS_TONE: Record<
  MeasureWorkflowStatus,
  { bg: string; fg: string; border: string; accentBar: string }
> = {
  open: {
    bg: "var(--color-warning-soft)",
    fg: "var(--color-warning)",
    border: "var(--color-warning)",
    accentBar: "var(--color-warning)",
  },
  in_progress: {
    bg: "var(--color-accent-soft)",
    fg: "var(--color-accent)",
    border: "var(--color-accent)",
    accentBar: "var(--color-accent)",
  },
  closed: {
    bg: "var(--color-success-soft)",
    fg: "var(--color-success)",
    border: "var(--color-success)",
    accentBar: "var(--color-success)",
  },
};

export function isMeasureWorkflowStatus(
  value: string,
): value is MeasureWorkflowStatus {
  return value in MEASURE_STATUS_LABELS;
}

export const FINDING_MEASURE_ENTITY_TYPE = "finding_measure";

export function isFindingType(value: string): value is FindingType {
  return FINDING_TYPES.includes(value as FindingType);
}

export function labelFindingType(type: FindingType): string {
  return FINDING_TYPE_LABELS[type];
}

export function labelFindingStatus(status: FindingStatus): string {
  return FINDING_STATUS_LABELS[status];
}

export function isFindingStatus(value: string): value is FindingStatus {
  return value in FINDING_STATUS_LABELS;
}

/** Próximo vencimiento de medidas abiertas (para la bandeja). */
export function nearestOpenMeasureDueAt(
  measures: { dueAt: Date | null; status?: string }[],
): Date | null {
  const open = measures.filter(
    (m) =>
      m.dueAt &&
      (!m.status || m.status === "open" || m.status === "in_progress"),
  );
  if (open.length === 0) return null;
  return open.reduce(
    (min, m) => (m.dueAt! < min ? m.dueAt! : min),
    open[0]!.dueAt!,
  );
}

export type FindingsListFilters = {
  q?: string;
  type?: FindingType;
  /** Si se omite, se excluyen anulados. `"all"` incluye todos. */
  status?: FindingStatus | "all";
};
