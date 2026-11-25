import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createDueItem, listVisibleNotifications } from "@/lib/automation";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("visibilidad de notificaciones", () => {
  const db = new PrismaClient();
  const slug = `notif-${Date.now()}`;
  let tenantId = "";
  let otherTenantId = "";
  let anaId = "";
  let luisId = "";

  beforeAll(async () => {
    const [tenant, other] = await Promise.all(
      [slug, `${slug}-b`].map((s) =>
        createTenantWithTemplate({ name: s, slug: s, size: "small", activity: "servicios" }),
      ),
    );
    tenantId = tenant.id;
    otherTenantId = other.id;
    const [ana, luis] = await Promise.all(
      ["ana", "luis"].map((name) =>
        db.user.create({ data: { name, email: `${name}@${slug}.test`, emailVerified: true } }),
      ),
    );
    anaId = ana.id;
    luisId = luis.id;
    // Fecha lejana: otros tests corren scans globales en paralelo.
    const due = await createDueItem(
      { tenantId, title: "Sin responsable", entityType: "document_validity", dueAt: new Date("2035-01-01T12:00:00Z") },
      db,
    );
    await db.inAppNotification.createMany({
      data: [
        { tenantId, userId: anaId, title: "de Ana", body: "-" },
        { tenantId, userId: luisId, title: "de Luis", body: "-" },
        { tenantId, userId: null, dueItemId: due.id, title: "de la empresa", body: "-" },
        // Aviso personal cuyo destinatario se borró (SetNull): no pasa a ser de todos.
        { tenantId, userId: null, title: "huérfana", body: "-" },
        { tenantId: otherTenantId, userId: anaId, title: "de otra empresa", body: "-" },
      ],
    });
  });

  afterAll(async () => {
    const ids = [tenantId, otherTenantId];
    await db.inAppNotification.deleteMany({ where: { tenantId: { in: ids } } });
    await db.dueItem.deleteMany({ where: { tenantId: { in: ids } } });
    await db.tenantRequirement.deleteMany({ where: { tenantId: { in: ids } } });
    await db.tenant.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: [anaId, luisId] } } });
    await db.$disconnect();
  });

  it("muestra solo las propias y los avisos de vencimiento sin responsable de esa empresa", async () => {
    const seen = await listVisibleNotifications(tenantId, anaId, db);

    expect(seen.map((n) => n.title).sort()).toEqual(["de Ana", "de la empresa"]);
  });
});
