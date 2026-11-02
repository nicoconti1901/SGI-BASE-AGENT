/**
 * Quién lleva un objetivo. Editarlo, cargarle o cambiarle indicadores y cerrarlo es de su responsable
 * (que además puede escribir) o del superusuario. Quien lo creó y se lo asignó a otra persona lo ve, pero no lo mueve.
 */
export function canRunObjective(input: {
  ownerUserId: string;
  actorUserId: string;
  /** El rol del actor permite escribir. */
  canWrite: boolean;
  isPlatformSuperuser: boolean;
}): boolean {
  if (input.isPlatformSuperuser) return true;
  return input.canWrite && input.ownerUserId === input.actorUserId;
}

export function objectiveLockMessage(ownerName: string): string {
  return `${ownerName} lleva este objetivo: solo esa persona (o el superusuario) puede editarlo, cargarle indicadores o cerrarlo.`;
}
