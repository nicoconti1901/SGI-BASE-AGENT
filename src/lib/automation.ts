import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  classifyDueWindow,
  DUE_REMINDERS_OFFER_CODE,
  NATIVE_OFFER_CATALOG,
  reminderStartsAt,
  shouldEmitReminder,
  type ReminderKind,
} from "@/domain/automation/due";
import { buildReminderDigests, type DigestItem, type DigestMember } from "@/domain/automation/digest";
import { getEmailSender, type EmailSender } from "@/lib/mail";

export type CreateDueItemInput = {
  tenantId: string;
  title: string;
  entityType: string;
  entityId?: string | null;
  dueAt: Date;
  leadDays?: number;
  /** Responsable: recibe el vencimiento en su resumen diario. */
  ownerUserId?: string | null;
  siteId?: string | null;
  personId?: string | null;
};

export async function ensureNativeOffersSeeded(db: PrismaClient = prisma) {
  for (const offer of NATIVE_OFFER_CATALOG) {
    await db.automationOffer.upsert({
      where: { code: offer.code },
      create: {
        code: offer.code,
        name: offer.name,
        description: offer.description,
        kind: offer.kind,
        enabledGlobal: true,
      },
      update: {
        name: offer.name,
        description: offer.description,
        kind: offer.kind,
      },
    });
  }
}

export async function listOffersWithActivation(
  tenantId: string,
  db: PrismaClient = prisma,
) {
  await ensureNativeOffersSeeded(db);
  const offers = await db.automationOffer.findMany({
    orderBy: { code: "asc" },
    include: {
      activations: { where: { tenantId } },
    },
  });
  return offers.map((offer) => ({
    ...offer,
    activation: offer.activations[0] ?? null,
  }));
}

export async function setOfferActivation(input: {
  tenantId: string;
  offerCode: string;
  active: boolean;
  db?: PrismaClient;
}) {
  const db = input.db ?? prisma;
  await ensureNativeOffersSeeded(db);
  const offer = await db.automationOffer.findUnique({
    where: { code: input.offerCode },
  });
  if (!offer) {
    throw new Error(`Oferta desconocida: ${input.offerCode}`);
  }
  if (!offer.enabledGlobal && input.active) {
    throw new Error("La oferta está deshabilitada a nivel plataforma");
  }

  return db.tenantOfferActivation.upsert({
    where: {
      tenantId_offerId: { tenantId: input.tenantId, offerId: offer.id },
    },
    create: {
      tenantId: input.tenantId,
      offerId: offer.id,
      active: input.active,
      activatedAt: input.active ? new Date() : new Date(),
      deactivatedAt: input.active ? null : new Date(),
    },
    update: {
      active: input.active,
      deactivatedAt: input.active ? null : new Date(),
      ...(input.active ? { activatedAt: new Date() } : {}),
    },
  });
}

export async function createDueItem(
  input: CreateDueItemInput,
  db: PrismaClient = prisma,
) {
  const title = input.title.trim();
  if (title.length < 2) {
    throw new Error("El título del vencimiento debe tener al menos 2 caracteres");
  }
  if (Number.isNaN(input.dueAt.getTime())) {
    throw new Error("Fecha de vencimiento inválida");
  }

  const leadDays = input.leadDays ?? 7;
  return db.dueItem.create({
    data: {
      tenantId: input.tenantId,
      title,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      dueAt: input.dueAt,
      leadDays,
      remindAt: reminderStartsAt(input.dueAt, leadDays),
      ownerUserId: input.ownerUserId ?? null,
      siteId: input.siteId ?? null,
      personId: input.personId ?? null,
      status: "open",
    },
  });
}

/** Crea o actualiza el DueItem abierto de una entidad (NC/acción/etc.). */
export async function upsertOpenDueItemForEntity(
  input: CreateDueItemInput & { entityId: string },
  db: PrismaClient = prisma,
) {
  const existing = await db.dueItem.findFirst({
    where: {
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: "open",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const leadDays = input.leadDays ?? existing.leadDays;
    return db.dueItem.update({
      where: { id: existing.id },
      data: {
        title: input.title.trim(),
        dueAt: input.dueAt,
        leadDays,
        remindAt: reminderStartsAt(input.dueAt, leadDays),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.siteId !== undefined ? { siteId: input.siteId } : {}),
        ...(input.personId !== undefined ? { personId: input.personId } : {}),
        lastReminderKind: null,
        lastRemindedAt: null,
      },
    });
  }

  return createDueItem(input, db);
}

export async function closeDueItemsForEntity(
  input: {
    tenantId: string;
    entityType: string;
    entityId: string;
  },
  db: PrismaClient = prisma,
) {
  return db.dueItem.updateMany({
    where: {
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: "open",
    },
    data: { status: "closed" },
  });
}

export async function listDueItems(
  tenantId: string,
  db: PrismaClient = prisma,
) {
  return db.dueItem.findMany({
    where: { tenantId },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
}

export async function listTenantNotifications(
  tenantId: string,
  db: PrismaClient = prisma,
  take = 30,
) {
  return db.inAppNotification.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listRecentAutomationRuns(
  db: PrismaClient = prisma,
  take = 20,
) {
  return db.automationRun.findMany({
    orderBy: { startedAt: "desc" },
    take,
    include: { tenant: { select: { name: true, slug: true } } },
  });
}

export type ScanDueRemindersResult = {
  runId: string;
  scanned: number;
  reminded: number;
  skippedInactiveOffer: number;
  tenantsTouched: string[];
  emailsSent: number;
};

/**
 * Recorre los vencimientos que entraron en ventana (remindAt ≤ ahora) y avisa una vez por
 * transición (próximo → vencido). En la app: una notificación por vencimiento, al responsable
 * o a la empresa. Por mail: un resumen por persona (ver buildReminderDigests).
 */
export async function scanDueReminders(options?: {
  db?: PrismaClient;
  mail?: EmailSender;
  now?: Date;
  tenantId?: string;
}): Promise<ScanDueRemindersResult> {
  const db = options?.db ?? prisma;
  const mail = options?.mail ?? getEmailSender();
  const now = options?.now ?? new Date();

  await ensureNativeOffersSeeded(db);

  const run = await db.automationRun.create({
    data: {
      tenantId: options?.tenantId ?? null,
      offerCode: DUE_REMINDERS_OFFER_CODE,
      status: "running",
    },
  });

  try {
    const offer = await db.automationOffer.findUnique({
      where: { code: DUE_REMINDERS_OFFER_CODE },
      include: { activations: { where: { active: true }, select: { tenantId: true } } },
    });
    const activeTenants = offer?.enabledGlobal ? offer.activations.map((a) => a.tenantId) : [];
    const inWindow = {
      status: "open" as const,
      remindAt: { lte: now },
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
    };

    const [openItems, skippedInactiveOffer] = await Promise.all([
      db.dueItem.findMany({
        where: { ...inWindow, AND: [{ tenantId: { in: activeTenants } }] },
        select: {
          id: true,
          tenantId: true,
          title: true,
          entityType: true,
          dueAt: true,
          leadDays: true,
          ownerUserId: true,
          lastReminderKind: true,
          tenant: { select: { name: true } },
          site: { select: { name: true } },
        },
        orderBy: { dueAt: "asc" },
      }),
      db.dueItem.count({ where: { ...inWindow, AND: [{ tenantId: { notIn: activeTenants } }] } }),
    ]);

    const claimed: DigestItem[] = [];
    for (const item of openItems) {
      const classification = classifyDueWindow({ dueAt: item.dueAt, now, leadDays: item.leadDays });
      if (!shouldEmitReminder({ classification, lastReminderKind: item.lastReminderKind })) continue;
      const kind = classification as Exclude<ReminderKind, "none">;

      // Claim atómico: solo el scan que cambia lastReminderKind avisa.
      // Evita duplicados si n8n reintenta o dos scans corren a la vez.
      const claim = await db.dueItem.updateMany({
        where: { id: item.id, status: "open", lastReminderKind: item.lastReminderKind },
        data: { lastRemindedAt: now, lastReminderKind: kind },
      });
      if (claim.count === 0) continue;

      claimed.push({
        id: item.id,
        tenantId: item.tenantId,
        tenantName: item.tenant.name,
        title: item.title,
        kind,
        dueAt: item.dueAt,
        ownerUserId: item.ownerUserId,
        siteName: item.site?.name ?? null,
      });
    }

    const tenantIds = [...new Set(claimed.map((i) => i.tenantId))];
    const ownerIds = [...new Set(claimed.flatMap((i) => (i.ownerUserId ? [i.ownerUserId] : [])))];
    const memberships = tenantIds.length
      ? await db.membership.findMany({
          where: {
            tenantId: { in: tenantIds },
            OR: [{ role: "tenant_admin" }, { userId: { in: ownerIds } }],
          },
          select: { tenantId: true, userId: true, role: true, user: { select: { email: true } } },
        })
      : [];
    const members: DigestMember[] = memberships.map((m) => ({
      tenantId: m.tenantId,
      userId: m.userId,
      email: m.user.email,
      role: m.role,
    }));
    const isMember = (tenantId: string, userId: string | null) =>
      userId !== null && members.some((m) => m.tenantId === tenantId && m.userId === userId);

    if (claimed.length > 0) {
      await db.inAppNotification.createMany({
        data: claimed.map((item) => ({
          tenantId: item.tenantId,
          userId: isMember(item.tenantId, item.ownerUserId) ? item.ownerUserId : null,
          title: item.kind === "overdue" ? `Vencido: ${item.title}` : `Próximo a vencer: ${item.title}`,
          body: `"${item.title}" vence el ${item.dueAt.toISOString().slice(0, 10)}.`,
          dueItemId: item.id,
        })),
      });
    }

    const digests = buildReminderDigests(claimed, members);
    for (const digest of digests) {
      await mail.send({ to: digest.to, subject: digest.subject, body: digest.body });
    }

    const summary = {
      scanned: openItems.length,
      reminded: claimed.length,
      skippedInactiveOffer,
      tenantsTouched: tenantIds,
      emailsSent: digests.length,
    };

    await db.automationRun.update({
      where: { id: run.id },
      data: { status: "succeeded", finishedAt: new Date(), summary },
    });

    return { runId: run.id, ...summary };
  } catch (error) {
    await db.automationRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : "Error en scan",
      },
    });
    throw error;
  }
}
