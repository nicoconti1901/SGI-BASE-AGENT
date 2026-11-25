import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createDueItem, scanDueReminders, setOfferActivation, upsertOpenDueItemForEntity } from "@/lib/automation";
import { DUE_REMINDERS_OFFER_CODE } from "@/domain/automation/due";
import { MemoryEmailSender } from "@/lib/mail";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("día calendario guardado en los vencimientos", () => {
  const db = new PrismaClient();
  const slug = `due-day-${Date.now()}`;
  let tenantId = "";
  const days = (item: { dueOn: Date; remindOn: Date }) =>
    [item.dueOn, item.remindOn].map((d) => d.toISOString().slice(0, 10));

  beforeAll(async () => {
    tenantId = (await createTenantWithTemplate({ name: "Due Day", slug, size: "small", activity: "servicios" })).id;
  });

  afterAll(async () => {
    await db.inAppNotification.deleteMany({ where: { tenantId } });
    await db.automationRun.deleteMany({ where: { tenantId } });
    await db.tenantOfferActivation.deleteMany({ where: { tenantId } });
    await db.dueItem.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  it("los completa en el alta y en el cambio de fecha", async () => {
    const input = { tenantId, title: "Vigencia", entityType: "document_validity", entityId: "doc-1", leadDays: 10 } as const;

    const created = await createDueItem({ ...input, dueAt: new Date("2035-03-05T23:59:59.999-03:00") }, db);
    const updated = await upsertOpenDueItemForEntity({ ...input, dueAt: new Date("2035-04-20T00:00:00.000Z") }, db);

    expect(days(created)).toEqual(["2035-03-05", "2035-02-23"]);
    expect(updated.id).toBe(created.id);
    expect(days(updated)).toEqual(["2035-04-20", "2035-04-10"]);
  });

  it("el control diario no da por vencido lo de hoy y avisa con el día correcto", async () => {
    await setOfferActivation({ tenantId, offerCode: DUE_REMINDERS_OFFER_CODE, active: true, db });
    const item = await createDueItem(
      { tenantId, title: "Calibración", entityType: "instrument_calibration", dueAt: new Date("2036-08-15T23:59:59.999-03:00") },
      db,
    );

    await scanDueReminders({ db, mail: new MemoryEmailSender(), now: new Date("2036-08-15T23:30:00-03:00"), tenantId });

    const notice = await db.inAppNotification.findFirstOrThrow({ where: { tenantId, dueItemId: item.id } });
    expect(notice.title).toBe("Próximo a vencer: Calibración");
    expect(notice.body).toContain("2036-08-15");
  });

  it("la base rechaza una fecha cambiada sin su día calendario", async () => {
    const item = await createDueItem({ tenantId, title: "Riesgo", entityType: "risk", dueAt: new Date("2035-05-05T00:00:00.000Z") }, db);

    await expect(
      db.dueItem.update({ where: { id: item.id }, data: { dueAt: new Date("2035-06-06T00:00:00.000Z") } }),
    ).rejects.toThrow(/due_item_calendar_check/);
    await expect(db.dueItem.update({ where: { id: item.id }, data: { leadDays: 30 } })).rejects.toThrow(/due_item_calendar_check/);
  });
});
