import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type TenantRole } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createPerson, createSite } from "@/lib/masterdata";
import { cancelFinding } from "@/lib/finding-lifecycle";
import {
  SafetyStatsError,
  addIncidentFollowUp,
  aggregateIncidentEvents,
  createIncidentWithFinding,
  getIncidentFicha,
  getSafetySettings,
  hasIncidentRecord,
  listExposurePeriods,
  listIncidents,
  saveIncidentHealth,
  updateIncidentFact,
  updateSafetySettings,
  type IncidentFactInput,
  type SafetyUser,
} from "@/lib/safety-stats";
import { aggregateWindow } from "@/domain/safety-stats/indices";
import { monthsBetween } from "@/domain/safety-stats/period";
import { DEFAULT_SAFETY_SETTINGS } from "@/domain/safety-stats/types";
import { EVENTS, EXPOSURE, SITE_A, materialize } from "./safety-stats-dataset";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("accidentabilidad: persistencia", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let a = "";
  let b = "";
  let siteA1 = "";
  let siteB1 = "";
  let personA = "";
  let personB = "";
  const actors = {} as Record<"admin" | "owner" | "contributor" | "viewer" | "superuser" | "adminB", SafetyUser>;

  const now = new Date("2026-02-20T15:00:00.000Z");
  const fact = (over: Partial<IncidentFactInput> = {}): IncidentFactInput => ({
    siteId: siteA1,
    occurredAt: new Date("2026-02-10T15:00:00.000Z"),
    classification: "lost_time",
    inItinere: false,
    isRoad: false,
    employerKind: "own",
    restrictedWork: false,
    accidentForm: "fall_same_level",
    materialAgent: "floor_stairs",
    returnToWorkDate: null,
    ...over,
  });
  const health = (personId: string | null = personA) => ({
    affectedPersonId: personId,
    natureOfInjury: "sprain",
    bodyPart: "foot",
    artClaimNumber: "ART-123",
    deathDate: null,
  });

  async function newIncident(tenantId: string, actor: SafetyUser, over: Partial<IncidentFactInput> = {}, title = "Caída en el depósito", at: Date = now) {
    return createIncidentWithFinding({ tenantId, actor, title, description: "Resbaló en el pasillo", fact: fact(over), now: at }, db);
  }

  async function newUser(label: string, tenantId: string | null, role: TenantRole | null): Promise<SafetyUser> {
    const user = await db.user.create({ data: { name: `Acc ${label}`, email: `acc-${label}-${stamp}@test.dev`, emailVerified: true } });
    userIds.push(user.id);
    if (tenantId && role) await db.membership.create({ data: { userId: user.id, tenantId, role } });
    return { userId: user.id, role };
  }

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Acc ${label}`, slug: `acc-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actors.admin = await newUser("admin", a, "tenant_admin");
    actors.owner = await newUser("owner", a, "process_owner");
    actors.contributor = await newUser("contrib", a, "contributor");
    actors.viewer = await newUser("viewer", a, "viewer");
    actors.superuser = { ...(await newUser("super", null, null)), isPlatformSuperuser: true };
    actors.adminB = await newUser("adminb", b, "tenant_admin");

    siteA1 = (await createSite({ tenantId: a, actorUserId: actors.admin.userId, name: "Planta Norte", kind: "plant" })).id;
    siteB1 = (await createSite({ tenantId: b, actorUserId: actors.adminB.userId, name: "Planta Norte", kind: "plant" })).id;
    const posA = await createJobPosition({ tenantId: a, actorUserId: actors.admin.userId, name: "Operario" });
    const posB = await createJobPosition({ tenantId: b, actorUserId: actors.adminB.userId, name: "Operario" });
    personA = (await createPerson({ tenantId: a, actorUserId: actors.admin.userId, employeeCode: "1", name: "Ana Acc", siteId: siteA1, positionId: posA.id })).id;
    personB = (await createPerson({ tenantId: b, actorUserId: actors.adminB.userId, employeeCode: "1", name: "Beto Acc", siteId: siteB1, positionId: posB.id })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("AT-15: el accidente cuenta desde que se guarda la ficha, aun en borrador, y sale de los conteos al anular el Hallazgo", async () => {
    const { finding, record } = await newIncident(a, actors.contributor, { occurredAt: new Date("2026-01-31T02:30:00.000Z") });
    expect(finding).toMatchObject({ type: "incident", origin: "incident", status: "draft", tenantId: a });
    // 23:30 del 30/01 hora local: pertenece a enero.
    expect(record.periodMonth.toISOString().slice(0, 10)).toBe("2026-01-01");

    const jan = { tenantId: a, fromMonth: "2026-01", toMonth: "2026-01", siteIds: [siteA1] };
    const before = await aggregateIncidentEvents(jan, db);
    expect(before.events.find((e) => e.classification === "lost_time" && e.month === "2026-01")?.count).toBe(1);
    expect(before.openCases).toEqual([{ siteId: siteA1, month: "2026-01", employerKind: "own", count: 1 }]);

    await db.finding.update({ where: { id: finding.id }, data: { status: "cancelled" } });
    const after = await aggregateIncidentEvents(jan, db);
    expect(after.events.filter((e) => e.classification === "lost_time")).toHaveLength(0);
    await db.finding.update({ where: { id: finding.id }, data: { status: "draft" } });
    expect((await aggregateIncidentEvents(jan, db)).events.find((e) => e.classification === "lost_time")?.count).toBe(1);
  });

  it("AT-16: la ficha solo apunta a un Hallazgo de tipo incidente y de su empresa, y es única por Hallazgo", async () => {
    const base = {
      occurredAt: new Date("2026-02-01T15:00:00.000Z"),
      occurredOn: new Date("2026-02-01T00:00:00.000Z"),
      periodMonth: new Date("2026-02-01T00:00:00.000Z"),
      weekday: 0,
      hourOfDay: 12,
      classification: "near_miss" as const,
      employerKind: "own" as const,
      accidentForm: "other",
      materialAgent: "other",
    };
    const nonIncident = await db.finding.create({
      data: { tenantId: a, type: "nonconformity", title: "NC común", description: "x", detectedAt: now },
    });
    await expect(
      db.incidentRecord.create({ data: { ...base, tenantId: a, findingId: nonIncident.id, siteId: siteA1 } }),
    ).rejects.toThrow(/tipo incidente/);

    const incidentOfB = await db.finding.create({
      data: { tenantId: b, type: "incident", origin: "incident", title: "Incidente B", description: "x", detectedAt: now },
    });
    await expect(
      db.incidentRecord.create({ data: { ...base, tenantId: a, findingId: incidentOfB.id, siteId: siteA1 } }),
    ).rejects.toThrow(/misma empresa/);
    await expect(
      db.incidentRecord.create({ data: { ...base, tenantId: b, findingId: incidentOfB.id, siteId: siteA1 } }),
    ).rejects.toThrow(/sede/);

    const { finding } = await newIncident(a, actors.admin);
    await expect(
      db.incidentRecord.create({ data: { ...base, tenantId: a, findingId: finding.id, siteId: siteA1 } }),
    ).rejects.toThrow();

    // Ficha de salud: la persona debe ser de la misma empresa.
    const record = await db.incidentRecord.findFirstOrThrow({ where: { findingId: finding.id } });
    await expect(
      db.incidentHealth.create({ data: { tenantId: a, incidentRecordId: record.id, affectedPersonId: personB } }),
    ).rejects.toThrow(/persona/);
    await expect(
      db.incidentHealth.create({ data: { tenantId: b, incidentRecordId: record.id, affectedPersonId: personB } }),
    ).rejects.toThrow(/ficha/);
    expect(await hasIncidentRecord(a, finding.id, db)).toBe(true);
    expect(await hasIncidentRecord(b, finding.id, db)).toBe(false);
  });

  it("AT-16: la base rechaza combinaciones imposibles (tareas restringidas con baja, reintegro sin baja, fatal con días)", async () => {
    const { record } = await newIncident(a, actors.admin);
    await expect(db.incidentRecord.update({ where: { id: record.id }, data: { restrictedWork: true } })).rejects.toThrow();
    await expect(db.incidentRecord.update({ where: { id: record.id }, data: { classification: "near_miss", inItinere: true } })).rejects.toThrow();
    await expect(db.incidentRecord.update({ where: { id: record.id }, data: { classification: "fatal", chargePct: 100 } })).rejects.toThrow();
    await expect(db.incidentRecord.update({ where: { id: record.id }, data: { chargePct: 150 } })).rejects.toThrow();
  });

  it("AT-18: otra empresa no ve ni modifica fichas, exposición ni ajustes", async () => {
    const { finding } = await newIncident(a, actors.admin, {}, "Aislamiento A");
    await db.exposurePeriod.create({
      data: { tenantId: a, siteId: siteA1, periodMonth: new Date("2026-02-01T00:00:00.000Z"), employerKind: "own", hours: 1000, headcountAvg: 10 },
    });
    await updateSafetySettings({ tenantId: a, actor: actors.admin, settings: { fatalChargeDays: 4000 } }, db);

    // Lectura: B no encuentra nada de A.
    expect(await getIncidentFicha({ tenantId: b, findingId: finding.id, actor: actors.adminB }, db)).toBeNull();
    expect((await listIncidents({ tenantId: b }, db)).total).toBe(0);
    expect((await aggregateIncidentEvents({ tenantId: b, fromMonth: "2026-01", toMonth: "2026-12" }, db)).events).toEqual([]);
    expect(await listExposurePeriods({ tenantId: b, fromMonth: "2026-01", toMonth: "2026-12" }, db)).toEqual([]);
    expect((await getSafetySettings(b, db)).fatalChargeDays).toBe(DEFAULT_SAFETY_SETTINGS.fatalChargeDays);
    expect((await getSafetySettings(a, db)).fatalChargeDays).toBe(4000);

    // Escritura: B no modifica la ficha de A.
    await expect(
      updateIncidentFact({ tenantId: b, actor: actors.adminB, findingId: finding.id, fact: { ...fact(), siteId: siteB1 } }, db),
    ).rejects.toBeInstanceOf(SafetyStatsError);
    await expect(saveIncidentHealth({ tenantId: b, actor: actors.adminB, findingId: finding.id, health: health(personB) }, db)).rejects.toBeInstanceOf(SafetyStatsError);
    await expect(
      addIncidentFollowUp({ tenantId: b, actor: actors.adminB, findingId: finding.id, followUp: { classification: "fatal" } }, db),
    ).rejects.toBeInstanceOf(SafetyStatsError);

    // Ni usar la sede o la persona de otra empresa en el alta.
    await expect(newIncident(a, actors.admin, { siteId: siteB1 })).rejects.toBeInstanceOf(SafetyStatsError);
    await expect(
      createIncidentWithFinding({ tenantId: a, actor: actors.admin, title: "Cruce", description: "x", fact: fact(), health: health(personB), now }, db),
    ).rejects.toBeInstanceOf(SafetyStatsError);
    expect(await db.incidentRecord.count({ where: { tenantId: a, finding: { title: "Cruce" } } })).toBe(0);
    expect(await db.finding.count({ where: { tenantId: a, title: "Cruce" } })).toBe(0);
  });

  it("AT-19: viewer y contributor leen la ficha completa, sin poder escribir, y cada consulta deja registro", async () => {
    const { finding, record } = await createIncidentWithFinding(
      { tenantId: a, actor: actors.admin, title: "Golpe con la pala", description: "Detalle completo", fact: fact(), health: health(), now },
      db,
    );
    const views = () => db.masterDataAudit.count({ where: { tenantId: a, entityId: record.id, action: "view" } });
    expect(await views()).toBe(0);

    for (const who of ["viewer", "contributor"] as const) {
      const ficha = await getIncidentFicha({ tenantId: a, findingId: finding.id, actor: actors[who] }, db);
      expect(ficha?.healthVisible).toBe(true);
      expect(ficha?.health?.affectedPerson?.name).toBe("Ana Acc");
      expect(ficha?.health).toMatchObject({ natureOfInjury: "sprain", bodyPart: "foot", artClaimNumber: "ART-123" });
      expect(ficha?.followUps.length).toBeGreaterThan(0);
    }
    expect(await views()).toBe(2);
    const lastView = await db.masterDataAudit.findFirstOrThrow({ where: { tenantId: a, entityId: record.id, action: "view" }, orderBy: { createdAt: "desc" } });
    expect(lastView.actorUserId).toBe(actors.contributor.userId);
    // El registro no copia datos de salud.
    expect(lastView.summary).not.toMatch(/Ana|sprain|ART-123/);

    for (const who of ["viewer", "contributor"] as const) {
      await expect(saveIncidentHealth({ tenantId: a, actor: actors[who], findingId: finding.id, health: health() }, db)).rejects.toThrow(/permiso/i);
      await expect(
        addIncidentFollowUp({ tenantId: a, actor: actors[who], findingId: finding.id, followUp: { classification: "fatal" } }, db),
      ).rejects.toThrow(/permiso/i);
      await expect(
        updateIncidentFact({ tenantId: a, actor: actors[who], findingId: finding.id, fact: fact() }, db),
      ).rejects.toThrow(/permiso/i);
    }
    await expect(newIncident(a, actors.viewer)).rejects.toThrow(/permiso/i);
  });

  it("AT-20: admin y responsable completan la ficha de salud; el colaborador da de alta el hecho pero no la completa", async () => {
    const { finding } = await newIncident(a, actors.contributor, {}, "Alta por colaborador");
    expect(await db.incidentHealth.count({ where: { incidentRecord: { findingId: finding.id } } })).toBe(0);
    await expect(
      createIncidentWithFinding({ tenantId: a, actor: actors.contributor, title: "x1", description: "x", fact: fact(), health: health(), now }, db),
    ).rejects.toThrow(/permiso/i);
    await expect(saveIncidentHealth({ tenantId: a, actor: actors.contributor, findingId: finding.id, health: health() }, db)).rejects.toThrow(/permiso/i);

    await saveIncidentHealth({ tenantId: a, actor: actors.owner, findingId: finding.id, health: health() }, db);
    expect((await getIncidentFicha({ tenantId: a, findingId: finding.id, actor: actors.viewer }, db))?.health?.affectedPerson?.id).toBe(personA);
    await saveIncidentHealth({ tenantId: a, actor: actors.admin, findingId: finding.id, health: { ...health(), bodyPart: "hand" } }, db);
    expect((await getIncidentFicha({ tenantId: a, findingId: finding.id, actor: actors.viewer }, db))?.health?.bodyPart).toBe("hand");

    // Con lesión, la persona es obligatoria.
    await expect(saveIncidentHealth({ tenantId: a, actor: actors.admin, findingId: finding.id, health: health(null) }, db)).rejects.toThrow(/persona/i);
    // Cada alta y edición quedó registrada.
    const record = await db.incidentRecord.findFirstOrThrow({ where: { findingId: finding.id } });
    const actions = (await db.masterDataAudit.findMany({ where: { tenantId: a, entityId: record.id }, orderBy: { createdAt: "asc" } })).map((r) => `${r.action}`);
    expect(actions.filter((x) => x === "create").length).toBe(2);
    expect(actions).toContain("update");
  });

  it("AT-21: el superusuario de plataforma no recibe la ficha de salud ni la edita", async () => {
    const { finding, record } = await createIncidentWithFinding(
      { tenantId: a, actor: actors.admin, title: "Para plataforma", description: "x", fact: fact(), health: health(), now },
      db,
    );
    const ficha = await getIncidentFicha({ tenantId: a, findingId: finding.id, actor: actors.superuser }, db);
    expect(ficha?.healthVisible).toBe(false);
    expect(ficha?.health).toBeNull();
    expect(ficha?.followUps).toEqual([]);
    expect(JSON.stringify(ficha)).not.toMatch(/Ana Acc|ART-123/);
    expect(await db.masterDataAudit.count({ where: { entityId: record.id, action: "view" } })).toBe(0);
    await expect(saveIncidentHealth({ tenantId: a, actor: actors.superuser, findingId: finding.id, health: health() }, db)).rejects.toThrow(/permiso/i);
    await expect(
      addIncidentFollowUp({ tenantId: a, actor: actors.superuser, findingId: finding.id, followUp: { classification: "fatal" } }, db),
    ).rejects.toThrow(/permiso/i);
  });

  it("AT-24: reclasificar crea un seguimiento, mueve el conteo y deja el historial legible para todos", async () => {
    const { finding, record } = await newIncident(a, actors.contributor, { classification: "no_lost_time", restrictedWork: true, occurredAt: new Date("2026-03-05T15:00:00.000Z") }, "Reclasificación", new Date("2026-03-10T15:00:00.000Z"));
    const mar = { tenantId: a, fromMonth: "2026-03", toMonth: "2026-03", siteIds: [siteA1] };
    const count = async (cls: string) => (await aggregateIncidentEvents(mar, db)).events.find((e) => e.classification === cls)?.count ?? 0;
    expect([await count("no_lost_time"), await count("lost_time")]).toEqual([1, 0]);

    await saveIncidentHealth({ tenantId: a, actor: actors.admin, findingId: finding.id, health: health() }, db);
    const result = await addIncidentFollowUp(
      { tenantId: a, actor: actors.owner, findingId: finding.id, followUp: { classification: "lost_time", note: "Pasó a baja médica" }, now: new Date("2026-03-20T15:00:00.000Z") },
      db,
    );
    expect(result).toMatchObject({ lostDays: 15, open: true });
    expect([await count("no_lost_time"), await count("lost_time")]).toEqual([0, 1]);
    // El caso sigue en el mes del accidente (marzo), aunque se reclasifique más tarde.
    const moved = await db.incidentRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(moved.periodMonth.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(moved.restrictedWork).toBe(false);

    // Vencimiento de seguimiento: uno solo, con sede y responsable, y se renueva sin duplicarse.
    const dueFor = () => db.dueItem.findMany({ where: { tenantId: a, entityType: "incident_followup", entityId: finding.id } });
    expect((await dueFor()).filter((d) => d.status === "open")).toHaveLength(1);
    await addIncidentFollowUp(
      { tenantId: a, actor: actors.owner, findingId: finding.id, followUp: { classification: "lost_time" }, now: new Date("2026-03-25T15:00:00.000Z") },
      db,
    );
    const open = (await dueFor()).filter((d) => d.status === "open");
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ siteId: siteA1, ownerUserId: actors.admin.userId });

    // Con la fecha de reintegro se cierra el caso y el vencimiento.
    await addIncidentFollowUp(
      { tenantId: a, actor: actors.owner, findingId: finding.id, followUp: { classification: "lost_time", returnToWorkDate: "2026-03-29" }, now: new Date("2026-03-30T15:00:00.000Z") },
      db,
    );
    expect((await dueFor()).filter((d) => d.status === "open")).toHaveLength(0);
    expect((await aggregateIncidentEvents(mar, db)).openCases).toEqual([]);

    // El historial lo lee cualquier rol de la empresa, del más nuevo al más viejo.
    const ficha = await getIncidentFicha({ tenantId: a, findingId: finding.id, actor: actors.viewer }, db);
    expect(ficha?.followUps.map((f) => f.classification)).toEqual(["lost_time", "lost_time", "lost_time", "no_lost_time"]);
    expect(ficha?.followUps[0]).toMatchObject({ lostDays: 23, returnToWorkDate: new Date("2026-03-29T00:00:00.000Z") });
    expect(ficha?.followUps.at(-1)?.note).toBe("Alta de la ficha");
  });

  it("anular el Hallazgo cierra el vencimiento de seguimiento y el caso sale de los conteos", async () => {
    const { finding } = await newIncident(a, actors.admin, { classification: "lost_time" }, "Caso a anular");
    const openDue = () => db.dueItem.findMany({ where: { tenantId: a, entityType: "incident_followup", entityId: finding.id, status: "open" } });
    expect(await openDue()).toHaveLength(1);

    await cancelFinding({ tenantId: a, findingId: finding.id, actorUserId: actors.admin.userId, reason: "Cargado por error" }, db);

    expect(await openDue()).toHaveLength(0);
    expect((await db.dueItem.findMany({ where: { tenantId: a, entityType: "incident_followup", entityId: finding.id } })).map((d) => d.status)).not.toContain("open");
  });

  it("reglas de dominio en el alta: reintegro anterior, in itinere con casi accidente y fecha futura", async () => {
    await expect(newIncident(a, actors.admin, { returnToWorkDate: "2026-02-01" })).rejects.toThrow(/anterior/);
    await expect(newIncident(a, actors.admin, { classification: "near_miss", inItinere: true })).rejects.toThrow(/trayecto/);
    await expect(newIncident(a, actors.admin, { occurredAt: new Date("2026-03-01T15:00:00.000Z") })).rejects.toThrow(/futura/);
    await expect(newIncident(a, actors.admin, { classification: "lost_time", returnToWorkDate: "2026-02-11" })).rejects.toThrow(/sin baja/i);
  });

  it("el dataset de referencia guardado en la base da los mismos resultados que el cálculo a mano", async () => {
    const t = await createTenantWithTemplate({ name: "Acc dataset", slug: `acc-ds-${stamp}`, size: "small", activity: "servicios" });
    tenantIds.push(t.id);
    const admin = await newUser("ds-admin", t.id, "tenant_admin");
    const sa = (await createSite({ tenantId: t.id, actorUserId: admin.userId, name: "Planta Norte", kind: "plant" })).id;
    const sb = (await createSite({ tenantId: t.id, actorUserId: admin.userId, name: "Obra Sur", kind: "worksite" })).id;
    const siteOf = (id: string) => (id === SITE_A ? sa : sb);

    for (const e of materialize(EVENTS)) {
      const finding = await db.finding.create({
        data: { tenantId: t.id, type: "incident", origin: "incident", status: "published", title: e.id, description: "x", detectedAt: new Date(`${e.date}T15:00:00.000Z`) },
      });
      await db.incidentRecord.create({
        data: {
          tenantId: t.id,
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
          accidentForm: "other",
          materialAgent: "other",
          lostDays: e.lostDays,
          returnToWorkDate: e.returnToWorkDate ? new Date(`${e.returnToWorkDate}T00:00:00.000Z`) : null,
          chargePct: e.chargePct,
        },
      });
    }
    for (const x of EXPOSURE) {
      await db.exposurePeriod.create({
        data: { tenantId: t.id, siteId: siteOf(x.siteId), periodMonth: new Date(`${x.month}-01T00:00:00.000Z`), employerKind: x.employerKind, hours: x.hours, headcountAvg: x.headcountAvg },
      });
    }

    const range = { tenantId: t.id, fromMonth: "2026-01", toMonth: "2026-03" };
    const [{ events, openCases }, exposure] = await Promise.all([aggregateIncidentEvents(range, db), listExposurePeriods(range, db)]);
    const result = aggregateWindow({
      exposure,
      events,
      openCases,
      months: monthsBetween("2026-01", "2026-03"),
      segments: [sa, sb].flatMap((siteId) => (["own", "contractor"] as const).map((employerKind) => ({ siteId, employerKind }))),
      settings: DEFAULT_SAFETY_SETTINGS,
    });
    // Fila 15 del SPEC: Empresa · total · ene–mar.
    expect(result.status).toBe("partial");
    expect(result.monthsUsed).toEqual(["2026-02"]);
    expect(result.totals).toMatchObject({ hours: 35000, cases: 2, fatalCases: 1, lostDays: 5 });
    expect(result.indices.if).toBeCloseTo(57.14, 2);
    expect(result.indices.ig).toBeCloseTo(171.57, 2);
    expect(result.indices.ii).toBeCloseTo(9.85, 2);
    expect(result.rawCounts).toMatchObject({ near_miss: 1, first_aid: 1, no_lost_time: 1, lost_time: 6, fatal: 1, lostDays: 57 });
    expect(result.inItinere).toEqual({ cases: 1, lostDays: 30 });
  });
});
