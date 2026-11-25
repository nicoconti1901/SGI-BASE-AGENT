import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { scanDueReminders, setOfferActivation, upsertOpenDueItemForEntity } from "@/lib/automation";
import { syncOpenDueItem, type DueItemSpec } from "@/lib/inspection-support";
import { DUE_REMINDERS_OFFER_CODE } from "@/domain/automation/due";
import { MemoryEmailSender } from "@/lib/mail";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("volver a guardar un vencimiento no duplica el aviso", () => {
  const db = new PrismaClient();
  const slug = `due-reset-${Date.now()}`;
  let tenantId = "";
  let anaId = "";
  let luisId = "";

  beforeAll(async () => {
    tenantId = (await createTenantWithTemplate({ name: "Due Reset", slug, size: "small", activity: "servicios" })).id;
    const [ana, luis] = await Promise.all(
      ["ana", "luis"].map((name) => db.user.create({ data: { name, email: `${name}@${slug}.test`, emailVerified: true } })),
    );
    anaId = ana.id;
    luisId = luis.id;
    await db.membership.createMany({
      data: [anaId, luisId].map((userId) => ({ tenantId, userId, role: "contributor" as const })),
    });
    await setOfferActivation({ tenantId, offerCode: DUE_REMINDERS_OFFER_CODE, active: true, db });
  });

  afterAll(async () => {
    await db.inAppNotification.deleteMany({ where: { tenantId } });
    await db.automationRun.deleteMany({ where: { tenantId } });
    await db.tenantOfferActivation.deleteMany({ where: { tenantId } });
    await db.dueItem.deleteMany({ where: { tenantId } });
    await db.membership.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: { in: [anaId, luisId] } } });
    await db.$disconnect();
  });

  const sent = { lastReminderKind: "upcoming", lastRemindedAt: new Date("2037-01-01T12:00:00.000Z") };
  const markSent = (id: string) => db.dueItem.update({ where: { id }, data: sent });
  const reload = (id: string) => db.dueItem.findUniqueOrThrow({ where: { id } });
  const reset = { lastReminderKind: null, lastRemindedAt: null };

  const writers = {
    upsertOpenDueItemForEntity: (spec: DueItemSpec) => upsertOpenDueItemForEntity(spec, db),
    syncOpenDueItem: (spec: DueItemSpec) => syncOpenDueItem(db, spec),
  };

  describe.each(Object.entries(writers))("%s", (name, save) => {
    const spec = (): DueItemSpec => ({
      tenantId,
      entityType: "operational_action",
      entityId: `accion-${name}`,
      title: "Acción: señalizar",
      dueAt: new Date("2037-03-10T00:00:00.000Z"),
      leadDays: 7,
      ownerUserId: anaId,
      siteId: null,
      personId: null,
    });

    it("conserva el aviso enviado si no cambian el día ni la anticipación", async () => {
      const { id } = await save(spec());
      await markSent(id);

      // Mismo día guardado como instante, otro título y el mismo responsable.
      await save({ ...spec(), title: "Acción: señalizar acopio", dueAt: new Date("2037-03-10T23:59:59.999-03:00") });
      await save({ ...spec(), ownerUserId: null });

      expect(await reload(id)).toMatchObject(sent);
    });

    it.each([
      ["el día", { dueAt: new Date("2037-03-11T00:00:00.000Z") }],
      ["la anticipación", { leadDays: 15 }],
      ["el responsable", { ownerUserId: "luis" }],
    ])("reinicia el aviso si cambia %s", async (_what, change) => {
      const { id } = await save(spec());
      await markSent(id);

      await save({ ...spec(), ...change, ...("ownerUserId" in change ? { ownerUserId: luisId } : {}) });

      expect(await reload(id)).toMatchObject(reset);
      await save(spec());
    });
  });

  it("el control avisa una vez, no repite al volver a guardar y avisa al nuevo responsable", async () => {
    const input = { tenantId, entityType: "operational_action", entityId: "accion-scan", title: "Acción: capacitar", dueAt: new Date("2038-05-20T00:00:00.000Z") } as const;
    const { id } = await upsertOpenDueItemForEntity({ ...input, ownerUserId: anaId }, db);
    const scan = () => scanDueReminders({ db, mail: new MemoryEmailSender(), now: new Date("2038-05-15T12:00:00.000Z"), tenantId });
    const notified = async () =>
      (await db.inAppNotification.findMany({ where: { tenantId, dueItemId: id }, orderBy: { createdAt: "asc" } })).map((n) => n.userId);

    await scan();
    await upsertOpenDueItemForEntity({ ...input, ownerUserId: anaId }, db);
    await scan();
    expect(await notified()).toEqual([anaId]);

    await upsertOpenDueItemForEntity({ ...input, ownerUserId: luisId }, db);
    await scan();
    expect(await notified()).toEqual([anaId, luisId]);
  });
});
