import type {
  AssessmentInput,
  QualitativeLevel,
} from "@/domain/risks/types";
import { QUALITATIVE_LEVEL_LABELS, QUALITATIVE_LEVELS } from "@/domain/risks/types";

export function assertValidAssessmentInput(input: AssessmentInput): void {
  if (!input.rationale.trim()) {
    throw new Error("La justificación de la evaluación es obligatoria");
  }
  if (input.method === "qualitative") {
    if (!QUALITATIVE_LEVELS.includes(input.level)) {
      throw new Error("Nivel cualitativo inválido");
    }
    return;
  }
  if (input.probability < 1 || input.probability > 5) {
    throw new Error("Probabilidad debe estar entre 1 y 5");
  }
  if (input.impact < 1 || input.impact > 5) {
    throw new Error("Impacto debe estar entre 1 y 5");
  }
  const expected = input.probability * input.impact;
  if (input.score !== expected) {
    throw new Error(
      `Score P×I inconsistente: esperado ${expected}, recibido ${input.score}`,
    );
  }
}

export function qualitativeResultLabel(level: QualitativeLevel): string {
  const map = {
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
    critical: "Crítico",
  } as const;
  return map[level];
}

export function nextAssessmentVersion(existingMax: number | null): number {
  return (existingMax ?? 0) + 1;
}

/** Texto legible de una evaluación guardada (ej. "Cualitativa · Nivel alto"). */
export function describeAssessmentResult(method: string, result: unknown): string {
  const r = (result ?? {}) as {
    level?: QualitativeLevel;
    probability?: number;
    impact?: number;
    score?: number;
  };
  if (method === "qualitative" && r.level) {
    return `Cualitativa · Nivel ${QUALITATIVE_LEVEL_LABELS[r.level].toLowerCase()}`;
  }
  if (method === "probability_impact") {
    return `Probabilidad ${r.probability} × Impacto ${r.impact} = ${r.score}`;
  }
  return "Evaluación";
}
