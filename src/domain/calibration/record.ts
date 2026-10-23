import { addMonths, isIsoDate } from "@/domain/inspections/dates";
import { calibrationDecision } from "./decision";
import type { Channel, Decision, DecisionRule, IncompleteReason, LabStatement, PointInput, Result } from "./types";

export type EvaluateInput = {
  rule: DecisionRule;
  criticalUse: boolean;
  channels: Channel[];
  /** ¿Se ajustó el equipo? Con ajuste hay dos juegos de puntos: antes (as-found) y después (as-left). */
  adjusted: boolean;
  /** Sin ajuste, son los únicos puntos. Con ajuste, son los medidos antes de ajustar (pueden faltar). */
  asFoundPoints: PointInput[];
  asLeftPoints?: PointInput[];
  labStatement?: LabStatement | null;
};

export type EvaluatedRecord = {
  /** Se puede cerrar el registro. */
  complete: boolean;
  asFoundResult: Result | "not_evaluated" | null;
  asLeftResult: Result | null;
  asFound: Decision | null;
  asLeft: Decision;
  incompleteReasons: IncompleteReason[];
  /** Se ajustó pero no hay datos de antes: no se puede saber si estuvo fuera de tolerancia. */
  missingAsFound: boolean;
};

/**
 * Evalúa un registro. El as-left decide si el equipo vuelve a servir; el as-found, si hay impacto en el pasado.
 * Con ajuste y sin as-found, el as-found queda «no evaluado».
 */
export function evaluateRecord(input: EvaluateInput): EvaluatedRecord {
  const common = { rule: input.rule, criticalUse: input.criticalUse, channels: input.channels, labStatement: input.labStatement };

  // La declaración del laboratorio es una sola: no distingue antes y después del ajuste.
  if (!input.adjusted || input.rule === "certificate_statement") {
    const decision = calibrationDecision({ ...common, points: input.asFoundPoints });
    const result = decision.result === "incomplete" ? null : decision.result;
    return {
      complete: result !== null,
      asFoundResult: result,
      asLeftResult: result,
      asFound: decision,
      asLeft: decision,
      incompleteReasons: decision.incompleteReasons,
      missingAsFound: false,
    };
  }

  const asLeft = calibrationDecision({ ...common, points: input.asLeftPoints ?? [] });
  const hasAsFound = input.asFoundPoints.length > 0;
  const asFound = hasAsFound ? calibrationDecision({ ...common, points: input.asFoundPoints }) : null;
  const asFoundIncomplete = asFound?.result === "incomplete";
  const asLeftResult = asLeft.result === "incomplete" ? null : asLeft.result;
  const asFoundResult = asFound === null ? ("not_evaluated" as const) : asFound.result === "incomplete" ? null : asFound.result;
  return {
    complete: asLeftResult !== null && !asFoundIncomplete,
    asFoundResult,
    asLeftResult,
    asFound,
    asLeft,
    incompleteReasons: [...asLeft.incompleteReasons.map((r) => ({ ...r, message: `Después del ajuste: ${r.message}` })), ...(asFound?.incompleteReasons ?? []).map((r) => ({ ...r, message: `Antes del ajuste: ${r.message}` }))],
    missingAsFound: asFound === null,
  };
}

export type ImpactTrigger = "as_found_not_apt" | "adjusted_without_as_found" | "functional_check_failed";

export type ImpactRequirement =
  | { required: false }
  | { required: true; trigger: ImpactTrigger; windowFrom: string | null; windowTo: string };

/**
 * Cuándo hay que evaluar el impacto de una medición pasada: el as-found fuera de tolerancia, o un equipo de uso
 * crítico ajustado sin datos de antes. La ventana va de la última comprobación apta (o nula: desde que se usa) a la fecha del registro.
 */
export function assessmentRequired(input: {
  asFoundResult: Result | "not_evaluated" | null;
  adjusted: boolean;
  criticalUse: boolean;
  previousAptDate: string | null;
  performedAt: string;
}): ImpactRequirement {
  const window = { windowFrom: input.previousAptDate, windowTo: input.performedAt };
  if (input.asFoundResult === "not_apt") return { required: true, trigger: "as_found_not_apt", ...window };
  if (input.adjusted && input.asFoundResult === "not_evaluated" && input.criticalUse) {
    return { required: true, trigger: "adjusted_without_as_found", ...window };
  }
  return { required: false };
}

/** Fecha de la próxima calibración o verificación: meses de calendario desde la fecha de ejecución. Sin intervalo, `null`. */
export function nextCalibrationDue(input: { performedAt: string; intervalMonths: number | null | undefined }): string | null {
  if (!input.intervalMonths || input.intervalMonths <= 0 || !isIsoDate(input.performedAt)) return null;
  return addMonths(input.performedAt, input.intervalMonths);
}

/** Último día en que el equipo se puede usar (inclusive). Un resultado no apto no da vigencia. */
export function validUntil(input: { performedAt: string; intervalMonths: number | null | undefined; asLeftResult: Result }): string | null {
  return input.asLeftResult === "apt" ? nextCalibrationDue(input) : null;
}
