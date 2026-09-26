import type { RootCauseAnalysis, WhyStep, WhyWarning } from "@/domain/findings/types";

export const MIN_WHY_DEPTH = 3;
export const MAX_WHY_DEPTH = 8;

export function createInitialWhyStep(problemStatement: string): WhyStep {
  const trimmed = problemStatement.trim() || "este hecho";
  return {
    order: 1,
    question: `¿Por qué ocurrió: ${trimmed}?`,
    answer: "",
    isRootCause: false,
  };
}

export function nextWhyQuestion(previousAnswer: string): string {
  const trimmed = previousAnswer.trim() || "eso";
  return `¿Por qué ocurrió: ${trimmed}?`;
}

export function detectWhyAnswerWarnings(answer: string): WhyWarning[] {
  const text = answer.trim().toLowerCase();
  const flags: WhyWarning[] = [];
  if (!text) return flags;
  if (text.length < 12) flags.push("vague");
  if (
    /\b(juan|pedro|maría|maria|el operador|la operaria|fulano|mengano)\b/.test(
      text,
    ) ||
    /\b(porque\s+)?(no\s+)?(quiso|olvidó|olvido|fue\s+negligente)\b/.test(text)
  ) {
    flags.push("blame");
  }
  if (
    /\b(hay que|debemos|se debe|capacitar|entrenar|contratar)\b/.test(text)
  ) {
    flags.push("solution");
  }
  if (
    /\b(mala suerte|siempre pasa|así es|no se|ns\/nc)\b/.test(text) ||
    text === "error humano"
  ) {
    flags.push("vague");
  }
  if (/\b(sintoma|síntoma|se vio|apareció)\b/.test(text)) {
    flags.push("symptom");
  }
  return [...new Set(flags)];
}

export function canConfirmRootCause(steps: WhyStep[]): boolean {
  if (steps.length < MIN_WHY_DEPTH) return false;
  if (steps.length > MAX_WHY_DEPTH) return false;
  const roots = steps.filter((s) => s.isRootCause);
  if (roots.length !== 1) return false;
  const root = roots[0]!;
  if (root.order < MIN_WHY_DEPTH) return false;
  if (root.answer.trim().length < 12) return false;
  return steps.every((s) => s.answer.trim().length > 0);
}

export function confirmRootCause(
  steps: WhyStep[],
  confirmedByUserId: string,
  problemStatement = "",
): RootCauseAnalysis {
  if (!canConfirmRootCause(steps)) {
    throw new Error(
      "No se puede confirmar la causa raíz: completá al menos 3 porqués, marcá uno como raíz y evitá respuestas vacías.",
    );
  }
  const root = steps.find((s) => s.isRootCause)!;
  return {
    method: "five_whys",
    problemStatement: problemStatement.trim(),
    steps: steps.map((s) => ({
      ...s,
      warningFlags: detectWhyAnswerWarnings(s.answer),
    })),
    rootCause: root.answer.trim(),
    rootCauseConfirmedAt: new Date(),
    rootCauseConfirmedByUserId: confirmedByUserId,
    status: "confirmed",
  };
}

export function markStepAsRoot(steps: WhyStep[], order: number): WhyStep[] {
  return steps.map((step) => ({
    ...step,
    isRootCause: step.order === order,
  }));
}

export function appendWhyStep(steps: WhyStep[]): WhyStep[] {
  if (steps.length >= MAX_WHY_DEPTH) {
    throw new Error(`Máximo ${MAX_WHY_DEPTH} niveles de análisis`);
  }
  const last = steps[steps.length - 1];
  if (!last?.answer.trim()) {
    throw new Error("Completá la respuesta del nivel actual antes de agregar otro");
  }
  return [
    ...steps.map((s) => ({ ...s, isRootCause: false })),
    {
      order: steps.length + 1,
      question: nextWhyQuestion(last.answer),
      answer: "",
      isRootCause: false,
    },
  ];
}
