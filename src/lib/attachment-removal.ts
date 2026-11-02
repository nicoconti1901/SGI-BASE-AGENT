import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import {
  attachmentLock,
  canRemoveAttachment,
  type AttachmentActor,
  type AttachmentKind,
  type AttachmentParentState,
} from "@/domain/attachments/removal";

export class AttachmentRemovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentRemovalError";
  }
}

type Db = PrismaClient;

type Found = {
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: string | null;
  /** Registro al que estaba adjunto, para dejar constancia. */
  parentId: string;
  parent: AttachmentParentState;
};

type Loader = {
  find: (db: Db, tenantId: string, id: string) => Promise<Found | null>;
  remove: (db: Db, id: string) => Promise<unknown>;
};

function pick(a: {
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: string | null;
}) {
  return {
    storageKey: a.storageKey,
    fileName: a.fileName,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    uploadedById: a.uploadedById,
  };
}

/** Los dos tipos de adjunto de un hallazgo viven en la misma tabla y se distinguen por `kind`. */
function findingLoader(kind: "finding_doc" | "measure_evidence"): Loader {
  return {
    find: async (db, tenantId, id) => {
      const a = await db.findingAttachment.findFirst({
        where: { id, tenantId, kind },
        include: { finding: { select: { status: true } }, measure: { select: { status: true } } },
      });
      if (!a) return null;
      return {
        ...pick(a),
        parentId: a.findingId,
        parent: { status: a.finding.status, measureStatus: a.measure?.status ?? null },
      };
    },
    remove: (db, id) => db.findingAttachment.delete({ where: { id } }),
  };
}

const LOADERS: Record<AttachmentKind, Loader> = {
  finding_doc: findingLoader("finding_doc"),
  measure_evidence: findingLoader("measure_evidence"),
  action: {
    find: async (db, tenantId, id) => {
      const a = await db.actionAttachment.findFirst({
        where: { id, tenantId },
        include: { action: { select: { status: true } } },
      });
      return a ? { ...pick(a), parentId: a.actionId, parent: { status: a.action.status } } : null;
    },
    remove: (db, id) => db.actionAttachment.delete({ where: { id } }),
  },
  audit_evidence: {
    find: async (db, tenantId, id) => {
      const a = await db.auditEvidenceAttachment.findFirst({
        where: { id, tenantId },
        include: { item: { select: { auditId: true, audit: { select: { status: true } } } } },
      });
      return a ? { ...pick(a), parentId: a.item.auditId, parent: { status: a.item.audit.status } } : null;
    },
    remove: (db, id) => db.auditEvidenceAttachment.delete({ where: { id } }),
  },
  audit_report: {
    find: async (db, tenantId, id) => {
      const a = await db.auditReportAttachment.findFirst({
        where: { id, tenantId },
        include: { audit: { select: { status: true } } },
      });
      return a ? { ...pick(a), parentId: a.auditId, parent: { status: a.audit.status } } : null;
    },
    remove: (db, id) => db.auditReportAttachment.delete({ where: { id } }),
  },
  inspection: {
    find: async (db, tenantId, id) => {
      const a = await db.inspectionAttachment.findFirst({
        where: { id, tenantId },
        include: { inspection: { select: { status: true } }, answer: { select: { inspectionId: true, inspection: { select: { status: true } } } } },
      });
      if (!a) return null;
      return {
        ...pick(a),
        parentId: a.inspectionId ?? a.answer?.inspectionId ?? a.assetId ?? a.id,
        parent: { status: a.inspection?.status ?? a.answer?.inspection.status ?? null },
      };
    },
    remove: (db, id) => db.inspectionAttachment.delete({ where: { id } }),
  },
  calibration: {
    find: async (db, tenantId, id) => {
      const a = await db.calibrationAttachment.findFirst({
        where: { id, tenantId },
        include: { record: { select: { status: true } } },
      });
      return a ? { ...pick(a), parentId: a.recordId, parent: { status: a.record.status } } : null;
    },
    remove: (db, id) => db.calibrationAttachment.delete({ where: { id } }),
  },
  training: {
    find: async (db, tenantId, id) => {
      const a = await db.trainingAttachment.findFirst({
        where: { id, tenantId },
        include: { session: { select: { status: true, voidedAt: true } }, record: { select: { voidedAt: true } } },
      });
      if (!a) return null;
      return {
        ...pick(a),
        parentId: a.sessionId ?? a.recordId ?? a.id,
        parent: { voided: Boolean(a.session?.voidedAt || a.record?.voidedAt || a.session?.status === "cancelled") },
      };
    },
    remove: (db, id) => db.trainingAttachment.delete({ where: { id } }),
  },
};

/**
 * Quita un archivo adjunto: controla quién lo pide y si el registro lo permite, borra la fila y deja constancia
 * en la misma transacción, y después borra el archivo guardado. Si el almacenamiento falla, el archivo queda
 * huérfano pero ya no aparece en ninguna pantalla.
 */
export async function removeAttachment(input: {
  tenantId: string;
  kind: AttachmentKind;
  attachmentId: string;
  actor: AttachmentActor;
  db?: Db;
  storage?: ObjectStorage;
}) {
  const db = input.db ?? prisma;
  const loader = LOADERS[input.kind];
  const found = await loader.find(db, input.tenantId, input.attachmentId);
  if (!found) throw new AttachmentRemovalError("El archivo ya no existe");
  if (!canRemoveAttachment(input.actor, found.uploadedById)) {
    throw new AttachmentRemovalError("Solo quien subió el archivo o un responsable puede quitarlo");
  }
  const lock = attachmentLock(input.kind, found.parent);
  if (lock) throw new AttachmentRemovalError(lock);

  await db.$transaction(async (tx) => {
    await loader.remove(tx as Db, input.attachmentId);
    await tx.attachmentRemoval.create({
      data: {
        tenantId: input.tenantId,
        kind: input.kind,
        parentId: found.parentId,
        fileName: found.fileName,
        contentType: found.contentType,
        sizeBytes: found.sizeBytes,
        uploadedById: found.uploadedById,
        removedByUserId: input.actor.userId,
      },
    });
  });

  try {
    await (input.storage ?? getObjectStorage()).deleteObject(found.storageKey);
  } catch {
    // El archivo ya no figura en ninguna pantalla; queda huérfano en el almacenamiento.
  }
  return { fileName: found.fileName };
}
