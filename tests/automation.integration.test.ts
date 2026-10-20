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
  const extraUsers: string[] = [];

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
    await db.site.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: { in: [userId, ...extraUsers] } } });
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

  it("manda un resumen por persona y una notificación por vencimiento, sin duplicar al reintentar", async () => {
    const now = new Date("2027-03-10T12:00:00.000Z");
    const day = 24 * 60 * 60 * 1000;
    const owner = await db.user.create({ data: { name: "Responsable", email: `owner@${slug}.test`, emailVerified: true } });
    extraUsers.push(owner.id);
    await db.membership.create({ data: { userId: owner.id, tenantId, role: "contributor" } });
    const site = await db.site.create({ data: { tenantId, name: "Base Añelo", kind: "base" } });
    await setOfferActivation({ tenantId, offerCode: DUE_REMINDERS_OFFER_CODE, active: true, db });
    // El vencimiento del test anterior ya pasó a vencido y volvería a avisar.
    await db.dueItem.updateMany({ where: { tenantId }, data: { status: "closed" } });

    await createDueItem({ tenantId, title: "Carga del extintor E-07", entityType: "asset_due", dueAt: new Date(now.getTime() - day), ownerUserId: owner.id, siteId: site.id }, db);
    await createDueItem({ tenantId, title: "Medida: señalizar acopio", entityType: "finding_measure", dueAt: new Date(now.getTime() + 2 * day), ownerUserId: owner.id }, db);
    await createDueItem({ tenantId, title: "Vigencia del documento: Plan de emergencia", entityType: "document_validity", dueAt: new Date(now.getTime() + 3 * day) }, db);
    await createDueItem({ tenantId, title: "Todavía lejos", entityType: "risk", dueAt: new Date(now.getTime() + 60 * day) }, db);

    const sender = new MemoryEmailSender();
    const result = await scanDueReminders({ db, mail: sender, now, tenantId });
    expect(result.reminded).toBe(3);

    const toOwner = sender.sent.filter((m) => m.to === `owner@${slug}.test`);
    const toAdmin = sender.sent.filter((m) => m.to === `admin@${slug}.test`);
    expect(toOwner).toHaveLength(1);
    expect(toAdmin).toHaveLength(1);
    expect(toOwner[0].body).toContain("Carga del extintor E-07");
    expect(toOwner[0].body).not.toContain("Plan de emergencia");
    expect(toAdmin[0].body).toContain("Base Añelo");
    expect(toAdmin[0].body).toContain("Plan de emergencia");
    expect(toAdmin[0].subject).toBe("[SGI] Auto Acme: 1 vencido y 2 por vencer");

    const notes = await db.inAppNotification.findMany({ where: { tenantId, createdAt: { gte: new Date(Date.now() - 60_000) }, dueItem: { dueAt: { gte: new Date(now.getTime() - 2 * day) } } } });
    expect(notes).toHaveLength(3);
    expect(notes.filter((n) => n.userId === owner.id)).toHaveLength(2);
    expect(notes.filter((n) => n.userId === null)).toHaveLength(1);

    const again = await scanDueReminders({ db, mail: sender, now, tenantId });
    expect(again.reminded).toBe(0);
    expect(sender.sent).toHaveLength(2);
  });
});
