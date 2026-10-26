import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type TenantRole } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { SafetyStatsError, updateSafetySettings, type SafetyUser } from "@/lib/safety-stats";
import {
  EXPOSURE_DUE_ENTITY_TYPE,
  applyExposureImport,
  getExposureGrid,
  listExposureRevisions,
  previewExposureImport,
  saveExposure,
  syncExposureDueItems,
} from "@/lib/safety-exposure";
import { listExposurePeriods } from "@/lib/safety-stats";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("exposición mensual (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let a = "";
  let b = "";
  let siteNorte = "";
  let siteSur = "";
  let siteOtra = "";
  const actors = {} as Record<"admin" | "owner" | "contributor" | "viewer" | "superuser" | "adminB", SafetyUser>;

  // «Hoy» fijo: 23/10/2026. Se controlan agosto, septiembre y octubre.
  const today = "2026-10-23";
  const monthRows = async (tenantId: string, month: string) => listExposurePeriods({ tenantId, fromMonth: month, toMonth: month }, db);
  const dueItems = (tenantId: string) => db.dueItem.findMany({ where: { tenantId, entityType: EXPOSURE_DUE_ENTITY_TYPE, status: "open" }, orderBy: { entityId: "asc" } });

  async function newUser(label: string, tenantId: string | null, role: TenantRole | null): Promise<SafetyUser> {
    const user = await db.user.create({ data: { name: `Exp ${label}`, email: `exp-${label}-${stamp}@test.dev`, emailVerified: true } });
    userIds.push(user.id);
    if (tenantId && role) await db.membership.create({ data: { userId: user.id, tenantId, role } });
    return { userId: user.id, role };
  }

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Exp ${label}`, slug: `exp-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actors.admin = await newUser("admin", a, "tenant_admin");
    actors.owner = await newUser("owner", a, "process_owner");
    actors.contributor = await newUser("contrib", a, "contributor");
    actors.viewer = await newUser("viewer", a, "viewer");
    actors.superuser = { ...(await newUser("super", null, null)), isPlatformSuperuser: true };
    actors.adminB = await newUser("adminb", b, "tenant_admin");
    siteNorte = (await createSite({ tenantId: a, actorUserId: actors.admin.userId, name: "Planta Norte", kind: "plant" })).id;
    siteSur = (await createSite({ tenantId: a, actorUserId: actors.admin.userId, name: "Obra Sur", kind: "worksite" })).id;
    siteOtra = (await createSite({ tenantId: b, actorUserId: actors.adminB.userId, name: "Planta Norte", kind: "plant" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  const save = (over: Partial<Parameters<typeof saveExposure>[0]> = {}) =>
    saveExposure(
      { tenantId: a, actor: actors.admin, siteId: siteNorte, month: "2026-09", own: { hours: 20000, headcountAvg: 110 }, contractor: { hours: 5000, headcountAvg: 28 }, today, ...over },
      db,
    );

  it("carga los dos grupos de una sede y los muestra en la grilla del mes", async () => {
    const done = await save();
    expect(done).toMatchObject({ created: 2, updated: 0 });
    const grid = await getExposureGrid(a, "2026-09", db);
    expect(grid.find((r) => r.siteId === siteNorte)).toMatchObject({ siteName: "Planta Norte", own: { hours: 20000, headcountAvg: 110 }, contractor: { hours: 5000, headcountAvg: 28 } });
    expect(grid.find((r) => r.siteId === siteSur)).toMatchObject({ own: null, contractor: null });
    // La grilla es de la empresa: la sede de la otra no aparece.
    expect(grid.map((r) => r.siteId)).not.toContain(siteOtra);
  });

  it("«sin personal contratista» se guarda como 0 / 0, distinto de no haber cargado", async () => {
    await save({ siteId: siteSur, own: { hours: 10000, headcountAvg: 55 }, contractor: { hours: 0, headcountAvg: 0 } });
    const rows = await monthRows(a, "2026-09");
    expect(rows.find((r) => r.siteId === siteSur && r.employerKind === "contractor")).toMatchObject({ hours: 0, headcountAvg: 0 });
  });

  it("AT-11: rechaza horas imposibles, meses futuros y sedes de otra empresa", async () => {
    await expect(save({ month: "2026-08", own: { hours: 10000, headcountAvg: 5 }, contractor: undefined })).rejects.toThrow(/horas por persona/);
    await expect(save({ month: "2026-11" })).rejects.toThrow(/futuro/);
    await expect(save({ siteId: siteOtra, month: "2026-08" })).rejects.toThrow(/sede no existe/);
    expect(await db.exposurePeriod.count({ where: { tenantId: a, periodMonth: new Date("2026-08-01") } })).toBe(0);
  });

  it("permisos: solo el administrador y el responsable de proceso cargan", async () => {
    await expect(save({ actor: actors.contributor, month: "2026-08" })).rejects.toBeInstanceOf(SafetyStatsError);
    await expect(save({ actor: actors.viewer, month: "2026-08" })).rejects.toBeInstanceOf(SafetyStatsError);
    await expect(save({ actor: actors.superuser, month: "2026-08" })).rejects.toBeInstanceOf(SafetyStatsError);
    await expect(save({ actor: actors.owner, month: "2026-08", siteId: siteSur })).resolves.toMatchObject({ created: 2 });
  });

  it("AT-22: corregir un mes que terminó exige motivo y deja una revisión; el tablero ve el valor nuevo", async () => {
    await expect(save({ own: { hours: 21000, headcountAvg: 110 }, contractor: undefined })).rejects.toThrow(/motivo/);
    expect((await monthRows(a, "2026-09")).find((r) => r.siteId === siteNorte && r.employerKind === "own")?.hours).toBe(20000);

    const done = await save({ own: { hours: 21000, headcountAvg: 110 }, contractor: undefined, reason: "Se omitieron las horas extra" });
    expect(done).toMatchObject({ created: 0, updated: 1 });
    expect((await monthRows(a, "2026-09")).find((r) => r.siteId === siteNorte && r.employerKind === "own")?.hours).toBe(21000);

    const [revision] = await listExposureRevisions(a, { month: "2026-09" }, db);
    expect(revision).toMatchObject({ siteName: "Planta Norte", employerKind: "own", previous: { hours: 20000 }, next: { hours: 21000 }, reason: "Se omitieron las horas extra" });
    expect(revision.actorName).toBe("Exp admin");
  });

  it("guardar lo mismo no crea revisiones ni cambia nada", async () => {
    const before = await db.exposureRevision.count({ where: { tenantId: a } });
    const done = await save({ own: { hours: 21000, headcountAvg: 110 }, contractor: undefined });
    expect(done).toMatchObject({ created: 0, updated: 0 });
    expect(await db.exposureRevision.count({ where: { tenantId: a } })).toBe(before);
  });

  it("dentro del mes en curso se puede ajustar sin motivo, pero queda la revisión", async () => {
    await save({ month: "2026-10", siteId: siteSur });
    const done = await save({ month: "2026-10", siteId: siteSur, own: { hours: 12000, headcountAvg: 60 }, contractor: undefined });
    expect(done.updated).toBe(1);
    const rev = (await listExposureRevisions(a, { month: "2026-10" }, db))[0];
    expect(rev.reason).toBe("Ajuste dentro del mes");
  });

  describe("AT-23: aviso de carga por sede y mes", () => {
    it("crea uno por sede y mes con falta, vence el día 10 del mes siguiente y es idempotente", async () => {
      const first = await syncExposureDueItems(a, { today }, db);
      expect(first.created).toBeGreaterThan(0);
      const items = await dueItems(a);
      const norteOctubre = items.find((i) => i.entityId === `${siteNorte}:2026-10`)!;
      expect(norteOctubre).toBeDefined();
      expect(norteOctubre.dueAt.toISOString().slice(0, 10)).toBe("2026-11-10");
      expect(norteOctubre.siteId).toBe(siteNorte);
      expect(norteOctubre.title).toContain("octubre 2026");
      expect(norteOctubre.leadDays).toBe(5);
      // Septiembre de Planta Norte tiene los dos grupos: sin aviso. Agosto de las dos sedes: pendientes.
      expect(items.some((i) => i.entityId === `${siteNorte}:2026-09`)).toBe(false);
      expect(items.some((i) => i.entityId === `${siteNorte}:2026-08`)).toBe(true);
      const again = await syncExposureDueItems(a, { today }, db);
      expect(again).toEqual({ created: 0, updated: 0, closed: 0 });
      expect((await dueItems(a)).length).toBe(items.length);
    });

    it("se cierra al guardar los dos grupos del mes", async () => {
      await save({ month: "2026-08" });
      expect((await dueItems(a)).some((i) => i.entityId === `${siteNorte}:2026-08`)).toBe(false);
    });

    it("el responsable de la carga pasa a ser el dueño de los avisos abiertos", async () => {
      await updateSafetySettings({ tenantId: a, actor: actors.admin, settings: { exposureOwnerUserId: actors.owner.userId } }, db);
      const result = await syncExposureDueItems(a, { today }, db);
      expect(result.updated).toBeGreaterThan(0);
      expect((await dueItems(a)).every((i) => i.ownerUserId === actors.owner.userId)).toBe(true);
      await expect(updateSafetySettings({ tenantId: a, actor: actors.admin, settings: { exposureOwnerUserId: actors.adminB.userId } }, db)).rejects.toThrow(/no pertenece/);
    });

    it("una sede dada de baja pierde sus avisos y la otra empresa no recibe nada", async () => {
      await db.site.update({ where: { id: siteSur }, data: { active: false, inactiveAt: new Date() } });
      await syncExposureDueItems(a, { today }, db);
      expect((await dueItems(a)).some((i) => i.siteId === siteSur)).toBe(false);
      expect(await dueItems(b)).toHaveLength(0);
      await db.site.update({ where: { id: siteSur }, data: { active: true, inactiveAt: null } });
    });
  });

  describe("AT-25: importación por CSV", () => {
    const header = "sede;mes;empresa;horas;dotacion";
    const csv = (...rows: string[]) => [header, ...rows].join("\n");

    it("vista previa: crea, corrige y marca como error una sede desconocida, sin guardar nada", async () => {
      const file = csv("Obra Sur;2026-07;propio;9000;50", "Planta Norte;2026-09;propio;22000;110", "Sede fantasma;2026-07;propio;100;1");
      const before = await db.exposurePeriod.count({ where: { tenantId: a } });
      const preview = await previewExposureImport(a, file, today, db);
      expect(preview.plan.counts).toEqual({ create: 1, update: 1, unchanged: 0, error: 1 });
      expect(preview.needsReason).toBe(true);
      expect(preview.plan.items.find((i) => i.action === "error")?.message).toContain("Sede fantasma");
      expect(await db.exposurePeriod.count({ where: { tenantId: a } })).toBe(before);
    });

    it("aplicar exige motivo si corrige algo, y reimportar el mismo archivo no cambia nada", async () => {
      const file = csv("Obra Sur;2026-07;propio;9000;50", "Obra Sur;2026-07;contratista;0;0", "Planta Norte;2026-09;propio;22000;110", "Sede fantasma;2026-07;propio;100;1");
      await expect(applyExposureImport({ tenantId: a, actor: actors.admin, csv: file, today }, db)).rejects.toThrow(/motivo/);
      expect(await db.exposurePeriod.count({ where: { tenantId: a, periodMonth: new Date("2026-07-01") } })).toBe(0);

      const done = await applyExposureImport({ tenantId: a, actor: actors.admin, csv: file, reason: "Cierre de nómina de septiembre", today }, db);
      expect(done.counts).toEqual({ create: 2, update: 1, unchanged: 0, error: 1 });
      expect((await monthRows(a, "2026-09")).find((r) => r.siteId === siteNorte && r.employerKind === "own")?.hours).toBe(22000);
      expect((await listExposureRevisions(a, { month: "2026-09" }, db))[0].reason).toBe("Cierre de nómina de septiembre");

      const revisionsBefore = await db.exposureRevision.count({ where: { tenantId: a } });
      const again = await applyExposureImport({ tenantId: a, actor: actors.admin, csv: file, today }, db);
      expect(again.counts).toEqual({ create: 0, update: 0, unchanged: 3, error: 1 });
      expect(await db.exposureRevision.count({ where: { tenantId: a } })).toBe(revisionsBefore);
    });

    it("el colaborador no importa y la otra empresa no ve lo importado", async () => {
      await expect(applyExposureImport({ tenantId: a, actor: actors.contributor, csv: csv("Obra Sur;2026-06;propio;1;1"), today }, db)).rejects.toBeInstanceOf(SafetyStatsError);
      expect(await monthRows(b, "2026-07")).toEqual([]);
      const preview = await previewExposureImport(b, csv("Obra Sur;2026-07;propio;9000;50"), today, db);
      expect(preview.plan.counts.error).toBe(1);
    });
  });

  it("deja registro de cada carga, corrección e importación sin datos personales", async () => {
    const audits = await db.masterDataAudit.findMany({ where: { tenantId: a, entityType: "exposure" }, orderBy: { createdAt: "asc" } });
    expect(audits.length).toBeGreaterThanOrEqual(5);
    expect(audits.every((r) => r.actorUserId && /Exposición|Importación de exposición/.test(r.summary))).toBe(true);
  });
});
