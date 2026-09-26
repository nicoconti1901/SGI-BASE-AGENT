import type { PrismaClient, WorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  closeDueItemsForEntity,
  upsertOpenDueItemForEntity,
} from "@/lib/automation";
import {
  ACTION_ENTITY_TYPE,
  assertWorkflowTransition,
  dueTitleForAction,
  isWorkflowStatus,
  type WorkflowStatus as DomainWorkflowStatus,
} from "@/domain/operations/nc";

export type CreateNonconformityInput = {
  tenantId: string;
  title: string;
  description?: string;
  ownerName?: string;
  source?: string;
  createdByUserId?: string;
};

export type CreateCorrectiveActionInput = {
  tenantId: string;
  nonconformityId: string;
  title: string;
  description?: string;
  ownerName?: string;
  dueAt?: Date | null;
};

function asDomainStatus(status: WorkflowStatus): DomainWorkflowStatus {
  if (!isWorkflowStatus(status)) {
    throw new Error(`Estado inválido: ${status}`);
  }
  return status;
}

async function syncActionDueItem(
  input: {
    tenantId: string;
    actionId: string;
    actionTitle: string;
    ncTitle: string;
    dueAt: Date | null | undefined;
    status: WorkflowStatus;
  },
  db: PrismaClient,
) {
  if (input.status === "closed" || !input.dueAt) {
    await closeDueItemsForEntity(
      {
        tenantId: input.tenantId,
        entityType: ACTION_ENTITY_TYPE,
        entityId: input.actionId,
      },
      db,
    );
    return;
  }

  await upsertOpenDueItemForEntity(
    {
      tenantId: input.tenantId,
      title: dueTitleForAction({
        actionTitle: input.actionTitle,
        ncTitle: input.ncTitle,
      }),
      entityType: ACTION_ENTITY_TYPE,
      entityId: input.actionId,
      dueAt: input.dueAt,
    },
    db,
  );
}

export async function listNonconformities(
  tenantId: string,
  db: PrismaClient = prisma,
) {
  return db.nonconformity.findMany({
    where: { tenantId },
    include: {
      actions: { orderBy: { dueAt: "asc" } },
      _count: { select: { actions: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getNonconformity(
  tenantId: string,
  id: string,
  db: PrismaClient = prisma,
) {
  return db.nonconformity.findFirst({
    where: { id, tenantId },
    include: {
      actions: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
    },
  });
}

export async function createNonconformity(
  input: CreateNonconformityInput,
  db: PrismaClient = prisma,
) {
  const title = input.title.trim();
  if (title.length < 2) {
    throw new Error("El título de la NC debe tener al menos 2 caracteres");
  }

  return db.nonconformity.create({
    data: {
      tenantId: input.tenantId,
      title,
      description: input.description?.trim() || null,
      ownerName: input.ownerName?.trim() || null,
      source: input.source?.trim() || null,
      createdByUserId: input.createdByUserId ?? null,
      status: "open",
    },
  });
}

export async function updateNonconformityStatus(input: {
  tenantId: string;
  id: string;
  status: string;
  db?: PrismaClient;
}) {
  const db = input.db ?? prisma;
  if (!isWorkflowStatus(input.status)) {
    throw new Error("Estado de NC inválido");
  }

  const current = await db.nonconformity.findFirst({
    where: { id: input.id, tenantId: input.tenantId },
  });
  if (!current) {
    throw new Error("No conformidad no encontrada");
  }

  assertWorkflowTransition(asDomainStatus(current.status), input.status);

  return db.nonconformity.update({
    where: { id: current.id },
    data: { status: input.status },
  });
}

export async function createCorrectiveAction(
  input: CreateCorrectiveActionInput,
  db: PrismaClient = prisma,
) {
  const title = input.title.trim();
  if (title.length < 2) {
    throw new Error("El título de la acción debe tener al menos 2 caracteres");
  }

  const nc = await db.nonconformity.findFirst({
    where: { id: input.nonconformityId, tenantId: input.tenantId },
  });
  if (!nc) {
    throw new Error("No conformidad no encontrada");
  }

  if (input.dueAt && Number.isNaN(input.dueAt.getTime())) {
    throw new Error("Fecha de vencimiento inválida");
  }

  const action = await db.correctiveAction.create({
    data: {
      tenantId: input.tenantId,
      nonconformityId: nc.id,
      title,
      description: input.description?.trim() || null,
      ownerName: input.ownerName?.trim() || null,
      dueAt: input.dueAt ?? null,
      status: "open",
    },
  });

  await syncActionDueItem(
    {
      tenantId: input.tenantId,
      actionId: action.id,
      actionTitle: action.title,
      ncTitle: nc.title,
      dueAt: action.dueAt,
      status: action.status,
    },
    db,
  );

  return action;
}

export async function updateCorrectiveActionStatus(input: {
  tenantId: string;
  id: string;
  status: string;
  db?: PrismaClient;
}) {
  const db = input.db ?? prisma;
  if (!isWorkflowStatus(input.status)) {
    throw new Error("Estado de acción inválido");
  }

  const action = await db.correctiveAction.findFirst({
    where: { id: input.id, tenantId: input.tenantId },
    include: { nonconformity: true },
  });
  if (!action) {
    throw new Error("Acción correctiva no encontrada");
  }

  assertWorkflowTransition(asDomainStatus(action.status), input.status);

  const updated = await db.correctiveAction.update({
    where: { id: action.id },
    data: { status: input.status },
  });

  await syncActionDueItem(
    {
      tenantId: input.tenantId,
      actionId: updated.id,
      actionTitle: updated.title,
      ncTitle: action.nonconformity.title,
      dueAt: updated.dueAt,
      status: updated.status,
    },
    db,
  );

  return updated;
}

export async function updateCorrectiveActionDueDate(input: {
  tenantId: string;
  id: string;
  dueAt: Date | null;
  db?: PrismaClient;
}) {
  const db = input.db ?? prisma;
  const action = await db.correctiveAction.findFirst({
    where: { id: input.id, tenantId: input.tenantId },
    include: { nonconformity: true },
  });
  if (!action) {
    throw new Error("Acción correctiva no encontrada");
  }
  if (input.dueAt && Number.isNaN(input.dueAt.getTime())) {
    throw new Error("Fecha de vencimiento inválida");
  }

  const updated = await db.correctiveAction.update({
    where: { id: action.id },
    data: { dueAt: input.dueAt },
  });

  await syncActionDueItem(
    {
      tenantId: input.tenantId,
      actionId: updated.id,
      actionTitle: updated.title,
      ncTitle: action.nonconformity.title,
      dueAt: updated.dueAt,
      status: updated.status,
    },
    db,
  );

  return updated;
}
