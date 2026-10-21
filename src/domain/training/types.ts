import type { IsoDate } from "./dates";

export type TrainingStatus = "valid" | "expiring" | "expired" | "missing" | "in_grace" | "not_required";

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  valid: "Vigente",
  expiring: "Por vencer",
  expired: "Vencida",
  missing: "Falta",
  in_grace: "En plazo",
  not_required: "No se exige",
};

export type TargetKind = "position" | "task" | "all";

export const TARGET_KIND_LABELS: Record<TargetKind, string> = {
  position: "Puesto",
  task: "Tarea",
  all: "Todo el personal",
};

export type TrainingResultValue = "passed" | "failed";

/** Misma enumeración que `EffectivenessStatus` de Prisma. */
export type EffectivenessValue =
  | "pending"
  | "effective"
  | "partially_effective"
  | "not_effective"
  | "not_applicable";

/** La persona tal como la necesita el cálculo (sin tocar la base). */
export type TrainingPerson = {
  id: string;
  active: boolean;
  /** Ingreso a la empresa. */
  hiredAt: IsoDate | null;
  positionId: string;
  /** Desde cuándo está en el puesto actual (`null` = desde el ingreso). */
  positionSince: IsoDate | null;
  /** `assignedAt` nulo = no se conoce la fecha de asignación. */
  tasks: { jobTaskId: string; assignedAt: IsoDate | null }[];
};

/** Una fila de la matriz de requisitos, con el `reminderDays` de su curso. */
export type TrainingRequirement = {
  courseId: string;
  targetKind: TargetKind;
  positionId: string | null;
  jobTaskId: string | null;
  mandatory: boolean;
  graceDays: number;
  effectiveFrom: IsoDate;
  reminderDays: number;
};

/** Registro de una persona en un curso. `voided`: anulado, no cuenta para nada. */
export type TrainingRecordInput = {
  courseId: string;
  completedAt: IsoDate;
  result: TrainingResultValue;
  /** Foto del vencimiento (`null` = no vence). */
  validUntil: IsoDate | null;
  voided: boolean;
  effectiveness?: EffectivenessValue | null;
};

export type ResolvedRequirement = {
  courseId: string;
  /** Alguna de las fuentes es obligatoria. */
  mandatory: boolean;
  /** El plazo de gracia más estricto entre las fuentes obligatorias (`null` si ninguna lo es). */
  graceEnd: IsoDate | null;
  reminderDays: number;
};

export type EffectivenessOutcome = "pending" | "effective" | "partially_effective" | "not_effective" | "n/a";

export type CourseStatus = {
  courseId: string;
  status: TrainingStatus;
  mandatory: boolean;
  validUntil: IsoDate | null;
  /** Solo si hay un registro vigente con vencimiento. */
  daysToExpiry: number | null;
  detail: "failed" | null;
  effectiveness: EffectivenessOutcome | null;
};

export type TaskQualificationBlocker = {
  courseId: string;
  reason: "missing" | "expired" | "in_grace" | "ineffective";
};

export type TaskQualification = {
  qualified: boolean;
  /** `false` = la tarea no tiene cursos obligatorios (el consumidor lo muestra como "sin requisitos"). */
  hasRequirements: boolean;
  /** La tarea figura entre las de la persona. */
  assigned: boolean;
  blockers: TaskQualificationBlocker[];
  /** Habilitado, pero con cursos por vencer. */
  expiring: { courseId: string; daysToExpiry: number }[];
};

export type ComplianceSummary = {
  /** `null` si no hay nada obligatorio que medir. */
  percent: number | null;
  valid: number;
  expiring: number;
  expired: number;
  missing: number;
  inGrace: number;
  /** Cursos obligatorios medidos (vigentes + por vencer + vencidos + faltantes + en plazo). */
  total: number;
};
