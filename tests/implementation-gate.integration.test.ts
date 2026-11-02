import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { ImplementationGateError, assertCanImplementAction, assertCanImplementTarget } from "@/lib/implementation-gate";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("implementation gate (integration)", () => {
  const db = new PrismaClient();
  const slug = `impl-gate-${Date.now()}`;
  let tenantId = "";
  const users = { owner: "", other: "", doer: "" };

  const check = (riskId: string, actor: keyof typeof users, isPlatformSuperuser = false) =>
    assertCanImplementTarget({ tenantId, kind: "risk", targetId: riskId, actorUserId: users[actor], isPlatformSuperuser, db });

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({ name: "Gate SA", slug, size: "small", activity: "servicios" });
    tenantId = tenant.id;
    for (const key of ["owner", "other", "doer"] as const) {
      const user = await db.user.create({ data: { name: `Persona ${key}`, email: `${key}@${slug}.test`, emailVerified: true } });
      users[key] = user.id;
      await db.membership.create({ data: { userId: user.id, tenantId, role: "contributor" } });
    }
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await db.$disconnect();
  });

  it("lets anyone move a risk that has no owner yet, and blocks others once it is being implemented", async () => {
    const evaluated = await db.risk.create({ data: { tenantId, title: "R1", status: "evaluated", responseOwnerUserId: users.owner } });
    await expect(check(evaluated.id, "other")).resolves.toBeUndefined();

    const implementing = await db.risk.create({ data: { tenantId, title: "R2", status: "implementing", responseOwnerUserId: users.owner } });
    await expect(check(implementing.id, "other")).rejects.toBeInstanceOf(ImplementationGateError);
    await expect(check(implementing.id, "other")).rejects.toThrow(/Persona owner lleva el riesgo/);
    await expect(check(implementing.id, "owner")).resolves.toBeUndefined();
    await expect(check(implementing.id, "other", true)).resolves.toBeUndefined();
  });

  it("lets the person in charge of an action work on it, and nobody else", async () => {
    const risk = await db.risk.create({ data: { tenantId, title: "R3", status: "implementing", responseOwnerUserId: users.owner } });
    const action = await db.action.create({
      data: { tenantId, title: "Homologar proveedor", ownerUserId: users.doer, links: { create: { targetType: "risk", targetId: risk.id } } },
    });
    const run = (actor: keyof typeof users) =>
      assertCanImplementAction({ tenantId, actionId: action.id, actorUserId: users[actor], isPlatformSuperuser: false, db });

    await expect(run("doer")).resolves.toBeUndefined();
    await expect(run("owner")).resolves.toBeUndefined();
    await expect(run("other")).rejects.toBeInstanceOf(ImplementationGateError);
  });
});
