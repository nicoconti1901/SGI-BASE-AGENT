import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { ObjectiveGateError, createIndicator, createObjective } from "@/lib/objectives";
import {
  canLoadIndicator,
  correctMeasurement,
  createFindingFromMeasurement,
  getIndicatorDetail,
  recordMeasurement,
} from "@/lib/measurements";
import { INDICATOR_MEASUREMENT_ENTITY_TYPE } from "@/domain/indicators/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("measurements (integration)", () => {
  const db = new PrismaClient();
  const slug = `meas-${Date.now()}`;
  let tenantId = "";
  let userId = "";
  let indicatorId = "";

  const record = (value: number, analysis: string | null = null, now?: Date) =>
    recordMeasurement({ tenantId, indicatorId, userId, value, analysis, now }, db);

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({ name: "Meas Acme", slug, size: "small", activity: "servicios" });
    tenantId = tenant.id;
    const user = await db.user.create({
      data: { name: "loader", email: `loader@${slug}.test`, emailVerified: true },
    });
    userId = user.id;
    await db.membership.create({ data: { userId, tenantId, role: "process_owner" } });

    const objective = await createObjective(
      {
        tenantId,
        createdByUserId: userId,
        draft: {
          title: "Entregas a tiempo",
          description: "",
          standards: ["ISO9001"],
          ownerUserId: userId,
          dueDate: new Date("2035-12-31"),
          plan: "",
        },
      },
      db,
    );
    // Mayor es mejor: meta 95, alerta 97 → 98 en meta · 96 alerta · 90 fuera.
    const indicator = await createIndicator(
      {
        tenantId,
        objectiveId: objective.id,
        draft: {
          name: "Entregas a tiempo",
          formula: "",
          unit: "%",
          direction: "higher_better",
          target: 95,
          alertThreshold: 97,
          frequency: "monthly",
          kind: "lagging",
          ownerUserId: userId,
        },
      },
      db,
    );
    indicatorId = indicator.id;
    // El indicador se "creó" hace tres meses para poder cargar varios períodos.
    await db.indicator.update({
      where: { id: indicatorId },
      data: { createdAt: new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 15)) },
    });
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("loads periods in order and computes the status from the target", async () => {
    const first = await record(98);
    expect(first.status).toBe("on_target");
    expect(first.periodKey).toMatch(/^\d{4}-01$/);

    const second = await record(96);
    expect(second.status).toBe("alert");
    expect(second.periodKey).toMatch(/^\d{4}-02$/);
  });

  it("requires the analysis when off target", async () => {
    await expect(record(90)).rejects.toThrow(/análisis del desvío/);
    const saved = await record(90, "Falló el transportista");
    expect(saved.status).toBe("off_target");
    expect(saved.analysis).toBe("Falló el transportista");
  });

  it("moves the due item to the following period after each load", async () => {
    const due = await db.dueItem.findMany({
      where: { tenantId, entityType: INDICATOR_MEASUREMENT_ENTITY_TYPE, entityId: indicatorId, status: "open" },
    });
    expect(due).toHaveLength(1);
    const detail = await getIndicatorDetail(tenantId, indicatorId, db);
    const pendingEnd = detail!.pendingPeriod.end;
    const expected = new Date(pendingEnd);
    expected.setUTCDate(expected.getUTCDate() + 10);
    expect(due[0].dueAt.toISOString()).toBe(expected.toISOString());
  });

  it("rejects future periods and non-numeric values", async () => {
    await expect(record(Number.NaN)).rejects.toBeInstanceOf(ObjectiveGateError);
    // Con el reloj en el pasado, el siguiente período todavía no empezó.
    await expect(record(99, null, new Date("2000-01-01"))).rejects.toThrow(/futuros/);
  });

  it("corrects a value leaving a record and recalculating the status", async () => {
    const detail = await getIndicatorDetail(tenantId, indicatorId, db);
    const offTarget = detail!.indicator.measurements.find((m) => m.status === "off_target")!;

    await expect(
      correctMeasurement({ tenantId, measurementId: offTarget.id, userId, newValue: 99, reason: " ", analysis: null }, db),
    ).rejects.toBeInstanceOf(ObjectiveGateError);

    const fixed = await correctMeasurement(
      { tenantId, measurementId: offTarget.id, userId, newValue: 99, reason: "Error de tipeo", analysis: null },
      db,
    );
    expect(fixed.status).toBe("on_target");
    const corrections = await db.measurementCorrection.findMany({ where: { measurementId: offTarget.id } });
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({ previousValue: 90, newValue: 99, reason: "Error de tipeo", byUserId: userId });

    // Un valor corregido que queda fuera de meta también pide análisis (ya existe uno).
    const again = await correctMeasurement(
      { tenantId, measurementId: offTarget.id, userId, newValue: 80, reason: "Otro error", analysis: null },
      db,
    );
    expect(again.status).toBe("off_target");
  });

  it("creates a draft finding from an off-target value, once", async () => {
    const detail = await getIndicatorDetail(tenantId, indicatorId, db);
    const onTarget = detail!.indicator.measurements.find((m) => m.status === "on_target")!;
    await expect(
      createFindingFromMeasurement({ tenantId, measurementId: onTarget.id, userId }, db),
    ).rejects.toThrow(/fuera de meta/);

    const offTarget = detail!.indicator.measurements.find((m) => m.status === "off_target")!;
    const finding = await createFindingFromMeasurement({ tenantId, measurementId: offTarget.id, userId }, db);
    expect(finding).toMatchObject({ type: "nonconformity", status: "draft", tenantId });
    expect(finding.description).toContain("Análisis del desvío: Falló el transportista");
    expect((await db.measurement.findUniqueOrThrow({ where: { id: offTarget.id } })).findingId).toBe(finding.id);

    await expect(
      createFindingFromMeasurement({ tenantId, measurementId: offTarget.id, userId }, db),
    ).rejects.toThrow(/ya tiene un hallazgo/);
  });

  it("only the indicator owner or a manager can load", () => {
    expect(canLoadIndicator({ userId: "a", ownerUserId: "a", canManage: false })).toBe(true);
    expect(canLoadIndicator({ userId: "b", ownerUserId: "a", canManage: false })).toBe(false);
    expect(canLoadIndicator({ userId: "b", ownerUserId: "a", canManage: true })).toBe(true);
  });
});
