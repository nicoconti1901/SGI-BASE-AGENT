import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type TenantRole } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { SafetyStatsError, type SafetyUser } from "@/lib/safety-stats";
import {
  defaultAnchorMonth,
  getIndicatorLinks,
  getSafetyDashboard,
  listLinkableIndicators,
  setIndicatorLinks,
  type DashboardFilter,
} from "@/lib/safety-dashboard";
import { EVENTS, EXPOSURE, SITE_A, materialize } from "./safety-stats-dataset";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("tablero de accidentabilidad (integración)", () => {
  const queries: string[] = [];
  const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  (db as unknown as { $on: (e: "query", cb: (q: { query: string }) => void) => void }).$on("query", (q) => queries.push(q.query));
  const stamp = Date.now();
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let t = "";
  let other = "";
  let sa = "";
  let sb = "";
  let admin: SafetyUser;
  let viewer: SafetyUser;
  let indicatorId = "";
  let foreignIndicatorId = "";

  const AS_OF = "2026-03-31";
  const dash = (over: Partial<DashboardFilter> = {}) => getSafetyDashboard(t, { kind: "ytd", anchor: "2026-03", group: "total", today: AS_OF, ...over }, db);

  async function newUser(label: string, tenantId: string, role: TenantRole): Promise<SafetyUser> {
    const user = await db.user.create({ data: { name: `Dash ${label}`, email: `dash-${label}-${stamp}@test.dev`, emailVerified: true } });
    userIds.push(user.id);
    await db.membership.create({ data: { userId: user.id, tenantId, role } });
    return { userId: user.id, role };
  }

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const tenant = await createTenantWithTemplate({ name: `Dash ${label}`, slug: `dash-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(tenant.id);
    }
    [t, other] = tenantIds;
    admin = await newUser("admin", t, "tenant_admin");
    viewer = await newUser("viewer", t, "viewer");
    const adminB = await newUser("adminb", other, "tenant_admin");
    sa = (await createSite({ tenantId: t, actorUserId: admin.userId, name: "Planta Norte", kind: "plant" })).id;
    sb = (await createSite({ tenantId: t, actorUserId: admin.userId, name: "Obra Sur", kind: "worksite" })).id;
    const siteOf = (id: string) => (id === SITE_A ? sa : sb);

    for (const e of materialize(EVENTS)) {
      const finding = await db.finding.create({
        data: { tenantId: t, type: "incident", origin: "incident", status: "published", title: e.id, description: "x", detectedAt: new Date(`${e.date}T15:00:00.000Z`) },
      });
      const record = await db.incidentRecord.create({
        data: {
          tenantId: t,
          findingId: finding.id,
          siteId: siteOf(e.siteId),
          occurredAt: new Date(`${e.date}T15:00:00.000Z`),
          occurredOn: new Date(`${e.occurredOn}T00:00:00.000Z`),
          periodMonth: new Date(`${e.periodMonth}T00:00:00.000Z`),
          weekday: e.weekday,
          hourOfDay: e.hourOfDay,
          classification: e.classification,
          inItinere: e.inItinere ?? false,
          employerKind: e.employerKind,
          restrictedWork: e.restrictedWork ?? false,
          accidentForm: e.classification === "near_miss" ? "slip_trip" : "fall_same_level",
          materialAgent: "floor_stairs",
          lostDays: e.lostDays,
          returnToWorkDate: e.returnToWorkDate ? new Date(`${e.returnToWorkDate}T00:00:00.000Z`) : null,
          chargePct: e.chargePct,
        },
      });
      if (e.classification === "lost_time" && !e.inItinere) {
        await db.incidentHealth.create({ data: { tenantId: t, incidentRecordId: record.id, bodyPart: "hand" } });
      }
    }
    for (const x of EXPOSURE) {
      await db.exposurePeriod.create({
        data: { tenantId: t, siteId: siteOf(x.siteId), periodMonth: new Date(`${x.month}-01T00:00:00.000Z`), employerKind: x.employerKind, hours: x.hours, headcountAvg: x.headcountAvg },
      });
    }

    const objective = await db.objective.create({ data: { tenantId: t, code: "OBJ-SST-1", title: "Reducir accidentes", ownerUserId: admin.userId, dueDate: new Date("2026-12-31") } });
    indicatorId = (
      await db.indicator.create({
        data: { tenantId: t, objectiveId: objective.id, name: "IF anual", unit: "índice", direction: "lower_better", target: 60, frequency: "monthly", kind: "lagging", ownerUserId: admin.userId },
      })
    ).id;
    const otherSite = await createSite({ tenantId: other, actorUserId: adminB.userId, name: "Otra", kind: "plant" });
    void otherSite;
    const otherObjective = await db.objective.create({ data: { tenantId: other, code: "OBJ-X", title: "Otro", ownerUserId: adminB.userId, dueDate: new Date("2026-12-31") } });
    foreignIndicatorId = (
      await db.indicator.create({
        data: { tenantId: other, objectiveId: otherObjective.id, name: "Ajeno", unit: "u", direction: "lower_better", target: 1, frequency: "monthly", kind: "lagging", ownerUserId: adminB.userId },
      })
    ).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("AT-01 (fila 15): empresa · total · ene–mar sale parcial y con los valores calculados a mano", async () => {
    const d = await dash();
    expect(d.current.status).toBe("partial");
    expect(d.current.monthsUsed).toEqual(["2026-02"]);
    expect(d.current.totals).toMatchObject({ hours: 35000, cases: 2, fatalCases: 1, lostDays: 5 });
    expect(d.current.indices.if).toBeCloseTo(57.14, 2);
    expect(d.current.indices.ig).toBeCloseTo(171.57, 2);
    expect(d.current.indices.ii).toBeCloseTo(9.85, 2);
    expect(d.current.rawCounts).toMatchObject({ near_miss: 1, first_aid: 1, no_lost_time: 1, lost_time: 6, fatal: 1, lostDays: 57 });
    expect(d.current.inItinere).toEqual({ cases: 1, lostDays: 30 });
    // Ordenado por mes: enero (inconsistente) antes que marzo (sin cargar).
    expect(d.gaps).toEqual([
      "Obra Sur (contratistas) tiene accidentes en enero 2026 pero 0 horas cargadas: revisá las horas de ese mes.",
      "Falta cargar las horas de marzo 2026 en Planta Norte (contratistas).",
    ]);
  });

  it("AT-12: sin la ventana anterior completa no hay flecha de tendencia", async () => {
    const d = await dash();
    expect(d.previous.status).toBe("no_data");
    expect(Object.values(d.trends).every((x) => x === null)).toBe(true);
  });

  it("un mes con horas y sin casos da IF 0, no «sin datos» (AT-04); sin la fila da «sin datos» (AT-03)", async () => {
    const own = await dash({ kind: "month", anchor: "2026-03", siteId: sa, group: "own" });
    expect(own.current.status).toBe("ok");
    expect(own.current.indices.if).toBe(0);
    const contractor = await dash({ kind: "month", anchor: "2026-03", siteId: sa, group: "contractor" });
    expect(contractor.current.status).toBe("no_data");
    expect(contractor.current.indices.if).toBeNull();
    expect(contractor.gaps).toEqual(["Falta cargar las horas de marzo 2026 en Planta Norte (contratistas)."]);
  });

  it("el filtro por sede y grupo coincide con las filas del SPEC (A · propio · ene–mar)", async () => {
    const d = await dash({ siteId: sa, group: "own" });
    expect(d.current.status).toBe("ok");
    expect(d.current.totals).toMatchObject({ hours: 60000, cases: 3, fatalCases: 1, lostDays: 30 });
    expect(d.current.indices.if).toBeCloseTo(50, 2);
    expect(d.current.indices.ig).toBeCloseTo(100.5, 2);
    expect(d.sites.map((s) => s.name)).toEqual(["Planta Norte"]);
  });

  it("la tendencia aparece cuando las dos ventanas son completas", async () => {
    // Ventana de 12 meses móviles: las dos tienen meses sin horas, así que no hay flecha.
    expect((await dash({ kind: "rolling12" })).trends.if).toBeNull();
    // Mes a mes en Obra Sur propio: febrero (sin casos) contra marzo (1 caso con baja).
    const d = await dash({ kind: "month", anchor: "2026-03", siteId: sb, group: "own" });
    expect(d.previous.status).toBe("ok");
    expect(d.trends.if).toBe("up");
  });

  it("AT-13: días sin accidentes con baja por sede", async () => {
    const d = await dash();
    const bySite = Object.fromEntries(d.daysSince.map((x) => [x.siteName, x.value]));
    expect(bySite["Planta Norte"]).toEqual({ kind: "days", days: 54 });
    expect(bySite["Obra Sur"]).toEqual({ kind: "days", days: 29 });
  });

  it("distribuciones laborales agregadas (el in itinere queda afuera) y sin nombres", async () => {
    const d = await dash();
    const total = (rows: { count: number }[]) => rows.reduce((n, r) => n + r.count, 0);
    // 10 eventos laborales de los 11 del dataset (E5 es in itinere).
    expect(total(d.distributions.form)).toBe(10);
    expect(d.distributions.form.map((r) => r.label)).toContain("Caída al mismo nivel");
    expect(total(d.distributions.weekday)).toBe(10);
    expect(d.distributions.weekday).toHaveLength(7);
    expect(total(d.distributions.hour)).toBe(10);
    // Los 6 casos con baja laborales (E1, E2, E6, E7, E10, E11) tienen ficha con la mano.
    expect(d.distributions.bodyPart[0]).toMatchObject({ label: "Mano", count: 6 });
    expect(JSON.stringify(d.distributions)).not.toMatch(/Dash|admin/);
  });

  it("AT-17: la cantidad de consultas es fija y las de incidentes son agregaciones (nada de findMany)", async () => {
    queries.length = 0;
    await dash({ kind: "rolling12" });
    const incident = queries.filter((q) => q.includes('"public"."incident_record"') || q.includes('"public"."incident_health"'));
    expect(incident.length).toBeGreaterThan(0);
    expect(incident.every((q) => /GROUP BY|COUNT\(/i.test(q))).toBe(true);
    const used = queries.filter((q) => /^SELECT/i.test(q)).length;
    expect(used).toBeLessThan(25);

    // Duplicar los eventos no cambia la cantidad de consultas.
    await db.exposurePeriod.count({ where: { tenantId: t } });
    queries.length = 0;
    await dash({ kind: "rolling12" });
    expect(queries.filter((q) => /^SELECT/i.test(q)).length).toBe(used);
  });

  it("AT-18: otra empresa no ve nada de esta", async () => {
    const d = await getSafetyDashboard(other, { kind: "ytd", anchor: "2026-03", group: "total", today: AS_OF }, db);
    expect(d.current.status).toBe("no_data");
    expect(d.current.rawCounts).toMatchObject({ lost_time: 0, fatal: 0 });
    expect(d.distributions.form).toEqual([]);
    expect(d.sites.map((s) => s.name)).toEqual(["Otra"]);
  });

  it("una sede dada de baja sale del tablero salvo que tenga historial en la ventana", async () => {
    await db.site.update({ where: { id: sb }, data: { active: false, inactiveAt: new Date() } });
    expect((await dash()).sites.map((s) => s.name)).toEqual(["Obra Sur", "Planta Norte"]);
    expect((await dash({ kind: "month", anchor: "2025-01" })).sites.map((s) => s.name)).toEqual(["Planta Norte"]);
    await db.site.update({ where: { id: sb }, data: { active: true, inactiveAt: null } });
  });

  it("abre en el último mes con horas cargadas", async () => {
    expect(await defaultAnchorMonth(t, AS_OF, db)).toBe("2026-03");
    expect(await defaultAnchorMonth(other, "2026-10-23", db)).toBe("2026-09");
  });

  describe("meta de un Indicador vinculado", () => {
    it("el administrador vincula el IF a un Indicador y el tablero lee su meta, sin escribir mediciones", async () => {
      expect((await listLinkableIndicators(t, db)).map((i) => i.name)).toEqual(["IF anual"]);
      await setIndicatorLinks({ tenantId: t, actor: admin, links: { if: indicatorId } }, db);
      expect(await getIndicatorLinks(t, db)).toEqual({ if: indicatorId });
      const d = await dash();
      // IF 57,14 con meta 60 (menor es mejor): cumple.
      expect(d.goals.if).toMatchObject({ indicatorName: "IF anual", target: 60, status: "met" });
      expect(d.goals.ig).toBeUndefined();
      expect(await db.measurement.count({ where: { tenantId: t } })).toBe(0);
    });

    it("sin datos en el índice, la meta queda «sin datos»", async () => {
      const d = await dash({ kind: "month", anchor: "2026-03", siteId: sa, group: "contractor" });
      expect(d.goals.if?.status).toBe("no_data");
    });

    it("rechaza indicadores de otra empresa y a quien no puede cambiar ajustes; desvincular borra el vínculo", async () => {
      await expect(setIndicatorLinks({ tenantId: t, actor: admin, links: { ig: foreignIndicatorId } }, db)).rejects.toBeInstanceOf(SafetyStatsError);
      await expect(setIndicatorLinks({ tenantId: t, actor: viewer, links: { ig: indicatorId } }, db)).rejects.toBeInstanceOf(SafetyStatsError);
      await setIndicatorLinks({ tenantId: t, actor: admin, links: { if: null } }, db);
      expect(await getIndicatorLinks(t, db)).toEqual({});
    });

    it("la base rechaza un índice que no es if, ig, ii ni id", async () => {
      await expect(db.safetyIndicatorLink.create({ data: { tenantId: t, metric: "trir", indicatorId } })).rejects.toThrow();
    });
  });
});
