import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import {
  isAllowedUploadContentType,
  resolveUploadContentType,
} from "@/domain/documents/versioning";
import {
  buildFindingAttachmentStorageKey,
  type FindingAttachmentKind,
} from "@/domain/findings/attachments";

const MAX_BYTES = 15 * 1024 * 1024;

function storageOrDefault(storage?: ObjectStorage): ObjectStorage {
  return storage ?? getObjectStorage();
}

export async function uploadFindingAttachment(input: {
  tenantId: string;
  findingId: string;
  measureId?: string | null;
  kind: FindingAttachmentKind;
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

  if (input.kind === "measure_evidence" && !input.measureId) {
    throw new Error("La evidencia de cierre debe asociarse a una medida");
  }
  if (input.kind === "finding_doc" && input.measureId) {
    throw new Error("La documentación del hallazgo no se asocia a una medida");
  }

  const finding = await db.finding.findFirst({
    where: { id: input.findingId, tenantId: input.tenantId },
  });
  if (!finding) throw new Error("Hallazgo no encontrado");

  if (input.measureId) {
    const measure = await db.findingMeasure.findFirst({
      where: {
        id: input.measureId,
        findingId: input.findingId,
        tenantId: input.tenantId,
      },
    });
    if (!measure) throw new Error("Medida no encontrada");
    if (measure.status === "closed") {
      throw new Error("No se puede adjuntar evidencia a una medida cerrada");
    }
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

  const attachment = await db.findingAttachment.create({
    data: {
      tenantId: input.tenantId,
      findingId: input.findingId,
      measureId: input.measureId ?? null,
      kind: input.kind,
      storageKey: "pending",
      fileName: input.fileName,
      contentType,
      sizeBytes: input.body.length,
      label: input.label?.trim() || null,
      uploadedById: input.uploadedById,
    },
  });

  const storageKey = buildFindingAttachmentStorageKey({
    tenantId: input.tenantId,
    findingId: input.findingId,
    attachmentId: attachment.id,
    fileName: input.fileName,
  });

  await storage.putObject(storageKey, input.body, contentType);

  return db.findingAttachment.update({
    where: { id: attachment.id },
    data: { storageKey },
  });
}

export async function readFindingAttachmentFile(
  attachmentId: string,
  options?: { db?: PrismaClient; storage?: ObjectStorage },
) {
  const db = options?.db ?? prisma;
  const storage = storageOrDefault(options?.storage);
  const attachment = await db.findingAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment) return null;
  const object = await storage.getObject(attachment.storageKey);
  if (!object) return null;
  return { attachment, body: object.body, contentType: object.contentType };
}
