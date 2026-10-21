import type {
  EvaluationModeValue,
  EvaluationResultValue,
  ResultReasonValue,
  SupplierCriticalityValue,
  Thresholds,
} from "./types";

/** Cobertura mínima, en %, del peso aplicable que tiene que estar respondido. */
export const MIN_COVERAGE_PERCENT = 60;

export type ScoreItem = {
  name?: string;
  weight: number;
  /** Entero de 1 a 5, o null si no aplica (N/A). */
  score: number | null;
  excluding: boolean;
  allowNA: boolean;
  /** Entra en la evaluación simplificada. */
  basic: boolean;
};

export type ScoreError =
  | "INVALID_SCORE"
  | "NA_NOT_ALLOWED"
  | "INVALID_WEIGHT"
  | "NO_ITEMS"
  | "INSUFFICIENT_COVERAGE"
  | "SIMPLIFIED_NOT_ALLOWED"
  | "DECLARED_NOT_ALLOWED";

export const SCORE_ERROR_MESSAGES: Record<ScoreError | "INVALID_THRESHOLDS", string> = {
  INVALID_SCORE: "Cada nota tiene que ser un número entero de 1 a 5",
  NA_NOT_ALLOWED: "Hay un criterio que no admite «No aplica»",
  INVALID_WEIGHT: "Hay un criterio con un peso inválido",
  NO_ITEMS: "Falta responder al menos un criterio",
  INSUFFICIENT_COVERAGE: `Hay que responder al menos el ${MIN_COVERAGE_PERCENT} % del peso de los criterios`,
  SIMPLIFIED_NOT_ALLOWED: "La evaluación simplificada no se permite para proveedores críticos",
  DECLARED_NOT_ALLOWED: "La aceptación con motivo solo vale para proveedores de bajo impacto",
  INVALID_THRESHOLDS: "El umbral de «con condiciones» no puede superar al de «aprobado»",
};

export type ExcludingFailure = { index: number; name?: string; score: 1 | 2 };

export type ScoreOk = {
  ok: true;
  /** 20,0 a 100,0 con un decimal, truncado. Nulo en evaluaciones declaradas. */
  total: number | null;
  /** Peso de los criterios dentro del alcance del modo. */
  applicableWeight: number;
  /** Peso de los criterios respondidos (sin N/A). */
  answeredWeight: number;
  /** % del peso aplicable respondido, truncado a un decimal. Nulo si es declarada. */
  coverage: number | null;
  excludingFailures: ExcludingFailure[];
};

export type ScoreOutcome = ScoreOk | { ok: false; error: ScoreError; itemIndex?: number };

/** División entera sin pasar por coma flotante. */
const intDiv = (a: number, b: number) => (a - (a % b)) / b;

const isScore =(n: unknown): n is 1 | 2 | 3 | 4 | 5 => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;

/**
 * total = floor(Σ(peso × nota) × 200 / Σpeso_respondido) / 10, en aritmética entera.
 * Rango 20 a 100. Las N/A se reponderan; sin respuesta no hay puntaje.
 */
export function scoreEvaluation(
  items: readonly ScoreItem[],
  mode: EvaluationModeValue,
  criticality: SupplierCriticalityValue,
): ScoreOutcome {
  if (mode === "declared") {
    if (criticality !== "low") return { ok: false, error: "DECLARED_NOT_ALLOWED" };
    return { ok: true, total: null, applicableWeight: 0, answeredWeight: 0, coverage: null, excludingFailures: [] };
  }
  if (mode === "simplified" && criticality === "critical") return { ok: false, error: "SIMPLIFIED_NOT_ALLOWED" };

  const scoped = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => mode === "full" || item.basic || item.excluding);
  if (scoped.length === 0) return { ok: false, error: "NO_ITEMS" };

  let applicableWeight = 0;
  let answeredWeight = 0;
  let weighted = 0;
  const excludingFailures: ExcludingFailure[] = [];

  for (const { item, index } of scoped) {
    if (!Number.isInteger(item.weight) || item.weight <= 0) return { ok: false, error: "INVALID_WEIGHT", itemIndex: index };
    applicableWeight += item.weight;
    if (item.score === null) {
      if (!item.allowNA || item.excluding) return { ok: false, error: "NA_NOT_ALLOWED", itemIndex: index };
      continue;
    }
    if (!isScore(item.score)) return { ok: false, error: "INVALID_SCORE", itemIndex: index };
    answeredWeight += item.weight;
    weighted += item.weight * item.score;
    if (item.excluding && item.score <= 2) {
      excludingFailures.push({ index, ...(item.name ? { name: item.name } : {}), score: item.score as 1 | 2 });
    }
  }

  if (answeredWeight === 0) return { ok: false, error: "NO_ITEMS" };
  if (answeredWeight * 100 < MIN_COVERAGE_PERCENT * applicableWeight) return { ok: false, error: "INSUFFICIENT_COVERAGE" };

  return {
    ok: true,
    total: intDiv(weighted * 200, answeredWeight) / 10,
    applicableWeight,
    answeredWeight,
    coverage: intDiv(answeredWeight * 1000, applicableWeight) / 10,
    excludingFailures,
  };
}

const RANK: Record<EvaluationResultValue, number> = { not_approved: 0, conditional: 1, approved: 2 };

export type ResultOutcome =
  | { ok: true; result: EvaluationResultValue; reason: ResultReasonValue }
  | { ok: false; error: "INVALID_THRESHOLDS" };

/** Resultado por puntaje y luego el tope de los excluyentes (nota 1 = no aprobado; nota 2 = condicional como máximo). */
export function resultFromScore(
  total: number,
  excludingFailures: readonly { score: number; index?: number; name?: string }[],
  thresholds: Thresholds,
): ResultOutcome {
  if (thresholds.conditionalMin > thresholds.approvedMin || thresholds.conditionalMin < 0) {
    return { ok: false, error: "INVALID_THRESHOLDS" };
  }
  const byScore: EvaluationResultValue =
    total >= thresholds.approvedMin ? "approved" : total >= thresholds.conditionalMin ? "conditional" : "not_approved";

  let cap: EvaluationResultValue = "approved";
  for (const f of excludingFailures) {
    const c: EvaluationResultValue = f.score <= 1 ? "not_approved" : "conditional";
    if (RANK[c] < RANK[cap]) cap = c;
  }
  const result = RANK[cap] < RANK[byScore] ? cap : byScore;
  return { ok: true, result, reason: result !== byScore ? "excluding_criterion" : "score" };
}

export type EvaluationOutcome =
  | (ScoreOk & { mode: EvaluationModeValue; result: EvaluationResultValue; resultReason: ResultReasonValue })
  | { ok: false; error: ScoreError | "INVALID_THRESHOLDS"; itemIndex?: number };

/** Puntaje + resultado en un solo paso: lo usan el servidor y la pantalla de evaluación (misma función). */
export function evaluateSupplier(
  items: readonly ScoreItem[],
  mode: EvaluationModeValue,
  criticality: SupplierCriticalityValue,
  thresholds: Thresholds,
): EvaluationOutcome {
  const score = scoreEvaluation(items, mode, criticality);
  if (!score.ok) return score;
  if (score.total === null) return { ...score, mode, result: "approved", resultReason: "declared" };
  const result = resultFromScore(score.total, score.excludingFailures, thresholds);
  if (!result.ok) return result;
  return { ...score, mode, result: result.result, resultReason: result.reason };
}
