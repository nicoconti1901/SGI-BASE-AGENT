import { addDays, addMonthsClamped } from "./dates";
import type { EvaluationResultValue, SupplierCriticalityValue, SupplierStatusValue } from "./types";

/** Días por defecto para hacer la evaluación inicial desde el alta (editable por empresa). */
export const DEFAULT_INITIAL_EVAL_DAYS = 30;

/**
 * Vencimiento de la evaluación inicial pendiente: alta + N días, solo para críticos que todavía no tienen
 * ninguna evaluación vigente. Estándar y bajo impacto no esperan nada (se evalúan cuando se necesita); de baja o ya evaluado, tampoco.
 * `createdDay` es el día de calendario del alta (medianoche UTC).
 */
export function initialEvaluationDue(input: {
  status: SupplierStatusValue;
  criticality: SupplierCriticalityValue;
  createdDay: Date;
  initialEvalDays: number;
}): Date | null {
  if (input.status !== "potential" || input.criticality !== "critical") return null;
  return addDays(input.createdDay, Math.max(0, input.initialEvalDays));
}

export type ReevaluationSignals = {
  /** Hallazgos del proveedor abiertos y detectados después de la última evaluación. */
  openFindingsSinceLast: number;
  /** El plan de mejora de una evaluación «con condiciones» ya está cerrado: toca comprobar si se cumplió. */
  planClosed: boolean;
  /** Hay un documento bloqueante vencido o faltante. */
  blockingDocsIssue: boolean;
};

/** Motivos, en lenguaje llano, por los que conviene una reevaluación por evento ya (lista vacía = ninguno). */
export function eventReevaluationReasons(signals: ReevaluationSignals): string[] {
  const reasons: string[] = [];
  if (signals.openFindingsSinceLast > 0) {
    reasons.push(
      signals.openFindingsSinceLast === 1
        ? "Hay un hallazgo abierto desde la última evaluación."
        : `Hay ${signals.openFindingsSinceLast} hallazgos abiertos desde la última evaluación.`,
    );
  }
  if (signals.planClosed) reasons.push("El plan de mejora ya está cerrado: reevaluar confirma si el proveedor cumplió.");
  if (signals.blockingDocsIssue) reasons.push("Tiene documentación obligatoria vencida o faltante.");
  return reasons;
}

/** Meses entre reevaluaciones; null = sin periodicidad. Configurable por empresa. */
export type ReevaluationConfig = {
  critical: number | null;
  standard: number | null;
  conditional: number | null;
};

export const DEFAULT_REEVALUATION: ReevaluationConfig = { critical: 12, standard: 24, conditional: 6 };

/**
 * Próxima reevaluación: crítico 12 m, estándar 24 m, condicional 6 m (el menor de los que apliquen),
 * bajo impacto y no aprobado ninguna. Devuelve null si no corresponde.
 */
export function nextEvaluationDue(
  lastEvaluatedAt: Date,
  criticality: SupplierCriticalityValue,
  result: EvaluationResultValue,
  config: Partial<ReevaluationConfig> = {},
): Date | null {
  if (result === "not_approved") return null;
  const cfg = { ...DEFAULT_REEVALUATION, ...config };
  const candidates: number[] = [];
  if (criticality === "critical" && cfg.critical !== null) candidates.push(cfg.critical);
  if (criticality === "standard" && cfg.standard !== null) candidates.push(cfg.standard);
  if (result === "conditional" && cfg.conditional !== null) candidates.push(cfg.conditional);
  if (candidates.length === 0) return null;
  return addMonthsClamped(lastEvaluatedAt, Math.min(...candidates));
}
