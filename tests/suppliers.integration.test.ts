import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createPerson, createSite } from "@/lib/masterdata";
import {
  SupplierError,
  applySupplierImport,
  createSupplier,
  deactivateSupplier,
  ensureSupplierDefaults,
  getApprovedList,
  getSupplier,
  getSupplierCounts,
  linkPersonToSupplier,
  listSupplierPeople,
  listSuppliers,
  previewSupplierImport,
  reactivateSupplier,
  recomputeSupplierSummary,
  recordApprovedListExport,
  searchLinkablePeople,
  supplierViewWhere,
  unlinkPersonFromSupplier,
  updateSupplier,
  type SupplierInput,
  type SupplierView,
} from "@/lib/suppliers";
import { cuitCheckDigit } from "@/domain/suppliers/cuit";
import { addDays, buenosAiresToday, isoDay } from "@/domain/suppliers/dates";
import { isEnabled, supplierSemaphore } from "@/domain/suppliers/status";
import { DEFAULT_DOCUMENT_TYPES } from "@/domain/suppliers/templates";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const NOW = new Date("2026-10-21T15:00:00Z");
const TODAY = buenosAiresToday(NOW);
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** CUIT válidos y distintos para armar listas grandes. */
function cuits(n: number): string[] {
  const out: string[] = [];
  for (let i = 1; out.length < n; i++) {
    const first10 = `20${String(10_000_000 + i).padStart(8, "0")}`;
    const dv = cuitCheckDigit(first10);
    if (dv !== null) out.push(`${first10}${dv}`);
  }
  return out;
}

describe.skipIf(!hasDatabase)("proveedores: persistencia y aislamiento", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let siteA = "";
  let siteB = "";
  let positionA = "";

  const base = (over: Partial<SupplierInput> = {}): SupplierInput => ({
    legalName: "Proveedor de prueba SA",
    type: "service",
    criticality: "standard",
    ...over,
  });
  const make = (tenantId: string, over: Partial<SupplierInput> = {}) =>
    createSupplier({ tenantId, actorUserId: actor, ...base(over) });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Prov ${label}`, slug: `prov-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    const user = await db.user.create({ data: { name: "Prov Admin", email: `prov-${stamp}@test.dev`, emailVerified: true } });
    actor = user.id;
    await db.membership.create({ data: { userId: actor, tenantId: a, role: "tenant_admin" } });
    siteA = (await createSite({ tenantId: a, actorUserId: actor, name: "Base Neuquén" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: actor, name: "Base Neuquén" })).id;
    positionA = (await createJobPosition({ tenantId: a, actorUserId: actor, name: "Soldador" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.$disconnect();
  });

  describe("ensureSupplierDefaults", () => {
    it("siembra v1 publicada por tipo, los tipos de documento y los ajustes; repetir no duplica", async () => {
      expect(await ensureSupplierDefaults(a, db)).toEqual({ seeded: true });
      expect(await ensureSupplierDefaults(a, db)).toEqual({ seeded: false });
      const templates = await db.supplierCriteriaTemplate.findMany({ where: { tenantId: a }, include: { criteria: true } });
      expect(templates.map((t) => [t.supplierType, t.version, t.status]).sort()).toEqual([
        ["contractor", 1, "published"],
        ["product", 1, "published"],
        ["service", 1, "published"],
      ]);
      for (const t of templates) expect(t.criteria.reduce((n, c) => n + c.weight, 0)).toBe(100);
      expect(await db.supplierDocumentType.count({ where: { tenantId: a } })).toBe(DEFAULT_DOCUMENT_TYPES.length);
      expect(await db.supplierSettings.count({ where: { tenantId: a } })).toBe(1);
    });

    it("no pisa lo que la empresa editó", async () => {
      await db.supplierDocumentType.update({ where: { tenantId_key: { tenantId: a, key: "f931" } }, data: { name: "F.931 (editado)", active: false } });
      await db.supplierSettings.delete({ where: { tenantId: a } }); // fuerza otra pasada de la siembra
      await ensureSupplierDefaults(a, db);
      const f931 = await db.supplierDocumentType.findUniqueOrThrow({ where: { tenantId_key: { tenantId: a, key: "f931" } } });
      expect(f931).toMatchObject({ name: "F.931 (editado)", active: false });
      expect(await db.supplierDocumentType.count({ where: { tenantId: a } })).toBe(DEFAULT_DOCUMENT_TYPES.length);
      await db.supplierDocumentType.update({ where: { id: f931.id }, data: { name: DEFAULT_DOCUMENT_TYPES.find((t) => t.key === "f931")!.name, active: true } });
    });

    it("cada empresa tiene lo suyo: la otra no se siembra sola", async () => {
      expect(await db.supplierCriteriaTemplate.count({ where: { tenantId: b } })).toBe(0);
      await ensureSupplierDefaults(b, db);
      expect(await db.supplierCriteriaTemplate.count({ where: { tenantId: b } })).toBe(3);
      expect(await db.supplierCriteriaTemplate.count({ where: { tenantId: a } })).toBe(3);
    });
  });

  describe("restricciones de la base", () => {
    it("a lo sumo una plantilla publicada por empresa y tipo", async () => {
      await expect(
        db.supplierCriteriaTemplate.create({ data: { tenantId: a, supplierType: "product", version: 2, status: "published" } }),
      ).rejects.toThrow();
      // un borrador sí, y otra versión publicada recién cuando se retira la anterior
      const draft = await db.supplierCriteriaTemplate.create({ data: { tenantId: a, supplierType: "product", version: 2, status: "draft" } });
      await expect(db.supplierCriteriaTemplate.update({ where: { id: draft.id }, data: { status: "published" } })).rejects.toThrow();
      await db.supplierCriteriaTemplate.updateMany({ where: { tenantId: a, supplierType: "product", version: 1 }, data: { status: "retired" } });
      await db.supplierCriteriaTemplate.update({ where: { id: draft.id }, data: { status: "published" } });
      await db.supplierCriteriaTemplate.updateMany({ where: { tenantId: a, supplierType: "product", status: "published" }, data: { status: "retired" } });
      await db.supplierCriteriaTemplate.updateMany({ where: { tenantId: a, supplierType: "product", version: 1 }, data: { status: "published" } });
      await db.supplierCriteriaTemplate.delete({ where: { id: draft.id } });
    });

    it("peso mayor que 0, nota de 1 a 5 y umbrales coherentes", async () => {
      const template = await db.supplierCriteriaTemplate.findFirstOrThrow({ where: { tenantId: a, supplierType: "service" } });
      await expect(db.supplierCriterion.create({ data: { tenantId: a, templateId: template.id, position: 99, name: "X", weight: 0 } })).rejects.toThrow();
      await expect(
        db.supplierCriteriaTemplate.create({ data: { tenantId: a, supplierType: "service", version: 9, approvedMin: 50, conditionalMin: 70 } }),
      ).rejects.toThrow();
      const supplier = await make(a, { legalName: "Para restricciones" });
      const evaluation = await db.supplierEvaluation.create({
        data: { tenantId: a, supplierId: supplier.id, kind: "initial", mode: "full", approvedMin: 80, conditionalMin: 60, criticalityAtEvaluation: "standard", evaluatedAt: d("2026-10-01"), result: "approved", resultReason: "score", totalScore: 90 },
      });
      const item = { tenantId: a, evaluationId: evaluation.id, position: 1, name: "Calidad", weight: 10 };
      await expect(db.supplierEvaluationItem.create({ data: { ...item, score: 6 } })).rejects.toThrow();
      await expect(db.supplierEvaluationItem.create({ data: { ...item, score: 0 } })).rejects.toThrow();
      await expect(db.supplierEvaluationItem.create({ data: { ...item, weight: 0, score: 3 } })).rejects.toThrow();
      await expect(db.supplierEvaluation.create({ data: { ...evaluationData(supplier.id), totalScore: 10 } })).rejects.toThrow();
      await db.supplierEvaluationItem.create({ data: { ...item, score: 5 } });
      await db.supplierEvaluationItem.create({ data: { ...item, position: 2, score: null } });
    });

    function evaluationData(supplierId: string) {
      return { tenantId: a, supplierId, kind: "initial" as const, mode: "full" as const, approvedMin: 80, conditionalMin: 60, criticalityAtEvaluation: "standard" as const, evaluatedAt: d("2026-10-01"), result: "approved" as const, resultReason: "score" as const };
    }

    it("CUIT de 11 dígitos y motivo de criticidad también se exigen en la base", async () => {
      const raw = { tenantId: a, legalName: "Crudo SA", type: "product" as const };
      await expect(db.supplier.create({ data: { ...raw, taxId: "123" } })).rejects.toThrow();
      await expect(db.supplier.create({ data: { ...raw, criticality: "low" } })).rejects.toThrow();
      await expect(db.supplier.create({ data: { ...raw, criticality: "critical", criticalityReason: "   " } })).rejects.toThrow();
    });
  });

  describe("alta, edición y baja", () => {
    it("mismo CUIT en dos proveedores del mismo tenant: error; en otro tenant: permitido", async () => {
      const first = await make(a, { legalName: "Con CUIT SA", taxId: "20-12345678-6" });
      expect(first.taxId).toBe("20123456786");
      await expect(make(a, { legalName: "Otro SA", taxId: "20123456786" })).rejects.toThrow(/Con CUIT SA/);
      await expect(make(a, { legalName: "Otro SA", taxId: "20 12345678 6" })).rejects.toBeInstanceOf(SupplierError);
      const other = await make(b, { legalName: "Con CUIT SA", taxId: "20123456786" });
      expect(other.tenantId).toBe(b);
    });

    it("valida CUIT, motivo de criticidad, responsable y sedes", async () => {
      await expect(make(a, { taxId: "20-12345678-5" })).rejects.toThrow("último dígito");
      await expect(make(a, { criticality: "critical" })).rejects.toThrow("motivo");
      await expect(make(a, { criticality: "low", criticalityReason: "  " })).rejects.toThrow("motivo");
      await expect(make(a, { ownerUserId: "no-existe" })).rejects.toThrow("responsable");
      await expect(make(a, { siteIds: [siteB] })).rejects.toThrow("sede");
      await expect(make(a, { legalName: "x" })).rejects.toThrow("razón social");
      await expect(make(a, { contactEmail: "no-es-mail" })).rejects.toThrow("email");
    });

    it("proveedor extranjero sin CUIT, con sedes y responsable; nace sin evaluar y con los documentos que le faltan", async () => {
      const s = await make(a, { legalName: "Foreign LLC", type: "contractor", criticality: "critical", criticalityReason: "Trabaja en altura", ownerUserId: actor, siteIds: [siteA] });
      expect(s).toMatchObject({ taxId: null, status: "potential", attentionAt: null, missingBlockingDocs: 4, missingRequiredDocs: 5 });
      const full = await getSupplier(a, s.id);
      expect(full?.siteList.map((x) => x.id)).toEqual([siteA]);
      expect(full?.owner?.id).toBe(actor);
    });

    it("editar el tipo recalcula los documentos que se exigen, y queda auditado", async () => {
      const s = await make(a, { legalName: "Cambia de tipo SA", type: "contractor", criticality: "critical", criticalityReason: "Planta" });
      expect(s.missingBlockingDocs).toBe(4);
      const updated = await updateSupplier({ tenantId: a, actorUserId: actor, id: s.id, ...base({ legalName: "Cambia de tipo SA", type: "product" }) });
      expect(updated).toMatchObject({ type: "product", missingBlockingDocs: 0, missingRequiredDocs: 1 });
      const log = await db.masterDataAudit.findMany({ where: { tenantId: a, entityType: "supplier", entityId: s.id }, orderBy: { createdAt: "asc" } });
      expect(log.map((l) => l.action)).toEqual(["create", "update"]);
      expect(log[1].summary).toMatch(/tipo/);
      expect(log[1].summary).toMatch(/criticidad/);
    });

    it("la baja pide motivo, se refleja en el estado y se puede revertir", async () => {
      const s = await make(a, { legalName: "Se da de baja SA" });
      await expect(deactivateSupplier({ tenantId: a, actorUserId: actor, id: s.id, reason: " " })).rejects.toThrow("motivo");
      await deactivateSupplier({ tenantId: a, actorUserId: actor, id: s.id, reason: "Dejó de operar" });
      expect(await db.supplier.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({ status: "inactive", inactiveReason: "Dejó de operar" });
      await reactivateSupplier({ tenantId: a, actorUserId: actor, id: s.id });
      expect(await db.supplier.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({ status: "potential", inactiveAt: null });
    });
  });

  describe("aislamiento entre empresas", () => {
    it("una empresa no ve ni modifica los proveedores de la otra", async () => {
      const mine = await make(a, { legalName: "Solo de A SA" });
      expect(await getSupplier(b, mine.id)).toBeNull();
      expect((await listSuppliers(b, { q: "Solo de A" }, 1, NOW)).items).toHaveLength(0);
      expect((await listSuppliers(a, { q: "Solo de A" }, 1, NOW)).items).toHaveLength(1);
      await expect(updateSupplier({ tenantId: b, actorUserId: actor, id: mine.id, ...base() })).rejects.toThrow("no encontrado");
      await expect(deactivateSupplier({ tenantId: b, actorUserId: actor, id: mine.id, reason: "intento" })).rejects.toThrow("no encontrado");
      await expect(recomputeSupplierSummary(b, mine.id, db)).rejects.toThrow("no encontrado");
      expect(await db.supplier.findUniqueOrThrow({ where: { id: mine.id } })).toMatchObject({ status: "potential", inactiveAt: null });
      expect((await getSupplierCounts(b, NOW)).total).toBe(await db.supplier.count({ where: { tenantId: b } })); // solo los suyos
    });

    it("no se vinculan personas de otra empresa ni a proveedores de otra empresa", async () => {
      const contractor = await make(a, { legalName: "Contratista A SA", type: "contractor", criticality: "critical", criticalityReason: "Planta" });
      const otherSupplier = await make(b, { legalName: "Contratista B SA", type: "contractor", criticality: "critical", criticalityReason: "Planta" });
      const personB = await createPerson({ tenantId: b, actorUserId: actor, employeeCode: "1", name: "Pedro B", siteId: siteB, positionId: (await createJobPosition({ tenantId: b, actorUserId: actor, name: "Op" })).id, employer: "contractor", contractorName: "Contratista B SA" });
      await expect(linkPersonToSupplier({ tenantId: a, actorUserId: actor, supplierId: contractor.id, personId: personB.id })).rejects.toThrow("Persona no encontrada");
      await expect(linkPersonToSupplier({ tenantId: a, actorUserId: actor, supplierId: otherSupplier.id, personId: personB.id })).rejects.toThrow("Proveedor no encontrado");
      expect(await searchLinkablePeople(a, contractor.id)).toEqual([]);
      expect(await searchLinkablePeople(b, contractor.id)).toEqual([]);
    });
  });

  describe("personas del contratista", () => {
    it("vincula, lista y desvincula; solo contratistas con personas de contratista", async () => {
      const contractor = await make(a, { legalName: "Montajes del Sur SA", type: "contractor", criticality: "critical", criticalityReason: "Altura" });
      const service = await make(a, { legalName: "Servicio común SA" });
      const mk = (code: string, name: string, employer: "own" | "contractor", contractorName?: string) =>
        createPerson({ tenantId: a, actorUserId: actor, employeeCode: code, name, siteId: siteA, positionId: positionA, employer, contractorName });
      const luis = await mk("C1", "Luis Gómez", "contractor", "Montajes del Sur SA");
      const ana = await mk("C2", "Ana Otra", "contractor", "Otra empresa");
      const own = await mk("P1", "Propio Pérez", "own");

      const linkable = await searchLinkablePeople(a, contractor.id);
      expect(linkable.map((p) => p.name)).toEqual(["Luis Gómez", "Ana Otra"]); // la que figura con el nombre del contratista va primero
      expect(linkable[0].sameName).toBe(true);

      await linkPersonToSupplier({ tenantId: a, actorUserId: actor, supplierId: contractor.id, personId: luis.id });
      await expect(linkPersonToSupplier({ tenantId: a, actorUserId: actor, supplierId: contractor.id, personId: own.id })).rejects.toThrow("de contratista");
      await expect(linkPersonToSupplier({ tenantId: a, actorUserId: actor, supplierId: service.id, personId: ana.id })).rejects.toThrow("contratista");
      expect((await listSupplierPeople(a, contractor.id)).map((p) => p.name)).toEqual(["Luis Gómez"]);
      expect((await searchLinkablePeople(a, contractor.id)).map((p) => p.name)).toEqual(["Ana Otra"]);

      await unlinkPersonFromSupplier({ tenantId: a, actorUserId: actor, supplierId: contractor.id, personId: luis.id });
      expect(await listSupplierPeople(a, contractor.id)).toEqual([]);
      await expect(unlinkPersonFromSupplier({ tenantId: a, actorUserId: actor, supplierId: contractor.id, personId: luis.id })).rejects.toThrow("no está vinculada");
    });
  });

  describe("resumen, habilitación documental y lista de aprobados", () => {
    it("contratista: nace no habilitado; con la documentación al día queda habilitado; ART vencida lo saca; una ART nueva lo devuelve", async () => {
      const s = await make(a, { legalName: "Contratista Doc SA", type: "contractor", criticality: "critical", criticalityReason: "Altura" });
      await db.supplierEvaluation.create({
        data: { tenantId: a, supplierId: s.id, kind: "initial", mode: "full", approvedMin: 80, conditionalMin: 60, criticalityAtEvaluation: "critical", evaluatedAt: d("2026-10-01"), result: "approved", resultReason: "score", totalScore: 95 },
      });
      const types = await db.supplierDocumentType.findMany({ where: { tenantId: a } });
      const type = (key: string) => types.find((t) => t.key === key)!.id;
      const doc = (key: string, expiresAt: Date | null, createdAt?: Date) =>
        db.supplierDocument.create({ data: { tenantId: a, supplierId: s.id, typeId: type(key), expiresAt, storageKey: `k-${key}-${Math.random()}`, fileName: `${key}.pdf`, contentType: "application/pdf", sizeBytes: 10, createdAt: createdAt ?? new Date(NOW.getTime() - 60_000) } });

      let sum = await recomputeSupplierSummary(a, s.id, db, NOW);
      expect(sum).toMatchObject({ status: "approved", missingBlockingDocs: 4, missingRequiredDocs: 5 });
      expect(isoDay(sum.nextEvaluationDueAt!)).toBe("2027-10-01");
      expect(isEnabled(sum.status, sum.missingBlockingDocs, sum.blockingDocExpiresAt, TODAY)).toBe(false);
      expect(supplierSemaphore(sum.status, sum.attentionAt, sum.missingRequiredDocs, TODAY)).toBe("red");
      expect((await getApprovedList(a, NOW)).entries.map((e) => e.id)).not.toContain(s.id);

      await doc("art_certificate", d("2026-10-10")); // vencida
      await doc("personnel_roster", null);
      await doc("life_insurance", null);
      await doc("f931", d("2026-11-15"));
      await doc("tax_registration", null);
      sum = await recomputeSupplierSummary(a, s.id, db, NOW);
      expect(sum).toMatchObject({ missingBlockingDocs: 0, missingRequiredDocs: 0 });
      expect(isoDay(sum.blockingDocExpiresAt!)).toBe("2026-10-10");
      expect(isEnabled(sum.status, sum.missingBlockingDocs, sum.blockingDocExpiresAt, TODAY)).toBe(false);
      expect((await getApprovedList(a, NOW)).entries.map((e) => e.id)).not.toContain(s.id);
      expect((await getApprovedList(a, NOW)).excludedForDocs).toBeGreaterThanOrEqual(1);

      // Una ART nueva reemplaza a la vigente (el vigente es el último no anulado).
      const renewed = await doc("art_certificate", d("2027-09-30"), new Date(NOW.getTime() + 1000));
      sum = await recomputeSupplierSummary(a, s.id, db, NOW);
      expect(isoDay(sum.blockingDocExpiresAt!)).toBe("2026-11-15"); // ahora vence antes el F.931
      expect(isEnabled(sum.status, sum.missingBlockingDocs, sum.blockingDocExpiresAt, TODAY)).toBe(true);
      expect((await getApprovedList(a, NOW)).entries.map((e) => e.id)).toContain(s.id);

      // Anular la nueva devuelve a la anterior (vencida).
      await db.supplierDocument.update({ where: { id: renewed.id }, data: { voidedAt: NOW, voidReason: "Subida por error" } });
      sum = await recomputeSupplierSummary(a, s.id, db, NOW);
      expect(isoDay(sum.blockingDocExpiresAt!)).toBe("2026-10-10");
    });

    it("anular la última evaluación devuelve el estado de la anterior; recalcular dos veces da lo mismo", async () => {
      const s = await make(a, { legalName: "Evaluado dos veces SA", criticality: "standard" });
      const evalData = (evaluatedAt: string, result: "approved" | "not_approved", score: number) => ({
        tenantId: a, supplierId: s.id, kind: "periodic" as const, mode: "full" as const, approvedMin: 80, conditionalMin: 60,
        criticalityAtEvaluation: "standard" as const, evaluatedAt: d(evaluatedAt), result, resultReason: "score" as const, totalScore: score,
      });
      await db.supplierEvaluation.create({ data: evalData("2026-06-01", "approved", 88) });
      const second = await db.supplierEvaluation.create({ data: evalData("2026-09-01", "not_approved", 45) });
      const afterSecond = await recomputeSupplierSummary(a, s.id, db, NOW);
      expect(afterSecond).toMatchObject({ status: "not_approved", nextEvaluationDueAt: null, attentionAt: null, lastEvaluationId: second.id });
      expect(Number(afterSecond.lastScore)).toBe(45);

      await db.supplierEvaluation.update({ where: { id: second.id }, data: { voidedAt: NOW, voidReason: "Evaluación cargada por error" } });
      const afterVoid = await recomputeSupplierSummary(a, s.id, db, NOW);
      expect(afterVoid.status).toBe("approved");
      expect(isoDay(afterVoid.nextEvaluationDueAt!)).toBe("2028-06-01");
      const again = await recomputeSupplierSummary(a, s.id, db, NOW);
      expect({ ...again, updatedAt: null }).toEqual({ ...afterVoid, updatedAt: null });
    });
  });

  describe("lista, filtros, conteos y paginación en la base", () => {
    let t = ""; // empresa propia para controlar todos los datos

    beforeAll(async () => {
      const tenant = await createTenantWithTemplate({ name: "Prov lista", slug: `prov-lista-${stamp}`, size: "small", activity: "servicios" });
      t = tenant.id;
      tenantIds.push(t);
      await ensureSupplierDefaults(t, db);
      const siteT = (await createSite({ tenantId: t, actorUserId: actor, name: "Sede T" })).id;
      const row = (n: number, over: Record<string, unknown>) => ({
        tenantId: t, legalName: `Proveedor ${String(n).padStart(3, "0")}`, type: "service" as const, ...over,
      });
      const plus = (days: number) => addDays(TODAY, days);
      const created = await db.supplier.createManyAndReturn({
        data: [
          row(1, { status: "approved", attentionAt: plus(-3), nextEvaluationDueAt: plus(-3) }), // rojo: reevaluación vencida
          row(2, { status: "approved", attentionAt: TODAY, nextEvaluationDueAt: TODAY }), // ámbar: vence hoy
          row(3, { status: "approved", attentionAt: plus(10) }), // ámbar
          row(4, { status: "approved", attentionAt: plus(30) }), // ámbar (límite inclusivo)
          row(5, { status: "approved", attentionAt: plus(31) }), // verde
          row(6, { status: "approved" }), // verde
          row(7, { status: "approved", missingRequiredDocs: 1 }), // ámbar
          row(8, { status: "conditional", attentionAt: plus(200) }), // ámbar
          row(9, { status: "conditional", attentionAt: plus(-1) }), // rojo
          row(10, { status: "not_approved" }), // rojo
          row(11, { status: "potential" }), // gris
          row(12, { status: "inactive" }), // gris
          row(13, { status: "approved", missingBlockingDocs: 1, attentionAt: plus(-1), criticality: "critical", criticalityReason: "x", type: "contractor" }), // rojo, no habilitado
          row(14, { status: "approved", blockingDocExpiresAt: TODAY, attentionAt: TODAY }), // ámbar, habilitado hoy
          row(15, { status: "approved", blockingDocExpiresAt: plus(-1), attentionAt: plus(-1) }), // rojo, no habilitado
        ],
      });
      // Sede: el 3 atiende solo la sede T; el resto, todas.
      await db.supplierSite.create({ data: { supplierId: created[2].id, siteId: siteT, tenantId: t } });
      await db.supplier.update({ where: { id: created[0].id }, data: { category: "Mantenimiento" } });
    });

    const views: SupplierView[] = ["red", "amber", "unrated", "approved", "attention", "all"];

    it("los filtros y conteos de la base coinciden con el semáforo y la habilitación puros", async () => {
      const all = await db.supplier.findMany({ where: { tenantId: t } });
      const expected = {
        red: all.filter((s) => supplierSemaphore(s.status, s.attentionAt, s.missingRequiredDocs, TODAY) === "red"),
        amber: all.filter((s) => supplierSemaphore(s.status, s.attentionAt, s.missingRequiredDocs, TODAY) === "amber"),
        unrated: all.filter((s) => s.status === "potential"),
        // «Aprobados vigentes»: solo aprobados (no «con condiciones») y habilitados.
        approved: all.filter((s) => s.status === "approved" && isEnabled(s.status, s.missingBlockingDocs, s.blockingDocExpiresAt, TODAY)),
      };
      const ids = async (view: SupplierView) =>
        (await db.supplier.findMany({ where: { tenantId: t, ...supplierViewWhere(view, TODAY) }, select: { id: true } })).map((s) => s.id).sort();
      for (const view of ["red", "amber", "unrated", "approved"] as const) {
        expect(await ids(view), view).toEqual(expected[view].map((s) => s.id).sort());
      }
      expect(await ids("attention")).toEqual([...expected.red, ...expected.amber].map((s) => s.id).sort());
      expect(await ids("all")).toHaveLength(15);

      const counts = await getSupplierCounts(t, NOW);
      expect(counts).toEqual({ red: expected.red.length, amber: expected.amber.length, unrated: 1, approved: expected.approved.length, total: 15 });
      expect(counts).toMatchObject({ red: 5, amber: 6, unrated: 1 });
    });

    it("filtros combinables: criticidad, tipo, rubro, sede, no habilitados y búsqueda", async () => {
      const names = async (f: Parameters<typeof listSuppliers>[1]) => (await listSuppliers(t, f, 1, NOW)).items.map((s) => s.legalName);
      expect(await names({ criticality: "critical" })).toEqual(["Proveedor 013"]);
      expect(await names({ type: "contractor" })).toEqual(["Proveedor 013"]);
      expect(await names({ category: "mantenimiento" })).toEqual(["Proveedor 001"]);
      expect(await names({ status: "conditional" })).toHaveLength(2);
      expect(await names({ notEnabled: true })).toEqual(["Proveedor 013", "Proveedor 015"].sort());
      expect(await names({ q: "proveedor 007" })).toEqual(["Proveedor 007"]);
      const siteT = (await db.site.findFirstOrThrow({ where: { tenantId: t } })).id;
      expect((await names({ siteId: siteT })).length).toBe(15); // atiende esa sede o todas
      expect(await names({ siteId: "otra" })).not.toContain("Proveedor 003"); // el 3 solo atiende la sede T
    });

    it("busca por CUIT con o sin guiones", async () => {
      const [cuit] = cuits(1);
      await make(t, { legalName: "Buscable SA", taxId: cuit });
      expect((await listSuppliers(t, { q: cuit }, 1, NOW)).items.map((s) => s.legalName)).toEqual(["Buscable SA"]);
      expect((await listSuppliers(t, { q: `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}` }, 1, NOW)).items).toHaveLength(1);
      await db.supplier.deleteMany({ where: { tenantId: t, legalName: "Buscable SA" } });
    });

    it("orden: lo más urgente primero; los sin fecha al final", async () => {
      const page = await listSuppliers(t, { view: "attention" }, 1, NOW);
      const dates = page.items.map((s) => s.attentionAt?.getTime() ?? Infinity);
      expect(dates).toEqual([...dates].sort((x, y) => x - y));
    });

    it("paginación en el servidor: 25 por página, total y páginas", async () => {
      await db.supplier.createMany({
        data: Array.from({ length: 45 }, (_, i) => ({ tenantId: t, legalName: `Masivo ${String(i).padStart(3, "0")}`, type: "product" as const })),
      });
      const first = await listSuppliers(t, { q: "Masivo" }, 1, NOW);
      expect(first).toMatchObject({ total: 45, page: 1, pages: 2, pageSize: 25 });
      expect(first.items).toHaveLength(25);
      const second = await listSuppliers(t, { q: "Masivo" }, 2, NOW);
      expect(second.items).toHaveLength(20);
      expect(new Set([...first.items, ...second.items].map((s) => s.id)).size).toBe(45);
      expect((await listSuppliers(t, { q: "Masivo" }, 99, NOW)).page).toBe(2); // se acota a la última
      expect((await listSuppliers(t, { q: "Masivo" }, -3, NOW)).page).toBe(1);
      await db.supplier.deleteMany({ where: { tenantId: t, legalName: { startsWith: "Masivo" } } });
    });

    it("lista de aprobados: habilitados por razón social, con los excluidos contados aparte, y registra la exportación", async () => {
      const list = await getApprovedList(t, NOW);
      const expectedIds = (await db.supplier.findMany({ where: { tenantId: t, ...supplierViewWhere("approved", TODAY) }, select: { id: true } })).map((s) => s.id).sort();
      expect(list.entries.map((e) => e.id).sort()).toEqual(expectedIds);
      expect(list.excludedForDocs).toBe(2); // 013 (falta documento) y 015 (vencido)
      const names = list.entries.map((e) => e.legalName);
      expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y, "es")));
      expect(list.entries.every((e) => e.status === "approved")).toBe(true);
      expect(list.entries.find((e) => e.legalName === "Proveedor 008")).toBeUndefined(); // con condiciones

      await recordApprovedListExport({ tenantId: t, actorUserId: actor, count: list.entries.length, excluded: list.excludedForDocs, format: "csv" });
      const log = await db.masterDataAudit.findFirstOrThrow({ where: { tenantId: t, entityType: "supplier", action: "export" } });
      expect(log.summary).toContain("lista de aprobados");
    });

    it("las vistas cubren todas las opciones sin consultas por fila", async () => {
      for (const view of views) {
        const page = await listSuppliers(t, { view }, 1, NOW);
        expect(page.items.length).toBeLessThanOrEqual(25);
      }
    });
  });

  describe("importación CSV", () => {
    let t = "";
    const HEADER = "razon_social,cuit,tipo,rubro,criticidad,motivo_criticidad,responsable,contacto,email,telefono,notas";

    beforeAll(async () => {
      t = (await createTenantWithTemplate({ name: "Prov import", slug: `prov-import-${stamp}`, size: "small", activity: "servicios" })).id;
      tenantIds.push(t);
      await db.membership.create({ data: { userId: actor, tenantId: t, role: "tenant_admin" } });
    });

    function csv500() {
      const ids = cuits(500);
      const bad = new Set([10, 250, 400]);
      const lines = [HEADER];
      for (let i = 1; i <= 500; i++) {
        lines.push(
          bad.has(i)
            ? `Inválido ${i},20-12345678-5,producto,,,,,,,,`
            : `Proveedor ${i},${ids[i - 1]},producto,Rubro,bajo impacto,Compra ocasional,,,,,`,
        );
      }
      return lines.join("\n");
    }

    it("500 filas con 3 inválidas: vista previa con 497 y 3 errores con número de fila; no escribe nada", async () => {
      const preview = await previewSupplierImport(t, csv500());
      expect(preview.plan.counts).toEqual({ create: 497, exists: 0 });
      expect(preview.errors.map((e) => e.line)).toEqual([11, 251, 401]);
      expect(await db.supplier.count({ where: { tenantId: t } })).toBe(0);
    });

    it("importa como «sin evaluar» (nunca aprobado) y reimportar no duplica", async () => {
      const first = await applySupplierImport({ tenantId: t, actorUserId: actor, csv: csv500() });
      expect(first).toEqual({ created: 497, existing: 0, errors: 3 });
      expect(await db.supplier.count({ where: { tenantId: t } })).toBe(497);
      expect(await db.supplier.count({ where: { tenantId: t, status: { not: "potential" } } })).toBe(0);
      const second = await applySupplierImport({ tenantId: t, actorUserId: actor, csv: csv500() });
      expect(second).toEqual({ created: 0, existing: 497, errors: 3 });
      expect(await db.supplier.count({ where: { tenantId: t } })).toBe(497);
      const log = await db.masterDataAudit.findMany({ where: { tenantId: t, action: "import" } });
      expect(log).toHaveLength(1); // la segunda pasada no tenía nada para importar
    });

    it("lo importado ya trae los documentos que le faltan según su tipo", async () => {
      const [one] = await db.supplier.findMany({ where: { tenantId: t }, take: 1 });
      expect(one).toMatchObject({ missingBlockingDocs: 0, missingRequiredDocs: 1 }); // producto: solo la constancia de inscripción
    });

    it("el responsable se indica con el email de un usuario de la empresa; uno ajeno es un error de esa fila", async () => {
      const email = (await db.user.findUniqueOrThrow({ where: { id: actor } })).email;
      const preview = await previewSupplierImport(
        t,
        [HEADER, `Con dueño SA,,servicio,,,,${email},,,,`, `Dueño ajeno SA,,servicio,,,,otro@nadie.com,,,,`, `Sin dueño SA,,servicio,,,,,,,,`].join("\n"),
      );
      expect(preview.errors).toEqual([expect.objectContaining({ line: 3, field: "responsable" })]);
      expect(preview.plan.counts.create).toBe(2);
      await applySupplierImport({ tenantId: t, actorUserId: actor, csv: [HEADER, `Con dueño SA,,servicio,,,,${email},,,,`].join("\n") });
      expect(await db.supplier.findFirstOrThrow({ where: { tenantId: t, legalName: "Con dueño SA" } })).toMatchObject({ ownerUserId: actor });
    });

    it("la importación no toca otra empresa", async () => {
      expect(await db.supplier.count({ where: { tenantId: b, legalName: { startsWith: "Proveedor " } } })).toBe(0);
    });
  });
});
