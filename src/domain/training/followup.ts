/**
 * Avisos y eficacia de las capacitaciones (SPEC-training, 20.5). Funciones puras: no leen la base ni el reloj.
 */
import { minIso, type IsoDate } from "./dates";
import type { EffectivenessValue } from "./types";

/** Lo que pesa sobre una persona, agregado en la base: una fila por persona, no una por celda de la matriz. */
export type PersonDueSummary = {
  personId: string;
  name: string;
  siteId: string | null;
  /** Primer día en que la persona deja de cumplir algo obligatorio (`null` = nada con fecha). */
  nextDueAt: IsoDate | null;
  expired: number;
  missing: number;
  inGrace: number;
  expiring: number;
  /** Días de aviso previo: el más chico entre los cursos que cuentan. */
  leadDays: number;
};

/** El aviso abierto tal como está en la base, con la fecha ya pasada a `YYYY-MM-DD`. */
export type ExistingTrainingDueItem = {
  title: string;
  dueAt: IsoDate;
  leadDays: number;
  ownerUserId: string | null;
  siteId: string | null;
};

export type DueSyncPlan =
  | { action: "noop" }
  | { action: "close" }
  | {
      action: "create" | "update";
      title: string;
      dueAt: IsoDate;
      leadDays: number;
      ownerUserId: string | null;
      siteId: string | null;
    };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function formatDate(iso: IsoDate): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** «Juan Pérez: 1 vencida, 2 por vencer». Si no hay nada que contar, el próximo vencimiento. */
export function describeTrainingCounts(s: PersonDueSummary): string {
  const parts = [
    s.expired > 0 ? plural(s.expired, "vencida", "vencidas") : null,
    s.missing > 0 ? plural(s.missing, "faltante", "faltantes") : null,
    s.inGrace > 0 ? `${s.inGrace} en plazo` : null,
    s.expiring > 0 ? `${s.expiring} por vencer` : null,
  ].filter((p): p is string => p !== null);
  if (parts.length > 0) return `${s.name}: ${parts.join(", ")}`;
  return s.nextDueAt ? `${s.name}: capacitaciones al día hasta el ${formatDate(s.nextDueAt)}` : `${s.name}: capacitaciones al día`;
}

/**
 * Qué hacer con el aviso abierto de una persona (uno por persona, no uno por curso):
 * crearlo, actualizarlo, cerrarlo si ya no queda nada pendiente, o dejarlo como está.
 */
export function planDueItemSync(
  summary: PersonDueSummary,
  existing: ExistingTrainingDueItem | null,
  ownerUserId: string | null,
): DueSyncPlan {
  if (!summary.nextDueAt) return existing ? { action: "close" } : { action: "noop" };

  const next = {
    title: describeTrainingCounts(summary),
    dueAt: summary.nextDueAt,
    leadDays: summary.leadDays,
    ownerUserId,
    siteId: summary.siteId,
  };
  if (!existing) return { action: "create", ...next };

  const same =
    existing.title === next.title &&
    existing.dueAt === next.dueAt &&
    existing.leadDays === next.leadDays &&
    existing.ownerUserId === next.ownerUserId &&
    existing.siteId === next.siteId;
  return same ? { action: "noop" } : { action: "update", ...next };
}

// ─── Eficacia ──────────────────────────────────────────────────────────────

export type EvaluationStatus = Extract<EffectivenessValue, "effective" | "partially_effective" | "not_effective">;
export type EvaluationMethod = "observation" | "practical_test" | "written_test" | "indicator" | "supervisor_review";

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  effective: "Eficaz",
  partially_effective: "Parcialmente eficaz",
  not_effective: "No eficaz",
};

export const EVALUATION_METHOD_LABELS: Record<EvaluationMethod, string> = {
  observation: "Observación en el puesto",
  practical_test: "Prueba práctica",
  written_test: "Prueba escrita",
  indicator: "Indicador de desempeño",
  supervisor_review: "Revisión del supervisor",
};

/** Errores para mostrarle al evaluador (vacío = válida). */
export function validateEvaluation(input: {
  status: EvaluationStatus;
  method: EvaluationMethod | null;
  note: string;
}): string[] {
  const errors: string[] = [];
  if (!input.method) errors.push("Elegí cómo se evaluó la eficacia");
  if (input.status === "not_effective" && input.note.trim().length < 3) {
    errors.push("Contá qué se observó para decidir que no fue eficaz");
  }
  if (input.status === "partially_effective" && input.note.trim().length < 3) {
    errors.push("Contá qué faltó para que fuera plenamente eficaz");
  }
  return errors;
}

/** Un «no eficaz» obliga a crear una acción o a reprogramar la evaluación (SPEC, «Avisos y eficacia»). */
export function evaluationNeedsResolution(statuses: readonly EffectivenessValue[]): boolean {
  return statuses.includes("not_effective");
}

/** Fecha del próximo aviso de eficacia de una sesión: la más próxima entre las evaluaciones pendientes. */
export function nextEffectivenessDue(pendingDueDates: readonly IsoDate[]): IsoDate | null {
  return minIso(pendingDueDates);
}
