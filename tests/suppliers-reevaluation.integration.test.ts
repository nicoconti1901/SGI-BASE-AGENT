import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { applySupplierImport, createSupplier, deactivateSupplier, reactivateSupplier, recomputeSupplierSummary, updateSupplier, type SupplierInput } from "@/lib/suppliers";
import { getPublishedTemplate } from "@/lib/supplier-criteria";
import { saveEvaluation, voidEvaluation } from "@/lib/supplier-evaluations";
import { getEvaluationEvidence } from "@/lib/supplier-evidence";
import { addDays, buenosAiresToday, isoDay } from "@/domain/suppliers/dates";
import { criteriaForEvaluation } from "@/domain/suppliers/evaluation";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const NOW = new Date("2026-10-21T15:00:00Z");
const TODAY = buenosAiresToday(NOW);

describe.skipIf(!hasDatabase)("proveedores 19.4: evaluación inicial pendiente y reevaluación", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let owner = "";

  const make = (tenantId: string, over: Partial<SupplierInput> = {}) =>
    createSupplier({ tenantId, actorUserId: actor, legalName: "Proveedor de prueba SA", type: "product", criticality: "standard", ownerUserId: owner, ...over });

  const openDue = (tenantId: string, supplierId: string) =>
    db.dueItem.findMany({ where: { tenantId, entityType: "supplier_evaluation", entityId: supplierId, status: "open" } });

  const evaluate = async (tenantId: string, supplierId: string, over: { kind?: "initial" | "periodic" | "event"; score?: number; evaluatedAt?: Date } = {}) => {
    const kind = over.kind ?? "initial";
    const template = await getPublishedTemplate(tenantId, "product", db);
    const answers = criteriaForEvaluation(template!.criteria, kind, "full").map((c) => {
      const score = over.score ?? 5;
      return { criterionId: c.id, score, comment: score <= 2 ? "evidencia" : "" };
    });
    return saveEvaluation(
      { tenantId, actorUserId: actor, supplierId, kind, mode: "full", answers, now: NOW, evaluatedAt: over.evaluatedAt, plan: { ownerUserId: owner, dueAt: addDays(TODAY, 30) } },
      db,
    );
  };

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Reeval ${label}`, slug: `reeval-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    const user = await db.user.create({ data: { name: "Reeval Admin", email: `reeval-${stamp}@test.dev`, emailVerified: true } });
    actor = user.id;
    const user2 = await db.user.create({ data: { name: "Reeval Owner", email: `reeval-owner-${stamp}@test.dev`, emailVerified: true } });
    owner = user2.id;
    await db.membership.create({ data: { userId: actor, tenantId: a, role: "tenant_admin" } });
    await db.membership.create({ data: { userId: owner, tenantId: a, role: "process_owner" } });
    await make(b, { legalName: "Semilla B SA", ownerUserId: "" });
  });

  afterAll(async () => {
    await db.action.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.dueItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.finding.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [actor, owner] } } });
    await db.$disconnect();
  });

  describe("evaluación inicial pendiente", () => {
    it("el alta de un estándar deja un vencimiento a 30 días con su responsable y aviso a 7", async () => {
      const s = await make(a, { legalName: "Nuevo estándar SA" });
      const due = await openDue(a, s.id);
      expect(due).toHaveLength(1);
      expect(due[0]).toMatchObject({ title: "Evaluar proveedor nuevo: Nuevo estándar SA", leadDays: 7, ownerUserId: owner, status: "open" });
      expect(isoDay(due[0].dueAt)).toBe(isoDay(addDays(buenosAiresToday(s.createdAt), 30)));
      expect(due[0].remindAt.getTime()).toBe(due[0].dueAt.getTime() - 7 * 86_400_000);
    });

    it("también para un crítico; no para bajo impacto", async () => {
      const crit = await make(a, { legalName: "Nuevo crítico SA", criticality: "critical", criticalityReason: "afecta el producto" });
      const low = await make(a, { legalName: "Nuevo bajo SA", criticality: "low", criticalityReason: "compra ocasional" });
      expect(await openDue(a, crit.id)).toHaveLength(1);
      expect(await openDue(a, low.id)).toHaveLength(0);
    });

    it("recalcular no duplica ni reinicia los avisos ya enviados", async () => {
      const s = await make(a, { legalName: "Idempotente SA" });
      const [before] = await openDue(a, s.id);
      await db.dueItem.update({ where: { id: before.id }, data: { lastReminderKind: "upcoming", lastRemindedAt: NOW } });
      await recomputeSupplierSummary(a, s.id, db);
      await recomputeSupplierSummary(a, s.id, db);
      const after = await openDue(a, s.id);
      expect(after).toHaveLength(1);
      expect(after[0]).toMatchObject({ id: before.id, lastReminderKind: "upcoming" });
    });

    it("el plazo sale de los ajustes de la empresa", async () => {
      await db.supplierSettings.update({ where: { tenantId: b }, data: { initialEvalDays: 10 } });
      const s = await make(b, { legalName: "Plazo corto SA", ownerUserId: "" });
      const [due] = await db.dueItem.findMany({ where: { tenantId: b, entityId: s.id, status: "open" } });
      expect(isoDay(due.dueAt)).toBe(isoDay(addDays(buenosAiresToday(s.createdAt), 10)));
    });

    it("la primera evaluación reemplaza el pendiente por la reevaluación (siempre uno solo)", async () => {
      const s = await make(a, { legalName: "Evaluado SA" });
      await evaluate(a, s.id);
      const due = await openDue(a, s.id);
      expect(due).toHaveLength(1);
      expect(due[0].title).toBe("Reevaluar proveedor: Evaluado SA");
      expect(due[0].leadDays).toBe(30);
      expect(isoDay(due[0].dueAt)).toBe("2028-10-21"); // estándar, 24 meses
      expect(await db.dueItem.count({ where: { tenantId: a, entityType: "supplier_evaluation", entityId: s.id } })).toBe(1);
    });

    it("no aprobado: ninguna reevaluación (se suspende hasta que se pida una nueva)", async () => {
      const s = await make(a, { legalName: "Rechazado SA" });
      await evaluate(a, s.id, { score: 1 });
      expect(await openDue(a, s.id)).toHaveLength(0);
    });

    it("anular la única evaluación devuelve la evaluación inicial pendiente", async () => {
      const s = await make(a, { legalName: "Anulado SA" });
      const { evaluation } = await evaluate(a, s.id);
      expect((await openDue(a, s.id))[0].title).toMatch(/^Reevaluar/);
      await voidEvaluation({ tenantId: a, actorUserId: actor, supplierId: s.id, evaluationId: evaluation.id, reason: "equivocada", now: NOW }, db);
      const due = await openDue(a, s.id);
      expect(due).toHaveLength(1);
      expect(due[0].title).toMatch(/^Evaluar proveedor nuevo/);
    });

    it("cambiar a bajo impacto o dar de baja lo cierra; reactivar lo vuelve a abrir", async () => {
      const s = await make(a, { legalName: "Cambia SA" });
      expect(await openDue(a, s.id)).toHaveLength(1);
      await updateSupplier({ tenantId: a, actorUserId: actor, id: s.id, legalName: "Cambia SA", type: "product", criticality: "low", criticalityReason: "ya no es relevante" });
      expect(await openDue(a, s.id)).toHaveLength(0);
      await updateSupplier({ tenantId: a, actorUserId: actor, id: s.id, legalName: "Cambia SA", type: "product", criticality: "standard", ownerUserId: owner });
      expect(await openDue(a, s.id)).toHaveLength(1);
      await deactivateSupplier({ tenantId: a, actorUserId: actor, id: s.id, reason: "cerró" }, db);
      expect(await openDue(a, s.id)).toHaveLength(0);
      await reactivateSupplier({ tenantId: a, actorUserId: actor, id: s.id }, db);
      expect(await openDue(a, s.id)).toHaveLength(1);
    });

    it("la importación deja el pendiente de críticos y estándar en lote, y ninguno para bajo impacto", async () => {
      const t = (await createTenantWithTemplate({ name: "Reeval import", slug: `reeval-imp-${stamp}`, size: "small", activity: "servicios" })).id;
      tenantIds.push(t);
      await db.membership.create({ data: { userId: actor, tenantId: t, role: "tenant_admin" } });
      const HEADER = "razon_social,cuit,tipo,rubro,criticidad,motivo_criticidad,responsable,contacto,email,telefono,notas";
      const email = (await db.user.findUniqueOrThrow({ where: { id: actor } })).email;
      const csv = [
        HEADER,
        `Imp crítico SA,,producto,,crítico,Afecta el producto,${email},,,,`,
        `Imp estándar SA,,producto,,estándar,,,,,,`,
        `Imp sin criticidad SA,,producto,,,,,,,,`,
        `Imp bajo SA,,producto,,bajo impacto,Compra ocasional,,,,,`,
      ].join("\n");
      expect(await applySupplierImport({ tenantId: t, actorUserId: actor, csv })).toMatchObject({ created: 4 });
      const suppliers = await db.supplier.findMany({ where: { tenantId: t } });
      const due = await db.dueItem.findMany({ where: { tenantId: t, entityType: "supplier_evaluation", status: "open" } });
      expect(due).toHaveLength(3);
      const low = suppliers.find((s) => s.legalName === "Imp bajo SA")!;
      expect(due.map((x) => x.entityId)).not.toContain(low.id);
      expect(due.find((x) => x.entityId === suppliers.find((s) => s.legalName === "Imp crítico SA")!.id)).toMatchObject({ ownerUserId: actor, leadDays: 7 });
      // Un recálculo posterior no duplica lo que dejó la importación.
      for (const s of suppliers) await recomputeSupplierSummary(t, s.id, db);
      expect(await db.dueItem.count({ where: { tenantId: t, entityType: "supplier_evaluation", status: "open" } })).toBe(3);
    });
  });

  describe("evidencia precargada de la reevaluación", () => {
    const finding = (tenantId: string, over: Record<string, unknown> = {}) =>
      db.finding.create({
        data: { tenantId, type: "nonconformity", status: "published", title: "Entrega fuera de plazo", description: "x", detectedAt: addDays(TODAY, -1), origin: "supplier", ...over },
      });

    it("trae los hallazgos del proveedor, las acciones abiertas y cuenta los abiertos desde la última evaluación", async () => {
      const s = await make(a, { legalName: "Evidencia SA" });
      const { evaluation } = await evaluate(a, s.id, { evaluatedAt: addDays(TODAY, -10) });
      const open = await finding(a);
      const old = await finding(a, { title: "Hallazgo viejo cerrado", status: "closed", detectedAt: addDays(TODAY, -60) });
      const recentClosed = await finding(a, { title: "Reclamo resuelto", status: "closed" });
      await db.supplierFinding.createMany({
        data: [
          { tenantId: a, supplierId: s.id, findingId: open.id, kind: "delivery" },
          { tenantId: a, supplierId: s.id, findingId: old.id, kind: "quality" },
          { tenantId: a, supplierId: s.id, findingId: recentClosed.id, kind: "claim" },
        ],
      });
      const action = await db.action.create({
        data: { tenantId: a, title: "Plan de entregas", ownerUserId: owner, status: "open", links: { create: [{ targetType: "finding", targetId: open.id }] } },
      });

      const ev = await getEvaluationEvidence(a, s.id, db);
      expect(ev.since).not.toBeNull();
      expect(ev.findings.map((f) => f.title).sort()).toEqual(["Entrega fuera de plazo", "Reclamo resuelto"]); // el viejo y cerrado queda afuera
      expect(ev.findings.find((f) => f.title === "Entrega fuera de plazo")).toMatchObject({ open: true, kind: "delivery" });
      expect(ev.openFindingsSinceLast).toBe(1);
      expect(ev.openActions.map((x) => x.id)).toEqual([action.id]);
      expect(ev.planClosed).toBe(false);
      void evaluation;
    });

    it("un plan de mejora cerrado se detecta recién cuando todas sus acciones se completaron", async () => {
      const s = await make(a, { legalName: "Plan SA" });
      const { evaluation, actionId } = await evaluate(a, s.id, { score: 3 });
      expect(evaluation.result).toBe("conditional");
      expect((await getEvaluationEvidence(a, s.id, db)).planClosed).toBe(false);
      expect((await getEvaluationEvidence(a, s.id, db)).openActions.map((x) => x.id)).toEqual([actionId]);
      await db.action.update({ where: { id: actionId! }, data: { status: "completed", completedAt: NOW } });
      const ev = await getEvaluationEvidence(a, s.id, db);
      expect(ev.planClosed).toBe(true);
      expect(ev.openActions).toHaveLength(0);
    });

    it("sin evaluaciones previas muestra todo el historial; sin nada, listas vacías", async () => {
      const s = await make(a, { legalName: "Vacío SA" });
      expect(await getEvaluationEvidence(a, s.id, db)).toEqual({ since: null, findings: [], openActions: [], openFindingsSinceLast: 0, planClosed: false });
    });

    it("otra empresa no ve la evidencia de este proveedor", async () => {
      const s = await make(a, { legalName: "Aislado SA" });
      const f = await finding(a, { title: "Solo de A" });
      await db.supplierFinding.create({ data: { tenantId: a, supplierId: s.id, findingId: f.id, kind: "quality" } });
      expect((await getEvaluationEvidence(a, s.id, db)).findings).toHaveLength(1);
      expect(await getEvaluationEvidence(b, s.id, db)).toMatchObject({ findings: [], openActions: [], openFindingsSinceLast: 0 });
    });
  });
});
