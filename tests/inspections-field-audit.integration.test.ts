import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createJobTask, createPerson, createSite } from "@/lib/masterdata";
import { addInspectionPhoto, closeInspection, getInspectionView, saveAnswer } from "@/lib/inspections";
import { getFieldAuditProgram, setMonthlyTarget, startFieldAudit } from "@/lib/inspection-field-audit";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { todayIso } from "@/domain/inspections/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("auditoría de seguridad en campo (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let inspector = "";
  let siteA = "";
  let siteB = "";
  let taskA = "";
  let taskB = "";
  let supervisorA = "";

  /** Responde todo «conforme» salvo lo indicado; lo crítico o mayor no conforme lleva comentario y foto. */
  async function fill(inspectionId: string, nonconform: string[] = []) {
    const view = (await getInspectionView(a, inspectionId))!;
    for (const row of view.items.filter((i) => i.item.kind === "check")) {
      const bad = nonconform.includes(row.item.code);
      await saveAnswer({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId, itemId: row.item.id, patch: { value: bad ? "nonconform" : "conform", ...(bad ? { comment: "Se ve mal" } : {}) } });
      if (bad && row.item.photoOnNc) {
        await addInspectionPhoto({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId, itemId: row.item.id, fileName: "f.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage });
      }
    }
  }
  const close = (inspectionId: string) => closeInspection({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId });
  const newSite = async (name: string) => (await createSite({ tenantId: a, actorUserId: inspector, name })).id;

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Campo ${label}`, slug: `campo-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    inspector = (await db.user.create({ data: { name: "Inés Auditora", email: `campo-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = await newSite("Frente Norte");
    siteB = (await createSite({ tenantId: b, actorUserId: inspector, name: "Frente B" })).id;
    taskA = (await createJobTask({ tenantId: a, actorUserId: inspector, name: "Montaje de andamios" })).id;
    taskB = (await createJobTask({ tenantId: b, actorUserId: inspector, name: "Tarea de B" })).id;
    const position = (await createJobPosition({ tenantId: a, actorUserId: inspector, name: "Supervisor de obra" })).id;
    supervisorA = (await createPerson({ tenantId: a, actorUserId: inspector, employeeCode: "S-1", name: "Sara Supervisora", siteId: siteA, positionId: position })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: inspector } });
    await db.$disconnect();
  });

  it("empieza con el contexto guardado y solo los ítems que aplican a las tareas especiales", async () => {
    const site = await newSite("Sin especiales");
    const plain = await startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: site, jobTaskId: taskA, contractorName: " Montajes SA ", supervisorPersonId: supervisorA });
    const inspection = await db.inspection.findUniqueOrThrow({ where: { id: plain.id }, include: { answers: true, template: true } });
    expect(inspection).toMatchObject({ assetId: null, siteId: site, jobTaskId: taskA, contractorName: "Montajes SA", supervisorPersonId: supervisorA, status: "draft", specialTasks: [] });
    expect(inspection.template.key).toBe("field_audit");
    expect(inspection.answers).toHaveLength(22); // 16 puntuables + 6 de texto

    const site2 = await newSite("Con especiales");
    const full = await startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: site2, specialTasks: ["height", "confined_space", "lifting", "height"] });
    const withAll = await db.inspection.findUniqueOrThrow({ where: { id: full.id }, include: { answers: true } });
    expect(withAll.specialTasks).toEqual(["height", "confined_space", "lifting"]);
    expect(withAll.answers).toHaveLength(28);
  });

  it("el borrador se retoma: dos pedidos a la vez abren uno solo", async () => {
    const site = await newSite("Doble toque");
    const [x, y] = await Promise.all([
      startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: site }),
      startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: site }),
    ]);
    expect(x.id).toBe(y.id);
    expect(await db.inspection.count({ where: { tenantId: a, siteId: site, status: "draft" } })).toBe(1);
  });

  it("rechaza sedes, tareas o supervisores de otra empresa y tareas especiales desconocidas", async () => {
    await expect(startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: siteB })).rejects.toThrow(/sede/);
    await expect(startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: siteA, jobTaskId: taskB })).rejects.toThrow(/tarea/);
    await expect(startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: siteA, supervisorPersonId: "no-existe" })).rejects.toThrow(/supervisor/);
    await expect(startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: siteA, specialTasks: ["diving"] })).rejects.toThrow(/especial/);
    expect(await db.inspection.count({ where: { tenantId: a, siteId: siteB } })).toBe(0);
  });

  it("cerrar sin novedades: apta, sin acción ni hallazgo, sin programa ni vencimiento", async () => {
    const site = await newSite("Apta");
    const { id } = await startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: site });
    await fill(id);
    const first = await close(id);
    const again = await close(id);
    expect(first.alreadyClosed).toBe(false);
    expect(again.alreadyClosed).toBe(true);
    const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
    expect(inspection).toMatchObject({ status: "closed", result: "fit", actionId: null, findingId: null, applicableCount: 16, nonconformCount: 0 });
    expect(await db.inspectionPlan.count({ where: { tenantId: a, siteId: site } })).toBe(0);
    expect(await db.dueItem.count({ where: { tenantId: a, siteId: site } })).toBe(0);
  });

  it("una crítica no conforme: no apta, una acción y un hallazgo borrador aunque se cierre dos veces a la vez", async () => {
    const site = await newSite("Crítica");
    const { id } = await startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: site, specialTasks: ["height"] });
    await fill(id, ["height_harness", "docs_talk"]);
    await Promise.all([close(id), close(id)]);
    const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { action: true, finding: true } });
    expect(inspection).toMatchObject({ result: "unfit", nonconformCount: 2, applicableCount: 18 });
    expect(inspection.action).toMatchObject({ ownerUserId: inspector });
    expect(inspection.finding).toMatchObject({ origin: "inspection" });
    expect(inspection.finding!.description).toContain("Arnés y cabo");
    expect(await db.action.count({ where: { tenantId: a, id: inspection.actionId! } })).toBe(1);
  });

  it("el programa cuenta las auditorías cerradas del mes contra la meta de cada sede", async () => {
    const site = await newSite("Programa");
    const other = await newSite("Programa sin meta");
    expect(await setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: site, target: "3" })).toMatchObject({ monthlyTarget: 3 });
    for (let i = 0; i < 2; i++) {
      const { id } = await startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: site });
      await fill(id);
      await close(id);
    }
    await startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: other }); // un borrador no cuenta
    const program = await getFieldAuditProgram(a, { q: "Programa" });
    const row = (name: string) => program.sites.find((s) => s.name === name)!;
    expect(row("Programa")).toMatchObject({ target: 3, done: 2, remaining: 1, pct: 67, status: "pending" });
    expect(row("Programa sin meta")).toMatchObject({ target: 0, done: 0, status: "no_target" });

    await setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: site, target: 2 });
    expect((await getFieldAuditProgram(a, { q: "Programa" })).sites.find((s) => s.name === "Programa")).toMatchObject({ target: 2, pct: 100, status: "met" });
    expect(await db.inspectionTarget.count({ where: { tenantId: a, siteId: site } })).toBe(1); // se actualiza, no se duplica
    expect(program.month).toBe(todayIso().slice(0, 7));

    await setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: site, target: null });
    expect(await db.inspectionTarget.count({ where: { tenantId: a, siteId: site } })).toBe(0);
  });

  it("valida la meta y no la deja en una sede ajena", async () => {
    await expect(setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteA, target: 0 })).rejects.toThrow(/entero/);
    await expect(setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteA, target: 101 })).rejects.toThrow(/entero/);
    await expect(setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteB, target: 4 })).rejects.toThrow(/sede/);
    expect(await db.inspectionTarget.count({ where: { siteId: siteB } })).toBe(0);
  });

  it("aislamiento: el programa de una empresa no muestra sedes, metas ni auditorías de la otra", async () => {
    await setMonthlyTarget({ tenantId: b, actorUserId: inspector, siteId: siteB, target: 5 });
    const programA = await getFieldAuditProgram(a);
    expect(programA.sites.map((s) => s.id)).not.toContain(siteB);
    const programB = await getFieldAuditProgram(b);
    expect(programB.sites).toEqual([expect.objectContaining({ id: siteB, target: 5, done: 0 })]);
  });

  it("cantidad de consultas del programa constante: tres, con 2 o con 20 sedes", async () => {
    const t = await createTenantWithTemplate({ name: "Campo perf", slug: `campo-perf-${stamp}`, size: "small", activity: "servicios" });
    tenantIds.push(t.id);
    const counted = async () => {
      let queries = 0;
      const spy = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
      spy.$on("query" as never, () => {
        queries++;
      });
      await getFieldAuditProgram(t.id, {}, spy);
      await spy.$disconnect();
      return queries;
    };
    await db.site.createMany({ data: Array.from({ length: 2 }, (_, i) => ({ tenantId: t.id, name: `S${i}` })) });
    await startFieldAudit({ tenantId: t.id, actorUserId: inspector, siteId: (await db.site.findFirstOrThrow({ where: { tenantId: t.id } })).id });
    const few = await counted();
    await db.site.createMany({ data: Array.from({ length: 18 }, (_, i) => ({ tenantId: t.id, name: `T${i}` })) });
    expect(await counted()).toBe(few);
  });
});
