/**
 * Fechas desde las que cuenta el plazo de gracia de una capacitación (SPEC-training):
 * desde cuándo la persona está en su puesto y desde cuándo tiene cada tarea.
 */

/** `null` equivale a "desde el ingreso". Solo se reinicia al cambiar de puesto. */
export function nextPositionSince(
  current: { positionId: string; positionSince: Date | null },
  nextPositionId: string,
  now: Date,
): Date | null {
  return current.positionId === nextPositionId ? current.positionSince : now;
}

/**
 * Las asignaciones se guardan reemplazando las filas: una tarea que sigue asignada
 * conserva su `assignedAt`; una nueva (o reasignada tras quitarla) lleva `now`.
 */
export function withAssignmentDates<T extends { jobTaskId: string }>(
  wanted: readonly T[],
  existing: readonly { jobTaskId: string; assignedAt: Date }[],
  now: Date,
): (T & { assignedAt: Date })[] {
  const since = new Map(existing.map((e) => [e.jobTaskId, e.assignedAt]));
  return wanted.map((row) => ({ ...row, assignedAt: since.get(row.jobTaskId) ?? now }));
}
