export type DocumentFateForControl = "keep" | "replace" | "create" | "undecided";

export class DocumentKeepProtectedError extends Error {
  constructor(message = "Documento marcado como Conservar") {
    super(message);
    this.name = "DocumentKeepProtectedError";
  }
}

/**
 * Regla SPEC: no sobrescribir docs `keep` sin acción explícita del
 * administrador de plataforma.
 */
export function assertCanAddDocumentVersion(input: {
  fate: DocumentFateForControl;
  forceOverwriteKeep: boolean;
  isPlatformSuperuser: boolean;
}): void {
  if (input.fate !== "keep") {
    return;
  }
  if (!input.forceOverwriteKeep) {
    throw new DocumentKeepProtectedError(
      "Documento marcado como Conservar: requiere confirmación explícita del administrador de plataforma para agregar una versión.",
    );
  }
  if (!input.isPlatformSuperuser) {
    throw new DocumentKeepProtectedError(
      "Solo el administrador de plataforma puede forzar la sobrescritura de un documento Conservar.",
    );
  }
}

export function nextVersionNumber(currentMax: number): number {
  return currentMax + 1;
}

export function buildDocumentStorageKey(input: {
  tenantId: string;
  documentId: string;
  versionNumber: number;
  fileName: string;
}): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${input.tenantId}/documents/${input.documentId}/v${input.versionNumber}/${safeName}`;
}

export function isAllowedUploadContentType(contentType: string): boolean {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
  ];
  return allowed.includes(contentType);
}

export function resolveUploadContentType(
  contentType: string,
  fileName: string,
): string {
  if (isAllowedUploadContentType(contentType)) {
    return contentType;
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return contentType || "application/octet-stream";
}
