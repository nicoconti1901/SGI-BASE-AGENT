/** Lo que decide si un aviso ya enviado sigue valiendo: la ventana (día y anticipación) y a quién se avisó. */
export type ReminderTarget = { dueOn: Date; leadDays: number; ownerUserId: string | null };

/**
 * Campos a escribir al volver a guardar un vencimiento. El aviso se reinicia solo si cambió el día o la
 * anticipación, o si hay un nuevo responsable (todavía no fue avisado). Título y sede no lo reinician.
 */
export function reminderReset(previous: ReminderTarget, next: ReminderTarget) {
  const windowChanged = previous.dueOn.getTime() !== next.dueOn.getTime() || previous.leadDays !== next.leadDays;
  const newOwner = next.ownerUserId !== null && next.ownerUserId !== previous.ownerUserId;
  return windowChanged || newOwner ? { lastReminderKind: null, lastRemindedAt: null } : {};
}
