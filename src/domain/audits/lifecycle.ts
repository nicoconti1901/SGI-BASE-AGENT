import {
  AUDIT_REPORT_GRACE_DAYS,
  AUDIT_STATUS_LABELS,
  FINDING_RESULTS,
  type AuditItemResult,
  type AuditStandard,
  type AuditStatus,
} from "@/domain/audits/types";

const TRANSITIONS: Record<AuditStatus, AuditStatus[]> = {
  planned: ["prepared", "cancelled"],
  prepared: ["planned", "in_progress", "cancelled"],
  in_progress: ["reporting", "cancelled"],
  reporting: ["in_progress", "closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export function canTransitionAudit(from: AuditStatus, to: AuditStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertCanTransitionAudit(from: AuditStatus, to: AuditStatus): void {
  if (!canTransitionAudit(from, to)) {
    throw new Error(
      `No se puede pasar de "${AUDIT_STATUS_LABELS[from]}" a "${AUDIT_STATUS_LABELS[to]}"`,
    );
  }
}

/** Integrantes que figuran a la vez en el equipo auditor y como auditados. */
export function impartialityConflicts(
  teamUserIds: string[],
  auditeeUserIds: (string | null)[],
): string[] {
  const auditees = new Set(auditeeUserIds.filter((id): id is string => Boolean(id)));
  return [...new Set(teamUserIds)].filter((id) => auditees.has(id));
}

export type AuditPlanInput = {
  objective: string;
  scope: string;
  standards: AuditStandard[];
  plannedStart: Date;
  plannedEnd: Date;
  team: { userId: string; role: "lead" | "auditor" }[];
  auditeeUserIds: (string | null)[];
  checklistCount: number;
  impartialityException: string | null;
};

/**
 * Qué falta para pasar a "preparada" (9001:2026 §9.2.2: objetivo, criterios y
 * alcance por auditoría; auditores objetivos e imparciales).
 * Lista vacía = listo.
 */
export function planReadinessIssues(plan: AuditPlanInput): string[] {
  const issues: string[] = [];
  if (!plan.objective.trim()) issues.push("Definí el objetivo de la auditoría");
  if (!plan.scope.trim()) issues.push("Definí el alcance (procesos, áreas, período)");
  if (plan.standards.length === 0) issues.push("Elegí al menos una norma");
  if (plan.plannedEnd < plan.plannedStart) {
    issues.push("La fecha de fin no puede ser anterior a la de inicio");
  }
  if (!plan.team.some((m) => m.role === "lead")) issues.push("Asigná un auditor líder");
  if (plan.checklistCount === 0) {
    issues.push("Agregá al menos un ítem a la lista de verificación");
  }
  const conflicts = impartialityConflicts(
    plan.team.map((m) => m.userId),
    plan.auditeeUserIds,
  );
  if (conflicts.length > 0 && !plan.impartialityException?.trim()) {
    issues.push(
      "Un auditor también figura como auditado: cambiá el equipo o justificá la excepción",
    );
  }
  return issues;
}

export function requiresEvidence(result: AuditItemResult): boolean {
  return FINDING_RESULTS.includes(result);
}

export function assertValidItemResult(input: {
  result: AuditItemResult;
  evidence: string | null | undefined;
}): void {
  if (requiresEvidence(input.result) && !input.evidence?.trim()) {
    throw new Error("Registrá la evidencia que respalda este hallazgo");
  }
}

/** Qué falta para pasar a "informe": checklist completo y hallazgos creados. */
export function executionReadinessIssues(
  items: { result: AuditItemResult; findingId: string | null }[],
): string[] {
  const issues: string[] = [];
  const pending = items.filter((i) => i.result === "pending").length;
  if (pending === 1) issues.push("Queda 1 ítem sin resultado");
  else if (pending > 1) issues.push(`Quedan ${pending} ítems sin resultado`);
  const missing = items.filter(
    (i) => requiresEvidence(i.result) && !i.findingId,
  ).length;
  if (missing === 1) issues.push("Falta generar 1 hallazgo");
  else if (missing > 1) issues.push(`Falta generar ${missing} hallazgos`);
  return issues;
}

/** Qué falta para cerrar: el informe responde al objetivo. */
export function closeReadinessIssues(report: { conclusion: string | null }): string[] {
  return report.conclusion?.trim()
    ? []
    : ["Escribí la conclusión del informe respecto del objetivo"];
}

/** Resultado del checklist → tipo y severidad del Hallazgo (SPEC-audits). */
export function findingFromItemResult(
  result: AuditItemResult,
): { type: "nonconformity" | "observation" | "opportunity"; severity: "major" | "minor" | null } | null {
  switch (result) {
    case "nc_major":
      return { type: "nonconformity", severity: "major" };
    case "nc_minor":
      return { type: "nonconformity", severity: "minor" };
    case "observation":
      return { type: "observation", severity: null };
    case "improvement":
      return { type: "opportunity", severity: null };
    default:
      return null;
  }
}

/** Fecha límite del informe: fin planificado + gracia. */
export function reportDueAt(plannedEnd: Date): Date {
  const due = new Date(plannedEnd);
  due.setDate(due.getDate() + AUDIT_REPORT_GRACE_DAYS);
  return due;
}

/** Código legible correlativo por año: AI-2026-03. */
export function auditCode(year: number, sequence: number): string {
  return `AI-${year}-${String(sequence).padStart(2, "0")}`;
}

/** Código de auditoría externa, correlativo por año: AE-2026-01. */
export function externalAuditCode(year: number, sequence: number): string {
  return `AE-${year}-${String(sequence).padStart(2, "0")}`;
}

export type CoverageRow = { standard: AuditStandard; total: number; covered: number };

/**
 * Cobertura del programa: un requisito cuenta como auditado si tiene un ítem
 * con resultado (≠ pendiente / no aplica) en una auditoría cerrada.
 */
export function computeCoverage(
  requirements: { id: string; standard: AuditStandard }[],
  auditedItems: { tenantRequirementId: string | null; result: AuditItemResult; auditClosed: boolean }[],
): CoverageRow[] {
  const covered = new Set(
    auditedItems
      .filter(
        (i) =>
          i.auditClosed &&
          i.tenantRequirementId &&
          i.result !== "pending" &&
          i.result !== "not_applicable",
      )
      .map((i) => i.tenantRequirementId as string),
  );
  const standards: AuditStandard[] = ["ISO9001", "ISO14001", "ISO45001"];
  return standards
    .map((standard) => {
      const reqs = requirements.filter((r) => r.standard === standard);
      return {
        standard,
        total: reqs.length,
        covered: reqs.filter((r) => covered.has(r.id)).length,
      };
    })
    .filter((row) => row.total > 0);
}

/** Iniciar antes de la fecha planificada exige motivo (SPEC-audits). */
export function startReadinessIssues(input: {
  plannedStart: Date;
  now: Date;
  reason: string | null | undefined;
}): string[] {
  const startDay = input.plannedStart.toISOString().slice(0, 10);
  const today = input.now.toISOString().slice(0, 10);
  if (startDay > today && !input.reason?.trim()) {
    return ["La auditoría está planificada para más adelante: indicá por qué se adelanta"];
  }
  return [];
}
