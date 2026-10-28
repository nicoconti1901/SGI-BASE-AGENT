import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { adoptOptInStandard, createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { findUnofferedStandards, listOfferedStandards } from "@/lib/ims-catalog";

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

  it("la empresa nueva no recibe ISO39001 y se le ofrece solo al adoptarla (AR-20)", async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug } });
    const vial = await db.isoRequirement.findMany({ where: { standard: "ISO39001" } });
    expect(vial.length).toBeGreaterThan(0);
    expect(await db.tenantRequirement.count({ where: { tenantId: tenant.id, requirement: { standard: "ISO39001" } } })).toBe(0);

    expect(await listOfferedStandards(tenant.id)).toEqual(["ISO9001", "ISO14001", "ISO45001"]);
    expect(await findUnofferedStandards(tenant.id, ["ISO9001", "ISO39001"])).toEqual(["ISO39001"]);

    expect(await adoptOptInStandard(tenant.id, "ISO39001")).toBe(vial.length);
    expect(await adoptOptInStandard(tenant.id, "ISO39001")).toBe(0);
    await expect(adoptOptInStandard(tenant.id, "ISO9001")).rejects.toThrow(/plantilla/);
    expect(await listOfferedStandards(tenant.id)).toEqual(["ISO9001", "ISO14001", "ISO45001", "ISO39001"]);
    expect(await findUnofferedStandards(tenant.id, ["ISO9001", "ISO39001"])).toEqual([]);
  });
});
