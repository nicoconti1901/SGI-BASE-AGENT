import type { RootCauseAnalysis, WhyStep, WhyWarning } from "@/domain/findings/types";

export const MIN_WHY_DEPTH = 3;
export const MAX_WHY_DEPTH = 8;
export const MAX_BRANCHES = 6;

let stepSeq = 0;

export function newWhyId(prefix = "w"): string {
  stepSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${stepSeq}`;
}

function branchLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

/** Normaliza pasos antiguos (sin id/rama) al modelo con ramas. */
export function normalizeWhySteps(
  steps: Array<Partial<WhyStep> & Pick<WhyStep, "question" | "answer" | "isRootCause" | "order">> | WhyStep[],
): WhyStep[] {
  if (!steps?.length) return [createInitialWhyStep()];
  const hasBranches = steps.every((s) => Boolean(s.branchId) && Boolean(s.id));
  if (hasBranches) {
    return steps.map((s) => ({
      id: s.id!,
      order: s.order || 1,
      branchId: s.branchId!,
      branchLabel: s.branchLabel || "A — Cadena principal",
      question: s.question || "¿Por qué?",
      answer: s.answer || "",
      evidenceNote: s.evidenceNote ?? "",
      isRootCause: Boolean(s.isRootCause),
      warningFlags: s.warningFlags,
    }));
  }
  const branchId = newWhyId("b");
  return steps.map((s, i) => ({
    id: s.id || newWhyId(),
    order: s.order || i + 1,
    branchId,
    branchLabel: s.branchLabel || "A — Cadena principal",
    question: s.question || "¿Por qué?",
    answer: s.answer || "",
    evidenceNote: s.evidenceNote ?? "",
    isRootCause: Boolean(s.isRootCause),
    warningFlags: s.warningFlags,
  }));
}

export function createInitialWhyStep(problemStatement?: string): WhyStep {
  const trimmed = problemStatement?.trim();
  const branchId = newWhyId("b");
  return {
    id: newWhyId(),
    order: 1,
    branchId,
    branchLabel: "A — Causa inmediata",
    question: trimmed
      ? systemWhyQuestion(trimmed, 1)
      : "¿Por qué ocurrió este hecho? (completá primero el punto de partida)",
    answer: "",
    evidenceNote: "",
    isRootCause: false,
  };
}

/** Pregunta orientada al sistema (evita cerrar en “el trabajador…”). */
export function systemWhyQuestion(subject: string, depth: number): string {
  const trimmed = subject.trim() || "eso";
  if (depth <= 1) {
    return `¿Por qué ocurrió: ${trimmed}?`;
  }
  return `¿Por qué el sistema / proceso permitió que ocurriera: ${trimmed}?`;
}

export function syncFirstWhyQuestion(
  steps: WhyStep[],
  problemStatement: string,
): WhyStep[] {
  const trimmed = problemStatement.trim();
  if (!trimmed) return steps;
  const normalized = normalizeWhySteps(steps);
  return normalized.map((step) =>
    step.order === 1
      ? { ...step, question: systemWhyQuestion(trimmed, 1) }
      : step,
  );
}

export function nextWhyQuestion(previousAnswer: string, depth: number): string {
  return systemWhyQuestion(previousAnswer, depth);
}

export function listBranchIds(steps: WhyStep[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const s of normalizeWhySteps(steps)) {
    if (!seen.has(s.branchId)) {
      seen.add(s.branchId);
      ids.push(s.branchId);
    }
  }
  return ids;
}

export function stepsOfBranch(steps: WhyStep[], branchId: string): WhyStep[] {
  return normalizeWhySteps(steps)
    .filter((s) => s.branchId === branchId)
    .sort((a, b) => a.order - b.order);
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
    /\b(porque\s+)?(no\s+)?(quiso|olvidó|olvido|fue\s+negligente|fue\s+descuidado|no\s+prestó\s+atención)\b/.test(
      text,
    ) ||
    /\b(error\s+humano|negligencia|imprudencia)\b/.test(text)
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

/**
 * Confirma si hay al menos una rama con profundidad mínima y causa raíz marcada.
 * Permite varias causas raíz (una por rama).
 */
export function canConfirmRootCause(steps: WhyStep[]): boolean {
  const normalized = normalizeWhySteps(steps);
  if (normalized.some((s) => !s.answer.trim())) return false;

  const branchIds = listBranchIds(normalized);
  const roots = normalized.filter((s) => s.isRootCause);
  if (roots.length === 0) return false;

  for (const root of roots) {
    if (root.answer.trim().length < 12) return false;
    const branchSteps = stepsOfBranch(normalized, root.branchId);
    if (branchSteps.length < MIN_WHY_DEPTH) return false;
    if (root.order < MIN_WHY_DEPTH) return false;
  }

  // Al menos una rama debe alcanzar la profundidad mínima con raíz
  const deepEnough = branchIds.some((id) => {
    const bs = stepsOfBranch(normalized, id);
    return bs.length >= MIN_WHY_DEPTH && bs.some((s) => s.isRootCause);
  });
  return deepEnough;
}

export function confirmRootCause(
  steps: WhyStep[],
  confirmedByUserId: string,
  problemStatement = "",
  extras?: {
    investigationChecklist?: string[];
    investigationSequence?: string;
  },
): RootCauseAnalysis {
  const normalized = normalizeWhySteps(steps);
  if (!canConfirmRootCause(normalized)) {
    throw new Error(
      "No se puede confirmar: completá las respuestas, profundizá al menos una rama (≥3 niveles) y marcá su causa raíz. Podés marcar una raíz por rama.",
    );
  }
  const roots = normalized
    .filter((s) => s.isRootCause)
    .sort((a, b) => a.branchLabel.localeCompare(b.branchLabel));
  const rootTexts = roots.map((r) => {
    const label = r.branchLabel ? `[${r.branchLabel}] ` : "";
    return `${label}${r.answer.trim()}`;
  });
  return {
    method: "five_whys",
    problemStatement: problemStatement.trim(),
    investigationChecklist: extras?.investigationChecklist,
    investigationSequence: extras?.investigationSequence?.trim() || undefined,
    steps: normalized.map((s) => ({
      ...s,
      warningFlags: detectWhyAnswerWarnings(s.answer),
    })),
    rootCause: rootTexts.join(" · "),
    rootCauseConfirmedAt: new Date(),
    rootCauseConfirmedByUserId: confirmedByUserId,
    status: "confirmed",
  };
}

/** Marca causa raíz dentro de su rama (una por rama; otras ramas intactas). */
export function markStepAsRoot(steps: WhyStep[], stepId: string): WhyStep[] {
  const normalized = normalizeWhySteps(steps);
  const target = normalized.find((s) => s.id === stepId);
  if (!target) return normalized;
  return normalized.map((step) => {
    if (step.branchId !== target.branchId) return step;
    return { ...step, isRootCause: step.id === stepId };
  });
}

export function appendWhyStep(
  steps: WhyStep[],
  branchId: string,
): WhyStep[] {
  const normalized = normalizeWhySteps(steps);
  const branch = stepsOfBranch(normalized, branchId);
  if (branch.length >= MAX_WHY_DEPTH) {
    throw new Error(`Máximo ${MAX_WHY_DEPTH} niveles por rama`);
  }
  const last = branch[branch.length - 1];
  if (!last?.answer.trim()) {
    throw new Error("Completá la respuesta del nivel actual antes de agregar otro");
  }
  const nextOrder = last.order + 1;
  return [
    ...normalized.map((s) =>
      s.branchId === branchId ? { ...s, isRootCause: false } : s,
    ),
    {
      id: newWhyId(),
      order: nextOrder,
      branchId,
      branchLabel: last.branchLabel,
      question: nextWhyQuestion(last.answer, nextOrder),
      answer: "",
      evidenceNote: "",
      isRootCause: false,
    },
  ];
}

/** Compat: append sobre la primera / única rama. */
export function appendWhyStepToActive(
  steps: WhyStep[],
  branchId?: string,
): WhyStep[] {
  const normalized = normalizeWhySteps(steps);
  const id = branchId ?? listBranchIds(normalized)[0]!;
  return appendWhyStep(normalized, id);
}

export function addWhyBranch(
  steps: WhyStep[],
  label?: string,
  problemStatement?: string,
): WhyStep[] {
  const normalized = normalizeWhySteps(steps);
  const count = listBranchIds(normalized).length;
  if (count >= MAX_BRANCHES) {
    throw new Error(`Máximo ${MAX_BRANCHES} ramas causales`);
  }
  const letter = branchLetter(count);
  const branchId = newWhyId("b");
  const branchLabel =
    label?.trim() || `${letter} — Causa contribuyente ${letter}`;
  const subject = problemStatement?.trim() || "este hecho";
  return [
    ...normalized,
    {
      id: newWhyId(),
      order: 1,
      branchId,
      branchLabel,
      question: systemWhyQuestion(subject, 1),
      answer: "",
      evidenceNote: "",
      isRootCause: false,
    },
  ];
}

export function removeBranch(steps: WhyStep[], branchId: string): WhyStep[] {
  const normalized = normalizeWhySteps(steps);
  const remaining = normalized.filter((s) => s.branchId !== branchId);
  if (remaining.length === 0) return [createInitialWhyStep()];
  return remaining;
}

// ─── Árbol por factores (ramas con nombre fijo, edición en el lugar) ──────────

export type FactorBranch = { branchId: string; label: string; steps: WhyStep[] };

/** Ramas en orden de aparición. A diferencia de listBranchIds, sin pasos no inventa una rama. */
export function factorBranches(steps: WhyStep[]): FactorBranch[] {
  const branches = new Map<string, FactorBranch>();
  for (const s of steps) {
    const branch = branches.get(s.branchId) ?? { branchId: s.branchId, label: s.branchLabel, steps: [] };
    branch.steps.push(s);
    branches.set(s.branchId, branch);
  }
  return [...branches.values()].map((b) => ({ ...b, steps: [...b.steps].sort((x, y) => x.order - y.order) }));
}

/** Abre la rama de un factor (nombre fijo del catálogo) con su primer ¿por qué? vacío. */
export function addFactorBranch(steps: WhyStep[], label: string): WhyStep[] {
  const branches = factorBranches(steps);
  if (branches.some((b) => b.label === label)) return steps;
  if (branches.length >= MAX_BRANCHES) {
    throw new Error(`Máximo ${MAX_BRANCHES} factores por análisis`);
  }
  return [
    ...steps,
    {
      id: newWhyId(),
      order: 1,
      branchId: newWhyId("b"),
      branchLabel: label,
      question: "",
      answer: "",
      evidenceNote: "",
      isRootCause: false,
    },
  ];
}

/** Quita el último nivel de una rama (una rama conserva siempre su primer nivel). */
export function removeLastWhyStep(steps: WhyStep[], branchId: string): WhyStep[] {
  const branch = factorBranches(steps).find((b) => b.branchId === branchId);
  if (!branch || branch.steps.length <= 1) return steps;
  const last = branch.steps[branch.steps.length - 1]!;
  return steps.filter((s) => s.id !== last.id);
}

/** Recalcula las preguntas: nivel 1 parte del hecho; cada nivel siguiente, de la respuesta anterior. */
export function refreshWhyQuestions(steps: WhyStep[], problemStatement: string): WhyStep[] {
  const questions = new Map<string, string>();
  for (const branch of factorBranches(steps)) {
    branch.steps.forEach((step, i) => {
      const subject = i === 0 ? problemStatement : branch.steps[i - 1]!.answer;
      questions.set(
        step.id,
        subject.trim() ? systemWhyQuestion(subject, step.order) : "¿Por qué?",
      );
    });
  }
  return steps.map((s) => ({ ...s, question: questions.get(s.id) ?? s.question }));
}

/** Por qué todavía no se puede confirmar la causa raíz, en el orden en que se completa. Vacío = se puede. */
export function rootCauseBlockers(input: {
  checklistCount: number;
  problemStatement: string;
  steps: WhyStep[];
  preventConfirmed: boolean;
}): string[] {
  const blockers: string[] = [];
  if (input.checklistCount < 3) {
    blockers.push("Marcá al menos 3 hechos reunidos (paso 1).");
  }
  if (!input.problemStatement.trim()) {
    blockers.push("Escribí el hecho comprobado (paso 2).");
  }
  const branches = factorBranches(input.steps);
  if (branches.length === 0) {
    blockers.push("Elegí al menos un factor que intervino (paso 3).");
  }
  for (const b of branches) {
    if (b.steps.some((s) => !s.answer.trim())) {
      blockers.push(`Respondé los niveles vacíos de «${b.label}» o quitalos.`);
    }
  }
  const hasDeepRoot = branches.some(
    (b) => b.steps.length >= MIN_WHY_DEPTH && b.steps.some((s) => s.isRootCause && s.order >= MIN_WHY_DEPTH),
  );
  if (branches.length > 0 && !hasDeepRoot) {
    blockers.push(`Llegá al menos al ${MIN_WHY_DEPTH}.er ¿por qué? en un factor y marcá su causa raíz.`);
  }
  if (!input.preventConfirmed) {
    blockers.push("Confirmá que corregir estas causas evita que el hecho se repita.");
  }
  return blockers;
}
