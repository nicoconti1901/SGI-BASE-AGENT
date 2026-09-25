import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { inviteTenantMember, getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("identity invite integration", () => {
  const db = new PrismaClient();
  const slug = `id-acme-${Date.now()}`;
  let tenantId = "";

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({
      name: "Identity Acme",
      slug,
      size: "small",
      activity: "servicios",
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    const users = await db.user.findMany({
      where: { email: { endsWith: `@${slug}.test` } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await db.membership.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    if (userIds.length) {
      await db.session.deleteMany({ where: { userId: { in: userIds } } });
      await db.account.deleteMany({ where: { userId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await db.$disconnect();
  });

  it("invites a contributor and enforces viewer write denial", async () => {
    const member = await inviteTenantMember({
      tenantId,
      name: "Ana Contributor",
      email: `ana@${slug}.test`,
      password: "Temporal123!",
      role: "contributor",
    });

    const membership = await getMembership(member.userId, tenantId);
    expect(membership?.role).toBe("contributor");
    expect(canTenantRole(membership?.role, "write")).toBe(true);
    expect(canTenantRole("viewer", "write")).toBe(false);
  });
});
