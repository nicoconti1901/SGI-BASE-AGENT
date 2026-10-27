import { addMonths } from "./dates";

/** Clave de la plantilla de la auditoría de seguridad en campo (SPEC, T7). */
export const FIELD_AUDIT_KEY = "field_audit";

/** Tareas especiales que se marcan al iniciar la auditoría: cada una suma sus ítems (SPEC, T7). */
export const SPECIAL_TASKS = {
  height: "Trabajo en altura",
  confined_space: "Espacio confinado",
  lifting: "Izaje",
} as const;
export type SpecialTask = keyof typeof SPECIAL_TASKS;
export const SPECIAL_TASK_KEYS = Object.keys(SPECIAL_TASKS) as SpecialTask[];

export function isSpecialTask(value: string): value is SpecialTask {
  return Object.hasOwn(SPECIAL_TASKS, value);
}

/** Deja solo las tareas especiales válidas, sin repetir y en el orden del catálogo. */
export function normalizeSpecialTasks(raw: readonly string[]): SpecialTask[] {
  const set = new Set(raw.filter(isSpecialTask));
  return SPECIAL_TASK_KEYS.filter((k) => set.has(k));
}

/**
 * Contexto con el que se evalúa `appliesWhen` de los ítems de la auditoría: una bandera por tarea especial
 * (`{ source: "context", key: "height", equals: true }`).
 */
export function auditContext(specialTasks: readonly string[]): Record<SpecialTask, boolean> {
  const marked = new Set(specialTasks);
  return { height: marked.has("height"), confined_space: marked.has("confined_space"), lifting: marked.has("lifting") };
}

export type ProgramStatus = "no_target" | "pending" | "met";

export type ProgramCompliance = {
  done: number;
  target: number | null;
  /** Auditorías que faltan para llegar a la meta (0 si la cumplió o no hay meta). */
  missing: number;
  /** Cumplimiento del programa, 0 a 100 con un decimal; nulo sin meta. Se topa en 100: hacer de más no compensa otra sede. */
  pct: number | null;
  status: ProgramStatus;
};

/** Cumplimiento del programa de una sede en un mes: auditorías cerradas contra la meta mensual (SPEC, decisión 18). */
export function programCompliance(done: number, target: number | null | undefined): ProgramCompliance {
  if (!target || target <= 0) return { done, target: null, missing: 0, pct: null, status: "no_target" };
  const pct = Math.min(100, Math.round((done / target) * 1000) / 10);
  return { done, target, missing: Math.max(0, target - done), pct, status: done >= target ? "met" : "pending" };
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Primer día del mes y primer día del mes siguiente: el rango `[from, to)` de las auditorías de ese mes. */
export function monthRange(month: string): { from: string; to: string } {
  if (!MONTH_RE.test(month)) throw new Error(`Mes inválido: ${month}`);
  const from = `${month}-01`;
  return { from, to: addMonths(from, 1) };
}

/** Mes (AAAA-MM) de una fecha ISO. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Mes anterior o siguiente a uno dado, para navegar el tablero. */
export function shiftMonth(month: string, delta: number): string {
  return monthOf(addMonths(`${month}-01`, delta));
}

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} de ${y}`;
}

/** Una línea con el contexto de la auditoría: tarea, contratista, supervisor y tareas especiales. */
export function fieldAuditSummary(inspection: {
  jobTask?: { name: string } | null;
  contractorName?: string | null;
  supervisor?: { name: string } | null;
  specialTasks: readonly string[];
}): string {
  const special = normalizeSpecialTasks(inspection.specialTasks).map((k) => SPECIAL_TASKS[k]);
  return [
    inspection.jobTask ? `Tarea: ${inspection.jobTask.name}` : null,
    inspection.contractorName ? `Contratista: ${inspection.contractorName}` : null,
    inspection.supervisor ? `Supervisor: ${inspection.supervisor.name}` : null,
    special.length > 0 ? `Tareas especiales: ${special.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "Auditoría de seguridad en campo";
}
