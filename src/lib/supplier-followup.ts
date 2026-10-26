import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import { isAllowedUploadContentType, resolveUploadContentType } from "@/domain/documents/versioning";
import { cleanName } from "@/domain/masterdata/roster";
import { buenosAiresToday } from "@/domain/suppliers/dates";
import {
  buildSupplierFindingTitle,
  scoreTrend,
  validateCommunication,
  SUPPLIER_FINDING_KINDS,
  type SupplierCommunicationChannelValue,
  type SupplierCommunicationKindValue,
  type SupplierFindingKindValue,
} from "@/domain/suppliers/findings";
import { SupplierError, audit } from "@/lib/suppliers";

type Tx = Prisma.TransactionClient;

export const SUPPLIER_COMMUNICATION_MAX_BYTES = 15 * 1024 * 1024;
const LIST_LIMIT = 50;

// ─── Hallazgos ─────────────────────────────────────────────────────────────

/**
 * Registra un hallazgo del proveedor: un `Finding` en borrador con `origin = supplier` y el vínculo del lado del módulo
 * (`SupplierFinding`). Sin columnas nuevas en `Finding`. El resto del ciclo (publicar, medidas, cierre) sigue en Hallazgos.
 */
export async function createSupplierFinding(
  input: {
    tenantId: string;
    actorUserId: string;
    supplierId: string;
    kind: SupplierFindingKindValue;
    description: string;
    /** Título propio; si falta se arma con el tipo, el proveedor y el comienzo de la descripción. */
    title?: string;
    detectedAt?: Date;
    evaluationId?: string | null;
    now?: Date;
  },
  db: PrismaClient = prisma,
) {
  if (!SUPPLIER_FINDING_KINDS.includes(input.kind)) throw new SupplierError("Elegí de qué tipo es el hallazgo");
  const description = input.description.trim();
  if (description.length < 3) throw new SupplierError("Describí qué pasó con el proveedor");
  const today = buenosAiresToday(input.now ?? new Date());
  const detectedAt = input.detectedAt ?? today;
  if (Number.isNaN(detectedAt.getTime()) || detectedAt.getTime() > today.getTime()) {
    throw new SupplierError("La fecha del hallazgo no puede ser futura");
  }

  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId } });
    if (!supplier) throw new SupplierError("Proveedor no encontrado");
    if (input.evaluationId) {
      const evaluation = await tx.supplierEvaluation.count({
        where: { id: input.evaluationId, tenantId: input.tenantId, supplierId: supplier.id },
      });
      if (!evaluation) throw new SupplierError("La evaluación no pertenece a este proveedor");
    }
    const title = cleanName(input.title ?? "") || buildSupplierFindingTitle(input.kind, supplier.legalName, description);
    const finding = await tx.finding.create({
      data: {
        tenantId: input.tenantId,
        type: "nonconformity",
        origin: "supplier",
        status: "draft",
        title,
        description,
        detectedAt,
        source: `Proveedor: ${supplier.legalName}`,
        createdByUserId: input.actorUserId,
      },
    });
    const link = await tx.supplierFinding.create({
      data: {
        tenantId: input.tenantId,
        supplierId: supplier.id,
        findingId: finding.id,
        kind: input.kind,
        evaluationId: input.evaluationId || null,
      },
    });
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: supplier.id,
      action: "create_finding",
      actorUserId: input.actorUserId,
      summary: `Hallazgo registrado para «${supplier.legalName}»: ${title}`,
    });
    return { finding, link };
  });
}

/** Hallazgos del proveedor (los más recientes primero, hasta 50) con las acciones abiertas de cada uno, en dos consultas. */
export async function listSupplierFindings(tenantId: string, supplierId: string, db: Tx = prisma) {
  const rows = await db.supplierFinding.findMany({
    where: { tenantId, supplierId },
    select: {
      id: true,
      kind: true,
      evaluationId: true,
      finding: { select: { id: true, title: true, status: true, detectedAt: true } },
    },
    orderBy: { finding: { detectedAt: "desc" } },
    take: LIST_LIMIT,
  });
  const findingIds = rows.map((r) => r.finding.id);
  const actions = findingIds.length
    ? await db.action.findMany({
        where: { tenantId, links: { some: { targetType: "finding", targetId: { in: findingIds } } } },
        select: { id: true, title: true, status: true, dueAt: true, links: { where: { targetType: "finding" }, select: { targetId: true } } },
        orderBy: { createdAt: "asc" },
        take: 200,
      })
    : [];
  return rows.map((r) => ({
    ...r,
    actions: actions
      .filter((a) => a.links.some((l) => l.targetId === r.finding.id))
      .map((a) => ({ id: a.id, title: a.title, status: a.status, dueAt: a.dueAt })),
  }));
}

// ─── Comunicaciones (ISO 9001 §8.4.3) ──────────────────────────────────────

export function buildCommunicationStorageKey(input: { tenantId: string; supplierId: string; communicationId: string; fileName: string }): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${input.tenantId}/suppliers/${input.supplierId}/communications/${input.communicationId}/${safeName}`;
}

/**
 * Registra lo que se le comunicó al proveedor: los requisitos que se le piden o el resultado de su evaluación.
 * Solo se registra (fecha, canal, resumen y adjunto opcional); la plataforma no envía nada.
 */
export async function recordCommunication(
  input: {
    tenantId: string;
    actorUserId: string;
    supplierId: string;
    kind: SupplierCommunicationKindValue;
    channel: SupplierCommunicationChannelValue;
    sentAt: Date | null;
    summary: string;
    recipientName?: string;
    evaluationId?: string | null;
    file?: { fileName: string; contentType: string; body: Buffer };
    now?: Date;
    storage?: ObjectStorage;
  },
  db: PrismaClient = prisma,
) {
  const summary = input.summary.trim();
  const errors = validateCommunication({ kind: input.kind, channel: input.channel, sentAt: input.sentAt, summary }, buenosAiresToday(input.now ?? new Date()));
  const firstError = Object.values(errors)[0];
  if (firstError) throw new SupplierError(firstError);
  if (input.kind === "evaluation_result" && !input.evaluationId) {
    throw new SupplierError("Elegí la evaluación cuyo resultado se comunicó");
  }

  let file: { fileName: string; contentType: string; body: Buffer } | null = null;
  if (input.file && input.file.body.length > 0) {
    const fileName = cleanName(input.file.fileName);
    if (!fileName) throw new SupplierError("El archivo no tiene nombre");
    const contentType = resolveUploadContentType(input.file.contentType, fileName);
    if (!isAllowedUploadContentType(contentType)) throw new SupplierError("Tipo de archivo no permitido: subí un PDF, una imagen, un Word o un texto");
    if (input.file.body.length > SUPPLIER_COMMUNICATION_MAX_BYTES) throw new SupplierError("El archivo supera el máximo de 15 MB");
    file = { fileName, contentType, body: input.file.body };
  }

  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId }, select: { id: true, legalName: true } });
  if (!supplier) throw new SupplierError("Proveedor no encontrado");
  if (input.evaluationId) {
    const evaluation = await db.supplierEvaluation.count({ where: { id: input.evaluationId, tenantId: input.tenantId, supplierId: supplier.id } });
    if (!evaluation) throw new SupplierError("La evaluación no pertenece a este proveedor");
  }

  // El id se define antes para armar la clave del archivo; si la base falla queda, a lo sumo, un archivo huérfano.
  const id = randomUUID();
  const storageKey = file ? buildCommunicationStorageKey({ tenantId: input.tenantId, supplierId: supplier.id, communicationId: id, fileName: file.fileName }) : null;
  if (file && storageKey) await (input.storage ?? getObjectStorage()).putObject(storageKey, file.body, file.contentType);

  return db.$transaction(async (tx) => {
    const communication = await tx.supplierCommunication.create({
      data: {
        id,
        tenantId: input.tenantId,
        supplierId: supplier.id,
        kind: input.kind,
        evaluationId: input.evaluationId || null,
        sentAt: input.sentAt as Date,
        channel: input.channel,
        recipientName: cleanName(input.recipientName ?? "") || null,
        summary,
        storageKey,
        fileName: file?.fileName ?? null,
        contentType: file?.contentType ?? null,
        sizeBytes: file?.body.length ?? null,
        createdByUserId: input.actorUserId,
      },
    });
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: supplier.id,
      action: "communicate",
      actorUserId: input.actorUserId,
      summary: `Se registró una comunicación a «${supplier.legalName}» (${input.kind === "requirements" ? "requisitos" : "resultado de la evaluación"})`,
    });
    return communication;
  });
}

export async function listSupplierCommunications(tenantId: string, supplierId: string, db: Tx = prisma) {
  const rows = await db.supplierCommunication.findMany({
    where: { tenantId, supplierId },
    select: {
      id: true, kind: true, channel: true, sentAt: true, recipientName: true, summary: true, fileName: true, sizeBytes: true,
      evaluationId: true, createdByUserId: true,
      evaluation: { select: { evaluatedAt: true, kind: true } },
    },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: LIST_LIMIT,
  });
  const ids = [...new Set(rows.map((r) => r.createdByUserId).filter((id): id is string => !!id))];
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids }, memberships: { some: { tenantId } } }, select: { id: true, name: true } })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({ ...r, createdByName: r.createdByUserId ? (names.get(r.createdByUserId) ?? null) : null }));
}

/** Evaluaciones sobre las que se puede registrar el resultado comunicado (no anuladas, las más recientes). */
export async function listCommunicableEvaluations(tenantId: string, supplierId: string, db: Tx = prisma) {
  return db.supplierEvaluation.findMany({
    where: { tenantId, supplierId, voidedAt: null },
    select: { id: true, kind: true, evaluatedAt: true, result: true },
    orderBy: [{ evaluatedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
  });
}

export async function getCommunicationTenant(communicationId: string, db: Tx = prisma): Promise<string | null> {
  const row = await db.supplierCommunication.findUnique({ where: { id: communicationId }, select: { tenantId: true } });
  return row?.tenantId ?? null;
}

/** Lee el adjunto: siempre filtrado por empresa, así una clave de otra empresa no se puede pedir. */
export async function readCommunicationFile(
  tenantId: string,
  communicationId: string,
  options?: { storage?: ObjectStorage; db?: Tx },
) {
  const db = options?.db ?? prisma;
  const communication = await db.supplierCommunication.findFirst({
    where: { id: communicationId, tenantId, storageKey: { not: null } },
    select: { storageKey: true, fileName: true, contentType: true },
  });
  if (!communication?.storageKey) return null;
  const object = await (options?.storage ?? getObjectStorage()).getObject(communication.storageKey);
  if (!object) return null;
  return {
    fileName: communication.fileName ?? "adjunto",
    body: object.body,
    contentType: communication.contentType ?? object.contentType,
  };
}

// ─── Evolución del puntaje ─────────────────────────────────────────────────

/** Las últimas evaluaciones con puntaje (hasta 12), de la más antigua a la más reciente, con la variación entre una y otra. */
export async function getScoreTrend(tenantId: string, supplierId: string, db: Tx = prisma) {
  const rows = await db.supplierEvaluation.findMany({
    where: { tenantId, supplierId, voidedAt: null, totalScore: { not: null } },
    select: { evaluatedAt: true, createdAt: true, totalScore: true },
    orderBy: [{ evaluatedAt: "desc" }, { createdAt: "desc" }],
    take: 12,
  });
  return scoreTrend(rows.map((r) => ({ evaluatedAt: r.evaluatedAt, createdAt: r.createdAt, totalScore: r.totalScore === null ? null : Number(r.totalScore), voided: false })));
}
