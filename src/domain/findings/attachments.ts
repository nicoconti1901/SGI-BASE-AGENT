/** Adjuntos operativos de hallazgos (no control documental). */

export type FindingAttachmentKind = "finding_doc" | "measure_evidence";

export const FINDING_ATTACHMENT_KIND_LABELS: Record<
  FindingAttachmentKind,
  string
> = {
  finding_doc: "Documentación del hallazgo",
  measure_evidence: "Evidencia de cierre de medida",
};

export function buildFindingAttachmentStorageKey(input: {
  tenantId: string;
  findingId: string;
  attachmentId: string;
  fileName: string;
}): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${input.tenantId}/findings/${input.findingId}/${input.attachmentId}/${safeName}`;
}

export function assertCanCloseMeasureWithEvidence(
  evidenceCount: number,
): void {
  if (evidenceCount < 1) {
    throw new Error(
      "Para cerrar la medida debés adjuntar al menos una evidencia (foto, registro o documento).",
    );
  }
}
