/** Auditorías internas integradas — ISO 9001/14001/45001 §9.2, guía ISO 19011:2026. */

export type AuditStandard = "ISO9001" | "ISO14001" | "ISO45001";

export type AuditProgramStatus = "draft" | "approved" | "closed";

export type AuditStatus =
  | "planned"
  | "prepared"
  | "in_progress"
  | "reporting"
  | "closed"
  | "cancelled";

export type ExternalAuditType = "certification_initial" | "surveillance" | "recertification" | "customer";

export const EXTERNAL_AUDIT_TYPE_LABELS: Record<ExternalAuditType, string> = {
  certification_initial: "Certificación inicial",
  surveillance: "Seguimiento",
  recertification: "Recertificación",
  customer: "Cliente (2.ª parte)",
};

export type AuditMode = "onsite" | "remote" | "hybrid";

export type AuditTeamRole = "lead" | "auditor";

export type AuditItemResult =
  | "pending"
  | "conforming"
  | "nc_major"
  | "nc_minor"
  | "observation"
  | "improvement"
  | "not_applicable";

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  planned: "Planificada",
  prepared: "Preparada",
  in_progress: "En curso",
  reporting: "Informe",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

export const AUDIT_PROGRAM_STATUS_LABELS: Record<AuditProgramStatus, string> = {
  draft: "Borrador",
  approved: "Aprobado",
  closed: "Cerrado",
};

export const AUDIT_MODE_LABELS: Record<AuditMode, string> = {
  onsite: "Presencial",
  remote: "Remota",
  hybrid: "Híbrida",
};

export const AUDIT_ITEM_RESULT_LABELS: Record<AuditItemResult, string> = {
  pending: "Pendiente",
  conforming: "Conforme",
  nc_major: "NC mayor",
  nc_minor: "NC menor",
  observation: "Observación",
  improvement: "Oportunidad de mejora",
  not_applicable: "No aplica",
};

export const AUDIT_STANDARD_LABELS: Record<AuditStandard, string> = {
  ISO9001: "ISO 9001",
  ISO14001: "ISO 14001",
  ISO45001: "ISO 45001",
};

/** Severidad que se guarda en Finding.severity para NC de auditoría. */
export const FINDING_SEVERITY_LABELS: Record<string, string> = {
  major: "NC mayor",
  minor: "NC menor",
};

/** Resultados que generan un Hallazgo y exigen evidencia. */
export const FINDING_RESULTS: readonly AuditItemResult[] = [
  "nc_major",
  "nc_minor",
  "observation",
  "improvement",
];

/** Aviso previo al inicio y plazo del informe (SPEC-audits, puntos resueltos). */
export const AUDIT_START_LEAD_DAYS = 7;
export const AUDIT_REPORT_GRACE_DAYS = 10;

export const AUDIT_START_ENTITY_TYPE = "audit_start";
export const AUDIT_REPORT_ENTITY_TYPE = "audit_report";
export const AUDIT_EXTERNAL_RESPONSE_ENTITY_TYPE = "audit_external_response";
