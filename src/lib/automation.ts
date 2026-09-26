import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  classifyDueWindow,
  DUE_REMINDERS_OFFER_CODE,
  NATIVE_OFFER_CATALOG,
  shouldEmitReminder,
  type ReminderKind,
} from "@/domain/automation/due";
import { getEmailSender, type EmailSender } from "@/lib/mail";

export type CreateDueItemInput = {
  tenantId: string;
  title: string;
  entityType: string;
  entityId?: string | null;
  dueAt: Date;
  leadDays?: number;
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

export async function isOfferActiveForTenant(
  tenantId: string,
  offerCode: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const offer = await db.automationOffer.findUnique({
    where: { code: offerCode },
    include: {
      activations: { where: { tenantId, active: true }, take: 1 },
    },
  });
  if (!offer?.enabledGlobal) return false;
  return offer.activations.length > 0;
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

  return db.dueItem.create({
    data: {
      tenantId: input.tenantId,
      title,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      dueAt: input.dueAt,
      leadDays: input.leadDays ?? 7,
      status: "open",
    },
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
};

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
    const openItems = await db.dueItem.findMany({
      where: {
        status: "open",
        ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      },
      include: {
        tenant: {
          include: {
            memberships: {
              where: {
                role: { in: ["tenant_admin", "process_owner"] },
              },
              include: { user: { select: { id: true, email: true, name: true } } },
            },
          },
        },
      },
    });

    let reminded = 0;
    let skippedInactiveOffer = 0;
    const tenantsTouched = new Set<string>();

    for (const item of openItems) {
      const active = await isOfferActiveForTenant(
        item.tenantId,
        DUE_REMINDERS_OFFER_CODE,
        db,
      );
      if (!active) {
        skippedInactiveOffer += 1;
        continue;
      }

      const classification = classifyDueWindow({
        dueAt: item.dueAt,
        now,
        leadDays: item.leadDays,
      });

      if (
        !shouldEmitReminder({
          classification,
          lastReminderKind: item.lastReminderKind,
        })
      ) {
        continue;
      }

      const kind = classification as Exclude<ReminderKind, "none">;
      const title =
        kind === "overdue"
          ? `Vencido: ${item.title}`
          : `Próximo a vencer: ${item.title}`;
      const body = `El ítem "${item.title}" (${item.entityType}) vence el ${item.dueAt.toISOString().slice(0, 10)}.`;

      const recipients = item.tenant.memberships;
      if (recipients.length === 0) {
        await db.inAppNotification.create({
          data: {
            tenantId: item.tenantId,
            userId: null,
            title,
            body,
            dueItemId: item.id,
          },
        });
      } else {
        for (const membership of recipients) {
          await db.inAppNotification.create({
            data: {
              tenantId: item.tenantId,
              userId: membership.userId,
              title,
              body,
              dueItemId: item.id,
            },
          });
          await mail.send({
            to: membership.user.email,
            subject: `[SGI] ${title}`,
            body,
          });
        }
      }

      await db.dueItem.update({
        where: { id: item.id },
        data: {
          lastRemindedAt: now,
          lastReminderKind: kind,
        },
      });

      reminded += 1;
      tenantsTouched.add(item.tenantId);
    }

    const summary = {
      scanned: openItems.length,
      reminded,
      skippedInactiveOffer,
      tenantsTouched: [...tenantsTouched],
    };

    await db.automationRun.update({
      where: { id: run.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        summary,
      },
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
