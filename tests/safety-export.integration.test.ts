import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type TenantRole } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createPerson, createSite } from "@/lib/masterdata";
import { SafetyStatsError, type SafetyUser } from "@/lib/safety-stats";
import { exportIncidentCases, getAggregateExport, getSafetySummary } from "@/lib/safety-export";
import { casesToCsv } from "@/domain/safety-stats/export";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("exportación de accidentabilidad (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let a = "";
  let b = "";
  let siteA = "";
  let siteB = "";
  let admin: SafetyUser;
  let viewer: SafetyUser;
  let platform: SafetyUser;
  const months = ["2026-03"];

  async function newUser(label: string, tenantId: string | null, role?: TenantRole): Promise<SafetyUser> {
    const user = await db.user.create({ data: { name: `Exp ${label}`, email: `exp-${label}-${stamp}@test.dev`, emailVerified: true } });
    userIds.push(user.id);
    if (tenantId && role) await db.membership.create({ data: { userId: user.id, tenantId, role } });
    return { userId: user.id, role, isPlatformSuperuser: !tenantId };
  }

  async function incident(tenantId: string, siteId: string, title: string, over: { status?: "published" | "cancelled"; classification?: "lost_time" | "near_miss"; personId?: string } = {}) {
    const finding = await db.finding.create({
      data: { tenantId, type: "incident", origin: "incident", status: over.status ?? "published", title, description: "x", detectedAt: new Date("2026-03-10T15:00:00.000Z") },
    });
    const record = await db.incidentRecord.create({
      data: {
        tenantId,
        findingId: finding.id,
        siteId,
        occurredAt: new Date("2026-03-10T15:00:00.000Z"),
        occurredOn: new Date("2026-03-10T00:00:00.000Z"),
        periodMonth: new Date("2026-03-01T00:00:00.000Z"),
        weekday: 2,
        hourOfDay: 12,
        classification: over.classification ?? "lost_time",
        employerKind: "own",
        accidentForm: "fall_same_level",
        materialAgent: "floor_stairs",
        lostDays: 4,
        returnToWorkDate: new Date("2026-03-14T00:00:00.000Z"),
      },
    });
    if (over.personId) {
      await db.incidentHealth.create({ data: { tenantId, incidentRecordId: record.id, affectedPersonId: over.personId, bodyPart: "hand", artClaimNumber: "ART-77" } });
    }
  }

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      tenantIds.push((await createTenantWithTemplate({ name: `Exp ${label}`, slug: `exp-${label}-${stamp}`, size: "small", activity: "servicios" })).id);
    }
    [a, b] = tenantIds;
    admin = await newUser("admin", a, "tenant_admin");
    viewer = await newUser("viewer", a, "viewer");
    platform = await newUser("platform", null);
    const adminB = await newUser("adminb", b, "tenant_admin");
    siteA = (await createSite({ tenantId: a, actorUserId: admin.userId, name: "Planta Norte", kind: "plant" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: adminB.userId, name: "Planta Ajena", kind: "plant" })).id;
    const position = await createJobPosition({ tenantId: a, actorUserId: admin.userId, name: "Operario" });
    const person = await createPerson({ tenantId: a, actorUserId: admin.userId, employeeCode: "L-1", name: "Ana Export", siteId: siteA, positionId: position.id });
    await incident(a, siteA, "Caída en planta", { personId: person.id });
    await incident(a, siteA, "Anulado", { status: "cancelled" });
    await incident(b, siteB, "Del otro tenant");
    await db.exposurePeriod.create({ data: { tenantId: a, siteId: siteA, periodMonth: new Date("2026-03-01T00:00:00.000Z"), employerKind: "own", hours: 20000, headcountAvg: 100 } });
    await db.exposurePeriod.create({ data: { tenantId: a, siteId: siteA, periodMonth: new Date("2026-03-01T00:00:00.000Z"), employerKind: "contractor", hours: 0, headcountAvg: 0 } });
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("el CSV agregado trae una fila por sede, mes y grupo, y solo de la empresa", async () => {
    const { rows } = await getAggregateExport({ tenantId: a, months }, db);
    expect(rows.map((r) => r.site)).toEqual(["Planta Norte", "Planta Norte"]);
    const own = rows.find((r) => r.employerKind === "own")!;
    // El Hallazgo anulado no cuenta (D4): 1 caso con baja, 4 días, IF = 1 × 1.000.000 / 20.000.
    expect(own).toMatchObject({ status: "ok", hours: 20000, lostTime: 1, lostDays: 4, if: 50 });
    expect(rows.find((r) => r.employerKind === "contractor")).toMatchObject({ status: "empty", if: null });
  });

  it("los casos con nombres salen para el viewer, sin anulados ni casos de otra empresa, y dejan registro", async () => {
    const before = await db.masterDataAudit.count({ where: { tenantId: a, action: "export" } });
    const { rows, truncated } = await exportIncidentCases({ tenantId: a, months, actor: viewer }, db);
    expect(truncated).toBe(false);
    expect(rows.map((r) => r.findingTitle)).toEqual(["Caída en planta"]);
    expect(rows[0]).toMatchObject({ person: "Ana Export", employeeCode: "L-1", artClaimNumber: "ART-77", lostDays: 4, returnToWorkDate: "2026-03-14" });
    expect(casesToCsv(rows)).toContain("Ana Export");
    const audit = await db.masterDataAudit.findMany({ where: { tenantId: a, action: "export" } });
    expect(audit).toHaveLength(before + 1);
    expect(audit[audit.length - 1]).toMatchObject({ actorUserId: viewer.userId });
    expect(audit.map((x) => x.summary).join()).not.toContain("Ana Export");
  });

  it("el personal de plataforma no recibe los casos con nombres y no deja registro", async () => {
    const before = await db.masterDataAudit.count({ where: { tenantId: a, action: "export" } });
    await expect(exportIncidentCases({ tenantId: a, months, actor: platform }, db)).rejects.toBeInstanceOf(SafetyStatsError);
    expect(await db.masterDataAudit.count({ where: { tenantId: a, action: "export" } })).toBe(before);
  });

  it("filtrar por una sede de otra empresa no trae nada", async () => {
    const { rows } = await exportIncidentCases({ tenantId: a, months, siteId: siteB, actor: admin }, db);
    expect(rows).toEqual([]);
    expect((await getAggregateExport({ tenantId: a, months, siteId: siteB }, db)).rows).toEqual([]);
  });

  it("el resumen trae el resultado de cada sede de la empresa", async () => {
    const summary = await getSafetySummary(a, { kind: "month", anchor: "2026-03", group: "total", today: "2026-03-31" }, db);
    expect(summary.perSite.map((s) => s.siteName)).toEqual(["Planta Norte"]);
    expect(summary.perSite[0].result.rawCounts.lost_time).toBe(1);
    expect(summary.current.status).toBe("ok");
  });
});
