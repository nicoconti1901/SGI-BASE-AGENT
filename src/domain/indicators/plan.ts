/**
 * Plan del objetivo (ISO §6.2.2): qué se va a hacer, quién y para cuándo (una fila por acción),
 * con qué recursos y cómo se evalúan los resultados. Reemplaza el cuadro de texto único.
 */
export type PlanStep = {
  what: string;
  ownerUserId: string;
  /** yyyy-mm-dd */
  dueDate: string;
};

export type ObjectivePlan = {
  steps: PlanStep[];
  resources: string;
  evaluation: string;
};

export const MAX_PLAN_STEPS = 20;

/** Ayudas rápidas para «Recursos» y «Cómo se evalúa»: el usuario elige en lugar de redactar. */
export const RESOURCE_SUGGESTIONS = [
  "Horas del equipo",
  "Presupuesto",
  "Capacitación",
  "Software o sistema",
  "Equipamiento",
  "Asesoramiento externo",
];

export const EVALUATION_SUGGESTIONS = [
  "Con los indicadores del objetivo",
  "Revisión mensual del responsable",
  "En la revisión por la dirección",
  "Con auditoría interna",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Lee las filas guardadas o recibidas del formulario; descarta filas vacías y basura. */
export function parsePlanSteps(raw: unknown): PlanStep[] {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      what: String(s.what ?? "").trim(),
      ownerUserId: String(s.ownerUserId ?? "").trim(),
      dueDate: String(s.dueDate ?? "").trim(),
    }))
    .filter((s) => s.what || s.ownerUserId || s.dueDate);
}

/** Qué le falta a cada acción del plan, numerada como la ve el usuario. */
export function planStepIssues(steps: PlanStep[]): string[] {
  const issues: string[] = [];
  if (steps.length > MAX_PLAN_STEPS) issues.push(`El plan admite hasta ${MAX_PLAN_STEPS} acciones`);
  steps.forEach((s, i) => {
    const n = i + 1;
    if (s.what.length < 3) issues.push(`Acción ${n}: describí qué se va a hacer`);
    if (!s.ownerUserId) issues.push(`Acción ${n}: elegí un responsable`);
    if (!DATE_RE.test(s.dueDate) || Number.isNaN(new Date(s.dueDate).getTime())) {
      issues.push(`Acción ${n}: indicá la fecha límite`);
    }
  });
  return issues;
}

/** El plan tiene contenido estructurado (si no, se muestra el texto libre anterior). */
export function hasStructuredPlan(plan: ObjectivePlan): boolean {
  return plan.steps.length > 0 || Boolean(plan.resources.trim()) || Boolean(plan.evaluation.trim());
}
