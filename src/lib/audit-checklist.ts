import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import {
  isAllowedUploadContentType,
  resolveUploadContentType,
} from "@/domain/documents/versioning";
import {
  buildAuditEvidenceStorageKey,
  checklistItemsForRequirement,
  compareClauses,
} from "@/domain/audits/checklist";
import { assertValidItemResult, findingFromItemResult } from "@/domain/audits/lifecycle";
import type { AuditItemResult, AuditStandard } from "@/domain/audits/types";
import { AuditGateError } from "@/lib/audits";

const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;
const STANDARD_ORDER: AuditStandard[] = ["ISO9001", "ISO14001", "ISO45001"];
/** Las preguntas propias van después de los requisitos del catálogo. */
const CUSTOM_ORDER_BASE = 10_000;

async function findEditableAudit(tenantId: string, auditId: string, db: PrismaClient) {
  const audit = await db.audit.findFirst({ where: { id: auditId, tenantId } });
  if (!audit) throw new Error("Auditoría no encontrada");
  if (audit.status !== "planned" && audit.status !== "prepared") {
    throw new AuditGateError(["La lista de verificación se arma antes de iniciar la auditoría"]);
  }
  return audit;
}

/** Requisitos del catálogo de la empresa para las normas de la auditoría. */
export async function listChecklistCandidates(
  tenantId: string,
  standards: AuditStandard[],
  db: PrismaClient = prisma,
) {
  if (standards.length === 0) return [];
  const rows = await db.tenantRequirement.findMany({
    where: { tenantId, requirement: { standard: { in: standards } } },
    select: {
      id: true,
      requirement: { select: { standard: true, clauseCode: true, title: true } },
    },
  });
  return rows
    .map((r) => ({
      tenantRequirementId: r.id,
      standard: r.requirement.standard,
      clauseCode: r.requirement.clauseCode,
      title: r.requirement.title,
    }))
    .sort(
      (a, b) =>
        STANDARD_ORDER.indexOf(a.standard) - STANDARD_ORDER.indexOf(b.standard) ||
        compareClauses(a.clauseCode, b.clauseCode),
    );
}

export async function getChecklist(tenantId: string, auditId: string, db: PrismaClient = prisma) {
  return db.auditChecklistItem.findMany({
    where: { tenantId, auditId },
    include: {
      requirement: { select: { requirement: { select: { standard: true, clauseCode: true } } } },
      attachments: { orderBy: { createdAt: "asc" } },
      finding: { select: { id: true, status: true, type: true, severity: true, title: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Reemplaza los ítems del catálogo por la selección (las preguntas propias se
 * conservan). Cambiar la lista de una auditoría preparada la vuelve a planificada.
 */
export async function setRequirementItems(
  input: { tenantId: string; auditId: string; tenantRequirementIds: string[] },
  db: PrismaClient = prisma,
) {
  const audit = await findEditableAudit(input.tenantId, input.auditId, db);
  const candidates = await listChecklistCandidates(input.tenantId, audit.standards, db);
  const selected = new Set(input.tenantRequirementIds);
  const drafts = candidates
    .filter((c) => selected.has(c.tenantRequirementId))
    .flatMap(checklistItemsForRequirement);

  await db.$transaction([
    db.auditChecklistItem.deleteMany({
      where: { auditId: audit.id, tenantRequirementId: { not: null } },
    }),
    db.auditChecklistItem.createMany({
      data: drafts.map((d, i) => ({
        tenantId: input.tenantId,
        auditId: audit.id,
        tenantRequirementId: d.tenantRequirementId,
        question: d.question,
        sortOrder: i,
      })),
    }),
    db.audit.update({ where: { id: audit.id }, data: { status: "planned" } }),
  ]);
  return drafts.length;
}

export async function addCustomQuestion(
  input: { tenantId: string; auditId: string; question: string },
  db: PrismaClient = prisma,
) {
  const question = input.question.trim();
  if (question.length < 5) throw new AuditGateError(["Escribí la pregunta que vas a verificar"]);
  const audit = await findEditableAudit(input.tenantId, input.auditId, db);
  const customs = await db.auditChecklistItem.count({
    where: { auditId: audit.id, tenantRequirementId: null },
  });
  return db.auditChecklistItem.create({
    data: {
      tenantId: input.tenantId,
      auditId: audit.id,
      question,
      sortOrder: CUSTOM_ORDER_BASE + customs,
    },
  });
}

export async function removeChecklistItem(
  input: { tenantId: string; auditId: string; itemId: string },
  db: PrismaClient = prisma,
) {
  const audit = await findEditableAudit(input.tenantId, input.auditId, db);
  await db.auditChecklistItem.deleteMany({
    where: { id: input.itemId, auditId: audit.id, tenantId: input.tenantId },
  });
}

export async function isAuditTeamMember(auditId: string, userId: string, db: PrismaClient = prisma) {
  return (await db.auditTeamMember.count({ where: { auditId, userId } })) > 0;
}

/**
 * Registrar el resultado de un ítem (auditoría en curso). NC / observación / OM
 * crean un Hallazgo en borrador vinculado (SPEC-audits, punto resuelto 4).
 * Mientras el hallazgo siga en borrador, cambiar el resultado lo actualiza o lo
 * elimina; publicado, el cambio se gestiona desde el hallazgo.
 */
export async function recordItemResult(
  input: {
    tenantId: string;
    auditId: string;
    itemId: string;
    result: AuditItemResult;
    evidence: string | null;
    userId: string;
  },
  db: PrismaClient = prisma,
) {
  const item = await db.auditChecklistItem.findFirst({
    where: { id: input.itemId, auditId: input.auditId, tenantId: input.tenantId },
    include: {
      audit: { select: { status: true, code: true } },
      finding: { select: { id: true, status: true } },
    },
  });
  if (!item) throw new Error("Ítem no encontrado");
  if (item.audit.status !== "in_progress") {
    throw new AuditGateError(["Los resultados se registran con la auditoría en curso"]);
  }
  const linked = item.finding && item.finding.status !== "cancelled" ? item.finding : null;
  if (linked && linked.status !== "draft") {
    throw new AuditGateError([
      "El hallazgo de este ítem ya fue publicado: para cambiar el resultado, anulalo desde Hallazgos",
    ]);
  }
  assertValidItemResult({ result: input.result, evidence: input.evidence });

  const evidence = input.evidence?.trim() || null;
  const mapping = findingFromItemResult(input.result);

  return db.$transaction(async (tx) => {
    let findingId: string | null = null;
    if (mapping) {
      const data = {
        type: mapping.type,
        severity: mapping.severity,
        title: findingTitle(item.question),
        description: evidence ?? "",
      };
      if (linked) {
        await tx.finding.update({ where: { id: linked.id }, data });
        findingId = linked.id;
      } else {
        const finding = await tx.finding.create({
          data: {
            ...data,
            tenantId: input.tenantId,
            status: "draft",
            detectedAt: new Date(),
            source: `Auditoría interna ${item.audit.code}`,
            createdByUserId: input.userId,
            auditId: input.auditId,
          },
        });
        findingId = finding.id;
      }
    } else if (linked) {
      // Deja de ser hallazgo: el borrador ya no tiene sentido.
      await tx.auditChecklistItem.update({ where: { id: item.id }, data: { findingId: null } });
      await tx.finding.delete({ where: { id: linked.id } });
    }

    return tx.auditChecklistItem.update({
      where: { id: item.id },
      data: { result: input.result, evidence, updatedByUserId: input.userId, findingId },
    });
  });
}

/** Título del hallazgo a partir de la pregunta del checklist (máx. 120 caracteres). */
function findingTitle(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 117)}…` : clean;
}

export async function uploadAuditEvidence(input: {
  tenantId: string;
  auditId: string;
  itemId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
  uploadedById: string;
  db?: PrismaClient;
  storage?: ObjectStorage;
}) {
  const db = input.db ?? prisma;
  const storage = input.storage ?? getObjectStorage();
  const item = await db.auditChecklistItem.findFirst({
    where: { id: input.itemId, auditId: input.auditId, tenantId: input.tenantId },
    include: { audit: { select: { status: true } } },
  });
  if (!item) throw new Error("Ítem no encontrado");
  if (item.audit.status !== "in_progress") {
    throw new AuditGateError(["La evidencia se adjunta con la auditoría en curso"]);
  }
  const contentType = resolveUploadContentType(input.contentType, input.fileName);
  if (!isAllowedUploadContentType(contentType)) {
    throw new AuditGateError([`Tipo de archivo no permitido: ${input.contentType}`]);
  }
  if (input.body.length === 0) throw new AuditGateError(["El archivo está vacío"]);
  if (input.body.length > MAX_EVIDENCE_BYTES) {
    throw new AuditGateError(["El archivo supera el máximo de 15 MB"]);
  }

  const attachment = await db.auditEvidenceAttachment.create({
    data: {
      tenantId: input.tenantId,
      itemId: item.id,
      storageKey: "pending",
      fileName: input.fileName,
      contentType,
      sizeBytes: input.body.length,
      uploadedById: input.uploadedById,
    },
  });
  const storageKey = buildAuditEvidenceStorageKey({
    tenantId: input.tenantId,
    auditId: input.auditId,
    itemId: item.id,
    attachmentId: attachment.id,
    fileName: input.fileName,
  });
  await storage.putObject(storageKey, input.body, contentType);
  return db.auditEvidenceAttachment.update({ where: { id: attachment.id }, data: { storageKey } });
}

export async function readAuditEvidenceFile(
  attachmentId: string,
  options?: { db?: PrismaClient; storage?: ObjectStorage },
) {
  const db = options?.db ?? prisma;
  const storage = options?.storage ?? getObjectStorage();
  const attachment = await db.auditEvidenceAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.storageKey === "pending") return null;
  const object = await storage.getObject(attachment.storageKey);
  if (!object) return null;
  return { attachment, body: object.body, contentType: object.contentType };
}

// ─── Informe del auditor externo ────────────────────────────────────────────

export async function uploadExternalAuditReport(input: {
  tenantId: string;
  auditId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
  uploadedById: string;
  db?: PrismaClient;
  storage?: ObjectStorage;
}) {
  const db = input.db ?? prisma;
  const storage = input.storage ?? getObjectStorage();
  const audit = await db.audit.findFirst({
    where: { id: input.auditId, tenantId: input.tenantId, kind: "external" },
  });
  if (!audit) throw new Error("Auditoría no encontrada");
  if (audit.status === "cancelled") {
    throw new AuditGateError(["La auditoría externa está cancelada"]);
  }
  const contentType = resolveUploadContentType(input.contentType, input.fileName);
  if (!isAllowedUploadContentType(contentType)) {
    throw new AuditGateError([`Tipo de archivo no permitido: ${input.contentType}`]);
  }
  if (input.body.length === 0) throw new AuditGateError(["El archivo está vacío"]);
  if (input.body.length > MAX_EVIDENCE_BYTES) {
    throw new AuditGateError(["El archivo supera el máximo de 15 MB"]);
  }

  const attachment = await db.auditReportAttachment.create({
    data: {
      tenantId: input.tenantId,
      auditId: audit.id,
      storageKey: "pending",
      fileName: input.fileName,
      contentType,
      sizeBytes: input.body.length,
      uploadedById: input.uploadedById,
    },
  });
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `tenants/${input.tenantId}/audits/${audit.id}/report/${attachment.id}/${safeName}`;
  await storage.putObject(storageKey, input.body, contentType);
  return db.auditReportAttachment.update({ where: { id: attachment.id }, data: { storageKey } });
}

export async function readExternalAuditReport(
  attachmentId: string,
  options?: { db?: PrismaClient; storage?: ObjectStorage },
) {
  const db = options?.db ?? prisma;
  const storage = options?.storage ?? getObjectStorage();
  const attachment = await db.auditReportAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.storageKey === "pending") return null;
  const object = await storage.getObject(attachment.storageKey);
  if (!object) return null;
  return { attachment, body: object.body, contentType: object.contentType };
}
