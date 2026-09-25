import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("tenant provisioning integration", () => {
  const db = new PrismaClient();
  const slug = `test-acme-${Date.now()}`;

  beforeAll(async () => {
    const catalogCount = await db.isoRequirement.count();
    if (catalogCount === 0) {
      throw new Error("Catálogo vacío: corré npm run db:seed");
    }
  });

  afterAll(async () => {
    const tenant = await db.tenant.findUnique({ where: { slug } });
    if (tenant) {
      await db.tenantRequirement.deleteMany({ where: { tenantId: tenant.id } });
      await db.tenant.delete({ where: { id: tenant.id } });
    }
    await db.$disconnect();
  });

  it("crea tenant small solo con requisitos esenciales", async () => {
    const essentialCount = await db.isoRequirement.count({
      where: { essential: true },
    });

    const tenant = await createTenantWithTemplate({
      name: "Test Acme",
      slug,
      size: "small",
      activity: "servicios",
    });

    expect(tenant.slug).toBe(slug);
    expect(tenant._count.requirements).toBe(essentialCount);
    expect(tenant._count.requirements).toBeGreaterThan(40);
  });
});
