import type { DocumentFate, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import {
  assertCanAddDocumentVersion,
  buildDocumentStorageKey,
  isAllowedUploadContentType,
  nextVersionNumber,
  resolveUploadContentType,
} from "@/domain/documents/versioning";

export type UploadDocumentInput = {
  tenantId: string;
  title: string;
  kind?: string;
  fate?: DocumentFate;
  tenantRequirementId?: string | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  fileName: string;
  contentType: string;
  body: Buffer;
  uploadedById: string;
  notes?: string;
  forceOverwriteKeep?: boolean;
  isPlatformSuperuser: boolean;
  /** When set, adds a version to an existing document instead of creating one. */
  documentId?: string;
};

function storageOrDefault(storage?: ObjectStorage): ObjectStorage {
  return storage ?? getObjectStorage();
}

export async function listDocumentsWithVersions(
  tenantId: string,
  db: PrismaClient = prisma,
) {
  return db.document.findMany({
    where: { tenantId },
    include: {
      currentVersion: true,
      versions: { orderBy: { versionNumber: "desc" } },
      tenantRequirement: {
        include: {
          requirement: {
            select: { clauseKey: true, title: true, standard: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getDocumentWithVersions(
  documentId: string,
  db: PrismaClient = prisma,
) {
  return db.document.findUnique({
    where: { id: documentId },
    include: {
      currentVersion: true,
      versions: { orderBy: { versionNumber: "desc" } },
      tenantRequirement: {
        include: {
          requirement: {
            select: { clauseKey: true, title: true, standard: true },
          },
        },
      },
    },
  });
}

export async function uploadTenantDocument(
  input: UploadDocumentInput,
  options?: { db?: PrismaClient; storage?: ObjectStorage },
) {
  const db = options?.db ?? prisma;
  const storage = storageOrDefault(options?.storage);

  const contentType = resolveUploadContentType(
    input.contentType,
    input.fileName,
  );

  if (!isAllowedUploadContentType(contentType)) {
    throw new Error(`Tipo de archivo no permitido: ${input.contentType}`);
  }
  if (input.body.length === 0) {
    throw new Error("El archivo está vacío");
  }
  if (input.body.length > 15 * 1024 * 1024) {
    throw new Error("El archivo supera el máximo de 15 MB");
  }

  if (input.tenantRequirementId) {
    const link = await db.tenantRequirement.findFirst({
      where: { id: input.tenantRequirementId, tenantId: input.tenantId },
    });
    if (!link) {
      throw new Error("El requisito no pertenece a este tenant");
    }
  }

  if (input.documentId) {
    return addVersionToDocument(input, db, storage);
  }

  const title = input.title.trim();
  if (title.length < 2) {
    throw new Error("El título debe tener al menos 2 caracteres");
  }

  const fate = input.fate ?? "create";
  const document = await db.document.create({
    data: {
      tenantId: input.tenantId,
      title,
      kind: input.kind ?? "procedure",
      fate,
      tenantRequirementId: input.tenantRequirementId ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
    },
  });

  const versionNumber = 1;
  const storageKey = buildDocumentStorageKey({
    tenantId: input.tenantId,
    documentId: document.id,
    versionNumber,
    fileName: input.fileName,
  });

  await storage.putObject(storageKey, input.body, contentType);

  const version = await db.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber,
      storageKey,
      fileName: input.fileName,
      contentType,
      sizeBytes: input.body.length,
      uploadedById: input.uploadedById,
      notes: input.notes?.trim() || null,
    },
  });

  return db.document.update({
    where: { id: document.id },
    data: { currentVersionId: version.id },
    include: {
      currentVersion: true,
      versions: { orderBy: { versionNumber: "desc" } },
    },
  });
}

async function addVersionToDocument(
  input: UploadDocumentInput,
  db: PrismaClient,
  storage: ObjectStorage,
) {
  const document = await db.document.findFirst({
    where: { id: input.documentId, tenantId: input.tenantId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });
  if (!document) {
    throw new Error("Documento no encontrado");
  }

  assertCanAddDocumentVersion({
    fate: document.fate,
    forceOverwriteKeep: Boolean(input.forceOverwriteKeep),
    isPlatformSuperuser: input.isPlatformSuperuser,
  });

  const maxVersion = document.versions[0]?.versionNumber ?? 0;
  const versionNumber = nextVersionNumber(maxVersion);
  const storageKey = buildDocumentStorageKey({
    tenantId: input.tenantId,
    documentId: document.id,
    versionNumber,
    fileName: input.fileName,
  });

  const contentType = resolveUploadContentType(
    input.contentType,
    input.fileName,
  );

  await storage.putObject(storageKey, input.body, contentType);

  const version = await db.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber,
      storageKey,
      fileName: input.fileName,
      contentType,
      sizeBytes: input.body.length,
      uploadedById: input.uploadedById,
      notes: input.notes?.trim() || null,
    },
  });

  return db.document.update({
    where: { id: document.id },
    data: {
      currentVersionId: version.id,
      ...(input.fate ? { fate: input.fate } : {}),
      ...(input.title?.trim() ? { title: input.title.trim() } : {}),
      ...(input.tenantRequirementId !== undefined
        ? { tenantRequirementId: input.tenantRequirementId }
        : {}),
    },
    include: {
      currentVersion: true,
      versions: { orderBy: { versionNumber: "desc" } },
    },
  });
}

export async function readDocumentFile(
  documentId: string,
  options?: {
    db?: PrismaClient;
    storage?: ObjectStorage;
    versionId?: string;
  },
) {
  const db = options?.db ?? prisma;
  const storage = storageOrDefault(options?.storage);
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { currentVersion: true, versions: true },
  });
  if (!document) {
    return null;
  }

  const version = options?.versionId
    ? document.versions.find((v) => v.id === options.versionId)
    : document.currentVersion;

  if (!version) {
    return null;
  }

  const object = await storage.getObject(version.storageKey);
  if (!object) {
    return null;
  }

  return {
    document,
    version,
    body: object.body,
    contentType: object.contentType || version.contentType,
  };
}
