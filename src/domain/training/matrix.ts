/**
 * Editor de la matriz de requisitos: celdas (destino × curso), cambios y advertencias.
 * Funciones puras, compartidas por la pantalla y por el servidor.
 */
import type { CourseCategoryValue } from "./courses";
import type { TargetKind } from "./types";

export type CellState = "none" | "mandatory" | "recommended";

export type MatrixCell = { state: CellState; graceDays: number };

/** Un cambio pedido sobre una celda. `state: "none"` borra el requisito. */
export type MatrixChange = {
  targetKind: TargetKind;
  /** `null` para "todo el personal". */
  targetId: string | null;
  courseId: string;
  state: CellState;
  graceDays: number;
};

export const MATRIX_MAX_CHANGES = 500;

export const cellKey = (kind: TargetKind, targetId: string | null, courseId: string) =>
  `${kind}|${targetId ?? ""}|${courseId}`;

/** 30 días por defecto; 0 para inducción y para tareas críticas (SPEC, decisión 2). */
export function defaultGraceDays(opts: {
  category: CourseCategoryValue;
  targetKind: TargetKind;
  taskCritical: boolean;
}): number {
  if (opts.category === "induction") return 0;
  if (opts.targetKind === "task" && opts.taskCritical) return 0;
  return 30;
}

const EMPTY: MatrixCell = { state: "none", graceDays: 0 };

/** Cambios entre lo guardado y el borrador: solo las celdas que difieren. */
export function diffMatrix(saved: ReadonlyMap<string, MatrixCell>, draft: ReadonlyMap<string, MatrixCell>): MatrixChange[] {
  const changes: MatrixChange[] = [];
  for (const [key, next] of draft) {
    const before = saved.get(key) ?? EMPTY;
    const same = before.state === next.state && (next.state === "none" || before.graceDays === next.graceDays);
    if (same) continue;
    const [targetKind, targetId, courseId] = key.split("|");
    changes.push({
      targetKind: targetKind as TargetKind,
      targetId: targetId === "" ? null : targetId,
      courseId,
      state: next.state,
      graceDays: next.graceDays,
    });
  }
  return changes;
}

export type MatrixWarning = {
  kind: "critical_task_without_courses" | "critical_task_grace" | "induction_grace";
  targetId: string | null;
  message: string;
};

/**
 * Advertencias del editor (no bloquean): una tarea crítica sin cursos obligatorios da una falsa
 * sensación de habilitación; "en plazo" no habilita una tarea crítica; la inducción se da al ingresar.
 */
export function matrixWarnings(input: {
  tasks: readonly { id: string; name: string; critical: boolean }[];
  courses: readonly { id: string; name: string; category: CourseCategoryValue }[];
  cells: ReadonlyMap<string, MatrixCell>;
}): MatrixWarning[] {
  const warnings: MatrixWarning[] = [];
  for (const task of input.tasks.filter((t) => t.critical)) {
    const mandatory = input.courses.filter((c) => input.cells.get(cellKey("task", task.id, c.id))?.state === "mandatory");
    if (mandatory.length === 0) {
      warnings.push({
        kind: "critical_task_without_courses",
        targetId: task.id,
        message: `La tarea crítica «${task.name}» no tiene cursos obligatorios: nadie va a figurar como no habilitado.`,
      });
      continue;
    }
    const withGrace = mandatory.filter((c) => (input.cells.get(cellKey("task", task.id, c.id))?.graceDays ?? 0) > 0);
    if (withGrace.length > 0) {
      warnings.push({
        kind: "critical_task_grace",
        targetId: task.id,
        message: `«${task.name}» es crítica y tiene plazo de gracia en ${withGrace.map((c) => c.name).join(", ")}: mientras está en plazo la persona no queda habilitada.`,
      });
    }
  }
  for (const course of input.courses.filter((c) => c.category === "induction")) {
    for (const [key, cell] of input.cells) {
      const [kind, targetId, courseId] = key.split("|");
      if (courseId === course.id && cell.state === "mandatory" && cell.graceDays > 15) {
        warnings.push({
          kind: "induction_grace",
          targetId: targetId === "" ? null : targetId,
          message: `La inducción «${course.name}» se da al ingresar: un plazo de más de 15 días suele ser un incumplimiento (${kind === "all" ? "todo el personal" : "ver destino"}).`,
        });
      }
    }
  }
  return warnings;
}
