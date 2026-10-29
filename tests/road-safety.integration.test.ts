import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type TenantRole } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createPerson, createSite } from "@/lib/masterdata";
import { createAsset } from "@/lib/assets";
import { startInspection } from "@/lib/inspections";
import { aggregateIncidentEvents, createIncidentWithFinding, SafetyStatsError, updateIncidentFact, type IncidentFactInput, type SafetyUser } from "@/lib/safety-stats";
import {
  RoadSafetyError,
  addOdometerReset,
  getKmGrid,
  getRoadEventDetail,
  getRoadSafetySettings,
  saveRoadEventDetail,
  saveVehicleKm,
  syncKmDueItems,
  updateRoadSafetySettings,
  type RoadEventDetailInput,
  type RoadUser,
} from "@/lib/road-safety";
import { aggregateWindow } from "@/domain/safety-stats/indices";
import { DEFAULT_SAFETY_SETTINGS } from "@/domain/safety-stats/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("seguridad vial: registro (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let a = "";
  let b = "";
  let siteA = "";
  let siteB = "";
  let driverA = "";
  let driverB = "";
  let v1 = "";
  let v2 = "";
  let vB = "";
  const actors = {} as Record<"admin" | "owner" | "contributor" | "viewer" | "superuser" | "adminB", SafetyUser & RoadUser>;

  const today = "2027-04-15";
  const now = new Date("2027-04-15T15:00:00.000Z");

  const fact = (over: Partial<IncidentFactInput> = {}): IncidentFactInput => ({
    siteId: siteA,
    occurredAt: new Date("2027-01-12T15:00:00.000Z"),
    classification: "property_damage_only",
    inItinere: false,
    isRoad: true,
    employerKind: "own",
    restrictedWork: false,
    accidentForm: "traffic",
    materialAgent: "vehicle",
    returnToWorkDate: null,
    ...over,
  });
  const road = (over: Partial<RoadEventDetailInput> = {}): RoadEventDetailInput => ({
    vehicleKind: "own",
    assetId: v1,
    vehicleLabel: null,
    driverPersonId: driverA,
    eventType: "collision_vehicle",
    roadSurface: "dry",
    light: "day",
    weather: "clear",
    seatbelt: "all",
    mainCause: "other_driver",
    propertyDamage: "minor",
    injuredCount: 0,
    hospitalizedCount: 0,
    fatalCount: 0,
    estimatedSpeedKmh: null,
    reportFiled: false,
    reportRef: null,
    ...over,
  });
  const newRoadIncident = (tenantId: string, actor: SafetyUser, f: Partial<IncidentFactInput> = {}, r: Partial<RoadEventDetailInput> | null = {}) =>
    createIncidentWithFinding({ tenantId, actor, title: "Choque en ruta", description: "Choque leve", fact: fact(f), road: r === null ? null : road(r), now }, db);

  async function newUser(label: string, tenantId: string | null, role: TenantRole | null): Promise<SafetyUser & RoadUser> {
    const user = await db.user.create({ data: { name: `Vial ${label}`, email: `vial-${label}-${stamp}@test.dev`, emailVerified: true } });
    userIds.push(user.id);
    if (tenantId && role) await db.membership.create({ data: { userId: user.id, tenantId, role } });
    return { userId: user.id, role };
  }

  let seq = 0;
  const newVehicle = async (tenantId: string, siteId: string, actorUserId: string) => {
    const n = ++seq;
    return (
      await createAsset({
        tenantId,
        actorUserId,
        typeKey: "light_vehicle",
        code: `RV${stamp % 100000}-${n}`,
        description: `Camioneta ${n}`,
        siteId,
        attributes: { plate: `RV${100 + n}XX`, brand: "Toyota", model: "Hilux", year: 2022 },
        dueDates: [
          { kind: "insurance", dueAt: "2030-01-01" },
          { kind: "rto", dueAt: "2030-01-01" },
          { kind: "service", dueAt: "2030-01-01" },
        ],
      })
    ).id;
  };

  /** Una inspección cerrada con lectura de odómetro, sin pasar por el formulario completo. */
  async function reading(tenantId: string, assetId: string, day: string, km: number) {
    const inspection = await startInspection({ tenantId, actorUserId: actors.admin.userId, assetId, templateKey: "light_pre_use" });
    await db.inspection.update({
      where: { id: inspection.id },
      data: { status: "closed", result: "fit", readingKm: km, inspectedAt: new Date(`${day}T00:00:00.000Z`), closedAt: new Date(`${day}T12:00:00.000Z`) },
    });
  }

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Vial ${label}`, slug: `vial-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actors.admin = await newUser("admin", a, "tenant_admin");
    actors.owner = await newUser("owner", a, "process_owner");
    actors.contributor = await newUser("contrib", a, "contributor");
    actors.viewer = await newUser("viewer", a, "viewer");
    actors.superuser = { ...(await newUser("super", null, null)), isPlatformSuperuser: true };
    actors.adminB = await newUser("adminb", b, "tenant_admin");

    siteA = (await createSite({ tenantId: a, actorUserId: actors.admin.userId, name: "Base Norte" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: actors.adminB.userId, name: "Base Norte" })).id;
    const posA = await createJobPosition({ tenantId: a, actorUserId: actors.admin.userId, name: "Chofer" });
    const posB = await createJobPosition({ tenantId: b, actorUserId: actors.adminB.userId, name: "Chofer" });
    driverA = (await createPerson({ tenantId: a, actorUserId: actors.admin.userId, employeeCode: "1", name: "Dario Chofer", siteId: siteA, positionId: posA.id })).id;
    driverB = (await createPerson({ tenantId: b, actorUserId: actors.adminB.userId, employeeCode: "1", name: "Dora Chofer", siteId: siteB, positionId: posB.id })).id;
    v1 = await newVehicle(a, siteA, actors.admin.userId);
    v2 = await newVehicle(a, siteA, actors.admin.userId);
    vB = await newVehicle(b, siteB, actors.adminB.userId);
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  describe("evento vial", () => {
    it("AR-08: un choque con solo daño material se guarda con su detalle y no suma en IF, IG ni II", async () => {
      const { record } = await newRoadIncident(a, actors.contributor);
      expect(record.classification).toBe("property_damage_only");
      expect(await db.roadEventDetail.count({ where: { incidentRecordId: record.id, tenantId: a } })).toBe(1);

      const range = { tenantId: a, fromMonth: "2027-01", toMonth: "2027-01", siteIds: [siteA] };
      const { events, openCases } = await aggregateIncidentEvents(range, db);
      const result = aggregateWindow({
        exposure: [{ siteId: siteA, employerKind: "own", month: "2027-01", hours: 20_000, headcountAvg: 100 }],
        events,
        openCases,
        months: ["2027-01"],
        segments: [{ siteId: siteA, employerKind: "own" }],
        settings: DEFAULT_SAFETY_SETTINGS,
      });
      expect(result.totals.cases).toBe(0);
      expect(result.indices.if).toBe(0);
      expect(result.indices.ig).toBe(0);
      expect(result.indices.ii).toBe(0);
    });

    it("AR-09: con lesión en jornada el evento entra en el tablero laboral; in itinere no", async () => {
      const lostTime = await newRoadIncident(a, actors.contributor, { classification: "lost_time", returnToWorkDate: "2027-01-15" }, { eventType: "rollover", injuredCount: 2, hospitalizedCount: 1, propertyDamage: "major" });
      const itinere = await newRoadIncident(a, actors.contributor, { classification: "lost_time", inItinere: true, returnToWorkDate: "2027-01-15" }, { vehicleKind: "private", assetId: null, injuredCount: 1 });
      expect(lostTime.record.isRoad && itinere.record.isRoad).toBe(true);

      const { events } = await aggregateIncidentEvents({ tenantId: a, fromMonth: "2027-01", toMonth: "2027-01", siteIds: [siteA] }, db);
      const result = aggregateWindow({
        exposure: [{ siteId: siteA, employerKind: "own", month: "2027-01", hours: 20_000, headcountAvg: 100 }],
        events,
        months: ["2027-01"],
        segments: [{ siteId: siteA, employerKind: "own" }],
        settings: DEFAULT_SAFETY_SETTINGS,
      });
      expect(result.totals.cases).toBe(1);
      expect(result.inItinere.cases).toBe(1);
    });

    it("«solo daño material» exige marcar el hecho de tránsito", async () => {
      await expect(newRoadIncident(a, actors.contributor, { isRoad: false }, null)).rejects.toThrow(/tránsito/);
    });

    it("AR-11: internados > lesionados y fallecidos con clasificación no fatal no se guardan, y no deja ficha a medias", async () => {
      const before = await db.incidentRecord.count({ where: { tenantId: a } });
      await expect(newRoadIncident(a, actors.contributor, { classification: "lost_time", returnToWorkDate: "2027-01-15" }, { injuredCount: 1, hospitalizedCount: 2 })).rejects.toBeInstanceOf(RoadSafetyError);
      await expect(newRoadIncident(a, actors.contributor, { classification: "lost_time", returnToWorkDate: "2027-01-15" }, { fatalCount: 1 })).rejects.toBeInstanceOf(RoadSafetyError);
      expect(await db.incidentRecord.count({ where: { tenantId: a } })).toBe(before);
    });

    it("el detalle vial solo va en un hecho de tránsito", async () => {
      await expect(newRoadIncident(a, actors.contributor, { isRoad: false, classification: "near_miss" }, {})).rejects.toBeInstanceOf(SafetyStatsError);
    });

    it("un vehículo o conductor de otra empresa se rechaza (AR-14)", async () => {
      await expect(newRoadIncident(a, actors.contributor, {}, { assetId: vB })).rejects.toThrow(/vehículo/);
      await expect(newRoadIncident(a, actors.contributor, {}, { driverPersonId: driverB })).rejects.toThrow(/persona/);
    });

    it("un vehículo particular guarda el evento sin vehículo de la flota", async () => {
      const { record } = await newRoadIncident(a, actors.contributor, {}, { vehicleKind: "private", assetId: v1, vehicleLabel: "  Fiat Palio  " });
      const detail = await db.roadEventDetail.findUniqueOrThrow({ where: { incidentRecordId: record.id } });
      expect(detail).toMatchObject({ vehicleKind: "private", assetId: null, vehicleLabel: "Fiat Palio" });
    });

    it("AR-13: el conductor solo lo ve quien gestiona, y la consulta queda registrada", async () => {
      const { record } = await newRoadIncident(a, actors.contributor);
      const asContributor = await getRoadEventDetail({ tenantId: a, actor: actors.contributor, incidentRecordId: record.id }, db);
      expect(asContributor).toMatchObject({ driverPersonId: null, driverName: null, assetCode: expect.any(String) });
      const asSuper = await getRoadEventDetail({ tenantId: a, actor: actors.superuser, incidentRecordId: record.id }, db);
      expect(asSuper?.driverName).toBeNull();

      const viewsBefore = await db.masterDataAudit.count({ where: { tenantId: a, entityType: "road_event_driver", entityId: record.id } });
      const asOwner = await getRoadEventDetail({ tenantId: a, actor: actors.owner, incidentRecordId: record.id }, db);
      expect(asOwner).toMatchObject({ driverPersonId: driverA, driverName: "Dario Chofer" });
      expect(await db.masterDataAudit.count({ where: { tenantId: a, entityType: "road_event_driver", entityId: record.id } })).toBe(viewsBefore + 1);
    });

    it("corregir el detalle es de quien gestiona; el alta deja registro sin nombres", async () => {
      const { record } = await newRoadIncident(a, actors.contributor);
      await expect(saveRoadEventDetail({ tenantId: a, actor: actors.contributor, incidentRecordId: record.id, detail: road({ mainCause: "speed" }) }, db)).rejects.toThrow(/gestiona/);
      await expect(saveRoadEventDetail({ tenantId: a, actor: actors.viewer, incidentRecordId: record.id, detail: road() }, db)).rejects.toThrow(/Sin permiso/);
      const updated = await saveRoadEventDetail({ tenantId: a, actor: actors.owner, incidentRecordId: record.id, detail: road({ mainCause: "speed", estimatedSpeedKmh: 110 }) }, db);
      expect(updated).toMatchObject({ mainCause: "speed", estimatedSpeedKmh: 110 });
      const audits = await db.masterDataAudit.findMany({ where: { tenantId: a, entityType: "road_event", entityId: record.id } });
      expect(audits.map((x) => x.action).sort()).toEqual(["create", "update"]);
      expect(audits.every((x) => !x.summary.includes("Dario"))).toBe(true);
    });

    it("una ficha que no es de tránsito no admite detalle, y tampoco se le quita la marca si ya lo tiene", async () => {
      const labor = await createIncidentWithFinding({ tenantId: a, actor: actors.contributor, title: "Caída", description: "x", fact: fact({ isRoad: false, classification: "near_miss", accidentForm: "fall_same_level", materialAgent: "floor_stairs" }), now }, db);
      await expect(saveRoadEventDetail({ tenantId: a, actor: actors.owner, incidentRecordId: labor.record.id, detail: road() }, db)).rejects.toThrow(/tránsito/);

      const withRoad = await newRoadIncident(a, actors.contributor, { classification: "near_miss" }, { propertyDamage: "none" });
      await expect(
        updateIncidentFact({ tenantId: a, actor: actors.admin, findingId: withRoad.finding.id, fact: fact({ isRoad: false, classification: "near_miss" }), now }, db),
      ).rejects.toThrow(/detalle vial/);
    });
  });

  describe("km por vehículo y mes", () => {
    it("AR-05: la grilla calcula los km de los odómetros y los marca «ok»", async () => {
      await reading(a, v1, "2026-12-31", 50_000);
      await reading(a, v1, "2027-01-31", 60_000);
      await reading(a, v1, "2027-02-28", 72_000);
      const grid = await getKmGrid(a, "2027-02", db);
      const row = grid.find((r) => r.assetId === v1)!;
      expect(row).toMatchObject({ state: "ok", km: 12_000, stored: null });
      expect(grid.find((r) => r.assetId === v2)).toMatchObject({ state: "no_data", km: null });
      expect(grid.some((r) => r.assetId === vB)).toBe(false);
    });

    it("confirmar guarda el calculado, deja registro y es de quien gestiona", async () => {
      await expect(saveVehicleKm({ tenantId: a, actor: actors.contributor, assetId: v1, month: "2027-02", today }, db)).rejects.toThrow(/gestionar/);
      const saved = await saveVehicleKm({ tenantId: a, actor: actors.owner, assetId: v1, month: "2027-02", today }, db);
      expect(saved).toMatchObject({ km: 12_000, source: "odometer", computedKm: 12_000, manualReason: null });
      expect(saved.confirmedAt).not.toBeNull();
      expect(await db.masterDataAudit.count({ where: { tenantId: a, entityType: "road_km", entityId: saved.id } })).toBe(1);
    });

    it("AR-12: pisar lo calculado o cargar a mano sin motivo es error; con motivo queda el registro", async () => {
      await expect(saveVehicleKm({ tenantId: a, actor: actors.owner, assetId: v1, month: "2027-02", km: 11_500, today }, db)).rejects.toThrow(/motivo/);
      await expect(saveVehicleKm({ tenantId: a, actor: actors.owner, assetId: v1, month: "2027-02", km: 11_500, reason: "  ", today }, db)).rejects.toThrow(/motivo/);
      const saved = await saveVehicleKm({ tenantId: a, actor: actors.owner, assetId: v1, month: "2027-02", km: 11_500, reason: "Odómetro mal leído en la inspección", today }, db);
      expect(saved).toMatchObject({ km: 11_500, source: "manual", computedKm: 12_000, manualReason: "Odómetro mal leído en la inspección" });
      const audit = await db.masterDataAudit.findMany({ where: { tenantId: a, entityType: "road_km", entityId: saved.id }, orderBy: { createdAt: "asc" } });
      expect(audit.map((x) => x.action)).toEqual(["create", "update"]);
      const grid = await getKmGrid(a, "2027-02", db);
      expect(grid.find((r) => r.assetId === v1)).toMatchObject({ state: "manual", km: 11_500 });
    });

    it("sin lecturas hay que cargar a mano, y un mes en curso no se carga", async () => {
      await expect(saveVehicleKm({ tenantId: a, actor: actors.owner, assetId: v2, month: "2027-02", today }, db)).rejects.toThrow(/a mano/);
      await expect(saveVehicleKm({ tenantId: a, actor: actors.owner, assetId: v1, month: "2027-04", km: 10, reason: "prueba", today }, db)).rejects.toThrow(/no cerró/);
    });

    it("la constraint de la base impide un km manual sin motivo", async () => {
      await expect(
        db.vehicleKmPeriod.create({ data: { tenantId: a, assetId: v2, periodMonth: new Date("2027-03-01T00:00:00.000Z"), km: 100, source: "manual", manualReason: "" } }),
      ).rejects.toThrow();
      await expect(
        db.vehicleKmPeriod.create({ data: { tenantId: a, assetId: v2, periodMonth: new Date("2027-03-15T00:00:00.000Z"), km: 100, source: "odometer" } }),
      ).rejects.toThrow();
    });

    it("AR-07: una lectura que baja es inconsistente; con reinicio corta la serie", async () => {
      const v3 = await newVehicle(a, siteA, actors.admin.userId);
      await reading(a, v3, "2027-01-31", 60_000);
      await reading(a, v3, "2027-02-28", 55_000);
      await reading(a, v3, "2027-03-31", 61_000);
      const feb = async () => (await getKmGrid(a, "2027-02", db)).find((r) => r.assetId === v3)!;
      expect(await feb()).toMatchObject({ state: "inconsistent", km: null });
      await expect(saveVehicleKm({ tenantId: a, actor: actors.owner, assetId: v3, month: "2027-02", today }, db)).rejects.toThrow(/no cierran/);

      await expect(addOdometerReset({ tenantId: a, actor: actors.contributor, assetId: v3, effectiveOn: "2027-02-15", reason: "Cambio de tablero" }, db)).rejects.toThrow(/gestionar/);
      await expect(addOdometerReset({ tenantId: a, actor: actors.owner, assetId: v3, effectiveOn: "2027-02-15", reason: "" }, db)).rejects.toThrow(/motivo/);
      await addOdometerReset({ tenantId: a, actor: actors.owner, assetId: v3, effectiveOn: "2027-02-15", reason: "Cambio de tablero" }, db);
      await expect(addOdometerReset({ tenantId: a, actor: actors.owner, assetId: v3, effectiveOn: "2027-02-15", reason: "Cambio de tablero" }, db)).rejects.toThrow(/ya tiene/);
      expect(await feb()).toMatchObject({ state: "no_data", km: null });
      const mar = (await getKmGrid(a, "2027-03", db)).find((r) => r.assetId === v3)!;
      expect(mar).toMatchObject({ state: "ok", km: 6_000 });
    });

    it("km 0 con eventos viales del vehículo en el mes es inconsistente", async () => {
      const v4 = await newVehicle(a, siteA, actors.admin.userId);
      await reading(a, v4, "2026-12-31", 10_000);
      await reading(a, v4, "2027-01-31", 10_000);
      await newRoadIncident(a, actors.contributor, {}, { assetId: v4 });
      const row = (await getKmGrid(a, "2027-01", db)).find((r) => r.assetId === v4)!;
      expect(row).toMatchObject({ state: "inconsistent", km: null });
    });

    it("AR-14: otra empresa no ve ni modifica los vehículos de la primera", async () => {
      expect((await getKmGrid(b, "2027-02", db)).map((r) => r.assetId)).toEqual([vB]);
      await expect(saveVehicleKm({ tenantId: b, actor: actors.adminB, assetId: v1, month: "2027-02", km: 5, reason: "prueba cruzada", today }, db)).rejects.toThrow(/flota/);
      await expect(addOdometerReset({ tenantId: b, actor: actors.adminB, assetId: v1, effectiveOn: "2027-02-10", reason: "prueba cruzada" }, db)).rejects.toThrow(/flota/);
    });
  });

  describe("aviso mensual de km (DueItem)", () => {
    const openItems = (tenantId: string) => db.dueItem.findMany({ where: { tenantId, entityType: "road_km_period", status: "open" } });

    it("AR-15: abre un aviso por mes cerrado, idempotente, y se cierra al confirmar todos los vehículos", async () => {
      const tenant = await createTenantWithTemplate({ name: "Vial due", slug: `vial-due-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(tenant.id);
      const admin = await newUser("due-admin", tenant.id, "tenant_admin");
      const site = (await createSite({ tenantId: tenant.id, actorUserId: admin.userId, name: "Base" })).id;
      const vehicleA = await newVehicle(tenant.id, site, admin.userId);
      const vehicleB = await newVehicle(tenant.id, site, admin.userId);
      // Los vehículos se crean "hoy" (2026): para que existan en el mes de la prueba, se retroceden.
      await db.asset.updateMany({ where: { tenantId: tenant.id }, data: { createdAt: new Date("2027-01-01T00:00:00.000Z") } });

      const first = await syncKmDueItems(tenant.id, { today }, db);
      const again = await syncKmDueItems(tenant.id, { today }, db);
      expect(first.opened).toEqual(["2027-03"]);
      expect(again.opened).toEqual(["2027-03"]);
      const items = await openItems(tenant.id);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ entityId: "2027-03", leadDays: 5 });
      expect(items[0].dueAt.toISOString().slice(0, 10)).toBe("2027-04-10");
      expect(items[0].remindAt.toISOString().slice(0, 10)).toBe("2027-04-05");
      expect(items[0].lastReminderKind).toBeNull();

      // Un recordatorio ya enviado no se reinicia con otra corrida.
      await db.dueItem.update({ where: { id: items[0].id }, data: { lastReminderKind: "upcoming" } });
      await syncKmDueItems(tenant.id, { today }, db);
      expect((await openItems(tenant.id))[0].lastReminderKind).toBe("upcoming");

      await saveVehicleKm({ tenantId: tenant.id, actor: admin, assetId: vehicleA, month: "2027-03", km: 800, reason: "Sin lecturas", today }, db);
      expect(await openItems(tenant.id)).toHaveLength(1);
      await saveVehicleKm({ tenantId: tenant.id, actor: admin, assetId: vehicleB, month: "2027-03", km: 900, reason: "Sin lecturas", today }, db);
      // El guardado sincroniza con la fecha real; acá cerramos con la fecha de la prueba.
      await syncKmDueItems(tenant.id, { today }, db);
      expect(await openItems(tenant.id)).toHaveLength(0);
      expect(await db.dueItem.count({ where: { tenantId: tenant.id, entityType: "road_km_period", status: "closed" } })).toBeGreaterThanOrEqual(1);
    });

    it("una empresa sin flota no recibe aviso", async () => {
      expect((await syncKmDueItems(b, { today: "2027-04-15" }, db)).opened).toEqual(["2027-03"]);
      const fresh = await createTenantWithTemplate({ name: "Vial vacía", slug: `vial-vacia-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(fresh.id);
      expect((await syncKmDueItems(fresh.id, { today }, db)).opened).toEqual([]);
      expect(await openItems(fresh.id)).toHaveLength(0);
    });
  });

  describe("ajustes", () => {
    it("valores por defecto, cambio solo para quien gestiona y validación", async () => {
      expect(await getRoadSafetySettings(a, db)).toEqual({ minExposureKm: 100_000, repeatThreshold: 2, repeatWindowMonths: 12, speedingPerDriver: false });
      const next = { minExposureKm: 50_000, repeatThreshold: 3, repeatWindowMonths: 6, speedingPerDriver: false };
      await expect(updateRoadSafetySettings({ tenantId: a, actor: actors.contributor, settings: next }, db)).rejects.toThrow(/gestionar/);
      await expect(updateRoadSafetySettings({ tenantId: a, actor: actors.owner, settings: { ...next, repeatThreshold: 0 } }, db)).rejects.toThrow(/reincidencia/);
      await updateRoadSafetySettings({ tenantId: a, actor: actors.owner, settings: next }, db);
      expect(await getRoadSafetySettings(a, db)).toEqual(next);
      expect(await getRoadSafetySettings(b, db)).toMatchObject({ minExposureKm: 100_000 });
    });
  });
});
