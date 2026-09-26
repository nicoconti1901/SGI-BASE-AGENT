import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import {
  createDueItem,
  scanDueReminders,
  setOfferActivation,
} from "@/lib/automation";
import { MemoryEmailSender } from "@/lib/mail";
import { DUE_REMINDERS_OFFER_CODE } from "@/domain/automation/due";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("automation due reminders integration", () => {
  const db = new PrismaClient();
  const mail = new MemoryEmailSender();
  const slug = `auto-${Date.now()}`;
  let tenantId = "";
  let userId = "";

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({
      name: "Auto Acme",
      slug,
      size: "small",
      activity: "servicios",
    });
    tenantId = tenant.id;

    const user = await db.user.create({
      data: {
        name: "Admin Tenant",
        email: `admin@${slug}.test`,
        emailVerified: true,
      },
    });
    userId = user.id;

    await db.membership.create({
      data: {
        userId,
        tenantId,
        role: "tenant_admin",
      },
    });
  });

  afterAll(async () => {
    await db.inAppNotification.deleteMany({ where: { tenantId } });
    await db.dueItem.deleteMany({ where: { tenantId } });
    await db.tenantOfferActivation.deleteMany({ where: { tenantId } });
    await db.automationRun.deleteMany({ where: { tenantId } });
    await db.membership.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("skips reminders when offer is inactive, then emits when activated", async () => {
    const now = new Date("2026-09-26T12:00:00.000Z");
    await createDueItem(
      {
        tenantId,
        title: "Revisión documental",
        entityType: "document",
        dueAt: new Date("2026-09-28T12:00:00.000Z"),
        leadDays: 7,
      },
      db,
    );

    const skipped = await scanDueReminders({
      db,
      mail,
      now,
      tenantId,
    });
    expect(skipped.reminded).toBe(0);
    expect(skipped.skippedInactiveOffer).toBeGreaterThanOrEqual(1);

    await setOfferActivation({
      tenantId,
      offerCode: DUE_REMINDERS_OFFER_CODE,
      active: true,
      db,
    });

    const first = await scanDueReminders({ db, mail, now, tenantId });
    expect(first.reminded).toBe(1);

    const notifications = await db.inAppNotification.findMany({
      where: { tenantId },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(mail.sent.some((m) => m.to.includes(slug))).toBe(true);

    const second = await scanDueReminders({ db, mail, now, tenantId });
    expect(second.reminded).toBe(0);

    const runs = await db.automationRun.findMany({
      where: { offerCode: DUE_REMINDERS_OFFER_CODE, tenantId },
    });
    expect(runs.every((r) => r.status === "succeeded")).toBe(true);
  });
});
