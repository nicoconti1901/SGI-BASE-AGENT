import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createDueItem, setOfferActivation } from "@/lib/automation";
import { DUE_REMINDERS_OFFER_CODE } from "@/domain/automation/due";
import { POST } from "@/app/api/automation/scan/route";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const SECRET = "test-automation-secret-0123456789abcdef";

function scanRequest(authorization?: string) {
  return new Request("http://localhost/api/automation/scan", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe.skipIf(!hasDatabase)("POST /api/automation/scan", () => {
  const db = new PrismaClient();
  const slug = `hook-${Date.now()}`;
  let tenantId = "";
  let dueItemId = "";
  const previousSecret = process.env.AUTOMATION_WEBHOOK_SECRET;

  beforeAll(async () => {
    process.env.AUTOMATION_WEBHOOK_SECRET = SECRET;
    const tenant = await createTenantWithTemplate({
      name: "Hook Acme",
      slug,
      size: "small",
      activity: "servicios",
    });
    tenantId = tenant.id;
    await setOfferActivation({
      tenantId,
      offerCode: DUE_REMINDERS_OFFER_CODE,
      active: true,
      db,
    });
    const item = await createDueItem(
      {
        tenantId,
        title: "Vencido para webhook",
        entityType: "manual",
        dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        leadDays: 7,
      },
      db,
    );
    dueItemId = item.id;
  });

  afterAll(async () => {
    process.env.AUTOMATION_WEBHOOK_SECRET = previousSecret;
    await db.inAppNotification.deleteMany({ where: { tenantId } });
    await db.dueItem.deleteMany({ where: { tenantId } });
    await db.tenantOfferActivation.deleteMany({ where: { tenantId } });
    await db.automationRun.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  it("returns 401 without a valid secret and does not run a scan", async () => {
    const startedAt = new Date();
    expect((await POST(scanRequest())).status).toBe(401);
    expect((await POST(scanRequest("Bearer wrong"))).status).toBe(401);
    const globalRuns = await db.automationRun.count({
      where: { tenantId: null, startedAt: { gte: startedAt } },
    });
    expect(globalRuns).toBe(0);
  });

  it("runs the scan once; concurrent retries do not duplicate notifications", async () => {
    const [a, b] = await Promise.all([
      POST(scanRequest(`Bearer ${SECRET}`)),
      POST(scanRequest(`Bearer ${SECRET}`)),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const body = (await a.json()) as { runId: string };
    expect(body.runId).toBeTruthy();

    const again = await POST(scanRequest(`Bearer ${SECRET}`));
    expect(again.status).toBe(200);

    const notifications = await db.inAppNotification.count({
      where: { dueItemId },
    });
    expect(notifications).toBe(1);
  });
});
