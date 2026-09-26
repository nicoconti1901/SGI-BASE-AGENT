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

export type WhyStep = {
  order: number;
  question: string;
  answer: string;
  evidenceNote?: string;
  isRootCause: boolean;
  warningFlags?: WhyWarning[];
};

export type RootCauseAnalysis = {
  method: "five_whys";
  problemStatement: string;
  steps: WhyStep[];
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

export const MEASURE_KIND_LABELS: Record<MeasureKind, string> = {
  corrective: "Correctiva",
  preventive: "Preventiva",
};

export const FINDING_MEASURE_ENTITY_TYPE = "finding_measure";

export function isFindingType(value: string): value is FindingType {
  return FINDING_TYPES.includes(value as FindingType);
}

export function labelFindingType(type: FindingType): string {
  return FINDING_TYPE_LABELS[type];
}
