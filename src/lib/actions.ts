import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  upsertOpenDueItemForEntity,
  closeDueItemsForEntity,
} from "@/lib/automation";
import {
  ACTION_ENTITY_TYPE,
  assertCanCompleteAction,
  assertCanRecordEffectiveness,
  type ActionDraft,
  type ActionLinkTarget,
  type EffectivenessStatus,
} from "@/domain/actions/types";

export async function createAction(
  input: {
    tenantId: string;
    draft: ActionDraft;
    createdByUserId?: string;
  },
  db: PrismaClient = prisma,
) {
  const { draft } = input;
  if (draft.title.trim().length < 2) {
    throw new Error("El título de la acción es obligatorio");
  }
  if (!draft.ownerUserId) {
    throw new Error("La acción necesita un responsable");
  }
  if (draft.links.length < 1) {
    throw new Error("La acción debe vincularse al menos a un ítem");
  }

  const action = await db.action.create({
    data: {
      tenantId: input.tenantId,
      title: draft.title.trim(),
      description: draft.description?.trim() || null,
      ownerUserId: draft.ownerUserId,
      dueAt: draft.dueAt,
      createdByUserId: input.createdByUserId ?? null,
      links: {
        create: draft.links.map((l) => ({
          targetType: l.targetType,
          targetId: l.targetId,
        })),
      },
    },
    include: { links: true, attachments: true },
  });

  if (draft.dueAt) {
    await upsertOpenDueItemForEntity(
      {
        tenantId: input.tenantId,
        title: `Acción: ${action.title}`,
        entityType: ACTION_ENTITY_TYPE,
        entityId: action.id,
        dueAt: draft.dueAt,
      },
      db,
    );
  }

  return action;
}

export async function getAction(
  tenantId: string,
  id: string,
  db: PrismaClient = prisma,
) {
  return db.action.findFirst({
    where: { id, tenantId },
    include: {
      links: true,
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listActionsForTarget(
  tenantId: string,
  targetType: ActionLinkTarget,
  targetId: string,
  db: PrismaClient = prisma,
) {
  return db.action.findMany({
    where: {
      tenantId,
      links: { some: { targetType, targetId } },
    },
    include: {
      links: true,
      attachments: { orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
}

export async function listOpenActions(
  tenantId: string,
  db: PrismaClient = prisma,
) {
  return db.action.findMany({
    where: {
      tenantId,
      status: { in: ["open", "in_progress"] },
    },
    include: { links: true },
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
  });
}

export async function listActionsNeedingEffectiveness(
  tenantId: string,
  db: PrismaClient = prisma,
) {
  return db.action.findMany({
    where: {
      tenantId,
      status: "completed",
      effectivenessStatus: "pending",
    },
    include: { links: true },
    orderBy: { completedAt: "desc" },
  });
}

export async function completeAction(
  input: {
    tenantId: string;
    actionId: string;
  },
  db: PrismaClient = prisma,
) {
  const action = await getAction(input.tenantId, input.actionId, db);
  if (!action) throw new Error("Acción no encontrada");
  if (action.status === "completed") {
    throw new Error("La acción ya está completada");
  }
  if (action.status === "cancelled") {
    throw new Error("No se puede completar una acción anulada");
  }

  assertCanCompleteAction(action.attachments.length);

  const updated = await db.action.update({
    where: { id: action.id },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
    include: { links: true, attachments: true },
  });

  await closeDueItemsForEntity(
    {
      tenantId: input.tenantId,
      entityType: ACTION_ENTITY_TYPE,
      entityId: action.id,
    },
    db,
  );

  return updated;
}

export async function recordActionEffectiveness(
  input: {
    tenantId: string;
    actionId: string;
    effectiveness: EffectivenessStatus;
    note?: string;
  },
  db: PrismaClient = prisma,
) {
  const action = await getAction(input.tenantId, input.actionId, db);
  if (!action) throw new Error("Acción no encontrada");

  assertCanRecordEffectiveness({
    actionStatus: action.status,
    effectiveness: input.effectiveness,
    note: input.note,
  });

  return db.action.update({
    where: { id: action.id },
    data: {
      effectivenessStatus: input.effectiveness,
      effectivenessNote: input.note?.trim() || null,
      effectivenessAt: new Date(),
    },
    include: { links: true, attachments: true },
  });
}

export async function hasOverdueActionsForTarget(
  tenantId: string,
  targetType: ActionLinkTarget,
  targetId: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<boolean> {
  const count = await db.action.count({
    where: {
      tenantId,
      status: { in: ["open", "in_progress"] },
      dueAt: { lt: now },
      links: { some: { targetType, targetId } },
    },
  });
  return count > 0;
}
