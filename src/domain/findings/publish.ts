import type { FindingDraft, FindingType } from "@/domain/findings/types";

function minMeasuresForType(type: FindingType): {
  min: number;
  requireCorrective: boolean;
} {
  switch (type) {
    case "nonconformity":
      return { min: 1, requireCorrective: true };
    case "incident":
      return { min: 1, requireCorrective: true };
    case "observation":
      return { min: 1, requireCorrective: false };
    case "opportunity":
      return { min: 1, requireCorrective: false };
  }
}

export function getPublishBlockers(draft: FindingDraft): string[] {
  const blockers: string[] = [];

  if (draft.title.trim().length < 2) {
    blockers.push("El título del hallazgo es obligatorio");
  }
  if (draft.description.trim().length < 2) {
    blockers.push("La descripción del hecho es obligatoria");
  }
  if (Number.isNaN(draft.detectedAt.getTime())) {
    blockers.push("La fecha de detección es inválida");
  }

  if (draft.rca.status !== "confirmed" || !draft.rca.rootCause?.trim()) {
    blockers.push(
      "Debés completar el laboratorio de 5 Porqués y confirmar la causa raíz",
    );
  }

  const { min, requireCorrective } = minMeasuresForType(draft.type);
  if (draft.measures.length < min) {
    blockers.push("Agregá al menos una medida de mejora");
  }
  if (requireCorrective && !draft.measures.some((m) => m.kind === "corrective")) {
    blockers.push("Este tipo de hallazgo requiere al menos una medida correctiva");
  }
  for (const measure of draft.measures) {
    if (measure.title.trim().length < 2) {
      blockers.push("Toda medida necesita título");
    }
    if (!measure.ownerUserId) {
      blockers.push("Toda medida necesita un responsable (usuario del tenant)");
    }
    if (measure.kind === "corrective" && !measure.dueAt) {
      blockers.push("Las medidas correctivas requieren fecha de vencimiento");
    }
  }
  if (!draft.measures.some((m) => m.linkedRootCause)) {
    blockers.push(
      "Al menos una medida debe estar vinculada a la causa raíz",
    );
  }

  if (draft.notifyUserIds.length < 1) {
    blockers.push("Asigná al menos un destinatario de notificación");
  }

  return [...new Set(blockers)];
}

export function assertCanPublishFinding(draft: FindingDraft): void {
  const blockers = getPublishBlockers(draft);
  if (blockers.length > 0) {
    throw new Error(blockers.join(" · "));
  }
}
