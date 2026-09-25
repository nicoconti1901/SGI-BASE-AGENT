import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { bulkSaveTenantGap } from "@/lib/assessment-gap";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("assessment gap integration", () => {
  const db = new PrismaClient();
  const slug = `gap-acme-${Date.now()}`;
  let tenantId = "";
  let userId = "";
  let requirementIds: string[] = [];

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({
      name: "Gap Acme",
      slug,
      size: "small",
      activity: "servicios",
    });
    tenantId = tenant.id;

    const user = await db.user.create({
      data: {
        name: "Gap Auditor",
        email: `auditor@${slug}.test`,
        emailVerified: true,
        platformRole: "platform_superuser",
      },
    });
    userId = user.id;

    const rows = await db.tenantRequirement.findMany({
      where: { tenantId },
      take: 3,
      orderBy: { id: "asc" },
    });
    requirementIds = rows.map((r) => r.id);
  });

  afterAll(async () => {
    await db.gapAssessmentAudit.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("bulk saves statuses, computes fate, and writes audit", async () => {
    expect(requirementIds.length).toBeGreaterThanOrEqual(2);

    await bulkSaveTenantGap({
      tenantId,
      userId,
      rows: [
        {
          tenantRequirementId: requirementIds[0],
          status: "compliant",
          notes: "Procedimiento vigente revisado",
          hasClientDocument: true,
        },
        {
          tenantRequirementId: requirementIds[1],
          status: "missing",
          notes: "Sin evidencia",
          hasClientDocument: false,
        },
      ],
    });

    const updated = await db.tenantRequirement.findMany({
      where: { id: { in: requirementIds.slice(0, 2) } },
      orderBy: { id: "asc" },
    });
    const byId = new Map(updated.map((r) => [r.id, r]));

    expect(byId.get(requirementIds[0])?.status).toBe("compliant");
    expect(byId.get(requirementIds[0])?.documentFate).toBe("keep");
    expect(byId.get(requirementIds[1])?.status).toBe("missing");
    expect(byId.get(requirementIds[1])?.documentFate).toBe("create");

    const audits = await db.gapAssessmentAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
    expect(audits[0]?.userId).toBe(userId);
    expect(audits.some((a) => a.newDocumentFate === "keep")).toBe(true);
    expect(audits.some((a) => a.newDocumentFate === "create")).toBe(true);
  });
});
