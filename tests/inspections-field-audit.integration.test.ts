import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createJobTask, createPerson, createSite } from "@/lib/masterdata";
import { addInspectionPhoto, closeInspection, getInspectionView, saveAnswer } from "@/lib/inspections";
import { fieldAuditProgram, setMonthlyTarget, startFieldAudit } from "@/lib/inspection-field-audits";
import { InspectionError } from "@/lib/inspection-support";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { addMonths, todayIso } from "@/domain/inspections/dates";
import { monthOf } from "@/domain/inspections/field-audit";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("auditoría de seguridad en campo (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let inspector = "";
  let other = "";
  let siteA = "";
  let siteA2 = "";
  let siteB = "";
  let taskA = "";
  let taskB = "";
  let supervisorA = "";
  let supervisorB = "";
  const thisMonth = monthOf(todayIso());

  const start = (over: Partial<Parameters<typeof startFieldAudit>[0]> = {}) =>
    startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: siteA, ...over });

  /** Responde todo «conforme» salvo lo indicado; lo crítico o mayor no conforme lleva comentario y foto. */
  async function fill(inspectionId: string, nonconform: string[] = [], actor = inspector) {
    const view = (await getInspectionView(a, inspectionId))!;
    for (const row of view.items.filter((i) => !i.answer.autoDerived)) {
      const base = { tenantId: a, actorUserId: actor, canEditOthers: false, inspectionId, itemId: row.item.id };
      if (row.item.kind === "text") {
        await saveAnswer({ ...base, patch: { textValue: "Todo en orden" } });
        continue;
      }
      const bad = nonconform.includes(row.item.code);
      await saveAnswer({ ...base, patch: { value: bad ? "nonconform" : "conform", ...(bad ? { comment: "Se ve mal" } : {}) } });
      if (bad && row.item.photoOnNc) {
        await addInspectionPhoto({ ...base, fileName: "f.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage });
      }
    }
  }
  const close = (inspectionId: string, actor = inspector) => closeInspection({ tenantId: a, actorUserId: actor, canEditOthers: false, inspectionId });
  const itemCodes = async (inspectionId: string) =>
    (await db.inspectionAnswer.findMany({ where: { inspectionId }, include: { item: true } })).map((r) => r.item.code);

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Campo ${label}`, slug: `campo-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    inspector = (await db.user.create({ data: { name: "Aldo Auditor", email: `campo-${stamp}@test.dev`, emailVerified: true } })).id;
    other = (await db.user.create({ data: { name: "Otro Auditor", email: `campo-o-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra Norte" })).id;
    siteA2 = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra Sur" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: inspector, name: "Obra B" })).id;
    taskA = (await createJobTask({ tenantId: a, actorUserId: inspector, name: "Soldadura" })).id;
    taskB = (await createJobTask({ tenantId: b, actorUserId: inspector, name: "Soldadura" })).id;
    const posA = await createJobPosition({ tenantId: a, actorUserId: inspector, name: "Supervisor" });
    const posB = await createJobPosition({ tenantId: b, actorUserId: inspector, name: "Supervisor" });
    supervisorA = (await createPerson({ tenantId: a, actorUserId: inspector, employeeCode: "S1", name: "Silvia Supervisora", siteId: siteA, positionId: posA.id })).id;
    supervisorB = (await createPerson({ tenantId: b, actorUserId: inspector, employeeCode: "S1", name: "Sergio B", siteId: siteB, positionId: posB.id })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [inspector, other] } } });
    await db.$disconnect();
  });

  describe("inicio de la auditoría", () => {
    it("guarda el contexto (tarea, contratista, supervisor y tareas especiales) y arma los ítems sin tareas especiales", async () => {
      const { id, resumed } = await start({ jobTaskId: taskA, contractorName: "  Montajes   del Sur SA ", supervisorPersonId: supervisorA });
      expect(resumed).toBe(false);
      const row = await db.inspection.findUniqueOrThrow({ where: { id }, include: { template: true } });
      expect(row).toMatchObject({ siteId: siteA, assetId: null, jobTaskId: taskA, contractorName: "Montajes del Sur SA", supervisorPersonId: supervisorA, specialTasks: [], status: "draft" });
      expect(row.template).toMatchObject({ key: "field_audit", scope: "activity" });
      const codes = await itemCodes(id);
      expect(codes).toHaveLength(12); // 10 controles + 2 observaciones
      expect(codes.filter((c) => /^(height|confined|lifting)_/.test(c))).toEqual([]);
      await db.inspection.delete({ where: { id } });
    });

    it("las tareas especiales suman sus ítems y se guardan sin repetir", async () => {
      const { id } = await start({ siteId: siteA2, specialTasks: ["lifting", "height", "height", "no-existe"] });
      expect((await db.inspection.findUniqueOrThrow({ where: { id } })).specialTasks).toEqual(["height", "lifting"]);
      const codes = await itemCodes(id);
      expect(codes).toHaveLength(16);
      expect(codes).toEqual(expect.arrayContaining(["height_harness", "height_anchor", "lifting_plan", "lifting_zone"]));
      expect(codes).not.toContain("confined_gases");
      await db.inspection.delete({ where: { id } });
    });

    it("retoma el borrador abierto del auditor en la sede, aun con dos pedidos a la vez", async () => {
      const [x, y] = await Promise.all([start({ specialTasks: ["height"] }), start({ specialTasks: ["height"] })]);
      expect(x.id).toBe(y.id);
      expect(await db.inspection.count({ where: { tenantId: a, siteId: siteA, inspectorUserId: inspector, status: "draft" } })).toBe(1);
      const again = await start();
      expect(again).toMatchObject({ id: x.id, resumed: true });
      // Otro auditor, otro borrador.
      const mine = await startFieldAudit({ tenantId: a, actorUserId: other, siteId: siteA });
      expect(mine.id).not.toBe(x.id);
      await db.inspection.deleteMany({ where: { id: { in: [x.id, mine.id] } } });
    });

    it("rechaza sede, tarea o supervisor de otra empresa o inexistentes", async () => {
      await expect(startFieldAudit({ tenantId: a, actorUserId: inspector, siteId: siteB })).rejects.toBeInstanceOf(InspectionError);
      await expect(start({ jobTaskId: taskB })).rejects.toThrow(/tarea/);
      await expect(start({ supervisorPersonId: supervisorB })).rejects.toThrow(/supervisor/);
      await expect(start({ jobTaskId: "nope" })).rejects.toThrow(/tarea/);
      await expect(start({ contractorName: "x".repeat(121) })).rejects.toThrow(/contratista/);
    });

    it("no admite una sede dada de baja", async () => {
      const gone = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra Cerrada" })).id;
      await db.site.update({ where: { id: gone }, data: { active: false } });
      await expect(start({ siteId: gone })).rejects.toThrow(/sede/);
    });
  });

  describe("cierre", () => {
    it("apta: sin acciones ni hallazgos, sin programa ni vencimientos, y suma al programa del mes", async () => {
      const { id } = await start({ siteId: siteA2, jobTaskId: taskA });
      await fill(id);
      const first = await close(id);
      expect(first.alreadyClosed).toBe(false);
      expect((await close(id)).alreadyClosed).toBe(true);
      const closed = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(closed).toMatchObject({ status: "closed", result: "fit", applicableCount: 10, conformCount: 10, actionId: null, findingId: null });
      expect(await db.inspectionPlan.count({ where: { tenantId: a, templateId: closed.templateId } })).toBe(0);
    });

    it("con una crítica en un ítem de altura: no apta, una acción y un hallazgo borrador, una sola vez", async () => {
      const { id } = await start({ specialTasks: ["height"], contractorName: "Alturas SA" });
      await fill(id, ["height_anchor"]);
      await close(id);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection.result).toBe("unfit");
      expect(inspection.actionId).toBeTruthy();
      expect(inspection.findingId).toBeTruthy();
      expect(await db.finding.findUniqueOrThrow({ where: { id: inspection.findingId! } })).toMatchObject({ tenantId: a, origin: "inspection" });
      expect(await db.action.count({ where: { tenantId: a, id: inspection.actionId! } })).toBe(1);
    });

    it("una menor deja la auditoría apta con observaciones y una acción, sin hallazgo", async () => {
      const { id } = await start({ siteId: siteA2 });
      await fill(id, ["docs_talk"]);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection).toMatchObject({ result: "fit_with_observations", findingId: null });
      expect(inspection.actionId).toBeTruthy();
    });

    it("el detalle trae la tarea y el supervisor", async () => {
      const { id } = await start({ siteId: siteA2, jobTaskId: taskA, supervisorPersonId: supervisorA });
      const view = (await getInspectionView(a, id))!;
      expect(view.inspection.jobTask?.name).toBe("Soldadura");
      expect(view.inspection.supervisor?.name).toBe("Silvia Supervisora");
      await db.inspection.delete({ where: { id } });
    });
  });

  describe("metas y cumplimiento del programa", () => {
    it("sin metas ninguna sede se mide", async () => {
      const p = await fieldAuditProgram(a, thisMonth);
      expect(p.summary).toMatchObject({ withTarget: 0, met: 0, target: 0 });
      expect(p.rows.every((r) => r.status === "no_target" && r.pct === null)).toBe(true);
    });

    it("la meta se fija, se cambia y se quita, y cada cambio deja registro", async () => {
      await setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteA, target: 3 });
      await setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteA, target: 3 });
      await setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteA, target: 2 });
      const targets = await db.inspectionTarget.findMany({ where: { tenantId: a, siteId: siteA } });
      expect(targets).toHaveLength(1);
      expect(targets[0].monthlyTarget).toBe(2);
      expect(await db.inspectionAudit.count({ where: { tenantId: a, entityType: "inspection_target", entityId: siteA } })).toBe(2);
      await setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteA2, target: 2 });
      await setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteA2, target: null });
      expect(await db.inspectionTarget.count({ where: { tenantId: a, siteId: siteA2 } })).toBe(0);
    });

    it("rechaza metas inválidas", async () => {
      for (const target of [-1, 1.5, 201]) {
        await expect(setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteA, target })).rejects.toBeInstanceOf(InspectionError);
      }
      await expect(setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteB, target: 2 })).rejects.toBeInstanceOf(InspectionError);
    });

    it("cuenta las auditorías cerradas del mes por sede contra su meta; los borradores no suman", async () => {
      // Hasta acá, en Obra Norte (meta 2) hay una cerrada con crítica; en Obra Sur (sin meta), dos cerradas.
      let p = await fieldAuditProgram(a, thisMonth);
      let norte = p.rows.find((r) => r.siteId === siteA)!;
      expect(norte).toMatchObject({ done: 1, target: 2, missing: 1, pct: 50, status: "pending" });
      expect(p.rows.find((r) => r.siteId === siteA2)).toMatchObject({ done: 2, target: null, status: "no_target" });

      const draft = await start();
      p = await fieldAuditProgram(a, thisMonth);
      expect(p.rows.find((r) => r.siteId === siteA)!.done).toBe(1);
      await fill(draft.id);
      await close(draft.id);

      p = await fieldAuditProgram(a, thisMonth);
      norte = p.rows.find((r) => r.siteId === siteA)!;
      expect(norte).toMatchObject({ done: 2, target: 2, missing: 0, pct: 100, status: "met" });
      expect(p.summary).toEqual({ withTarget: 1, met: 1, done: 2, target: 2 });
    });

    it("el mes anterior y el siguiente no cuentan las auditorías de este mes", async () => {
      for (const month of [monthOf(addMonths(todayIso(), -1)), monthOf(addMonths(todayIso(), 1))]) {
        const p = await fieldAuditProgram(a, month);
        expect(p.rows.find((r) => r.siteId === siteA)).toMatchObject({ done: 0, target: 2, status: "pending" });
      }
    });

    it("ordena primero las sedes con meta atrasada y al final las que no se miden", async () => {
      await setMonthlyTarget({ tenantId: a, actorUserId: inspector, siteId: siteA2, target: 5 });
      const p = await fieldAuditProgram(a, thisMonth);
      expect(p.rows.map((r) => [r.siteName, r.status])).toEqual([
        ["Obra Sur", "pending"],
        ["Obra Norte", "met"],
      ]);
    });

    it("la cantidad de consultas no crece con las sedes", async () => {
      const calls: string[] = [];
      const spy = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
      spy.$on("query", (e: { query: string }) => calls.push(e.query));
      await fieldAuditProgram(a, thisMonth, spy);
      const small = calls.length;
      expect(small).toBeGreaterThan(0);
      for (let i = 0; i < 5; i++) await createSite({ tenantId: a, actorUserId: inspector, name: `Obra extra ${i}` });
      calls.length = 0;
      await fieldAuditProgram(a, thisMonth, spy);
      expect(calls.length).toBe(small);
      await spy.$disconnect();
    });
  });

  describe("aislamiento", () => {
    it("otra empresa no ve las auditorías ni las metas de esta", async () => {
      const p = await fieldAuditProgram(b, thisMonth);
      expect(p.rows.map((r) => r.siteId)).toEqual([siteB]);
      expect(p.rows[0]).toMatchObject({ done: 0, target: null });
      await expect(setMonthlyTarget({ tenantId: b, actorUserId: inspector, siteId: siteA, target: 4 })).rejects.toBeInstanceOf(InspectionError);
      expect(await db.inspectionTarget.count({ where: { tenantId: b } })).toBe(0);
      const any = await db.inspection.findFirstOrThrow({ where: { tenantId: a, template: { key: "field_audit" } } });
      expect(await getInspectionView(b, any.id)).toBeNull();
    });

    it("la base rechaza tareas especiales desconocidas y metas fuera de rango", async () => {
      const row = await db.inspection.findFirstOrThrow({ where: { tenantId: a, template: { key: "field_audit" } } });
      await expect(db.inspection.update({ where: { id: row.id }, data: { specialTasks: ["volar"] } })).rejects.toThrow();
      const target = await db.inspectionTarget.findFirstOrThrow({ where: { tenantId: a } });
      await expect(db.inspectionTarget.update({ where: { id: target.id }, data: { monthlyTarget: 0 } })).rejects.toThrow();
    });
  });
});
