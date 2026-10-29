import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type TenantRole } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createPerson, createSite } from "@/lib/masterdata";
import { createAsset } from "@/lib/assets";
import { startInspection } from "@/lib/inspections";
import { createIncidentWithFinding, type IncidentFactInput, type SafetyUser } from "@/lib/safety-stats";
import { exportRoadCases, getRoadDashboard, getRoadTotalsSeries } from "@/lib/road-dashboard";
import type { RoadEventDetailInput, RoadUser } from "@/lib/road-safety";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("seguridad vial: tablero (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let a = "";
  let b = "";
  let siteA = "";
  let d1 = "";
  let d2 = "";
  let d3 = "";
  let v1 = "";
  let v2 = "";
  let vB = "";
  const actors = {} as Record<"admin" | "owner" | "contributor" | "adminB", SafetyUser & RoadUser>;

  const today = "2027-04-15";
  const now = new Date("2027-04-15T15:00:00.000Z");
  const MONTHS_Q1 = ["2027-01", "2027-02", "2027-03"];

  const fact = (over: Partial<IncidentFactInput>): IncidentFactInput => ({
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
  const road = (over: Partial<RoadEventDetailInput>): RoadEventDetailInput => ({
    vehicleKind: "own",
    assetId: v1,
    vehicleLabel: null,
    driverPersonId: d1,
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
  const incident = (tenantId: string, actor: SafetyUser, f: Partial<IncidentFactInput>, r: Partial<RoadEventDetailInput>) =>
    createIncidentWithFinding({ tenantId, actor, title: "Hecho de tránsito", description: "Hecho de prueba", fact: fact(f), road: road(r), now }, db);

  async function newUser(label: string, tenantId: string, role: TenantRole): Promise<SafetyUser & RoadUser> {
    const user = await db.user.create({ data: { name: `Tablero ${label}`, email: `tablero-${label}-${stamp}@test.dev`, emailVerified: true } });
    userIds.push(user.id);
    await db.membership.create({ data: { userId: user.id, tenantId, role } });
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
        code: `TV${stamp % 100000}-${n}`,
        description: `Camioneta ${n}`,
        siteId,
        attributes: { plate: `TV${100 + n}XX`, brand: "Toyota", model: "Hilux", year: 2022 },
        dueDates: [
          { kind: "insurance", dueAt: "2030-01-01" },
          { kind: "rto", dueAt: "2030-01-01" },
          { kind: "service", dueAt: "2030-01-01" },
        ],
      })
    ).id;
  };

  async function reading(tenantId: string, assetId: string, day: string, km: number) {
    const inspection = await startInspection({ tenantId, actorUserId: actors.admin.userId, assetId, templateKey: "light_pre_use" });
    await db.inspection.update({
      where: { id: inspection.id },
      data: { status: "closed", result: "fit", readingKm: km, inspectedAt: new Date(`${day}T00:00:00.000Z`), closedAt: new Date(`${day}T12:00:00.000Z`) },
    });
  }

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Tablero ${label}`, slug: `tablero-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actors.admin = await newUser("admin", a, "tenant_admin");
    actors.owner = await newUser("owner", a, "process_owner");
    actors.contributor = await newUser("contrib", a, "contributor");
    actors.adminB = await newUser("adminb", b, "tenant_admin");

    siteA = (await createSite({ tenantId: a, actorUserId: actors.admin.userId, name: "Base Norte" })).id;
    const siteB = (await createSite({ tenantId: b, actorUserId: actors.adminB.userId, name: "Base Norte" })).id;
    const posA = await createJobPosition({ tenantId: a, actorUserId: actors.admin.userId, name: "Chofer" });
    const person = (n: string, name: string) => createPerson({ tenantId: a, actorUserId: actors.admin.userId, employeeCode: n, name, siteId: siteA, positionId: posA.id });
    d1 = (await person("1", "Dario Uno")).id;
    d2 = (await person("2", "Diana Dos")).id;
    d3 = (await person("3", "Dante Tres")).id;
    v1 = await newVehicle(a, siteA, actors.admin.userId);
    v2 = await newVehicle(a, siteA, actors.admin.userId);
    vB = await newVehicle(b, siteB, actors.adminB.userId);

    // Odómetros del dataset del SPEC: V1 = 10.000 / 12.000 / 8.000 y V2 = 20.000 / 18.000 / 12.000.
    for (const [day, km1, km2] of [
      ["2026-12-31", 50_000, 100_000],
      ["2027-01-31", 60_000, 120_000],
      ["2027-02-28", 72_000, 138_000],
      ["2027-03-31", 80_000, 150_000],
    ] as const) {
      await reading(a, v1, day, km1);
      await reading(a, v2, day, km2);
    }
    await reading(b, vB, "2026-12-31", 1_000);
    await reading(b, vB, "2027-01-31", 3_000);

    // E1..E5 del dataset.
    await incident(a, actors.contributor, { occurredAt: new Date("2027-01-12T15:00:00.000Z") }, {});
    await incident(a, actors.contributor, { occurredAt: new Date("2027-02-10T15:00:00.000Z"), classification: "lost_time", returnToWorkDate: "2027-02-20" }, {
      assetId: v2, driverPersonId: d2, eventType: "rollover", injuredCount: 2, hospitalizedCount: 1, mainCause: "speed",
    });
    await incident(a, actors.contributor, { occurredAt: new Date("2027-02-18T15:00:00.000Z"), classification: "near_miss" }, { assetId: v2, driverPersonId: d2, eventType: "run_off_road", propertyDamage: "none" });
    await incident(a, actors.contributor, { occurredAt: new Date("2027-03-08T15:00:00.000Z"), classification: "no_lost_time" }, { eventType: "collision_fixed_object", injuredCount: 1, seatbelt: "some_not" });
    await incident(a, actors.contributor, { occurredAt: new Date("2027-03-20T15:00:00.000Z"), classification: "lost_time", inItinere: true, returnToWorkDate: "2027-03-25" }, {
      vehicleKind: "private", assetId: null, driverPersonId: d3, injuredCount: 1,
    });
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  const dashboard = (actor: RoadUser, over: { kind?: "month" | "ytd" | "rolling12"; tenantId?: string } = {}) =>
    getRoadDashboard({ tenantId: over.tenantId ?? a, actor, kind: over.kind ?? "ytd", anchor: "2027-03", today }, db);

  it("AR-01: las tasas coinciden con el dataset calculado a mano", async () => {
    const d = await dashboard(actors.admin);
    expect(d.rates.ytd.aggregate).toMatchObject({ status: "ok", totalKm: 80_000, events: 3 });
    expect(d.rates.ytd.indices).toEqual({ eventsPerMillionKm: 37.5, injuryEventsPerMillionKm: 25, rolloversPerMillionKm: 12.5 });
    expect(d.result).toMatchObject({ hospitalized: 1, fatalities: 0 });
  });

  it("AR-02: la serie mensual da 33,33 / 33,33 / 50,00", async () => {
    const d = await dashboard(actors.admin);
    expect(d.series.slice(-3).map((p) => p.indices?.eventsPerMillionKm)).toEqual([33.33, 33.33, 50]);
    expect(d.rates.month.indices?.eventsPerMillionKm).toBe(50);
  });

  it("AR-10: el casi accidente y el hecho in itinere quedan fuera de las tasas y cuentan aparte", async () => {
    const d = await dashboard(actors.admin);
    expect(d.result).toMatchObject({ nearMisses: 1, outsideControl: 1 });
    expect(d.breakdown.byType.find((r) => r.key === "run_off_road")).toBeUndefined();
    expect(d.breakdown.byVehicle.map((r) => r.count)).toEqual([2, 1]);
  });

  it("AR-19: el cinturón se calcula sobre los hechos con dato", async () => {
    const d = await dashboard(actors.admin);
    // E1, E2 y E5 con todos con cinturón; E4 con alguno sin cinturón.
    expect(d.intermediate).toMatchObject({ seatbeltBase: 4, seatbeltPct: 75 });
  });

  it("AR-16: un vehículo sin inspección calendarizada cuenta como vencido; con una al día, no", async () => {
    let d = await dashboard(actors.admin);
    expect(d.intermediate.fleet).toMatchObject({ total: 2, upToDate: 0 });
    const updated = await db.inspectionPlan.updateMany({ where: { tenantId: a, assetId: v1 }, data: { lastInspectedAt: new Date("2027-03-31"), nextDueAt: new Date("2027-09-30") } });
    expect(updated.count).toBeGreaterThan(0);
    d = await dashboard(actors.admin);
    expect(d.intermediate.fleet).toMatchObject({ total: 2, upToDate: 1 });
    expect(d.intermediate.fleet.overdue.map((v) => v.id)).toEqual([v2]);
  });

  it("AR-13: Dario aparece para revisar con 2 hechos; el colaborador no ve nombres y no queda registro", async () => {
    const before = await db.masterDataAudit.count({ where: { tenantId: a, entityType: "road_review_list" } });
    const owner = await dashboard(actors.owner);
    expect(owner.review).toEqual([{ personId: d1, name: "Dario Uno", count: 2 }]);
    expect(await db.masterDataAudit.count({ where: { tenantId: a, entityType: "road_review_list" } })).toBe(before + 1);

    const contributor = await dashboard(actors.contributor);
    expect(contributor.review).toBeNull();
    expect(contributor.canSeeDrivers).toBe(false);
    expect(JSON.stringify(contributor)).not.toMatch(/Dario|Diana|Dante/);
    expect(await db.masterDataAudit.count({ where: { tenantId: a, entityType: "road_review_list" } })).toBe(before + 1);
  });

  it("AR-14: otra empresa no ve los hechos ni los km de esta", async () => {
    const d = await dashboard(actors.adminB, { tenantId: b });
    expect(d.rates.ytd.aggregate.events).toBe(0);
    expect(d.result).toMatchObject({ nearMisses: 0, outsideControl: 0, hospitalized: 0 });
    expect(d.breakdown.byVehicle).toEqual([]);
    expect(d.intermediate.fleet.total).toBe(1);
    expect(d.exposure.totalKm).toBe(2_000);
  });

  it("AR-04: sin km no hay tasa, sin datos", async () => {
    const empty = await createTenantWithTemplate({ name: "Tablero vacío", slug: `tablero-vacio-${stamp}`, size: "small", activity: "servicios" });
    tenantIds.push(empty.id);
    const d = await getRoadDashboard({ tenantId: empty.id, actor: actors.admin, kind: "ytd", anchor: "2027-03", today }, db);
    expect(d.rates.ytd.indices).toBeNull();
    expect(d.rates.ytd.aggregate.status).toBe("no_data");
  });

  it("exportación: los totales no llevan nombres; los casos, solo para quien gestiona, y dejan registro", async () => {
    const series = await getRoadTotalsSeries({ tenantId: a, months: MONTHS_Q1 }, db);
    expect(series.map((p) => p.indices?.eventsPerMillionKm)).toEqual([33.33, 33.33, 50]);

    await expect(exportRoadCases({ tenantId: a, actor: actors.contributor, months: MONTHS_Q1 }, db)).rejects.toThrow(/nombre/);
    const { csv, rows } = await exportRoadCases({ tenantId: a, actor: actors.admin, months: MONTHS_Q1 }, db);
    expect(rows).toBe(5);
    expect(csv).toContain("Dario Uno");
    expect(csv).toContain("Dante Tres");
    expect(await db.masterDataAudit.count({ where: { tenantId: a, entityType: "road_cases_export", actorUserId: actors.admin.userId } })).toBe(1);
    const other = await exportRoadCases({ tenantId: b, actor: actors.adminB, months: MONTHS_Q1 }, db);
    expect(other.rows).toBe(0);
  });
});
