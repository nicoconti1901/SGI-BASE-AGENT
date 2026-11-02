/**
 * Quién puede implementar. Mientras un riesgo u oportunidad se está registrando y evaluando, lo avanza quien
 * puede escribir. Cuando se decide qué hacer y se asigna a una persona, la implementación (acciones, avances de
 * estado, cierre) es solo de esa persona, de quien tenga a cargo una de sus acciones, o del superusuario.
 * El resto ve el estado y qué falta, pero no lo mueve.
 */
export type ImplementationKind = "risk" | "opportunity";

/** Estados anteriores a la asignación: ahí todavía no hay un responsable que lo lleve. */
const BEFORE_ASSIGNMENT: Record<ImplementationKind, readonly string[]> = {
  risk: ["identified", "analyzing", "evaluated"],
  opportunity: ["discovered", "analyzing", "evaluated"],
};

export type ImplementationInput = {
  status: string;
  /** Responsable de la respuesta (riesgo) o de llevar adelante la oportunidad. */
  ownerUserId: string | null | undefined;
  actorUserId: string;
  isPlatformSuperuser: boolean;
  /** Responsable de la acción concreta sobre la que se actúa, si es una acción. */
  actionOwnerUserId?: string | null;
};

export function canImplement(kind: ImplementationKind, input: ImplementationInput): boolean {
  if (input.isPlatformSuperuser) return true;
  if (!input.ownerUserId || BEFORE_ASSIGNMENT[kind].includes(input.status)) return true;
  return input.actorUserId === input.ownerUserId || input.actorUserId === input.actionOwnerUserId;
}

export function implementationLockMessage(kind: ImplementationKind, ownerName: string): string {
  const what = kind === "risk" ? "el riesgo" : "la oportunidad";
  return `${ownerName} lleva ${what}: solo esa persona (o el superusuario) puede avanzarlo desde acá.`;
}

/** Lo que todavía falta para cerrar, en palabras del usuario. */
export function remainingStageLabels(stages: { label: string; state: string }[]): string[] {
  return stages.filter((s) => s.state !== "done").map((s) => s.label);
}
