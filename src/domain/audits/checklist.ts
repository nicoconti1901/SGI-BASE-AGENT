import type { AuditStandard } from "@/domain/audits/types";

export type RequirementForChecklist = {
  tenantRequirementId: string;
  standard: AuditStandard;
  clauseCode: string;
  title: string;
};

export type ChecklistItemDraft = { tenantRequirementId: string | null; question: string };

/**
 * Ítems que genera un requisito del catálogo. ISO 9001:2026 separa el
 * tratamiento de riesgos (6.1.2) y oportunidades (6.1.3): se auditan como
 * líneas distintas aunque el catálogo tenga una sola cláusula 6.1.
 */
export function checklistItemsForRequirement(req: RequirementForChecklist): ChecklistItemDraft[] {
  if (req.standard === "ISO9001" && req.clauseCode === "6.1") {
    return [
      {
        tenantRequirementId: req.tenantRequirementId,
        question: "6.1 · ¿Se determinan los riesgos y se planifican acciones proporcionales a su impacto? (6.1.2)",
      },
      {
        tenantRequirementId: req.tenantRequirementId,
        question: "6.1 · ¿Se identifican oportunidades y se decide cuáles aprovechar? (6.1.3)",
      },
    ];
  }
  return [
    {
      tenantRequirementId: req.tenantRequirementId,
      question: `${req.clauseCode} · ${req.title}`,
    },
  ];
}

/** Orden natural de cláusulas: 4.10 va después de 4.9. */
export function compareClauses(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

/** Ejecuta la auditoría quien integra el equipo auditor, o el administrador / superusuario. */
export function canExecuteAudit(input: {
  isTeamMember: boolean;
  isCompanyAdmin: boolean;
  isPlatformSuperuser: boolean;
}): boolean {
  return input.isTeamMember || input.isCompanyAdmin || input.isPlatformSuperuser;
}

export function buildAuditEvidenceStorageKey(input: {
  tenantId: string;
  auditId: string;
  itemId: string;
  attachmentId: string;
  fileName: string;
}): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${input.tenantId}/audits/${input.auditId}/${input.itemId}/${input.attachmentId}/${safeName}`;
}
