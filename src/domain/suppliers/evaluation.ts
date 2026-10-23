import type {
  CriterionPhaseValue,
  EvaluationModeValue,
  EvaluationResultValue,
  ResultReasonValue,
} from "./types";

export const EVALUATION_KINDS = ["initial", "periodic", "event"] as const;
export type EvaluationKindValue = (typeof EVALUATION_KINDS)[number];

export const EVALUATION_KIND_LABELS: Record<EvaluationKindValue, string> = {
  initial: "Inicial (selección)",
  periodic: "Periódica",
  event: "Por evento",
};

export const EVALUATION_MODE_LABELS: Record<EvaluationModeValue, string> = {
  full: "Completa",
  simplified: "Simplificada",
  declared: "Aceptación con motivo",
};

export type ScopedCriterion = { phase: CriterionPhaseValue; basic: boolean; excluding: boolean };

/**
 * Qué criterios se preguntan: la selección mira los de fase «selección» o «ambas»; la reevaluación, los de
 * «desempeño» o «ambas». Un criterio excluyente se pregunta siempre (no se puede saltear un freno).
 * La evaluación simplificada se limita a los básicos y los excluyentes; la declarada no lleva criterios.
 */
export function criteriaForEvaluation<T extends ScopedCriterion>(
  criteria: readonly T[],
  kind: EvaluationKindValue,
  mode: EvaluationModeValue,
): T[] {
  if (mode === "declared") return [];
  const wanted: CriterionPhaseValue = kind === "initial" ? "performance" : "selection";
  return criteria.filter((c) => {
    if (c.excluding) return true;
    if (c.phase === wanted) return false;
    return mode === "full" || c.basic;
  });
}

/** Posiciones de las respuestas con nota 1 o 2 que no tienen comentario (es obligatorio explicar una nota baja). */
export function lowScoresWithoutComment(items: readonly { score: number | null; comment: string }[]): number[] {
  const out: number[] = [];
  items.forEach((item, index) => {
    if (item.score !== null && item.score <= 2 && !item.comment.trim()) out.push(index);
  });
  return out;
}

/** Aviso suave de la pantalla: todas las notas iguales y ningún comentario. */
export function looksUnevidenced(items: readonly { score: number | null; comment: string }[], overallComment: string): boolean {
  const scores = items.filter((i) => i.score !== null).map((i) => i.score);
  if (scores.length < 3) return false;
  return new Set(scores).size === 1 && !overallComment.trim() && items.every((i) => !i.comment.trim());
}

/** Frase corta que explica el resultado: «No aprobado: Seguridad en 1», «Aprobado por puntaje». */
export function describeResult(
  result: EvaluationResultValue,
  reason: ResultReasonValue,
  failures: readonly { name?: string; score: number }[],
): string {
  const label = result === "approved" ? "Aprobado" : result === "conditional" ? "Con condiciones" : "No aprobado";
  if (reason === "declared") return `${label}: aceptación con motivo`;
  if (reason === "excluding_criterion") {
    const worst = failures
      .slice()
      .sort((a, b) => a.score - b.score)
      .map((f) => `${f.name ?? "Criterio excluyente"} en ${f.score}`)
      .join(", ");
    return `${label}: ${worst} (criterio excluyente)`;
  }
  return `${label} por puntaje`;
}
