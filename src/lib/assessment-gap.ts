import { prisma } from "@/lib/db";
import {
  isRequirementStatus,
  resolveDocumentFateHint,
  type DocumentFate,
  type RequirementStatus,
} from "@/domain/assessment/gap";

export type GapRowUpdate = {
  tenantRequirementId: string;
  status: RequirementStatus;
  notes: string;
  hasClientDocument: boolean;
};

export type BulkSaveGapInput = {
  tenantId: string;
  userId: string;
  rows: GapRowUpdate[];
};

function normalizeNotes(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function listTenantGapRequirements(tenantId: string) {
  return prisma.tenantRequirement.findMany({
    where: { tenantId },
    include: { requirement: true },
    orderBy: [
      { requirement: { standard: "asc" } },
      { requirement: { clauseCode: "asc" } },
    ],
  });
}

export async function listRecentGapAudits(tenantId: string, take = 20) {
  return prisma.gapAssessmentAudit.findMany({
    where: { tenantId },
    include: {
      user: { select: { name: true, email: true } },
      tenantRequirement: {
        include: {
          requirement: {
            select: { clauseKey: true, title: true, standard: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function bulkSaveTenantGap(input: BulkSaveGapInput) {
  if (input.rows.length === 0) {
    throw new Error("No hay filas para guardar");
  }

  const ids = input.rows.map((row) => row.tenantRequirementId);
  const existing = await prisma.tenantRequirement.findMany({
    where: {
      tenantId: input.tenantId,
      id: { in: ids },
    },
  });

  if (existing.length !== ids.length) {
    throw new Error("Hay requisitos que no pertenecen a este tenant");
  }

  const byId = new Map(existing.map((row) => [row.id, row]));
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const row of input.rows) {
      if (!isRequirementStatus(row.status)) {
        throw new Error(`Estado de gap inválido: ${row.status}`);
      }

      const current = byId.get(row.tenantRequirementId);
      if (!current) {
        throw new Error("Requisito no encontrado");
      }

      const notes = normalizeNotes(row.notes);
      const documentFate: DocumentFate = resolveDocumentFateHint({
        status: row.status,
        hasClientDocument: row.hasClientDocument,
      });

      const statusChanged = current.status !== row.status;
      const notesChanged = (current.notes ?? null) !== notes;
      const docChanged = current.hasClientDocument !== row.hasClientDocument;
      const fateChanged = current.documentFate !== documentFate;

      if (!statusChanged && !notesChanged && !docChanged && !fateChanged) {
        continue;
      }

      await tx.tenantRequirement.update({
        where: { id: current.id },
        data: {
          status: row.status,
          notes,
          hasClientDocument: row.hasClientDocument,
          documentFate,
          assessedAt: now,
          assessedByUserId: input.userId,
        },
      });

      await tx.gapAssessmentAudit.create({
        data: {
          tenantId: input.tenantId,
          tenantRequirementId: current.id,
          userId: input.userId,
          previousStatus: current.status,
          newStatus: row.status,
          previousNotes: current.notes,
          newNotes: notes,
          previousHasDocument: current.hasClientDocument,
          newHasDocument: row.hasClientDocument,
          previousDocumentFate: current.documentFate,
          newDocumentFate: documentFate,
        },
      });
    }
  });
}
