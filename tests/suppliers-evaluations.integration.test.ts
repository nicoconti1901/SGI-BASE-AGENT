import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { MemoryObjectStorage } from "@/lib/storage/types";
import {
  createSupplier,
  deactivateSupplier,
  getApprovedList,
  getSupplier,
  recomputeSupplierSummary,
  type SupplierInput,
} from "@/lib/suppliers";
import {
  discardTemplateDraft,
  getPublishedTemplate,
  listTemplateVersions,
  publishTemplateDraft,
  saveDocumentType,
  saveTemplateDraft,
  setDocumentTypeActive,
  startTemplateDraft,
} from "@/lib/supplier-criteria";
import {
  getSupplierEvaluation,
  listSupplierEvaluations,
  saveEvaluation,
  voidEvaluation,
  type EvaluationAnswer,
  type SaveEvaluationInput,
} from "@/lib/supplier-evaluations";
import {
  listSupplierDocuments,
  readSupplierDocumentFile,
  uploadSupplierDocument,
  voidSupplierDocument,
} from "@/lib/supplier-documents";
import { addDays, buenosAiresToday } from "@/domain/suppliers/dates";
import { criteriaForEvaluation, type EvaluationKindValue } from "@/domain/suppliers/evaluation";
import type { EvaluationModeValue, SupplierTypeValue } from "@/domain/suppliers/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const NOW = new Date("2026-10-21T15:00:00Z");
const TODAY = buenosAiresToday(NOW);
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const PDF = Buffer.from("%PDF-1.4 prueba");

describe.skipIf(!hasDatabase)("proveedores 19.3: criterios, evaluación y documentos", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let owner = "";
  let siteA = "";

  const make = (tenantId: string, over: Partial<SupplierInput> = {}) =>
    createSupplier({ tenantId, actorUserId: actor, legalName: "Proveedor de prueba SA", type: "product", criticality: "standard", ...over });

  /** Responde todos los criterios que corresponden al tipo/modo con la nota que devuelva `pick`. */
  async function answers(
    tenantId: string,
    type: SupplierTypeValue,
    kind: EvaluationKindValue,
    mode: EvaluationModeValue,
    pick: number | ((name: string) => number | null),
  ): Promise<EvaluationAnswer[]> {
    const template = await getPublishedTemplate(tenantId, type, db);
    return criteriaForEvaluation(template!.criteria, kind, mode).map((c) => {
      const score = typeof pick === "number" ? pick : pick(c.name);
      return { criterionId: c.id, score, comment: score !== null && score <= 2 ? "evidencia" : "" };
    });
  }

  const evaluate = async (supplierId: string, tenantId: string, type: SupplierTypeValue, over: Partial<SaveEvaluationInput> & { score?: number } = {}) => {
    const kind = over.kind ?? "initial";
    const mode = over.mode ?? "full";
    const { score, ...rest } = over;
    return saveEvaluation(
      {
        tenantId,
        actorUserId: actor,
        supplierId,
        kind,
        mode,
        now: NOW,
        answers: await answers(tenantId, type, kind, mode, score ?? 5),
        ...rest,
      },
      db,
    );
  };

  const openDue = (tenantId: string, entityType: string, entityId: string) =>
    db.dueItem.findMany({ where: { tenantId, entityType, entityId, status: "open" } });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Eval ${label}`, slug: `eval-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    const user = await db.user.create({ data: { name: "Eval Admin", email: `eval-${stamp}@test.dev`, emailVerified: true } });
    actor = user.id;
    const user2 = await db.user.create({ data: { name: "Eval Owner", email: `eval-owner-${stamp}@test.dev`, emailVerified: true } });
    owner = user2.id;
    await db.membership.create({ data: { userId: actor, tenantId: a, role: "tenant_admin" } });
    await db.membership.create({ data: { userId: owner, tenantId: a, role: "process_owner" } });
    siteA = (await createSite({ tenantId: a, actorUserId: actor, name: "Base Neuquén" })).id;
    await createSite({ tenantId: b, actorUserId: actor, name: "Base Neuquén" });
    await make(b, { legalName: "Semilla B SA" }); // siembra las plantillas y los tipos de documento de b
  });

  afterAll(async () => {
    await db.action.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.dueItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [actor, owner] } } });
    await db.$disconnect();
  });

  describe("saveEvaluation", () => {
    it("calcula total y resultado en el servidor e ignora lo que venga falsificado del cliente", async () => {
      const s = await make(a, { legalName: "Calculo SA" });
      const forged = { totalScore: 100, result: "approved", resultReason: "score" } as unknown as Partial<SaveEvaluationInput>;
      const { evaluation } = await evaluate(s.id, a, "product", { score: 3, plan: { ownerUserId: owner, dueAt: addDays(TODAY, 30) }, ...forged });
      // Todo en 3: 60,0 → con condiciones (no 100 aprobado).
      expect(Number(evaluation.totalScore)).toBe(60);
      expect(evaluation.result).toBe("conditional");
      expect(evaluation.resultReason).toBe("score");
      expect(Number(evaluation.coverage)).toBe(100);
    });

    it("guarda una copia fija de criterios, pesos y umbrales, y el proveedor queda aprobado", async () => {
      const s = await make(a, { legalName: "Copia SA" });
      const { evaluation } = await evaluate(s.id, a, "product");
      const full = await getSupplierEvaluation(a, s.id, evaluation.id, db);
      expect(full).toMatchObject({ templateVersion: 1, approvedMin: 80, conditionalMin: 60, criticalityAtEvaluation: "standard", result: "approved", totalScore: 100, mode: "full", kind: "initial" });
      expect(full!.items.length).toBeGreaterThan(0);
      expect(full!.items.reduce((n, i) => n + i.weight, 0)).toBeLessThanOrEqual(100);
      const sup = await getSupplier(a, s.id, db);
      expect(sup).toMatchObject({ status: "approved", lastScore: 100, lastEvaluationId: evaluation.id });
      expect(sup!.nextEvaluationDueAt).toEqual(d("2028-10-21")); // estándar, 24 meses
    });

    it("un 1 en un criterio excluyente es no aprobado aunque el puntaje alcance, y no deja reevaluación", async () => {
      const s = await make(a, { legalName: "Excluyente SA" });
      const { evaluation } = await evaluate(s.id, a, "product", { score: 5, answers: await answers(a, "product", "initial", "full", (n) => (n.startsWith("Calidad") ? 1 : 5)) });
      expect(evaluation.result).toBe("not_approved");
      expect(evaluation.resultReason).toBe("excluding_criterion");
      expect(Number(evaluation.totalScore)).toBe(60); // por puntaje solo daría «con condiciones»; el excluyente lo baja
      const sup = await getSupplier(a, s.id, db);
      expect(sup).toMatchObject({ status: "not_approved", nextEvaluationDueAt: null });
      expect(await openDue(a, "supplier_evaluation", s.id)).toHaveLength(0);
      expect((await getApprovedList(a, NOW, db)).entries.map((e) => e.id)).not.toContain(s.id);
    });

    it("una nota de 1 o 2 exige comentario", async () => {
      const s = await make(a, { legalName: "Comentario SA" });
      const bad = (await answers(a, "product", "initial", "full", 5)).map((x, i) => (i === 0 ? { ...x, score: 2, comment: "" } : x));
      await expect(evaluate(s.id, a, "product", { answers: bad, plan: { ownerUserId: owner, dueAt: addDays(TODAY, 10) } })).rejects.toThrow(/necesita un comentario/);
      expect(await db.supplierEvaluation.count({ where: { supplierId: s.id } })).toBe(0);
    });

    it("rechaza notas fuera de rango, criterios de otra empresa o repetidos", async () => {
      const s = await make(a, { legalName: "Invalida SA" });
      const ok = await answers(a, "product", "initial", "full", 4);
      await expect(evaluate(s.id, a, "product", { answers: ok.map((x, i) => (i === 0 ? { ...x, score: 6 } : x)) })).rejects.toThrow(/entero de 1 a 5/);
      await expect(evaluate(s.id, a, "product", { answers: [...ok, ok[0]] })).rejects.toThrow(/dos veces/);
      const otherTemplate = await getPublishedTemplate(b, "product", db);
      await expect(evaluate(s.id, a, "product", { answers: [...ok, { criterionId: otherTemplate!.criteria[0].id, score: 4 }] })).rejects.toThrow(/no corresponde/);
      expect(await db.supplierEvaluation.count({ where: { supplierId: s.id } })).toBe(0);
    });

    it("la inicial solo una vez; la periódica requiere una inicial", async () => {
      const s = await make(a, { legalName: "Tipos SA" });
      await expect(evaluate(s.id, a, "product", { kind: "periodic" })).rejects.toThrow(/inicial/);
      await evaluate(s.id, a, "product");
      await expect(evaluate(s.id, a, "product")).rejects.toThrow(/Ya tiene una evaluación inicial/);
      await evaluate(s.id, a, "product", { kind: "periodic", score: 4 });
      expect(await db.supplierEvaluation.count({ where: { supplierId: s.id } })).toBe(2);
    });

    it("no evalúa a un proveedor de baja ni a uno de otra empresa", async () => {
      const s = await make(a, { legalName: "Baja SA" });
      await deactivateSupplier({ tenantId: a, actorUserId: actor, id: s.id, reason: "ya no opera" }, db);
      await expect(evaluate(s.id, a, "product")).rejects.toThrow(/de baja/);
      const other = await make(a, { legalName: "Ajeno SA" });
      await expect(evaluate(other.id, b, "product")).rejects.toThrow(/no encontrado/i);
    });

    it("simplificada: no para críticos; para no críticos usa básicos y excluyentes y queda marcada", async () => {
      const crit = await make(a, { legalName: "Critico SA", criticality: "critical", criticalityReason: "afecta el producto" });
      await expect(evaluate(crit.id, a, "product", { mode: "simplified" })).rejects.toThrow(/crítico/);
      const s = await make(a, { legalName: "Simple SA" });
      const { evaluation } = await evaluate(s.id, a, "product", { mode: "simplified", score: 4 });
      expect(evaluation.mode).toBe("simplified");
      expect(Number(evaluation.totalScore)).toBe(80);
      const items = await db.supplierEvaluationItem.findMany({ where: { evaluationId: evaluation.id } });
      expect(items.length).toBeLessThan((await getPublishedTemplate(a, "product", db))!.criteria.length);
    });

    it("declarada: solo bajo impacto, con motivo, sin puntaje, y queda aprobada sin reevaluación", async () => {
      const std = await make(a, { legalName: "NoBajo SA" });
      await expect(evaluate(std.id, a, "product", { mode: "declared", comment: "compra única" })).rejects.toThrow(/bajo impacto/);
      const low = await make(a, { legalName: "Bajo SA", criticality: "low", criticalityReason: "compra de librería" });
      await expect(evaluate(low.id, a, "product", { mode: "declared", comment: "" })).rejects.toThrow(/motivo/);
      const { evaluation } = await evaluate(low.id, a, "product", { mode: "declared", comment: "Compra de librería, sin impacto en el producto" });
      expect(evaluation).toMatchObject({ mode: "declared", totalScore: null, result: "approved", resultReason: "declared", templateId: null });
      expect(await db.supplierEvaluationItem.count({ where: { evaluationId: evaluation.id } })).toBe(0);
      expect(await getSupplier(a, low.id, db)).toMatchObject({ status: "approved", nextEvaluationDueAt: null });
      expect((await getApprovedList(a, NOW, db)).entries.map((e) => e.id)).toContain(low.id);
    });
  });

  describe("resultado condicional", () => {
    it("sin plan de mejora no se guarda nada", async () => {
      const s = await make(a, { legalName: "Condicional SA" });
      await expect(evaluate(s.id, a, "product", { score: 3 })).rejects.toThrow(/plan de mejora/);
      expect(await db.supplierEvaluation.count({ where: { supplierId: s.id } })).toBe(0);
      expect(await db.action.count({ where: { tenantId: a, title: { contains: "Condicional SA" } } })).toBe(0);
    });

    it("rechaza un responsable de otra empresa y una fecha pasada", async () => {
      const s = await make(a, { legalName: "Plan Malo SA" });
      const outsider = await db.user.create({ data: { name: "Externo", email: `out-${stamp}@test.dev`, emailVerified: true } });
      try {
        await expect(evaluate(s.id, a, "product", { score: 3, plan: { ownerUserId: outsider.id, dueAt: addDays(TODAY, 20) } })).rejects.toThrow(/integrante/);
        await expect(evaluate(s.id, a, "product", { score: 3, plan: { ownerUserId: owner, dueAt: addDays(TODAY, -1) } })).rejects.toThrow(/anterior a hoy/);
      } finally {
        await db.user.delete({ where: { id: outsider.id } });
      }
    });

    it("con plan crea la evaluación, la Acción vinculada y el DueItem de reevaluación a los 6 meses", async () => {
      const s = await make(a, { legalName: "Con Plan SA", ownerUserId: owner, siteIds: [siteA] });
      const { evaluation, actionId } = await evaluate(s.id, a, "product", { score: 3, plan: { ownerUserId: owner, dueAt: addDays(TODAY, 45), title: "Regularizar certificados" } });
      expect(actionId).toBeTruthy();
      const action = await db.action.findUniqueOrThrow({ where: { id: actionId! }, include: { links: true } });
      expect(action).toMatchObject({ tenantId: a, title: "Regularizar certificados", ownerUserId: owner });
      expect(action.links).toEqual([expect.objectContaining({ targetType: "supplier_evaluation", targetId: evaluation.id })]);
      const sup = await getSupplier(a, s.id, db);
      expect(sup).toMatchObject({ status: "conditional" });
      expect(sup!.nextEvaluationDueAt).toEqual(d("2027-04-21"));
      const due = await openDue(a, "supplier_evaluation", s.id);
      expect(due).toHaveLength(1);
      expect(due[0]).toMatchObject({ dueAt: d("2027-04-21"), ownerUserId: owner, siteId: siteA, leadDays: 30 });
      const detail = await getSupplierEvaluation(a, s.id, evaluation.id, db);
      expect(detail!.actions.map((x) => x.id)).toEqual([actionId]);
    });
  });

  describe("anular una evaluación", () => {
    it("vuelve el estado y el DueItem a los de la anterior; el motivo es obligatorio; no se anula dos veces", async () => {
      const s = await make(a, { legalName: "Anula SA", criticality: "critical", criticalityReason: "afecta el producto" });
      await evaluate(s.id, a, "product"); // aprobado, 12 meses
      const second = await evaluate(s.id, a, "product", { kind: "periodic", answers: await answers(a, "product", "periodic", "full", (n) => (n.startsWith("Calidad") ? 1 : 5)) });
      expect((await getSupplier(a, s.id, db))!.status).toBe("not_approved");
      expect(await openDue(a, "supplier_evaluation", s.id)).toHaveLength(0);

      await expect(voidEvaluation({ tenantId: a, actorUserId: actor, supplierId: s.id, evaluationId: second.evaluation.id, reason: " ", now: NOW }, db)).rejects.toThrow(/motivo/);
      await voidEvaluation({ tenantId: a, actorUserId: actor, supplierId: s.id, evaluationId: second.evaluation.id, reason: "Se cargó en el proveedor equivocado", now: NOW }, db);
      const sup = await getSupplier(a, s.id, db);
      expect(sup).toMatchObject({ status: "approved" });
      expect(sup!.nextEvaluationDueAt).toEqual(d("2027-10-21"));
      expect(await openDue(a, "supplier_evaluation", s.id)).toHaveLength(1);
      await expect(voidEvaluation({ tenantId: a, actorUserId: actor, supplierId: s.id, evaluationId: second.evaluation.id, reason: "otra vez", now: NOW }, db)).rejects.toThrow(/ya está anulada/);

      const history = await listSupplierEvaluations(a, s.id, db);
      expect(history).toHaveLength(2); // la anulada se conserva
      expect(history.filter((h) => h.voidedAt)).toHaveLength(1);
    });

    it("anular la única evaluación deja al proveedor sin evaluar y sin reevaluación", async () => {
      const s = await make(a, { legalName: "Unica SA" });
      const { evaluation } = await evaluate(s.id, a, "product");
      await voidEvaluation({ tenantId: a, actorUserId: actor, supplierId: s.id, evaluationId: evaluation.id, reason: "error de carga", now: NOW }, db);
      expect(await getSupplier(a, s.id, db)).toMatchObject({ status: "potential", lastEvaluationId: null, nextEvaluationDueAt: null });
      expect(await openDue(a, "supplier_evaluation", s.id)).toHaveLength(0);
    });

    it("no anula la evaluación de otra empresa", async () => {
      const s = await make(a, { legalName: "Aislada SA" });
      const { evaluation } = await evaluate(s.id, a, "product");
      await expect(voidEvaluation({ tenantId: b, actorUserId: actor, supplierId: s.id, evaluationId: evaluation.id, reason: "intento ajeno", now: NOW }, db)).rejects.toThrow(/no encontrada/i);
      expect(await getSupplierEvaluation(b, s.id, evaluation.id, db)).toBeNull();
      expect(await listSupplierEvaluations(b, s.id, db)).toHaveLength(0);
    });
  });

  describe("criterios con versiones", () => {
    it("publicar la v2 con otro peso no toca la evaluación hecha con la v1", async () => {
      const s = await make(a, { legalName: "Versiones SA", type: "service" });
      const { evaluation } = await evaluate(s.id, a, "service", { score: 4 });
      const before = await getSupplierEvaluation(a, s.id, evaluation.id, db);

      const draft = await startTemplateDraft({ tenantId: a, actorUserId: actor, supplierType: "service" }, db);
      expect(draft).toMatchObject({ version: 2, status: "draft" });
      // Dos veces devuelve el mismo borrador.
      expect((await startTemplateDraft({ tenantId: a, actorUserId: actor, supplierType: "service" }, db)).id).toBe(draft.id);

      const criteria = draft.criteria.map((c, i) => ({ ...c, weight: i === 0 ? c.weight + 5 : i === 1 ? c.weight - 5 : c.weight }));
      await saveTemplateDraft({ tenantId: a, actorUserId: actor, templateId: draft.id, approvedMin: 85, conditionalMin: 65, changeNote: "Más peso a la calidad", criteria }, db);
      await publishTemplateDraft({ tenantId: a, actorUserId: actor, templateId: draft.id }, db);

      const versions = await listTemplateVersions(a, "service", db);
      expect(versions.map((v) => [v.version, v.status])).toEqual([[2, "published"], [1, "retired"]]);
      expect((await getPublishedTemplate(a, "service", db))!.approvedMin).toBe(85);

      const after = await getSupplierEvaluation(a, s.id, evaluation.id, db);
      expect(after).toMatchObject({ templateVersion: 1, approvedMin: 80, conditionalMin: 60, totalScore: before!.totalScore, result: before!.result });
      expect(after!.items.map((i) => [i.name, i.weight])).toEqual(before!.items.map((i) => [i.name, i.weight]));

      // Una evaluación nueva usa la v2 y sus umbrales.
      const s2 = await make(a, { legalName: "Versiones 2 SA", type: "service" });
      const second = await evaluate(s2.id, a, "service", { score: 4, plan: { ownerUserId: owner, dueAt: addDays(TODAY, 30) } });
      expect(second.evaluation).toMatchObject({ templateVersion: 2, approvedMin: 85 });
      expect(second.evaluation.result).toBe("conditional"); // 80,0 < 85 con la v2 (con la v1 habría sido aprobado)
    }, 30_000);

    it("no publica un borrador con pesos que no suman 100 o un excluyente con N/A, y no edita lo publicado", async () => {
      const draft = await startTemplateDraft({ tenantId: a, actorUserId: actor, supplierType: "contractor" }, db);
      const bad = draft.criteria.map((c, i) => ({ ...c, weight: i === 0 ? c.weight + 7 : c.weight }));
      await saveTemplateDraft({ tenantId: a, actorUserId: actor, templateId: draft.id, approvedMin: 80, conditionalMin: 60, changeNote: "x", criteria: bad }, db);
      await expect(publishTemplateDraft({ tenantId: a, actorUserId: actor, templateId: draft.id }, db)).rejects.toThrow(/sumar 100/);
      // Un excluyente nunca guarda N/A.
      const saved = (await listTemplateVersions(a, "contractor", db)).find((v) => v.id === draft.id)!;
      expect(saved.criteria.filter((c) => c.excluding).every((c) => !c.allowNA)).toBe(true);

      const published = (await getPublishedTemplate(a, "contractor", db))!;
      await expect(saveTemplateDraft({ tenantId: a, actorUserId: actor, templateId: published.id, approvedMin: 80, conditionalMin: 60, changeNote: "", criteria: published.criteria }, db)).rejects.toThrow(/borrador/);
      await discardTemplateDraft({ tenantId: a, actorUserId: actor, templateId: draft.id }, db);
      expect(await db.supplierCriteriaTemplate.count({ where: { tenantId: a, supplierType: "contractor" } })).toBe(1);
    });

    it("una versión nueva exige contar qué cambió", async () => {
      const draft = await startTemplateDraft({ tenantId: a, actorUserId: actor, supplierType: "contractor" }, db);
      await expect(publishTemplateDraft({ tenantId: a, actorUserId: actor, templateId: draft.id }, db)).rejects.toThrow(/qué cambió/);
      await discardTemplateDraft({ tenantId: a, actorUserId: actor, templateId: draft.id }, db);
    });

    it("las plantillas de una empresa no se editan, publican ni descartan desde otra", async () => {
      const draft = await startTemplateDraft({ tenantId: a, actorUserId: actor, supplierType: "contractor" }, db);
      try {
        await make(b); // siembra b
        await expect(publishTemplateDraft({ tenantId: b, actorUserId: actor, templateId: draft.id }, db)).rejects.toThrow(/no encontrada/i);
        await expect(discardTemplateDraft({ tenantId: b, actorUserId: actor, templateId: draft.id }, db)).rejects.toThrow(/no encontrada/i);
        await expect(saveTemplateDraft({ tenantId: b, actorUserId: actor, templateId: draft.id, approvedMin: 80, conditionalMin: 60, changeNote: "", criteria: draft.criteria }, db)).rejects.toThrow(/no encontrada/i);
      } finally {
        await discardTemplateDraft({ tenantId: a, actorUserId: actor, templateId: draft.id }, db);
      }
    });
  });

  describe("documentos y habilitación", () => {
    const BLOCKING = ["art_certificate", "personnel_roster", "life_insurance", "f931"];
    const typeByKey = async (tenantId: string, key: string) => db.supplierDocumentType.findUniqueOrThrow({ where: { tenantId_key: { tenantId, key } } });

    const upload = async (supplierId: string, key: string, expiresAt: Date | null, tenantId = a) =>
      uploadSupplierDocument(
        { tenantId, actorUserId: actor, supplierId, typeId: (await typeByKey(tenantId, key)).id, expiresAt, fileName: `${key}.pdf`, contentType: "application/pdf", body: PDF, storage, now: NOW },
        db,
      );

    const uploadAllBlocking = async (supplierId: string, overrides: Record<string, Date | null> = {}) => {
      for (const key of BLOCKING) await upload(supplierId, key, key in overrides ? overrides[key] : d("2027-06-30"));
    };

    const approvedIds = async () => (await getApprovedList(a, NOW, db)).entries.map((e) => e.id);

    it("un contratista sin documentos bloqueantes cargados no está habilitado aunque tenga 95 puntos", async () => {
      const s = await make(a, { legalName: "Contratista Sin Papeles SA", type: "contractor", criticality: "critical", criticalityReason: "trabaja en planta" });
      await evaluate(s.id, a, "contractor", { score: 5 });
      const sup = await getSupplier(a, s.id, db);
      expect(sup).toMatchObject({ status: "approved", missingBlockingDocs: 4 });
      expect(await approvedIds()).not.toContain(s.id);
    });

    it("con la ART vencida figura no habilitado y fuera de la lista; al cargar una vigente vuelve", async () => {
      const s = await make(a, { legalName: "Contratista ART SA", type: "contractor", criticality: "critical", criticalityReason: "trabaja en planta", ownerUserId: owner });
      await evaluate(s.id, a, "contractor", { score: 5 });
      await uploadAllBlocking(s.id, { art_certificate: d("2026-10-18") }); // venció hace 3 días
      let sup = await getSupplier(a, s.id, db);
      expect(sup).toMatchObject({ status: "approved", lastScore: 100, missingBlockingDocs: 0 });
      expect(sup!.blockingDocExpiresAt).toEqual(d("2026-10-18"));
      expect(sup!.attentionAt!.getTime()).toBeLessThan(TODAY.getTime());
      expect(await approvedIds()).not.toContain(s.id);

      await upload(s.id, "art_certificate", d("2027-10-18"));
      sup = await getSupplier(a, s.id, db);
      expect(sup!.blockingDocExpiresAt).toEqual(d("2027-06-30"));
      expect(await approvedIds()).toContain(s.id);
    });

    it("cargar un documento nuevo reemplaza al vigente: un solo DueItem abierto por tipo, y repetir no duplica", async () => {
      const s = await make(a, { legalName: "Contratista Dobles SA", type: "contractor", criticality: "critical", criticalityReason: "trabaja en planta", ownerUserId: owner, siteIds: [siteA] });
      const first = await upload(s.id, "art_certificate", d("2027-01-31"));
      let open = await db.dueItem.findMany({ where: { tenantId: a, entityType: "supplier_document", entityId: first.id, status: "open" } });
      expect(open).toHaveLength(1);
      expect(open[0]).toMatchObject({ dueAt: d("2027-01-31"), ownerUserId: owner, siteId: siteA, leadDays: 30 });

      const second = await upload(s.id, "art_certificate", d("2027-07-31"));
      expect(await db.dueItem.count({ where: { entityId: first.id, status: "open" } })).toBe(0);
      expect(await db.dueItem.count({ where: { entityId: second.id, status: "open" } })).toBe(1);
      expect((await db.supplierDocument.findUniqueOrThrow({ where: { id: first.id } })).supersededAt).not.toBeNull();

      // Recalcular una y otra vez no duplica ni revive el anterior.
      await recomputeSupplierSummary(a, s.id, db, NOW);
      await recomputeSupplierSummary(a, s.id, db, NOW);
      const all = await db.dueItem.findMany({ where: { tenantId: a, entityType: "supplier_document", entityId: { in: [first.id, second.id] }, status: "open" } });
      expect(all.map((x) => x.entityId)).toEqual([second.id]);

      // Anular el vigente devuelve el vigente anterior y su DueItem.
      await voidSupplierDocument({ tenantId: a, actorUserId: actor, supplierId: s.id, documentId: second.id, reason: "fecha mal cargada", now: NOW }, db);
      open = await db.dueItem.findMany({ where: { tenantId: a, entityType: "supplier_document", entityId: { in: [first.id, second.id] }, status: "open" } });
      expect(open.map((x) => x.entityId)).toEqual([first.id]);
      expect((await db.supplierDocument.findUniqueOrThrow({ where: { id: first.id } })).supersededAt).toBeNull();
    });

    it("el F.931 mensual avisa con 7 días; un documento sin vencimiento no genera DueItem", async () => {
      const s = await make(a, { legalName: "Contratista Mensual SA", type: "contractor", criticality: "critical", criticalityReason: "trabaja en planta" });
      const f931 = await upload(s.id, "f931", d("2026-11-30"));
      const tax = await upload(s.id, "tax_registration", null);
      expect((await db.dueItem.findFirstOrThrow({ where: { entityId: f931.id, status: "open" } })).leadDays).toBe(7);
      expect(await db.dueItem.count({ where: { entityId: tax.id } })).toBe(0);
    });

    it("listSupplierDocuments marca vigente, por vencer, vencido y faltante por tipo", async () => {
      const s = await make(a, { legalName: "Contratista Estados SA", type: "contractor", criticality: "critical", criticalityReason: "trabaja en planta" });
      await upload(s.id, "art_certificate", d("2027-10-01"));
      await upload(s.id, "life_insurance", d("2026-11-05"));
      await upload(s.id, "personnel_roster", d("2026-10-01"));
      const rows = await listSupplierDocuments(a, s.id, NOW, db);
      const status = (prefix: string) => rows.find((r) => r.type.name.startsWith(prefix))!.status;
      expect(status("Certificado de cobertura")).toBe("valid");
      expect(status("Seguro de vida")).toBe("expiring");
      expect(status("Nómina")).toBe("expired");
      expect(status("F.931")).toBe("missing");
      // El tipo de otro rubro no aplica: un proveedor de producto no pide la ART.
      const prod = await make(a, { legalName: "Producto Docs SA", type: "product" });
      expect((await listSupplierDocuments(a, prod.id, NOW, db)).some((r) => r.type.name.startsWith("Certificado de cobertura"))).toBe(false);
    });

    it("valida el archivo, las fechas y el tipo", async () => {
      const s = await make(a, { legalName: "Contratista Valida SA", type: "contractor", criticality: "critical", criticalityReason: "trabaja en planta" });
      const typeId = (await typeByKey(a, "art_certificate")).id;
      const base = { tenantId: a, actorUserId: actor, supplierId: s.id, typeId, fileName: "art.pdf", contentType: "application/pdf", body: PDF, storage, now: NOW };
      await expect(uploadSupplierDocument({ ...base, body: Buffer.alloc(0) }, db)).rejects.toThrow(/vacío/);
      await expect(uploadSupplierDocument({ ...base, fileName: "virus.exe", contentType: "application/x-msdownload" }, db)).rejects.toThrow(/no permitido/);
      await expect(uploadSupplierDocument({ ...base, issuedAt: d("2026-10-10"), expiresAt: d("2026-10-01") }, db)).rejects.toThrow(/anterior a la fecha de emisión/);
      await expect(uploadSupplierDocument({ ...base, body: Buffer.alloc(16 * 1024 * 1024 + 1, 1) }, db)).rejects.toThrow(/15 MB/);
      const prod = await make(a, { legalName: "Producto ART SA", type: "product" });
      await expect(uploadSupplierDocument({ ...base, supplierId: prod.id }, db)).rejects.toThrow(/no se le pide/);
      expect(await db.supplierDocument.count({ where: { supplierId: { in: [s.id, prod.id] } } })).toBe(0);
    });

    it("aislamiento: no se carga, anula ni lee un documento de otra empresa", async () => {
      const s = await make(a, { legalName: "Contratista Aislado SA", type: "contractor", criticality: "critical", criticalityReason: "trabaja en planta" });
      const doc = await upload(s.id, "art_certificate", d("2027-10-01"));
      await make(b); // siembra tipos de b
      const typeOfB = (await typeByKey(b, "art_certificate")).id;
      const base = { actorUserId: actor, fileName: "x.pdf", contentType: "application/pdf", body: PDF, storage, now: NOW };
      await expect(uploadSupplierDocument({ ...base, tenantId: b, supplierId: s.id, typeId: typeOfB }, db)).rejects.toThrow(/Proveedor no encontrado/);
      await expect(uploadSupplierDocument({ ...base, tenantId: a, supplierId: s.id, typeId: typeOfB }, db)).rejects.toThrow(/Tipo de documento no encontrado/);
      await expect(voidSupplierDocument({ tenantId: b, actorUserId: actor, supplierId: s.id, documentId: doc.id, reason: "intento ajeno", now: NOW }, db)).rejects.toThrow(/no encontrado/i);
      expect(await readSupplierDocumentFile(b, doc.id, { storage, db })).toBeNull();
      const own = await readSupplierDocumentFile(a, doc.id, { storage, db });
      expect(own?.body.equals(PDF)).toBe(true);
      expect(own?.document.storageKey.startsWith(`tenants/${a}/suppliers/${s.id}/`)).toBe(true);
    });

    it("cambiar el juego de tipos de documento recalcula los faltantes de toda la empresa", async () => {
      const s = await make(a, { legalName: "Contratista Tipos SA", type: "contractor", criticality: "critical", criticalityReason: "trabaja en planta" });
      await evaluate(s.id, a, "contractor", { score: 5 });
      await uploadAllBlocking(s.id);
      expect(await approvedIds()).toContain(s.id);

      await saveDocumentType({ tenantId: a, actorUserId: actor, name: "Habilitación de trabajo en altura", appliesTo: ["contractor"], required: false, blocksEnablement: true, validityMonths: 12, recurrence: "none", note: "" }, db);
      const created = await db.supplierDocumentType.findFirstOrThrow({ where: { tenantId: a, name: "Habilitación de trabajo en altura" } });
      expect(created).toMatchObject({ required: true, blocksEnablement: true, key: "habilitacion_de_trabajo_en_altura" }); // lo que bloquea se exige
      expect((await getSupplier(a, s.id, db))!.missingBlockingDocs).toBe(1);
      expect(await approvedIds()).not.toContain(s.id);

      await setDocumentTypeActive({ tenantId: a, actorUserId: actor, id: created.id, active: false }, db);
      expect((await getSupplier(a, s.id, db))!.missingBlockingDocs).toBe(0);
      expect(await approvedIds()).toContain(s.id);

      await expect(saveDocumentType({ tenantId: b, actorUserId: actor, id: created.id, name: "Robado", appliesTo: ["service"], required: false, blocksEnablement: false, validityMonths: null, recurrence: "none", note: "" }, db)).rejects.toThrow(/no encontrado/i);
    });

    it("el resumen incremental coincide con recalcularlo desde cero", async () => {
      const s = await make(a, { legalName: "Contratista Resumen SA", type: "contractor", criticality: "critical", criticalityReason: "trabaja en planta", ownerUserId: owner });
      await evaluate(s.id, a, "contractor", { score: 4 });
      await uploadAllBlocking(s.id, { f931: d("2026-11-30") });
      const incremental = await db.supplier.findUniqueOrThrow({ where: { id: s.id } });
      const fresh = await recomputeSupplierSummary(a, s.id, db, NOW);
      const pick = ({ status, lastEvaluationId, lastEvaluatedAt, lastScore, nextEvaluationDueAt, blockingDocExpiresAt, missingRequiredDocs, missingBlockingDocs, attentionAt }: typeof fresh) => ({
        status, lastEvaluationId, lastEvaluatedAt, lastScore: lastScore && Number(lastScore), nextEvaluationDueAt, blockingDocExpiresAt, missingRequiredDocs, missingBlockingDocs, attentionAt,
      });
      expect(pick(incremental)).toEqual(pick(fresh));
      expect(await db.dueItem.count({ where: { tenantId: a, entityId: s.id, entityType: "supplier_evaluation", status: "open" } })).toBe(1);
    });
  });
});
