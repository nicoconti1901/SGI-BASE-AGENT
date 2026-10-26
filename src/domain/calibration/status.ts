import { addDays, diffDays, formatDateEs } from "@/domain/inspections/dates";
import type { RecordKind, Result } from "./types";

export const INSTRUMENT_STATUSES = ["valid", "due_soon", "expired", "not_apt", "in_calibration", "never_calibrated", "impact_pending", "not_required"] as const;
export type InstrumentStatus = (typeof INSTRUMENT_STATUSES)[number];

export const STATUS_LABELS: Record<InstrumentStatus, string> = {
  valid: "Vigente",
  due_soon: "Por vencer",
  expired: "Vencido",
  not_apt: "No apto",
  in_calibration: "En calibración",
  never_calibrated: "Sin calibración inicial",
  impact_pending: "Evaluación de impacto pendiente",
  not_required: "Sin control metrológico",
};

/** Los ocho estados se agrupan en pocos colores en pantalla. */
export type StatusTone = "ok" | "warning" | "danger" | "info" | "neutral";
export const STATUS_TONES: Record<InstrumentStatus, StatusTone> = {
  valid: "ok",
  due_soon: "warning",
  expired: "danger",
  not_apt: "danger",
  never_calibrated: "danger",
  impact_pending: "danger",
  in_calibration: "info",
  not_required: "neutral",
};

/** Los contadores clicables de la lista: cada estado cae en un solo grupo. */
export const STATUS_GROUPS = {
  valid: ["valid"],
  due_soon: ["due_soon"],
  /** «No usar»: vencidos, no aptos y sin calibración inicial. */
  unusable: ["expired", "not_apt", "never_calibrated"],
  in_calibration: ["in_calibration"],
  impact_pending: ["impact_pending"],
  not_required: ["not_required"],
} as const satisfies Record<string, readonly InstrumentStatus[]>;
export type StatusGroup = keyof typeof STATUS_GROUPS;

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  valid: "Vigentes",
  due_soon: "Por vencer",
  unusable: "No usar",
  in_calibration: "En calibración",
  impact_pending: "Evaluaciones pendientes",
  not_required: "Sin control",
};

export function isStatusGroup(value: string | undefined): value is StatusGroup {
  return value !== undefined && Object.hasOwn(STATUS_GROUPS, value);
}

export type StatusInput = {
  /** Hoy en la hora de la empresa (AAAA-MM-DD). */
  today: string;
  requirements: { calibration: boolean; verification: boolean };
  /** Último día de vigencia de la última calibración (o verificación) apta; `null` si no hay ninguna. */
  validity: { calibrationValidUntil: string | null; verificationValidUntil: string | null };
  hold: {
    /** Resultado del último registro cerrado y no anulado. */
    lastDecision: Result | null;
    impactPending: boolean;
    inCalibrationSince: string | null;
  };
  /** Días de aviso previo. */
  leadDays: number;
};

export type StatusOutput = {
  /** El primero que aplica según la precedencia. */
  status: InstrumentStatus;
  /** Todos los motivos que aplican, en orden de precedencia. */
  reasons: InstrumentStatus[];
  /** Vencimiento más próximo entre lo que se exige. */
  nextDueAt: string | null;
  dueKind: RecordKind | null;
};

/**
 * Estado derivado del equipo; nadie lo edita. Precedencia:
 * en calibración → no apto → evaluación pendiente → sin calibración inicial → vencido → por vencer → vigente.
 * El equipo es utilizable todo el día de su vencimiento y vencido desde el día siguiente.
 */
export function calibrationStatus(input: StatusInput): StatusOutput {
  const { requirements, validity, hold } = input;
  if (!requirements.calibration && !requirements.verification) {
    return { status: "not_required", reasons: ["not_required"], nextDueAt: null, dueKind: null };
  }
  const required: { kind: RecordKind; until: string | null }[] = [];
  if (requirements.calibration) required.push({ kind: "calibration", until: validity.calibrationValidUntil });
  if (requirements.verification) required.push({ kind: "verification", until: validity.verificationValidUntil });

  const dated = required.filter((r): r is { kind: RecordKind; until: string } => r.until !== null).sort((a, b) => a.until.localeCompare(b.until));
  const nextDueAt = dated[0]?.until ?? null;
  const dueKind = dated[0]?.kind ?? null;

  const reasons: InstrumentStatus[] = [];
  if (hold.inCalibrationSince) reasons.push("in_calibration");
  if (hold.lastDecision === "not_apt") reasons.push("not_apt");
  if (hold.impactPending) reasons.push("impact_pending");
  if (required.some((r) => r.until === null)) reasons.push("never_calibrated");
  if (nextDueAt !== null) {
    if (input.today > nextDueAt) reasons.push("expired");
    else if (input.today >= addDays(nextDueAt, -Math.max(input.leadDays, 0))) reasons.push("due_soon");
  }
  if (reasons.length === 0) reasons.push("valid");
  return { status: reasons[0], reasons, nextDueAt, dueKind };
}

export type Usability = { usable: boolean; reason: string | null; action: string | null };

const KIND_NOUN: Record<RecordKind, string> = { calibration: "calibración", verification: "verificación" };

/** ¿Se puede usar hoy? Compone el estado metrológico con el estado del activo (en servicio, fuera de servicio, baja). */
export function instrumentUsability(input: {
  assetStatus: "in_service" | "out_of_service" | "retired";
  status: InstrumentStatus;
  nextDueAt?: string | null;
  dueKind?: RecordKind | null;
  expectedReturnAt?: string | null;
}): Usability {
  if (input.assetStatus === "retired") return { usable: false, reason: "El equipo está dado de baja", action: null };
  if (input.assetStatus === "out_of_service") {
    return { usable: false, reason: "El equipo está fuera de servicio", action: "Repetir la prueba funcional: si es apta y la cierra un responsable de proceso, vuelve a servicio" };
  }
  const noun = KIND_NOUN[input.dueKind ?? "calibration"];
  switch (input.status) {
    case "valid":
    case "due_soon":
    case "not_required":
      return { usable: true, reason: null, action: null };
    case "in_calibration":
      return {
        usable: false,
        reason: input.expectedReturnAt ? `En calibración, regreso estimado ${formatDateEs(input.expectedReturnAt)}` : "En calibración",
        action: "Esperar el regreso del laboratorio",
      };
    case "not_apt":
      return { usable: false, reason: "No apto en el último control", action: "Calibrar o reparar el equipo" };
    case "impact_pending":
      return { usable: false, reason: "Falta la evaluación de impacto de la última calibración", action: "Completar la evaluación de impacto" };
    case "never_calibrated":
      return { usable: false, reason: "Sin calibración inicial", action: "Cargar la calibración inicial" };
    case "expired":
      return {
        usable: false,
        reason: input.nextDueAt ? `${capitalize(noun)} vencida el ${formatDateEs(input.nextDueAt)}` : `${capitalize(noun)} vencida`,
        action: `Cargar la nueva ${noun}`,
      };
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Días hasta el vencimiento (negativo: ya venció). */
export function daysToDue(today: string, nextDueAt: string | null): number | null {
  return nextDueAt ? diffDays(today, nextDueAt) : null;
}

export type RecordSummary = {
  kind: RecordKind;
  status: "draft" | "closed" | "voided";
  performedAt: string;
  closedAt: string | null;
  asLeftResult: Result | null;
  validUntil: string | null;
};

/** ¿Estaba el equipo vigente en esa fecha? Sirve a los módulos que cargan una medición con fecha pasada. */
export function wasInstrumentValidOn(records: readonly RecordSummary[], date: string): boolean {
  return records.some((r) => r.status === "closed" && r.asLeftResult === "apt" && r.performedAt <= date && r.validUntil !== null && date <= r.validUntil);
}

export type DerivedControl = {
  calibrationValidUntil: string | null;
  verificationValidUntil: string | null;
  nextDueAt: string | null;
  lastDecision: Result | null;
  impactPending: boolean;
  inCalibrationSince: string | null;
  expectedReturnAt: string | null;
};

/**
 * Columnas derivadas de `InstrumentControl`. Se reconstruyen siempre desde los registros cerrados y no anulados,
 * los envíos abiertos y las evaluaciones pendientes; por eso recalcular dos veces da lo mismo.
 */
export function deriveControl(input: {
  requirements: { calibration: boolean; verification: boolean };
  records: readonly RecordSummary[];
  pendingAssessments: number;
  openShipment: { sentAt: string; expectedReturnAt: string | null } | null;
}): DerivedControl {
  const closed = input.records.filter((r) => r.status === "closed");
  const order = (a: RecordSummary, b: RecordSummary) => a.performedAt.localeCompare(b.performedAt) || (a.closedAt ?? "").localeCompare(b.closedAt ?? "");
  const latest = [...closed].sort(order).at(-1) ?? null;
  const latestApt = (kind: RecordKind) =>
    [...closed]
      .filter((r) => r.kind === kind && r.asLeftResult === "apt")
      .sort(order)
      .at(-1) ?? null;
  const calibrationValidUntil = latestApt("calibration")?.validUntil ?? null;
  const verificationValidUntil = latestApt("verification")?.validUntil ?? null;
  const dates = [input.requirements.calibration ? calibrationValidUntil : null, input.requirements.verification ? verificationValidUntil : null].filter(
    (d): d is string => d !== null,
  );
  return {
    calibrationValidUntil,
    verificationValidUntil,
    nextDueAt: dates.length > 0 ? dates.sort()[0] : null,
    lastDecision: latest?.asLeftResult ?? null,
    impactPending: input.pendingAssessments > 0,
    inCalibrationSince: input.openShipment?.sentAt ?? null,
    expectedReturnAt: input.openShipment?.expectedReturnAt ?? null,
  };
}
