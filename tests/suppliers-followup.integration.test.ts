import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { createSupplier, type SupplierInput } from "@/lib/suppliers";
import { getPublishedTemplate } from "@/lib/supplier-criteria";
import { saveEvaluation } from "@/lib/supplier-evaluations";
import { getEvaluationEvidence } from "@/lib/supplier-evidence";
import {
  createSupplierFinding,
  getCommunicationTenant,
  getScoreTrend,
  listCommunicableEvaluations,
  listSupplierCommunications,
  listSupplierFindings,
  readCommunicationFile,
  recordCommunication,
} from "@/lib/supplier-followup";
import { addDays, buenosAiresToday } from "@/domain/suppliers/dates";
import { criteriaForEvaluation } from "@/domain/suppliers/evaluation";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const NOW = new Date("2026-10-21T15:00:00Z");
const TODAY = buenosAiresToday(NOW);
const PDF = Buffer.from("%PDF-1.4 prueba");

describe.skipIf(!hasDatabase)("proveedores 19.5: hallazgos, comunicaciones y evolución", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let supplierA = "";

  const make = (tenantId: string, over: Partial<SupplierInput> = {}) =>
    createSupplier({ tenantId, actorUserId: actor, legalName: "Proveedor de prueba SA", type: "product", criticality: "standard", ...over });

  const evaluate = async (supplierId: string, over: { kind?: "initial" | "periodic"; score?: number; evaluatedAt?: Date } = {}) => {
    const kind = over.kind ?? "initial";
    const template = await getPublishedTemplate(a, "product", db);
    const answers = criteriaForEvaluation(template!.criteria, kind, "full").map((c) => ({ criterionId: c.id, score: over.score ?? 5, comment: "ok" }));
    return saveEvaluation({ tenantId: a, actorUserId: actor, supplierId, kind, mode: "full", answers, now: NOW, evaluatedAt: over.evaluatedAt, plan: { ownerUserId: actor, dueAt: addDays(TODAY, 30) } }, db);
  };

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Follow ${label}`, slug: `follow-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    const user = await db.user.create({ data: { name: "Follow Admin", email: `follow-${stamp}@test.dev`, emailVerified: true } });
    actor = user.id;
    await db.membership.create({ data: { userId: actor, tenantId: a, role: "tenant_admin" } });
    supplierA = (await make(a, { legalName: "Seguimiento SA" })).id;
    await make(b, { legalName: "Semilla B SA" });
  });

  afterAll(async () => {
    await db.action.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.dueItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.finding.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.$disconnect();
  });

  describe("hallazgos del proveedor", () => {
    it("crea un Finding con origin = supplier y un SupplierFinding; no toca columnas de Finding", async () => {
      const { finding, link } = await createSupplierFinding(
        { tenantId: a, actorUserId: actor, supplierId: supplierA, kind: "delivery", description: "Llegó con 3 días de atraso", now: NOW },
        db,
      );
      expect(finding).toMatchObject({
        tenantId: a,
        origin: "supplier",
        type: "nonconformity",
        status: "draft",
        title: "Entrega · Seguimiento SA: Llegó con 3 días de atraso",
        source: "Proveedor: Seguimiento SA",
        createdByUserId: actor,
      });
      expect(link).toMatchObject({ tenantId: a, supplierId: supplierA, findingId: finding.id, kind: "delivery", evaluationId: null });
    });

    it("la reevaluación siguiente lo precarga como evidencia", async () => {
      const s = await make(a, { legalName: "Con hallazgo SA" });
      await evaluate(s.id, { evaluatedAt: addDays(TODAY, -5) });
      await createSupplierFinding({ tenantId: a, actorUserId: actor, supplierId: s.id, kind: "quality", description: "Lote con rechazo", now: NOW }, db);
      const ev = await getEvaluationEvidence(a, s.id, db);
      expect(ev.findings.map((f) => f.kind)).toEqual(["quality"]);
      expect(ev.openFindingsSinceLast).toBe(1);
    });

    it("valida tipo, descripción, fecha futura y que la evaluación sea de ese proveedor", async () => {
      const base = { tenantId: a, actorUserId: actor, supplierId: supplierA, kind: "quality" as const, description: "Algo pasó", now: NOW };
      await expect(createSupplierFinding({ ...base, kind: "otro" as never }, db)).rejects.toThrow(/tipo/);
      await expect(createSupplierFinding({ ...base, description: " " }, db)).rejects.toThrow(/Describí/);
      await expect(createSupplierFinding({ ...base, detectedAt: addDays(TODAY, 1) }, db)).rejects.toThrow(/futura/);
      const other = await make(a, { legalName: "Otro SA" });
      const { evaluation } = await evaluate(other.id);
      await expect(createSupplierFinding({ ...base, evaluationId: evaluation.id }, db)).rejects.toThrow(/no pertenece/);
      expect(await db.finding.count({ where: { tenantId: a, title: { contains: "Algo pasó" } } })).toBe(0);
    });

    it("vincula la evaluación cuando es del proveedor", async () => {
      const s = await make(a, { legalName: "Vinculada SA" });
      const { evaluation } = await evaluate(s.id);
      const { link } = await createSupplierFinding({ tenantId: a, actorUserId: actor, supplierId: s.id, kind: "claim", description: "Reclamo del cliente", evaluationId: evaluation.id, now: NOW }, db);
      expect(link.evaluationId).toBe(evaluation.id);
    });

    it("no crea hallazgos para un proveedor de otra empresa", async () => {
      await expect(createSupplierFinding({ tenantId: b, actorUserId: actor, supplierId: supplierA, kind: "quality", description: "Intento ajeno", now: NOW }, db)).rejects.toThrow(/no encontrado/i);
      expect(await db.finding.count({ where: { tenantId: b, origin: "supplier" } })).toBe(0);
    });

    it("la lista trae los hallazgos con sus acciones abiertas, acotada por empresa", async () => {
      const s = await make(a, { legalName: "Lista SA" });
      const { finding } = await createSupplierFinding({ tenantId: a, actorUserId: actor, supplierId: s.id, kind: "safety", description: "Sin casco en obra", now: NOW }, db);
      await db.action.create({ data: { tenantId: a, title: "Capacitar al contratista", ownerUserId: actor, links: { create: [{ targetType: "finding", targetId: finding.id }] } } });
      const rows = await listSupplierFindings(a, s.id, db);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "safety", finding: { id: finding.id, status: "draft" } });
      expect(rows[0].actions.map((x) => x.title)).toEqual(["Capacitar al contratista"]);
      expect(await listSupplierFindings(b, s.id, db)).toEqual([]);
    });
  });

  describe("comunicaciones (§8.4.3)", () => {
    const base = () => ({ tenantId: a, actorUserId: actor, supplierId: supplierA, now: NOW, storage });

    it("registra los requisitos comunicados con fecha, canal y resumen", async () => {
      const c = await recordCommunication(
        { ...base(), kind: "requirements", channel: "email", sentAt: addDays(TODAY, -2), summary: "Se enviaron los requisitos de seguridad", recipientName: "María Pérez" },
        db,
      );
      expect(c).toMatchObject({ tenantId: a, supplierId: supplierA, kind: "requirements", channel: "email", recipientName: "María Pérez", storageKey: null, evaluationId: null });
      const rows = await listSupplierCommunications(a, supplierA, db);
      expect(rows[0]).toMatchObject({ id: c.id, createdByName: "Follow Admin" });
    });

    it("el resultado exige una evaluación del proveedor; con ella queda vinculado", async () => {
      const s = await make(a, { legalName: "Resultado SA" });
      const { evaluation } = await evaluate(s.id);
      const input = { ...base(), supplierId: s.id, kind: "evaluation_result" as const, channel: "meeting" as const, sentAt: TODAY, summary: "Se le informó que quedó aprobado" };
      await expect(recordCommunication(input, db)).rejects.toThrow(/evaluación cuyo resultado/);
      const c = await recordCommunication({ ...input, evaluationId: evaluation.id }, db);
      expect(c.evaluationId).toBe(evaluation.id);
      expect((await listCommunicableEvaluations(a, s.id, db)).map((e) => e.id)).toEqual([evaluation.id]);
      const other = await make(a, { legalName: "Ajena SA" });
      await expect(recordCommunication({ ...input, supplierId: other.id, evaluationId: evaluation.id }, db)).rejects.toThrow(/no pertenece/);
    });

    it("valida fecha futura, resumen y canal", async () => {
      const ok = { ...base(), kind: "requirements" as const, channel: "letter" as const, sentAt: TODAY, summary: "Carta documento" };
      await expect(recordCommunication({ ...ok, sentAt: addDays(TODAY, 1) }, db)).rejects.toThrow(/futura/);
      await expect(recordCommunication({ ...ok, summary: "" }, db)).rejects.toThrow(/resumen/);
      await expect(recordCommunication({ ...ok, channel: "paloma" as never }, db)).rejects.toThrow(/cómo/);
    });

    it("guarda el adjunto y solo lo lee la empresa dueña", async () => {
      const c = await recordCommunication(
        { ...base(), kind: "requirements", channel: "email", sentAt: TODAY, summary: "Con adjunto", file: { fileName: "requisitos 2026.pdf", contentType: "application/pdf", body: PDF } },
        db,
      );
      expect(c.storageKey).toBe(`tenants/${a}/suppliers/${supplierA}/communications/${c.id}/requisitos_2026.pdf`);
      expect(await getCommunicationTenant(c.id, db)).toBe(a);
      const file = await readCommunicationFile(a, c.id, { storage, db });
      expect(file).toMatchObject({ fileName: "requisitos 2026.pdf", contentType: "application/pdf" });
      expect(file!.body.equals(PDF)).toBe(true);
      // Pedir la misma clave desde otra empresa no devuelve nada.
      expect(await readCommunicationFile(b, c.id, { storage, db })).toBeNull();
    });

    it("rechaza archivos de tipo no permitido o demasiado grandes y no deja registro", async () => {
      const ok = { ...base(), kind: "requirements" as const, channel: "email" as const, sentAt: TODAY, summary: "Con adjunto malo" };
      await expect(recordCommunication({ ...ok, file: { fileName: "virus.exe", contentType: "application/x-msdownload", body: PDF } }, db)).rejects.toThrow(/no permitido/);
      await expect(recordCommunication({ ...ok, file: { fileName: "enorme.pdf", contentType: "application/pdf", body: Buffer.alloc(15 * 1024 * 1024 + 1) } }, db)).rejects.toThrow(/15 MB/);
      expect(await db.supplierCommunication.count({ where: { tenantId: a, summary: "Con adjunto malo" } })).toBe(0);
    });

    it("no registra comunicaciones de un proveedor de otra empresa", async () => {
      await expect(recordCommunication({ ...base(), tenantId: b, kind: "requirements", channel: "email", sentAt: TODAY, summary: "Intento ajeno" }, db)).rejects.toThrow(/no encontrado/i);
      expect(await listSupplierCommunications(b, supplierA, db)).toEqual([]);
    });
  });

  describe("evolución del puntaje", () => {
    it("trae las evaluaciones con puntaje de la más antigua a la más reciente, sin las anuladas", async () => {
      const s = await make(a, { legalName: "Evolución SA" });
      await evaluate(s.id, { evaluatedAt: addDays(TODAY, -300), score: 3 });
      await evaluate(s.id, { kind: "periodic", evaluatedAt: addDays(TODAY, -100), score: 4 });
      await evaluate(s.id, { kind: "periodic", evaluatedAt: addDays(TODAY, -1), score: 5 });
      const trend = await getScoreTrend(a, s.id, db);
      expect(trend.map((t) => t.score)).toEqual([60, 80, 100]);
      expect(trend.map((t) => t.delta)).toEqual([null, 20, 20]);
      expect(await getScoreTrend(b, s.id, db)).toEqual([]);
    });
  });
});
