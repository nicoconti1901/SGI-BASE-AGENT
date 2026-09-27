import {
  FINDING_STATUS_LABELS,
  type FindingStatus,
  type FindingType,
  type MeasureWorkflowStatus,
} from "@/domain/findings/types";

/**
 * Ciclo de vida del hallazgo — SPEC-findings-lifecycle.md (§10.2 y guía
 * ISO/TC 176 APG): cerrar exige eficacia verificada en NC e incidentes.
 */

export const VERIFICATION_WAIT_DAYS = 30;
export const FINDING_VERIFICATION_ENTITY_TYPE = "finding_verification";

export type VerificationResult = "effective" | "not_effective";

export const VERIFICATION_RESULT_LABELS: Record<VerificationResult, string> = {
  effective: "Eficaz",
  not_effective: "No eficaz",
};

/** P1: NC e incidente se cierran solo con eficacia verificada. */
export function requiresEffectivenessVerification(type: FindingType): boolean {
  return type === "nonconformity" || type === "incident";
}

/** Transiciones explícitas (las derivadas de las medidas se calculan aparte). */
const EXPLICIT: Record<"verify" | "cancel" | "reopen", FindingStatus[]> = {
  verify: ["verification"],
  cancel: ["draft", "published", "in_progress", "verification"],
  reopen: ["closed"],
};

export function canApplyFindingAction(
  action: keyof typeof EXPLICIT,
  status: FindingStatus,
): boolean {
  return EXPLICIT[action].includes(status);
}

export function assertCanApplyFindingAction(
  action: keyof typeof EXPLICIT,
  status: FindingStatus,
): void {
  if (!canApplyFindingAction(action, status)) {
    const verb = { verify: "verificar", cancel: "anular", reopen: "reabrir" }[action];
    throw new Error(`No se puede ${verb} un hallazgo en estado "${FINDING_STATUS_LABELS[status]}"`);
  }
}

export type MeasureSnapshot = {
  status: MeasureWorkflowStatus;
  kind: "corrective" | "preventive";
  createdAt: Date;
};

/**
 * Tras un reproceso (verificación no eficaz o reapertura) hace falta una
 * medida correctiva nueva antes de volver a verificar (R6, R8).
 */
export function needsNewCorrectiveMeasure(input: {
  reworkSince: Date | null;
  measures: MeasureSnapshot[];
}): boolean {
  if (!input.reworkSince) return false;
  const since = input.reworkSince;
  return !input.measures.some((m) => m.kind === "corrective" && m.createdAt > since);
}

/**
 * Estado que corresponde después de iniciar, cerrar o agregar medidas (R2, R3).
 * Solo actúa sobre hallazgos publicados o en curso.
 */
export function deriveStatusFromMeasures(input: {
  status: FindingStatus;
  type: FindingType;
  reworkSince: Date | null;
  measures: MeasureSnapshot[];
}): FindingStatus {
  if (input.status !== "published" && input.status !== "in_progress") return input.status;
  const { measures } = input;
  const started = measures.some((m) => m.status !== "open");
  const allClosed = measures.length > 0 && measures.every((m) => m.status === "closed");

  if (allClosed && !needsNewCorrectiveMeasure(input)) {
    return requiresEffectivenessVerification(input.type) ? "verification" : "closed";
  }
  if (started || input.status === "in_progress") return "in_progress";
  return "published";
}

export function defaultVerificationDueAt(from: Date): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + VERIFICATION_WAIT_DAYS);
  return due;
}

/** P3: el verificador no puede ser el único responsable de todas las medidas. */
export function verifierIsSoleOwner(verifierUserId: string, measureOwnerIds: string[]): boolean {
  return measureOwnerIds.length > 0 && measureOwnerIds.every((id) => id === verifierUserId);
}

/** Qué falta para registrar una verificación de eficacia (R4, P2, P3). Lista vacía = OK. */
export function verificationIssues(input: {
  status: FindingStatus;
  result: VerificationResult | null;
  evidence: string;
  verifierUserId: string;
  measureOwnerIds: string[];
  independenceException: string | null;
  verificationDueAt: Date | null;
  now: Date;
  earlyReason: string | null;
}): string[] {
  if (input.status !== "verification") {
    return ["El hallazgo no está en verificación de eficacia"];
  }
  const issues: string[] = [];
  if (!input.result) issues.push("Elegí si las acciones fueron eficaces");
  if (!input.evidence.trim()) {
    issues.push("Describí la evidencia de eficacia (qué revisaste y qué encontraste)");
  }
  if (
    verifierIsSoleOwner(input.verifierUserId, input.measureOwnerIds) &&
    !input.independenceException?.trim()
  ) {
    issues.push(
      "Sos responsable de todas las medidas: la eficacia la debería verificar otra persona, o justificá la excepción",
    );
  }
  if (
    input.verificationDueAt &&
    input.now < input.verificationDueAt &&
    !input.earlyReason?.trim()
  ) {
    issues.push("La verificación está programada para más adelante: indicá por qué se adelanta");
  }
  return issues;
}

export function reasonIssues(reason: string | null | undefined, action: "cancel" | "reopen"): string[] {
  if (reason?.trim()) return [];
  return [
    action === "cancel"
      ? "Indicá el motivo de la anulación"
      : "Indicá el motivo de la reapertura (p. ej. el problema volvió a ocurrir)",
  ];
}

/** "Qué falta" para la ficha, según el estado. */
export function pendingSteps(input: {
  status: FindingStatus;
  type: FindingType;
  reworkSince: Date | null;
  measures: (MeasureSnapshot & { dueAt: Date | null })[];
  verificationDueAt: Date | null;
  now: Date;
}): string[] {
  const { status, measures } = input;
  if (status === "published" || status === "in_progress") {
    const steps: string[] = [];
    if (needsNewCorrectiveMeasure(input)) {
      steps.push("Agregá una nueva medida correctiva: la anterior no resolvió el problema");
    }
    const open = measures.filter((m) => m.status !== "closed");
    const overdue = open.filter((m) => m.dueAt && m.dueAt < input.now).length;
    if (open.length > 0) {
      steps.push(
        `${open.length === 1 ? "Falta cerrar 1 medida" : `Faltan cerrar ${open.length} medidas`}${
          overdue ? ` (${overdue} vencida${overdue > 1 ? "s" : ""})` : ""
        }, con evidencia`,
      );
    }
    if (requiresEffectivenessVerification(input.type)) {
      steps.push("Después: verificar la eficacia de las acciones");
    }
    return steps;
  }
  if (status === "verification") {
    return ["Verificar la eficacia: comprobar que el problema no volvió a ocurrir"];
  }
  return [];
}
