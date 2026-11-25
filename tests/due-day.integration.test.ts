import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createDueItem, listDueItems, scanDueReminders, setOfferActivation, upsertOpenDueItemForEntity } from "@/lib/automation";
import { hasOverdueActionsForTarget } from "@/lib/actions";
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
    await db.action.deleteMany({ where: { tenantId } });
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

  it("lista en el orden del día calendario que muestra", async () => {
    await createDueItem({ tenantId, title: "Orden B (día 2)", entityType: "risk", dueAt: new Date("2039-01-02T00:00:00.000Z") }, db);
    await createDueItem({ tenantId, title: "Orden A (día 1)", entityType: "risk", dueAt: new Date("2039-01-01T23:59:59.999-03:00") }, db);

    const titles = (await listDueItems(tenantId, db)).map((i) => i.title).filter((t) => t.startsWith("Orden"));

    expect(titles).toEqual(["Orden A (día 1)", "Orden B (día 2)"]);
  });

  it.each([
    ["fecha sin hora de hoy", "2040-06-10T00:00:00.000Z", false],
    ["fin del día de hoy", "2040-06-10T23:59:59.999-03:00", false],
    ["fecha sin hora de ayer", "2040-06-09T00:00:00.000Z", true],
    ["fin del día de ayer", "2040-06-09T23:59:59.999-03:00", true],
  ])("acción con %s: vencida = %s", async (name, dueAt, expected) => {
    await db.action.create({
      data: { tenantId, title: name, ownerUserId: "x", dueAt: new Date(dueAt), links: { create: { targetType: "risk", targetId: name } } },
    });

    expect(await hasOverdueActionsForTarget(tenantId, "risk", name, new Date("2040-06-10T22:00:00-03:00"), db)).toBe(expected);
  });

  it("la base rechaza una fecha cambiada sin su día calendario", async () => {
    const item = await createDueItem({ tenantId, title: "Riesgo", entityType: "risk", dueAt: new Date("2035-05-05T00:00:00.000Z") }, db);

    await expect(
      db.dueItem.update({ where: { id: item.id }, data: { dueAt: new Date("2035-06-06T00:00:00.000Z") } }),
    ).rejects.toThrow(/due_item_calendar_check/);
    await expect(db.dueItem.update({ where: { id: item.id }, data: { leadDays: 30 } })).rejects.toThrow(/due_item_calendar_check/);
  });
});
