/** Acciones operativas compartidas (riesgo / oportunidad / hallazgo). */

export type ActionStatus = "open" | "in_progress" | "completed" | "cancelled";

export type EffectivenessStatus =
  | "pending"
  | "effective"
  | "partially_effective"
  | "not_effective"
  | "not_applicable";

export type ActionLinkTarget = "risk" | "opportunity" | "finding";

export const ACTION_STATUSES: ActionStatus[] = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
];

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  open: "Abierta",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Anulada",
};

export const EFFECTIVENESS_STATUSES: EffectivenessStatus[] = [
  "pending",
  "effective",
  "partially_effective",
  "not_effective",
  "not_applicable",
];

export const EFFECTIVENESS_STATUS_LABELS: Record<EffectivenessStatus, string> =
  {
    pending: "Pendiente de evaluar",
    effective: "Efectiva",
    partially_effective: "Parcialmente efectiva",
    not_effective: "No efectiva",
    not_applicable: "No aplica",
  };

export const ACTION_ENTITY_TYPE = "operational_action";

export type ActionDraft = {
  title: string;
  description?: string;
  ownerUserId: string;
  dueAt: Date | null;
  links: { targetType: ActionLinkTarget; targetId: string }[];
};

/**
 * Completar una acción ≠ evaluar efectividad.
 * Sin evidencia no se puede completar.
 */
export function assertCanCompleteAction(evidenceCount: number): void {
  if (evidenceCount < 1) {
    throw new Error(
      "Para completar la acción debés adjuntar al menos una evidencia.",
    );
  }
}

export function assertCanRecordEffectiveness(input: {
  actionStatus: ActionStatus;
  effectiveness: EffectivenessStatus;
  note?: string;
}): void {
  if (input.actionStatus !== "completed") {
    throw new Error(
      "Solo se puede evaluar efectividad de una acción completada.",
    );
  }
  if (input.effectiveness === "pending") {
    throw new Error("Seleccioná un resultado de efectividad.");
  }
  if (
    (input.effectiveness === "not_effective" ||
      input.effectiveness === "partially_effective") &&
    !input.note?.trim()
  ) {
    throw new Error(
      "Indicá un comentario cuando la efectividad no es plena.",
    );
  }
}

/** Aprendizaje completo solo si hay efectividad distinta de pending. */
export function hasLearnedFromAction(
  effectiveness: EffectivenessStatus,
): boolean {
  return effectiveness !== "pending";
}

export function buildActionAttachmentStorageKey(input: {
  tenantId: string;
  actionId: string;
  attachmentId: string;
  fileName: string;
}): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${input.tenantId}/actions/${input.actionId}/${input.attachmentId}/${safeName}`;
}
