import { addMonthsClamped } from "./dates";
import type { EvaluationResultValue, SupplierCriticalityValue } from "./types";

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
