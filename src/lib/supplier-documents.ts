import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import { isAllowedUploadContentType, resolveUploadContentType } from "@/domain/documents/versioning";
import { cleanName } from "@/domain/masterdata/roster";
import { buenosAiresToday } from "@/domain/suppliers/dates";
import { documentStatus, type DocumentStatus } from "@/domain/suppliers/status";
import { DEFAULT_WARN_DAYS } from "@/domain/suppliers/types";
import { SupplierError, audit, recomputeSupplierSummary } from "@/lib/suppliers";

type Tx = Prisma.TransactionClient;

export const SUPPLIER_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

export function buildSupplierDocumentStorageKey(input: { tenantId: string; supplierId: string; documentId: string; fileName: string }): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${input.tenantId}/suppliers/${input.supplierId}/documents/${input.documentId}/${safeName}`;
}

/**
 * Carga un documento del proveedor. Reemplaza al vigente de ese tipo (queda en el historial) y deja un único
 * `DueItem` abierto con el vencimiento nuevo. El archivo se valida igual que las evidencias de Acciones.
 */
export async function uploadSupplierDocument(
  input: {
    tenantId: string;
    actorUserId: string;
    supplierId: string;
    typeId: string;
    issuedAt?: Date | null;
    expiresAt?: Date | null;
    fileName: string;
    contentType: string;
    body: Buffer;
    now?: Date;
    storage?: ObjectStorage;
  },
  db: PrismaClient = prisma,
) {
  const fileName = cleanName(input.fileName);
  if (!fileName) throw new SupplierError("El archivo no tiene nombre");
  const contentType = resolveUploadContentType(input.contentType, fileName);
  if (!isAllowedUploadContentType(contentType)) throw new SupplierError("Tipo de archivo no permitido: subí un PDF, una imagen, un Word o un texto");
  if (input.body.length === 0) throw new SupplierError("El archivo está vacío");
  if (input.body.length > SUPPLIER_DOCUMENT_MAX_BYTES) throw new SupplierError("El archivo supera el máximo de 15 MB");
  const issuedAt = input.issuedAt ?? null;
  const expiresAt = input.expiresAt ?? null;
  for (const date of [issuedAt, expiresAt]) {
    if (date && Number.isNaN(date.getTime())) throw new SupplierError("Una de las fechas no es válida");
  }
  if (issuedAt && expiresAt && expiresAt.getTime() < issuedAt.getTime()) {
    throw new SupplierError("El vencimiento es anterior a la fecha de emisión");
  }

  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId } });
  if (!supplier) throw new SupplierError("Proveedor no encontrado");
  const type = await db.supplierDocumentType.findFirst({ where: { id: input.typeId, tenantId: input.tenantId } });
  if (!type) throw new SupplierError("Tipo de documento no encontrado");
  if (!type.active) throw new SupplierError("Ese tipo de documento está desactivado");
  if (!type.appliesTo.includes(supplier.type)) throw new SupplierError("Ese documento no se le pide a este tipo de proveedor");

  // El id se define antes para armar la clave de almacenamiento; si la base falla queda, a lo sumo, un archivo huérfano.
  const documentId = randomUUID();
  const storageKey = buildSupplierDocumentStorageKey({ tenantId: input.tenantId, supplierId: supplier.id, documentId, fileName });
  await (input.storage ?? getObjectStorage()).putObject(storageKey, input.body, contentType);

  return db.$transaction(async (tx) => {
    const document = await tx.supplierDocument.create({
      data: {
        id: documentId,
        tenantId: input.tenantId,
        supplierId: supplier.id,
        typeId: type.id,
        issuedAt,
        expiresAt,
        storageKey,
        fileName,
        contentType,
        sizeBytes: input.body.length,
        uploadedByUserId: input.actorUserId,
      },
    });
    // Resumen, habilitación y `DueItem` (cierra el del documento anterior y abre el nuevo).
    await recomputeSupplierSummary(input.tenantId, supplier.id, tx, input.now);
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: supplier.id,
      action: "upload_document",
      actorUserId: input.actorUserId,
      summary: `Se cargó «${type.name}» de «${supplier.legalName}»${expiresAt ? ` (vence ${expiresAt.toISOString().slice(0, 10)})` : " (sin vencimiento)"}`,
    });
    return document;
  });
}

/** Anula un documento (motivo obligatorio). Si era el vigente, vuelve a regir el anterior del mismo tipo. */
export async function voidSupplierDocument(
  input: { tenantId: string; actorUserId: string; supplierId: string; documentId: string; reason: string; now?: Date },
  db: PrismaClient = prisma,
) {
  const reason = cleanName(input.reason);
  if (reason.length < 3) throw new SupplierError("Escribí el motivo de la anulación");
  await db.$transaction(async (tx) => {
    const document = await tx.supplierDocument.findFirst({
      where: { id: input.documentId, tenantId: input.tenantId, supplierId: input.supplierId },
      include: { type: { select: { name: true } }, supplier: { select: { legalName: true } } },
    });
    if (!document) throw new SupplierError("Documento no encontrado");
    if (document.voidedAt) throw new SupplierError("El documento ya está anulado");
    await tx.supplierDocument.update({ where: { id: document.id }, data: { voidedAt: new Date(), voidReason: reason } });
    await recomputeSupplierSummary(input.tenantId, input.supplierId, tx, input.now);
    await audit(tx, {
      tenantId: input.tenantId,
      entityId: input.supplierId,
      action: "void_document",
      actorUserId: input.actorUserId,
      summary: `Se anuló «${document.type.name}» de «${document.supplier.legalName}»: ${reason}`,
    });
  });
}

// ─── Lectura ───────────────────────────────────────────────────────────────

export type SupplierDocumentRow = {
  type: { id: string; name: string; required: boolean; blocksEnablement: boolean; note: string; validityMonths: number | null };
  current: { id: string; fileName: string; issuedAt: Date | null; expiresAt: Date | null; createdAt: Date } | null;
  /** `missing` = no hay vigente; el resto sale de `documentStatus`. */
  status: DocumentStatus | "missing";
  previous: number;
};

/** Un renglón por tipo de documento activo que le aplica al proveedor, con su vigente y su estado. */
export async function listSupplierDocuments(tenantId: string, supplierId: string, now: Date = new Date(), db: Tx = prisma): Promise<SupplierDocumentRow[]> {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, tenantId }, select: { type: true } });
  if (!supplier) return [];
  const [types, docs, settings] = await Promise.all([
    db.supplierDocumentType.findMany({
      where: { tenantId, active: true, appliesTo: { has: supplier.type } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    db.supplierDocument.findMany({
      where: { tenantId, supplierId, voidedAt: null },
      select: { id: true, typeId: true, fileName: true, issuedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    db.supplierSettings.findUnique({ where: { tenantId }, select: { docWarnDays: true } }),
  ]);
  const today = buenosAiresToday(now);
  const warn = settings?.docWarnDays ?? DEFAULT_WARN_DAYS;
  return types.map((t) => {
    const own = docs.filter((d) => d.typeId === t.id);
    const current = own[0] ?? null;
    return {
      type: { id: t.id, name: t.name, required: t.required, blocksEnablement: t.blocksEnablement, note: t.note, validityMonths: t.validityMonths },
      current,
      status: current ? documentStatus(current.expiresAt, today, warn) : "missing",
      previous: Math.max(0, own.length - 1),
    };
  });
}

/** Historial completo (vigentes, reemplazados y anulados) para la tabla de la ficha. Acotado. */
export async function listSupplierDocumentHistory(tenantId: string, supplierId: string, db: Tx = prisma) {
  return db.supplierDocument.findMany({
    where: { tenantId, supplierId },
    select: {
      id: true, fileName: true, issuedAt: true, expiresAt: true, createdAt: true, voidedAt: true, voidReason: true, supersededAt: true,
      type: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/** Archivo de un documento, acotado a la empresa del solicitante. */
export async function readSupplierDocumentFile(
  tenantId: string,
  documentId: string,
  options?: { storage?: ObjectStorage; db?: Tx },
) {
  const db = options?.db ?? prisma;
  const document = await db.supplierDocument.findFirst({ where: { id: documentId, tenantId } });
  if (!document) return null;
  const object = await (options?.storage ?? getObjectStorage()).getObject(document.storageKey);
  if (!object) return null;
  return { document, body: object.body, contentType: object.contentType };
}

/** Empresa a la que pertenece un documento, para autorizar la descarga antes de leer nada. */
export async function getSupplierDocumentTenant(documentId: string, db: Tx = prisma): Promise<string | null> {
  const found = await db.supplierDocument.findUnique({ where: { id: documentId }, select: { tenantId: true } });
  return found?.tenantId ?? null;
}
