import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import {
  isAllowedUploadContentType,
  resolveUploadContentType,
} from "@/domain/documents/versioning";
import { buildActionAttachmentStorageKey } from "@/domain/actions/types";

const MAX_BYTES = 15 * 1024 * 1024;

function storageOrDefault(storage?: ObjectStorage): ObjectStorage {
  return storage ?? getObjectStorage();
}

export async function uploadActionAttachment(input: {
  tenantId: string;
  actionId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
  uploadedById: string;
  label?: string;
  db?: PrismaClient;
  storage?: ObjectStorage;
}) {
  const db = input.db ?? prisma;
  const storage = storageOrDefault(input.storage);

  const action = await db.action.findFirst({
    where: { id: input.actionId, tenantId: input.tenantId },
  });
  if (!action) throw new Error("Acción no encontrada");
  if (action.status === "cancelled") {
    throw new Error("No se puede adjuntar evidencia a una acción anulada");
  }

  const contentType = resolveUploadContentType(
    input.contentType,
    input.fileName,
  );
  if (!isAllowedUploadContentType(contentType)) {
    throw new Error(`Tipo de archivo no permitido: ${input.contentType}`);
  }
  if (input.body.length === 0) throw new Error("El archivo está vacío");
  if (input.body.length > MAX_BYTES) {
    throw new Error("El archivo supera el máximo de 15 MB");
  }

  const attachment = await db.actionAttachment.create({
    data: {
      tenantId: input.tenantId,
      actionId: input.actionId,
      storageKey: "pending",
      fileName: input.fileName,
      contentType,
      sizeBytes: input.body.length,
      label: input.label?.trim() || null,
      uploadedById: input.uploadedById,
    },
  });

  const storageKey = buildActionAttachmentStorageKey({
    tenantId: input.tenantId,
    actionId: input.actionId,
    attachmentId: attachment.id,
    fileName: input.fileName,
  });

  await storage.putObject(storageKey, input.body, contentType);

  return db.actionAttachment.update({
    where: { id: attachment.id },
    data: { storageKey },
  });
}

export async function readActionAttachmentFile(
  attachmentId: string,
  options?: { db?: PrismaClient; storage?: ObjectStorage },
) {
  const db = options?.db ?? prisma;
  const storage = storageOrDefault(options?.storage);
  const attachment = await db.actionAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment) return null;
  const object = await storage.getObject(attachment.storageKey);
  if (!object) return null;
  return { attachment, body: object.body, contentType: object.contentType };
}

export async function getActionAttachmentForDownload(
  tenantId: string,
  attachmentId: string,
  db: PrismaClient = prisma,
) {
  return db.actionAttachment.findFirst({
    where: { id: attachmentId, tenantId },
  });
}
