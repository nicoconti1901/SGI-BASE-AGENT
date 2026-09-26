import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  upsertOpenDueItemForEntity,
  closeDueItemsForEntity,
} from "@/lib/automation";
import { getEmailSender } from "@/lib/mail";
import { assertCanPublishFinding } from "@/domain/findings/publish";
import { assertCanCloseMeasureWithEvidence } from "@/domain/findings/attachments";
import {
  FINDING_MEASURE_ENTITY_TYPE,
  FINDING_TYPE_LABELS,
  type FindingDraft,
  type FindingType,
  type FindingsListFilters,
  type RootCauseAnalysis,
  labelFindingType,
} from "@/domain/findings/types";

export function buildFindingsWhere(
  tenantId: string,
  filters: FindingsListFilters = {},
): Prisma.FindingWhereInput {
  const where: Prisma.FindingWhereInput = { tenantId };

  if (filters.type) {
    where.type = filters.type;
  }

  if (!filters.status || filters.status === "all") {
    if (!filters.status) {
      where.status = { not: "cancelled" };
    }
  } else {
    where.status = filters.status;
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listFindings(
  tenantId: string,
  filters: FindingsListFilters = {},
  db: PrismaClient = prisma,
) {
  return db.finding.findMany({
    where: buildFindingsWhere(tenantId, filters),
    include: {
      measures: { orderBy: { dueAt: "asc" } },
      notifyRecipients: true,
      _count: { select: { measures: true } },
    },
    orderBy: [{ detectedAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getFinding(
  tenantId: string,
  id: string,
  db: PrismaClient = prisma,
) {
  return db.finding.findFirst({
    where: { id, tenantId },
    include: {
      measures: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        include: {
          evidence: { orderBy: { createdAt: "desc" } },
        },
      },
      notifyRecipients: true,
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listTenantMemberOptions(
  tenantId: string,
  db: PrismaClient = prisma,
) {
  const memberships = await db.membership.findMany({
    where: { tenantId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));
}

export async function createFindingDraft(input: {
  tenantId: string;
  type: FindingType;
  title: string;
  description: string;
  detectedAt: Date;
  source?: string;
  location?: string;
  severity?: string;
  createdByUserId: string;
  rca?: RootCauseAnalysis | null;
  db?: PrismaClient;
}) {
  const db = input.db ?? prisma;
  const title = input.title.trim();
  if (title.length < 2) throw new Error("Título inválido");

  return db.finding.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      status: "draft",
      title,
      description: input.description.trim(),
      detectedAt: input.detectedAt,
      source: input.source?.trim() || null,
      location: input.location?.trim() || null,
      severity: input.severity?.trim() || null,
      createdByUserId: input.createdByUserId,
      rcaJson: input.rca
        ? (input.rca as unknown as Prisma.InputJsonValue)
        : undefined,
      rcaStatus: input.rca?.status === "confirmed" ? "confirmed" : "incomplete",
      rootCause: input.rca?.rootCause ?? null,
    },
  });
}

export async function saveFindingDraft(input: {
  tenantId: string;
  findingId: string;
  draft: FindingDraft;
  db?: PrismaClient;
}) {
  const db = input.db ?? prisma;
  const existing = await db.finding.findFirst({
    where: { id: input.findingId, tenantId: input.tenantId },
  });
  if (!existing) throw new Error("Hallazgo no encontrado");
  if (existing.status !== "draft") {
    throw new Error("Solo se pueden editar borradores completos desde el wizard");
  }

  await db.findingMeasure.deleteMany({ where: { findingId: existing.id } });
  await db.findingNotifyRecipient.deleteMany({
    where: { findingId: existing.id },
  });

  return db.finding.update({
    where: { id: existing.id },
    data: {
      type: input.draft.type,
      title: input.draft.title.trim(),
      description: input.draft.description.trim(),
      detectedAt: input.draft.detectedAt,
      source: input.draft.source?.trim() || null,
      location: input.draft.location?.trim() || null,
      severity: input.draft.severity?.trim() || null,
      rcaJson: input.draft.rca as unknown as Prisma.InputJsonValue,
      rcaStatus:
        input.draft.rca.status === "confirmed" ? "confirmed" : "incomplete",
      rootCause: input.draft.rca.rootCause,
      measures: {
        create: input.draft.measures.map((m) => ({
          tenantId: input.tenantId,
          kind: m.kind,
          title: m.title.trim(),
          description: m.description?.trim() || null,
          ownerUserId: m.ownerUserId,
          dueAt: m.dueAt,
          linkedRootCause: m.linkedRootCause,
          status: "open",
        })),
      },
      notifyRecipients: {
        create: [...new Set(input.draft.notifyUserIds)].map((userId) => ({
          userId,
        })),
      },
    },
    include: { measures: true, notifyRecipients: true },
  });
}

export async function publishFinding(input: {
  tenantId: string;
  findingId: string;
  draft: FindingDraft;
  actorUserId: string;
  db?: PrismaClient;
}) {
  const db = input.db ?? prisma;
  assertCanPublishFinding(input.draft);

  const memberIds = new Set(
    (
      await db.membership.findMany({
        where: { tenantId: input.tenantId },
        select: { userId: true },
      })
    ).map((m) => m.userId),
  );

  for (const measure of input.draft.measures) {
    if (!memberIds.has(measure.ownerUserId)) {
      throw new Error("El responsable de una medida no es miembro del tenant");
    }
  }
  for (const userId of input.draft.notifyUserIds) {
    if (!memberIds.has(userId)) {
      throw new Error("Un notificado no es miembro del tenant");
    }
  }

  const saved = await saveFindingDraft({
    tenantId: input.tenantId,
    findingId: input.findingId,
    draft: input.draft,
    db,
  });

  const published = await db.finding.update({
    where: { id: saved.id },
    data: {
      status: "published",
      publishedAt: new Date(),
    },
    include: { measures: true, notifyRecipients: true },
  });

  for (const measure of published.measures) {
    if (measure.dueAt) {
      await upsertOpenDueItemForEntity(
        {
          tenantId: input.tenantId,
          title: `${labelFindingType(published.type as FindingType)} · ${measure.title}`,
          entityType: FINDING_MEASURE_ENTITY_TYPE,
          entityId: measure.id,
          dueAt: measure.dueAt,
        },
        db,
      );
    }
  }

  const mail = getEmailSender();
  const typeLabel = FINDING_TYPE_LABELS[published.type as FindingType];
  const notifyIds = new Set(published.notifyRecipients.map((r) => r.userId));
  for (const measure of published.measures) {
    notifyIds.add(measure.ownerUserId);
  }

  const users = await db.user.findMany({
    where: { id: { in: [...notifyIds] } },
    select: { id: true, email: true, name: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  for (const recipient of published.notifyRecipients) {
    const user = byId.get(recipient.userId);
    const title = `Hallazgo publicado: ${published.title}`;
    const body = `Se publicó un hallazgo (${typeLabel}). Causa raíz: ${published.rootCause}. Revisá responsabilidades en el portal.`;
    await db.inAppNotification.create({
      data: {
        tenantId: input.tenantId,
        userId: recipient.userId,
        title,
        body,
      },
    });
    if (user) {
      await mail.send({
        to: user.email,
        subject: `[SGI] ${title}`,
        body,
      });
    }
  }

  for (const measure of published.measures) {
    if (published.notifyRecipients.some((r) => r.userId === measure.ownerUserId)) {
      continue;
    }
    const user = byId.get(measure.ownerUserId);
    const title = `Medida asignada: ${measure.title}`;
    const body = `Se te asignó una medida (${measure.kind}) del hallazgo "${published.title}"${
      measure.dueAt ? `, vence ${measure.dueAt.toISOString().slice(0, 10)}` : ""
    }.`;
    await db.inAppNotification.create({
      data: {
        tenantId: input.tenantId,
        userId: measure.ownerUserId,
        title,
        body,
      },
    });
    if (user) {
      await mail.send({
        to: user.email,
        subject: `[SGI] ${title}`,
        body,
      });
    }
  }

  return published;
}

export async function closeFindingMeasure(input: {
  tenantId: string;
  measureId: string;
  db?: PrismaClient;
}) {
  const db = input.db ?? prisma;
  const measure = await db.findingMeasure.findFirst({
    where: { id: input.measureId, tenantId: input.tenantId },
    include: {
      evidence: { where: { kind: "measure_evidence" } },
    },
  });
  if (!measure) throw new Error("Medida no encontrada");
  if (measure.status === "closed") {
    throw new Error("La medida ya está cerrada");
  }

  assertCanCloseMeasureWithEvidence(measure.evidence.length);

  const updated = await db.findingMeasure.update({
    where: { id: measure.id },
    data: { status: "closed" },
  });

  await closeDueItemsForEntity(
    {
      tenantId: input.tenantId,
      entityType: FINDING_MEASURE_ENTITY_TYPE,
      entityId: measure.id,
    },
    db,
  );

  return updated;
}
