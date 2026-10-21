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
  updatePerson,
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

  describe("fechas del plazo de gracia (assignedAt y positionSince)", () => {
    const old = new Date("2026-01-10T12:00:00.000Z");
    const recent = (d: Date | null | undefined) => Boolean(d) && Date.now() - d!.getTime() < 60_000;

    async function setup(code: string) {
      const site = await createSite({ tenantId: a, actorUserId: actor, name: `Sede ${code} ${stamp}`, kind: "base" });
      const p1 = await createJobPosition({ tenantId: a, actorUserId: actor, name: `Puesto 1 ${code} ${stamp}` });
      const p2 = await createJobPosition({ tenantId: a, actorUserId: actor, name: `Puesto 2 ${code} ${stamp}` });
      const altura = await createJobTask({ tenantId: a, actorUserId: actor, name: `Altura ${code} ${stamp}` });
      const izaje = await createJobTask({ tenantId: a, actorUserId: actor, name: `Izaje ${code} ${stamp}` });
      const person = await createPerson({ tenantId: a, actorUserId: actor, employeeCode: `${code}-${stamp}`, name: `Persona ${code}`, siteId: site.id, positionId: p1.id, jobTaskIds: [altura.id] });
      await db.personJobTask.updateMany({ where: { personId: person.id }, data: { assignedAt: old } });
      await db.person.update({ where: { id: person.id }, data: { positionSince: old } });
      const base = { tenantId: a, actorUserId: actor, id: person.id, employeeCode: person.employeeCode, name: person.name, siteId: site.id };
      const dates = async () => Object.fromEntries((await db.personJobTask.findMany({ where: { personId: person.id } })).map((r) => [r.jobTaskId, r.assignedAt]));
      return { site, p1, p2, altura, izaje, person, base, dates };
    }

    it("alta: sin puesto anterior, positionSince queda nulo (desde el ingreso) y la tarea lleva la fecha de hoy", async () => {
      const site = await createSite({ tenantId: a, actorUserId: actor, name: `Sede alta ${stamp}`, kind: "base" });
      const pos = await createJobPosition({ tenantId: a, actorUserId: actor, name: `Puesto alta ${stamp}` });
      const task = await createJobTask({ tenantId: a, actorUserId: actor, name: `Tarea alta ${stamp}` });
      const person = await createPerson({ tenantId: a, actorUserId: actor, employeeCode: `ALTA-${stamp}`, name: "Alta", siteId: site.id, positionId: pos.id, jobTaskIds: [task.id] });
      expect(person.positionSince).toBeNull();
      const rows = await db.personJobTask.findMany({ where: { personId: person.id } });
      expect(recent(rows[0].assignedAt)).toBe(true);
    });

    it("editar la persona conserva la fecha de las tareas que siguen y del puesto sin cambios; la tarea nueva lleva hoy", async () => {
      const c = await setup("EDIT");
      await updatePerson({ ...c.base, positionId: c.p1.id, jobTaskIds: [c.altura.id, c.izaje.id] });
      const d = await c.dates();
      expect(d[c.altura.id]).toEqual(old);
      expect(recent(d[c.izaje.id])).toBe(true);
      expect((await db.person.findUniqueOrThrow({ where: { id: c.person.id } })).positionSince).toEqual(old);
    });

    it("cambiar de puesto reinicia positionSince y no toca las fechas de las tareas", async () => {
      const c = await setup("PUES");
      await updatePerson({ ...c.base, positionId: c.p2.id, jobTaskIds: [c.altura.id] });
      const after = await db.person.findUniqueOrThrow({ where: { id: c.person.id } });
      expect(recent(after.positionSince)).toBe(true);
      expect((await c.dates())[c.altura.id]).toEqual(old);
    });

    it("el responsable de proceso conserva las fechas al cambiar tareas, y una tarea quitada y vuelta a poner empieza de nuevo", async () => {
      const c = await setup("ASIG");
      await setPersonJobTasks({ tenantId: a, actorUserId: actor, personId: c.person.id, jobTaskIds: [c.altura.id, c.izaje.id] });
      let d = await c.dates();
      expect(d[c.altura.id]).toEqual(old);
      expect(recent(d[c.izaje.id])).toBe(true);
      await setPersonJobTasks({ tenantId: a, actorUserId: actor, personId: c.person.id, jobTaskIds: [c.izaje.id] });
      await setPersonJobTasks({ tenantId: a, actorUserId: actor, personId: c.person.id, jobTaskIds: [c.altura.id, c.izaje.id] });
      d = await c.dates();
      expect(recent(d[c.altura.id])).toBe(true);
    });

    it("reimportar la nómina conserva las fechas; el cambio de puesto por CSV reinicia positionSince", async () => {
      const header = "legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas";
      const row = (puesto: string, tareas: string) => `IMPF-${stamp},Imp Fechas,,Sede imp ${stamp},,${puesto},,,2024-03-01,${tareas}`;
      await applyRosterImport({ tenantId: a, actorUserId: actor, csv: [header, row("Puesto I1", "Tarea I1")].join("\n"), allowCreateCatalog: true });
      const person = await db.person.findFirstOrThrow({ where: { tenantId: a, employeeCode: `IMPF-${stamp}` } });
      expect(person.positionSince).toBeNull();
      await db.personJobTask.updateMany({ where: { personId: person.id }, data: { assignedAt: old } });
      await db.person.update({ where: { id: person.id }, data: { positionSince: old } });

      await applyRosterImport({ tenantId: a, actorUserId: actor, csv: [header, row("Puesto I1", "Tarea I1|Tarea I2")].join("\n"), allowCreateCatalog: true });
      let tasks = await db.personJobTask.findMany({ where: { personId: person.id }, include: { jobTask: true } });
      expect(tasks.find((t) => t.jobTask.name === "Tarea I1")?.assignedAt).toEqual(old);
      expect(recent(tasks.find((t) => t.jobTask.name === "Tarea I2")?.assignedAt)).toBe(true);
      expect((await db.person.findUniqueOrThrow({ where: { id: person.id } })).positionSince).toEqual(old);

      await applyRosterImport({ tenantId: a, actorUserId: actor, csv: [header, row("Puesto I2", "Tarea I1|Tarea I2")].join("\n"), allowCreateCatalog: true });
      tasks = await db.personJobTask.findMany({ where: { personId: person.id }, include: { jobTask: true } });
      expect(tasks.find((t) => t.jobTask.name === "Tarea I1")?.assignedAt).toEqual(old);
      expect(recent((await db.person.findUniqueOrThrow({ where: { id: person.id } })).positionSince)).toBe(true);
    }, 60_000);
  });
});
