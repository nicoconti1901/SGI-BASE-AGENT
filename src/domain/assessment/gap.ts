export type RequirementStatus =
  | "pending"
  | "not_applicable"
  | "missing"
  | "partial"
  | "compliant"
  | "automated";

export type DocumentFate = "keep" | "replace" | "create" | "undecided";

export const REQUIREMENT_STATUSES: RequirementStatus[] = [
  "pending",
  "not_applicable",
  "missing",
  "partial",
  "compliant",
  "automated",
];

export const GAP_STATUS_LABELS: Record<RequirementStatus, string> = {
  pending: "Pendiente",
  not_applicable: "No aplica",
  missing: "Faltante",
  partial: "Parcial",
  compliant: "Conforme",
  automated: "Automatizado",
};

export const DOCUMENT_FATE_LABELS: Record<DocumentFate, string> = {
  keep: "Conservar",
  replace: "Reemplazar",
  create: "Crear",
  undecided: "Sin definir",
};

export function isRequirementStatus(value: string): value is RequirementStatus {
  return REQUIREMENT_STATUSES.includes(value as RequirementStatus);
}

export function labelGapStatus(status: RequirementStatus): string {
  return GAP_STATUS_LABELS[status];
}

export function labelDocumentFate(fate: DocumentFate): string {
  return DOCUMENT_FATE_LABELS[fate];
}

export function meetsRequirementStatus(status: RequirementStatus): boolean {
  return status === "compliant" || status === "automated";
}

/**
 * Regla de destino documental (SPEC).
 * - Doc del cliente + cumple → conservar
 * - Doc del cliente + no cumple → reemplazar
 * - Sin doc → crear
 */
export function decideDocumentFate(input: {
  meetsRequirement: boolean;
  hasClientDocument: boolean;
}): Exclude<DocumentFate, "undecided"> {
  if (input.hasClientDocument && input.meetsRequirement) return "keep";
  if (input.hasClientDocument && !input.meetsRequirement) return "replace";
  return "create";
}

/** Hint de destino según estado de gap; pending / N/A quedan sin definir. */
export function resolveDocumentFateHint(input: {
  status: RequirementStatus;
  hasClientDocument: boolean;
}): DocumentFate {
  if (input.status === "pending" || input.status === "not_applicable") {
    return "undecided";
  }
  return decideDocumentFate({
    meetsRequirement: meetsRequirementStatus(input.status),
    hasClientDocument: input.hasClientDocument,
  });
}
