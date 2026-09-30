import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import {
  ObjectiveGateError,
  closeObjective,
  createIndicator,
  createObjective,
  getObjective,
  listObjectives,
  setIndicatorActive,
  updateIndicator,
  updateObjective,
  type IndicatorDraft,
  type ObjectiveDraft,
} from "@/lib/objectives";
import { INDICATOR_MEASUREMENT_ENTITY_TYPE } from "@/domain/indicators/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("objectives and indicators (integration)", () => {
  const db = new PrismaClient();
  const slug = `obj-${Date.now()}`;
  let tenantId = "";
  let otherTenantId = "";
  const userIds: string[] = [];

  const objective = (overrides: Partial<ObjectiveDraft> = {}): ObjectiveDraft => ({
    title: "Reducir reclamos de clientes",
    description: "Menos reclamos por pedido",
    standards: ["ISO9001"],
    ownerUserId: userIds[0],
    dueDate: new Date("2035-12-31"),
    plan: "Revisar el proceso de despacho",
    ...overrides,
  });

  const indicator = (overrides: Partial<IndicatorDraft> = {}): IndicatorDraft => ({
    name: "Reclamos por 100 pedidos",
    formula: "reclamos / pedidos * 100",
    unit: "%",
    direction: "lower_better",
    target: 2,
    alertThreshold: 1.5,
    frequency: "monthly",
    kind: "lagging",
    ownerUserId: userIds[1],
    ...overrides,
  });

  const openDue = (indicatorId: string) =>
    db.dueItem.findMany({
      where: { tenantId, entityType: INDICATOR_MEASUREMENT_ENTITY_TYPE, entityId: indicatorId, status: "open" },
    });

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({ name: "Obj Acme", slug, size: "small", activity: "servicios" });
    tenantId = tenant.id;
    const other = await createTenantWithTemplate({
      name: "Obj Otra",
      slug: `${slug}-otra`,
      size: "small",
      activity: "servicios",
    });
    otherTenantId = other.id;
    for (const name of ["owner", "loader"]) {
      const user = await db.user.create({
        data: { name, email: `${name}@${slug}.test`, emailVerified: true },
      });
      userIds.push(user.id);
      await db.membership.create({ data: { userId: user.id, tenantId, role: "process_owner" } });
    }
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("creates objectives with correlative codes and validates the draft", async () => {
    await expect(createObjective({ tenantId, createdByUserId: userIds[0], draft: objective({ standards: [] }) }, db)).rejects.toBeInstanceOf(ObjectiveGateError);
    await expect(createObjective({ tenantId, createdByUserId: userIds[0], draft: objective({ title: " " }) }, db)).rejects.toBeInstanceOf(ObjectiveGateError);

    const year = new Date().getUTCFullYear();
    const first = await createObjective({ tenantId, createdByUserId: userIds[0], draft: objective() }, db);
    const second = await createObjective({ tenantId, createdByUserId: userIds[0], draft: objective({ title: "Cero accidentes" }) }, db);
    expect(first.code).toBe(`OBJ-${year}-01`);
    expect(second.code).toBe(`OBJ-${year}-02`);
  });

  it("rejects owners outside the company", async () => {
    const stranger = await db.user.create({
      data: { name: "stranger", email: `stranger@${slug}.test`, emailVerified: true },
    });
    userIds.push(stranger.id);
    await expect(
      createObjective({ tenantId, createdByUserId: userIds[0], draft: objective({ ownerUserId: stranger.id }) }, db),
    ).rejects.toThrow(/integrante de la empresa/);
  });

  it("creates indicators with a due item for the pending period and validates the alert side", async () => {
    const obj = await createObjective({ tenantId, createdByUserId: userIds[0], draft: objective({ title: "Con indicadores" }) }, db);
    await expect(
      createIndicator({ tenantId, objectiveId: obj.id, draft: indicator({ alertThreshold: 3 }) }, db),
    ).rejects.toThrow(/alerta tiene que ser menor/);

    const created = await createIndicator({ tenantId, objectiveId: obj.id, draft: indicator() }, db);
    const due = await openDue(created.id);
    expect(due).toHaveLength(1);
    // Vence 10 días después de que termina el período en que se creó.
    expect(due[0].dueAt.getUTCDate()).toBe(11);

    const quarterly = await updateIndicator(
      { tenantId, indicatorId: created.id, draft: indicator({ frequency: "quarterly" }) },
      db,
    );
    expect(quarterly.frequency).toBe("quarterly");
    expect(await openDue(created.id)).toHaveLength(1);
  });

  it("deactivating stops the due item and reactivating brings it back", async () => {
    const obj = await createObjective({ tenantId, createdByUserId: userIds[0], draft: objective({ title: "Activar" }) }, db);
    const created = await createIndicator({ tenantId, objectiveId: obj.id, draft: indicator() }, db);
    await setIndicatorActive({ tenantId, indicatorId: created.id, active: false }, db);
    expect(await openDue(created.id)).toHaveLength(0);
    await setIndicatorActive({ tenantId, indicatorId: created.id, active: true }, db);
    expect(await openDue(created.id)).toHaveLength(1);
  });

  it("closing an objective needs a note, closes the due items and freezes it", async () => {
    const obj = await createObjective({ tenantId, createdByUserId: userIds[0], draft: objective({ title: "Cierre" }) }, db);
    const created = await createIndicator({ tenantId, objectiveId: obj.id, draft: indicator() }, db);

    await expect(closeObjective({ tenantId, objectiveId: obj.id, result: "achieved", note: " " }, db)).rejects.toBeInstanceOf(ObjectiveGateError);
    const closed = await closeObjective({ tenantId, objectiveId: obj.id, result: "achieved", note: "Se logró" }, db);
    expect(closed.status).toBe("achieved");
    expect(closed.closedAt).not.toBeNull();
    expect(await openDue(created.id)).toHaveLength(0);

    await expect(updateObjective({ tenantId, objectiveId: obj.id, draft: objective() }, db)).rejects.toBeInstanceOf(ObjectiveGateError);
    await expect(createIndicator({ tenantId, objectiveId: obj.id, draft: indicator() }, db)).rejects.toBeInstanceOf(ObjectiveGateError);
    await expect(setIndicatorActive({ tenantId, indicatorId: created.id, active: false }, db)).rejects.toBeInstanceOf(ObjectiveGateError);
  });

  it("does not leak objectives across tenants", async () => {
    const mine = await listObjectives(tenantId, db);
    expect(mine.length).toBeGreaterThan(0);
    expect(await listObjectives(otherTenantId, db)).toEqual([]);
    expect(await getObjective(otherTenantId, mine[0].id, db)).toBeNull();
    await expect(
      updateObjective({ tenantId: otherTenantId, objectiveId: mine[0].id, draft: objective() }, db),
    ).rejects.toThrow(/no encontrado/);
  });
});
