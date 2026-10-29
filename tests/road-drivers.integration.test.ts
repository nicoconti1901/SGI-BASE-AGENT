import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type TenantRole } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createJobTask, createPerson, createSite } from "@/lib/masterdata";
import { createCourse } from "@/lib/training-config";
import { getDriverSummary, getDriverTask, listDrivers, saveDriverLicense, setDriverTask } from "@/lib/road-drivers";
import { RoadSafetyError, saveSpeedingPeriod, type RoadUser } from "@/lib/road-safety";
import { createAsset } from "@/lib/assets";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("seguridad vial: conductores habilitados (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let a = "";
  let b = "";
  let taskA = "";
  let taskB = "";
  const people = {} as Record<"ok" | "expired" | "noCourse" | "noLicense", string>;
  let personB = "";
  let vehicle = "";
  const actors = {} as Record<"admin" | "contributor" | "adminB" | "superuser", RoadUser>;
  const today = "2027-04-15";

  async function newUser(label: string, tenantId: string | null, role: TenantRole | null): Promise<RoadUser> {
    const user = await db.user.create({ data: { name: `Cond ${label}`, email: `cond-${label}-${stamp}@test.dev`, emailVerified: true } });
    userIds.push(user.id);
    if (tenantId && role) await db.membership.create({ data: { userId: user.id, tenantId, role } });
    return { userId: user.id, role };
  }

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Cond ${label}`, slug: `cond-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actors.admin = await newUser("admin", a, "tenant_admin");
    actors.contributor = await newUser("contrib", a, "contributor");
    actors.adminB = await newUser("adminb", b, "tenant_admin");
    actors.superuser = { ...(await newUser("super", null, null)), isPlatformSuperuser: true };

    const site = (await createSite({ tenantId: a, actorUserId: actors.admin.userId, name: "Base" })).id;
    const siteB = (await createSite({ tenantId: b, actorUserId: actors.adminB.userId, name: "Base" })).id;
    const pos = (await createJobPosition({ tenantId: a, actorUserId: actors.admin.userId, name: "Chofer" })).id;
    const posB = (await createJobPosition({ tenantId: b, actorUserId: actors.adminB.userId, name: "Chofer" })).id;
    taskA = (await createJobTask({ tenantId: a, actorUserId: actors.admin.userId, name: "Conducir vehículos" })).id;
    taskB = (await createJobTask({ tenantId: b, actorUserId: actors.adminB.userId, name: "Conducir vehículos" })).id;
    const mk = async (code: string, name: string, tenantId = a, siteId = site, positionId = pos, userId = actors.admin.userId) =>
      (await createPerson({ tenantId, actorUserId: userId, employeeCode: code, name, siteId, positionId, jobTaskIds: [tenantId === a ? taskA : taskB] })).id;
    people.ok = await mk("1", "Ana Habilitada");
    people.expired = await mk("2", "Beto Vencido");
    people.noCourse = await mk("3", "Cora Sin Curso");
    people.noLicense = await mk("4", "Dani Sin Licencia");
    personB = await mk("1", "Eva De Otra", b, siteB, posB, actors.adminB.userId);

    // El curso de manejo defensivo es obligatorio para la tarea; tres de las cuatro personas lo hicieron.
    const course = await createCourse({ tenantId: a, actorUserId: actors.admin.userId, draft: { name: "Manejo defensivo", validityMonths: 24 } });
    await db.trainingRequirement.create({ data: { tenantId: a, courseId: course.id, targetKind: "task", jobTaskId: taskA, mandatory: true, graceDays: 0, effectiveFrom: new Date("2026-01-01") } });
    for (const id of [people.ok, people.expired, people.noLicense]) {
      await db.trainingRecord.create({ data: { tenantId: a, personId: id, courseId: course.id, completedAt: new Date("2027-01-10"), result: "passed", validUntil: new Date("2029-01-10") } });
    }

    vehicle = (
      await createAsset({
        tenantId: a,
        actorUserId: actors.admin.userId,
        typeKey: "light_vehicle",
        code: `CD${stamp % 100000}`,
        description: "Camioneta",
        siteId: site,
        attributes: { plate: "CD100XX", brand: "Toyota", model: "Hilux", year: 2022 },
        dueDates: [
          { kind: "insurance", dueAt: "2030-01-01" },
          { kind: "rto", dueAt: "2030-01-01" },
          { kind: "service", dueAt: "2030-01-01" },
        ],
      })
    ).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("sin tarea de conducción elegida no hay conductores que evaluar", async () => {
    expect(await getDriverSummary(a, today, db)).toMatchObject({ configured: false, total: 0, pct: null });
  });

  it("elegir la tarea es de quien gestiona y solo vale una tarea de la empresa", async () => {
    await expect(setDriverTask({ tenantId: a, actor: actors.contributor, jobTaskId: taskA }, db)).rejects.toThrow(/gestionar/);
    await expect(setDriverTask({ tenantId: a, actor: actors.superuser, jobTaskId: taskA }, db)).rejects.toThrow(/gestionar/);
    await expect(setDriverTask({ tenantId: a, actor: actors.admin, jobTaskId: taskB }, db)).rejects.toThrow(RoadSafetyError);
    await setDriverTask({ tenantId: a, actor: actors.admin, jobTaskId: taskA }, db);
    expect(await getDriverTask(a, db)).toEqual({ id: taskA, name: "Conducir vehículos" });
    expect(await getDriverTask(b, db)).toBeNull();
  });

  it("AR-17: licencia vencida o sin manejo defensivo → no habilitado", async () => {
    await saveDriverLicense({ tenantId: a, actor: actors.admin, personId: people.ok, expiresOn: "2027-12-31" }, db);
    await saveDriverLicense({ tenantId: a, actor: actors.admin, personId: people.expired, expiresOn: "2027-04-14" }, db);
    await saveDriverLicense({ tenantId: a, actor: actors.admin, personId: people.noCourse, expiresOn: "2027-12-31" }, db);

    const { rows } = await listDrivers({ tenantId: a, actor: actors.admin, today }, db);
    const by = (id: string) => rows.find((r) => r.personId === id)!;
    expect(by(people.ok)).toMatchObject({ enabled: true, blockers: [] });
    expect(by(people.expired)).toMatchObject({ enabled: false, blockers: ["license_expired"] });
    expect(by(people.noCourse)).toMatchObject({ enabled: false, blockers: ["training_missing"] });
    expect(by(people.noLicense)).toMatchObject({ enabled: false, blockers: ["license_missing"] });
    expect(rows.some((r) => r.personId === personB)).toBe(false);
  });

  it("el resumen del tablero no lleva nombres y la lista queda registrada", async () => {
    const summary = await getDriverSummary(a, today, db);
    expect(summary).toEqual({ configured: true, taskName: "Conducir vehículos", total: 4, enabled: 1, pct: 25 });
    expect(JSON.stringify(summary)).not.toMatch(/Ana|Beto|Cora|Dani/);
    expect(await db.masterDataAudit.count({ where: { tenantId: a, entityType: "road_drivers_list" } })).toBeGreaterThan(0);
    await expect(listDrivers({ tenantId: a, actor: actors.contributor, today }, db)).rejects.toThrow(/gestionar/);
  });

  it("una licencia se cambia, se quita y deja registro; es de la empresa de la persona (AR-14)", async () => {
    await saveDriverLicense({ tenantId: a, actor: actors.admin, personId: people.noLicense, expiresOn: "2028-01-31" }, db);
    expect(await getDriverSummary(a, today, db)).toMatchObject({ enabled: 2 });
    await saveDriverLicense({ tenantId: a, actor: actors.admin, personId: people.noLicense, expiresOn: null }, db);
    expect(await db.driverLicense.count({ where: { personId: people.noLicense } })).toBe(0);
    expect(await db.masterDataAudit.count({ where: { tenantId: a, entityType: "driver_license", entityId: people.noLicense } })).toBe(2);
    await expect(saveDriverLicense({ tenantId: a, actor: actors.admin, personId: personB, expiresOn: "2028-01-31" }, db)).rejects.toThrow(/empresa/);
    await expect(saveDriverLicense({ tenantId: a, actor: actors.admin, personId: people.ok, expiresOn: "31/12/2027" }, db)).rejects.toThrow(/inválida/);
    await expect(saveDriverLicense({ tenantId: a, actor: actors.contributor, personId: people.ok, expiresOn: "2028-01-31" }, db)).rejects.toThrow(/gestionar/);
  });

  it("los excesos de velocidad se cargan por vehículo y mes cerrado, solo quien gestiona", async () => {
    await expect(saveSpeedingPeriod({ tenantId: a, actor: actors.contributor, assetId: vehicle, month: "2027-03", count: 4, today }, db)).rejects.toThrow(/gestionar/);
    await expect(saveSpeedingPeriod({ tenantId: a, actor: actors.admin, assetId: vehicle, month: "2027-04", count: 4, today }, db)).rejects.toThrow(/cerró/);
    await expect(saveSpeedingPeriod({ tenantId: a, actor: actors.admin, assetId: vehicle, month: "2027-03", count: -1, today }, db)).rejects.toThrow(/entera/);
    await expect(saveSpeedingPeriod({ tenantId: b, actor: actors.adminB, assetId: vehicle, month: "2027-03", count: 4, today }, db)).rejects.toThrow(/flota/);
    await saveSpeedingPeriod({ tenantId: a, actor: actors.admin, assetId: vehicle, month: "2027-03", count: 4, today }, db);
    const again = await saveSpeedingPeriod({ tenantId: a, actor: actors.admin, assetId: vehicle, month: "2027-03", count: 6, note: "Corregido", today }, db);
    expect(again).toMatchObject({ count: 6, note: "Corregido", personId: null });
    expect(await db.speedingPeriod.count({ where: { tenantId: a, assetId: vehicle } })).toBe(1);
  });
});
