import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import {
  MasterDataError,
  applyRosterImport,
  createJobPosition,
  createJobTask,
  createPerson,
  createSite,
  deactivateCatalogItem,
  deactivatePerson,
  listPeople,
  listSites,
  previewRosterImport,
  searchPeople,
  setPersonJobTasks,
} from "@/lib/masterdata";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("master data integration", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({
        name: `MD ${label}`,
        slug: `md-${label}-${stamp}`,
        size: "small",
        activity: "servicios",
      });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    const user = await db.user.create({
      data: { name: "MD Admin", email: `md-${stamp}@test.dev`, emailVerified: true },
    });
    actor = user.id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.$disconnect();
  });

  it("dos tenants no ven las sedes ni las personas del otro, y pueden repetir nombres y legajos", async () => {
    const siteA = await createSite({ tenantId: a, actorUserId: actor, name: "Base Neuquén", kind: "base" });
    const siteB = await createSite({ tenantId: b, actorUserId: actor, name: "Base Neuquén", kind: "base" });
    const posA = await createJobPosition({ tenantId: a, actorUserId: actor, name: "Operario" });
    const posB = await createJobPosition({ tenantId: b, actorUserId: actor, name: "Operario" });
    await createPerson({ tenantId: a, actorUserId: actor, employeeCode: "1", name: "Ana A", siteId: siteA.id, positionId: posA.id });
    await createPerson({ tenantId: b, actorUserId: actor, employeeCode: "1", name: "Ana B", siteId: siteB.id, positionId: posB.id });

    expect((await listPeople(a)).map((p) => p.name)).toEqual(["Ana A"]);
    expect((await listPeople(b)).map((p) => p.name)).toEqual(["Ana B"]);
    expect((await listSites(a)).map((s) => s.id)).toEqual([siteA.id]);
    expect(await searchPeople(b, { q: "Ana" })).toHaveLength(1);
    // No se puede usar la sede de otro tenant.
    await expect(
      createPerson({ tenantId: a, actorUserId: actor, employeeCode: "2", name: "X", siteId: siteB.id, positionId: posA.id }),
    ).rejects.toBeInstanceOf(MasterDataError);
  });

  it("rechaza legajos y nombres repetidos dentro del mismo tenant", async () => {
    const [site] = await listSites(a);
    const [position] = await db.jobPosition.findMany({ where: { tenantId: a } });
    await expect(
      createPerson({ tenantId: a, actorUserId: actor, employeeCode: "1", name: "Otra", siteId: site.id, positionId: position.id }),
    ).rejects.toThrow("legajo");
    await expect(createSite({ tenantId: a, actorUserId: actor, name: "base neuquén" })).rejects.toThrow("Ya existe");
  });

  it("la persona que rota aparece al filtrar por su sede base y por las adicionales", async () => {
    const base = await createSite({ tenantId: a, actorUserId: actor, name: "Obrador 1", kind: "worksite" });
    const extra = await createSite({ tenantId: a, actorUserId: actor, name: "Yacimiento 2", kind: "field" });
    const [position] = await db.jobPosition.findMany({ where: { tenantId: a } });
    const p = await createPerson({
      tenantId: a,
      actorUserId: actor,
      employeeCode: "R1",
      name: "Rota Rosa",
      siteId: base.id,
      extraSiteIds: [extra.id, base.id],
      positionId: position.id,
    });
    expect(p.extraSites).toHaveLength(1);
    expect((await listPeople(a, { siteId: base.id })).map((x) => x.id)).toContain(p.id);
    expect((await listPeople(a, { siteId: extra.id })).map((x) => x.id)).toContain(p.id);
    expect((await searchPeople(a, { siteId: extra.id })).map((x) => x.id)).toContain(p.id);
  });

  it("bloquea la baja de una sede con personas activas y la permite al dar de baja a la persona", async () => {
    const site = (await listSites(a)).find((s) => s.name === "Obrador 1")!;
    await expect(
      deactivateCatalogItem({ entity: "site", tenantId: a, actorUserId: actor, id: site.id }),
    ).rejects.toThrow("Rota Rosa");
    const rosa = (await listPeople(a, { q: "Rota" }))[0];
    await deactivatePerson({ tenantId: a, actorUserId: actor, id: rosa.id });
    await deactivateCatalogItem({ entity: "site", tenantId: a, actorUserId: actor, id: site.id });
    // La persona de baja no aparece en los selectores pero conserva su ficha.
    expect(await searchPeople(a, { q: "Rota" })).toHaveLength(0);
    expect((await listPeople(a, { status: "inactive" })).map((x) => x.id)).toContain(rosa.id);
  });

  it("asigna tareas y no permite tareas de otro tenant", async () => {
    const task = await createJobTask({ tenantId: a, actorUserId: actor, name: "Trabajo en altura", critical: true });
    const taskB = await createJobTask({ tenantId: b, actorUserId: actor, name: "Trabajo en altura", critical: true });
    const ana = (await listPeople(a, { q: "Ana" }))[0];
    await setPersonJobTasks({ tenantId: a, actorUserId: actor, personId: ana.id, jobTaskIds: [task.id] });
    expect((await listPeople(a, { q: "Ana" }))[0].jobTasks).toHaveLength(1);
    await expect(
      setPersonJobTasks({ tenantId: a, actorUserId: actor, personId: ana.id, jobTaskIds: [taskB.id] }),
    ).rejects.toBeInstanceOf(MasterDataError);
  });

  it("importa 500 personas en una operación, crea el catálogo faltante solo con confirmación y no duplica al reimportar", async () => {
    const header = "legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas";
    const lines = Array.from(
      { length: 500 },
      (_, i) => `E${i + 1},Empleado ${i + 1},,Planta Nueva,Base Neuquén,Soldador,,,2024-03-01,Soldadura`,
    );
    const csv = [header, ...lines, "BAD,,,,,,,,,"].join("\n");
    const count = () => db.person.count({ where: { tenantId: a, employeeCode: { startsWith: "E" } } });

    const preview = await previewRosterImport(a, csv);
    expect(preview.plan.counts.create).toBe(500);
    expect(preview.errors.map((e) => e.line)).toEqual([502, 502, 502]);
    expect(preview.plan.toCreate.site).toEqual(["Planta Nueva"]);

    await expect(
      applyRosterImport({ tenantId: a, actorUserId: actor, csv, allowCreateCatalog: false }),
    ).rejects.toThrow("confirmá");
    expect(await count()).toBe(0);

    const first = await applyRosterImport({ tenantId: a, actorUserId: actor, csv, allowCreateCatalog: true });
    expect(first.counts.create).toBe(500);
    expect(await count()).toBe(500);
    expect(
      await db.personSite.count({ where: { tenantId: a, person: { employeeCode: { startsWith: "E" } } } }),
    ).toBe(500);

    const again = await applyRosterImport({ tenantId: a, actorUserId: actor, csv, allowCreateCatalog: true });
    expect(again.counts).toEqual({ create: 0, update: 0, unchanged: 500, blocked: 0 });
    expect(await count()).toBe(500);

    const changed = csv.replace("E1,Empleado 1,,Planta Nueva", "E1,Empleado Uno,,Planta Nueva");
    const third = await applyRosterImport({ tenantId: a, actorUserId: actor, csv: changed, allowCreateCatalog: false });
    expect(third.counts.update).toBe(1);
    expect((await db.person.findFirst({ where: { tenantId: a, employeeCode: "E1" } }))?.name).toBe("Empleado Uno");
    // El tenant B no recibió nada.
    expect(await db.person.count({ where: { tenantId: b, employeeCode: { startsWith: "E" } } })).toBe(0);
  }, 120_000);
});
