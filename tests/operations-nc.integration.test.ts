import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import {
  createCorrectiveAction,
  createNonconformity,
  updateCorrectiveActionStatus,
  updateNonconformityStatus,
} from "@/lib/operations-nc";
import { ACTION_ENTITY_TYPE } from "@/domain/operations/nc";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("operations NC integration", () => {
  const db = new PrismaClient();
  const slug = `nc-${Date.now()}`;
  let tenantId = "";

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({
      name: "NC Acme",
      slug,
      size: "small",
      activity: "servicios",
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await db.dueItem.deleteMany({ where: { tenantId } });
    await db.correctiveAction.deleteMany({ where: { tenantId } });
    await db.nonconformity.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  it("creates NC + action with due item and closes due on action close", async () => {
    const nc = await createNonconformity(
      {
        tenantId,
        title: "Desvío en registro de calidad",
        description: "Falta evidencia de control",
        ownerName: "Ana",
        source: "auditoría interna",
      },
      db,
    );

    await updateNonconformityStatus({
      tenantId,
      id: nc.id,
      status: "in_progress",
      db,
    });

    const dueAt = new Date("2026-10-10T12:00:00.000Z");
    const action = await createCorrectiveAction(
      {
        tenantId,
        nonconformityId: nc.id,
        title: "Completar evidencia",
        ownerName: "Luis",
        dueAt,
      },
      db,
    );

    const due = await db.dueItem.findFirst({
      where: {
        tenantId,
        entityType: ACTION_ENTITY_TYPE,
        entityId: action.id,
        status: "open",
      },
    });
    expect(due).toBeTruthy();
    expect(due?.title).toContain("Completar evidencia");
    expect(due?.dueAt.toISOString()).toBe(dueAt.toISOString());

    await updateCorrectiveActionStatus({
      tenantId,
      id: action.id,
      status: "closed",
      db,
    });

    const closedDue = await db.dueItem.findFirst({
      where: {
        tenantId,
        entityType: ACTION_ENTITY_TYPE,
        entityId: action.id,
      },
    });
    expect(closedDue?.status).toBe("closed");
  });
});
