/**
 * Quitar un archivo adjunto. Lo puede hacer quien lo subió o quien administra (responsable de proceso,
 * administrador, superusuario), y solo mientras el registro está abierto: la evidencia de algo cerrado
 * respalda ese cierre y no se saca.
 */
export const ATTACHMENT_KINDS = [
  "finding_doc",
  "measure_evidence",
  "action",
  "audit_evidence",
  "audit_report",
  "inspection",
  "calibration",
  "training",
] as const;

export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export function isAttachmentKind(value: string): value is AttachmentKind {
  return (ATTACHMENT_KINDS as readonly string[]).includes(value);
}

export type AttachmentActor = {
  userId: string;
  /** Puede cargar archivos (rol de escritura). */
  canWrite: boolean;
  /** Administra los registros de su empresa (responsable de proceso o administrador). */
  canManage: boolean;
  isPlatformSuperuser: boolean;
};

/** ¿Esta persona puede quitar este archivo? No mira el estado del registro: eso lo dice `attachmentLock`. */
export function canRemoveAttachment(actor: AttachmentActor, uploadedById: string | null | undefined): boolean {
  if (actor.isPlatformSuperuser || actor.canManage) return true;
  return actor.canWrite && Boolean(uploadedById) && uploadedById === actor.userId;
}

/** Estado del registro al que está adjunto el archivo; solo los campos que el tipo necesita. */
export type AttachmentParentState = {
  /** Hallazgo, acción, auditoría, inspección o calibración. */
  status?: string | null;
  /** Medida del hallazgo (para la evidencia de cierre). */
  measureStatus?: string | null;
  /** Capacitación o registro anulado. */
  voided?: boolean;
};

const CLOSED: Record<AttachmentKind, readonly string[]> = {
  finding_doc: ["closed", "cancelled"],
  measure_evidence: ["cancelled"],
  action: ["completed", "cancelled"],
  audit_evidence: ["closed", "cancelled"],
  audit_report: ["closed", "cancelled"],
  inspection: ["closed"],
  calibration: ["closed", "voided"],
  training: [],
};

const LOCK_MESSAGES: Record<AttachmentKind, string> = {
  finding_doc: "El hallazgo está cerrado o anulado: sus archivos quedan como respaldo.",
  measure_evidence: "La medida está cerrada: esta evidencia respalda su cierre.",
  action: "La acción está completada o anulada: su evidencia respalda ese cierre.",
  audit_evidence: "La auditoría está cerrada o cancelada: sus archivos quedan como respaldo.",
  audit_report: "La auditoría está cerrada o cancelada: sus archivos quedan como respaldo.",
  inspection: "La inspección está cerrada: sus fotos quedan como respaldo.",
  calibration: "La calibración está cerrada o anulada: sus archivos quedan como respaldo.",
  training: "La capacitación está anulada: sus archivos quedan como respaldo.",
};

/** Por qué NO se puede quitar el archivo (texto para el usuario), o null si se puede. */
export function attachmentLock(kind: AttachmentKind, parent: AttachmentParentState): string | null {
  const locked =
    parent.voided ||
    (kind === "measure_evidence" && parent.measureStatus === "closed") ||
    Boolean(parent.status && CLOSED[kind].includes(parent.status));
  return locked ? LOCK_MESSAGES[kind] : null;
}

/** ¿Corresponde mostrar «Quitar»? Junta quién es la persona y el estado del registro. */
export function canOfferRemoval(
  actor: AttachmentActor,
  kind: AttachmentKind,
  uploadedById: string | null | undefined,
  parent: AttachmentParentState,
): boolean {
  return canRemoveAttachment(actor, uploadedById) && attachmentLock(kind, parent) === null;
}
