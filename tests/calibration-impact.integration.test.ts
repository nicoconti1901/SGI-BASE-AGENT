import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createPerson, createSite } from "@/lib/masterdata";
import { InspectionError } from "@/lib/inspection-support";
import { checkInstrumentForUse, createInstrument, getInstrument, recomputeInstrumentControl, requireUsableInstrument, searchInstruments } from "@/lib/instruments";
import { closeCalibrationRecord, saveCalibrationDraft, sendInstrumentToCalibration, uploadCalibrationCertificate, voidCalibrationRecord, type RecordDraftInput } from "@/lib/calibration-records";
import { completeImpactAssessment, listCompletedAssessments } from "@/lib/impact-assessments";
import { addDays, addMonths, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { MemoryObjectStorage } from "@/lib/storage/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TODAY = todayIso();

const channel = { key: "h2s", label: "H₂S", unit: "ppm", rangeMin: 0, rangeMax: 100, emp: { abs: 0, pctReading: 10, pctFullScale: 0 }, active: true };
const control = (over: Record<string, unknown> = {}) => ({ magnitude: "gas_concentration", requiresCalibration: true, calibrationIntervalMonths: 6, channels: [channel], ...over });
const apt = [{ channelKey: "h2s", nominal: "50", measured: "50.5", uncertainty: "0.5" }];
const outOfTolerance = [{ channelKey: "h2s", nominal: "50", measured: "58", uncertainty: "0.5" }];

describe.skipIf(!hasDatabase)("vencimientos y evaluación de impacto (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let member = "";
  let siteA = "";
  let position = "";
  let seq = 0;
  /** Los vencimientos valen hasta las 23:59 de Argentina: se comparan en fecha local, no en UTC. */
  const localDay = (d: Date) => todayIso(d);

  const make = (over: Record<string, unknown> = {}, tenantId = a) =>
    createInstrument({ tenantId, actorUserId: actor, code: `i-${++seq}`, description: "Detector de gases", siteId: siteA, control: control(), ...over }, db);

  const input = (assetId: string, over: Partial<RecordDraftInput> = {}): RecordDraftInput => ({
    tenantId: a,
    actorUserId: actor,
    assetId,
    kind: "calibration",
    performedAt: addDays(TODAY, -3),
    labName: "INTI",
    traceability: "nmi",
    adjusted: false,
    basis: "points",
    asFoundPoints: apt,
    asLeftPoints: [],
    ...over,
  });

  /** Carga y cierra una calibración, como lo haría la pantalla. */
  const load = async (assetId: string, over: Partial<RecordDraftInput> = {}) => {
    const { id } = await saveCalibrationDraft(input(assetId, over), db);
    await uploadCalibrationCertificate({ tenantId: a, recordId: id, fileName: "c.pdf", contentType: "application/pdf", body: Buffer.from("%PDF"), uploadedById: actor }, { db, storage });
    await closeCalibrationRecord({ tenantId: a, actorUserId: actor, recordId: id }, db);
    return id;
  };
  const openDues = (tenantId: string, entityType: string, entityId: string) => db.dueItem.findMany({ where: { tenantId, entityType, entityId, status: "open" } });
  const pendingOf = (assetId: string) => db.impactAssessment.findFirst({ where: { assetId, status: "pending" } });
  const complete = (assessmentId: string, over: Partial<Parameters<typeof completeImpactAssessment>[0]> = {}) =>
    completeImpactAssessment(
      { tenantId: a, actorUserId: actor, assessmentId, outcome: "no_affected_results", affectedSummary: "Mediciones de atmósfera de la cuadrilla norte", rationale: "Se repitieron las mediciones y coinciden", registerFinding: false, actions: [], ...over },
      db,
    );

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Imp ${label}`, slug: `imp-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actor = (await db.user.create({ data: { name: "Imp Admin", email: `imp-${stamp}@test.dev`, emailVerified: true } })).id;
    member = (await db.user.create({ data: { name: "Imp Miembro", email: `imp-m-${stamp}@test.dev`, emailVerified: true } })).id;
    await db.membership.create({ data: { userId: member, tenantId: a, role: "contributor" } });
    siteA = (await createSite({ tenantId: a, actorUserId: actor, name: "Base Neuquén" })).id;
    position = (await createJobPosition({ tenantId: a, actorUserId: actor, name: "Técnico" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [actor, member] } } });
    await db.$disconnect();
  });

  describe("vencimientos (DueItem)", () => {
    it("al cerrar un registro apto queda un vencimiento abierto con el aviso, la sede y el responsable", async () => {
      const person = await createPerson({ tenantId: a, actorUserId: actor, employeeCode: `E${stamp}`, name: "Responsable", siteId: siteA, positionId: position, userId: member }, db);
      const asset = await make({ assignedPersonId: person.id, control: control({ alertLeadDays: 45 }) });
      await load(asset.id);
      const dues = await openDues(a, "instrument_calibration", asset.id);
      expect(dues).toHaveLength(1);
      expect(dues[0]).toMatchObject({ leadDays: 45, siteId: siteA, personId: person.id, ownerUserId: member });
      expect(dues[0].title).toContain(asset.code);
      expect(localDay(dues[0].dueAt)).toBe(addMonths(addDays(TODAY, -3), 6));
    });

    it("una nueva calibración apta reemplaza el vencimiento anterior; recalcular dos veces no duplica", async () => {
      const asset = await make();
      await load(asset.id, { performedAt: addDays(TODAY, -60) });
      await load(asset.id, { performedAt: addDays(TODAY, -3) });
      await recomputeInstrumentControl(a, asset.id, db);
      await recomputeInstrumentControl(a, asset.id, db);
      const open = await openDues(a, "instrument_calibration", asset.id);
      expect(open).toHaveLength(1);
      expect(localDay(open[0].dueAt)).toBe(addMonths(addDays(TODAY, -3), 6));
    });

    it("la verificación tiene su propio vencimiento", async () => {
      const asset = await make({ control: control({ requiresVerification: true, verificationIntervalMonths: 1 }) });
      await load(asset.id);
      await load(asset.id, { kind: "verification", traceability: "other_lab", traceabilityBasis: "Patrón propio", labName: "Calidad" });
      expect(await openDues(a, "instrument_calibration", asset.id)).toHaveLength(1);
      const verification = await openDues(a, "instrument_verification", asset.id);
      expect(verification).toHaveLength(1);
      expect(localDay(verification[0].dueAt)).toBe(addMonths(addDays(TODAY, -3), 1));
    });

    it("anular el registro vigente cierra el vencimiento; el registro anterior vuelve a regir y su vencimiento reaparece", async () => {
      const asset = await make();
      await load(asset.id, { performedAt: addDays(TODAY, -60) });
      const second = await load(asset.id, { performedAt: addDays(TODAY, -3) });
      await voidCalibrationRecord({ tenantId: a, actorUserId: actor, recordId: second, reason: "Fecha mal cargada" }, db);
      const open = await openDues(a, "instrument_calibration", asset.id);
      expect(open).toHaveLength(1);
      expect(localDay(open[0].dueAt)).toBe(addMonths(addDays(TODAY, -60), 6));
    });

    it("un resultado no apto cierra el vencimiento y un equipo dado de baja deja de vencer", async () => {
      const notApt = await make();
      await load(notApt.id, { performedAt: addDays(TODAY, -60) });
      expect(await openDues(a, "instrument_calibration", notApt.id)).toHaveLength(1);
      await load(notApt.id, { asFoundPoints: outOfTolerance });
      expect(await openDues(a, "instrument_calibration", notApt.id)).toHaveLength(0);

      const retired = await make();
      await load(retired.id);
      await db.asset.update({ where: { id: retired.id }, data: { status: "retired", retiredAt: new Date(), retirementReason: "Baja de prueba" } });
      await recomputeInstrumentControl(a, retired.id, db);
      expect(await openDues(a, "instrument_calibration", retired.id)).toHaveLength(0);
    });

    it("sin calibración inicial no hay nada que vencer", async () => {
      const asset = await make();
      await recomputeInstrumentControl(a, asset.id, db);
      expect(await openDues(a, "instrument_calibration", asset.id)).toHaveLength(0);
    });
  });

  describe("evaluación de impacto", () => {
    it("un as-found fuera de tolerancia abre la evaluación con la ventana desde el último registro apto y bloquea el equipo", async () => {
      const asset = await make();
      await load(asset.id, { performedAt: addDays(TODAY, -90) });
      const bad = await load(asset.id, { performedAt: addDays(TODAY, -3), adjusted: true, asFoundPoints: outOfTolerance, asLeftPoints: apt });
      const assessment = await pendingOf(asset.id);
      expect(assessment).toMatchObject({ trigger: "as_found_not_apt", triggerRecordId: bad, status: "pending" });
      expect(isoFromDate(assessment!.windowFrom!)).toBe(addDays(TODAY, -90));
      expect(isoFromDate(assessment!.windowTo)).toBe(addDays(TODAY, -3));

      // El as-left es apto, pero el equipo no vuelve a servir hasta completar la evaluación.
      const detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.control.impactPending).toBe(true);
      expect(detail?.view.status).toBe("impact_pending");
      expect(detail?.view.usability).toMatchObject({ usable: false, action: "Completar la evaluación de impacto" });
      const due = await openDues(a, "instrument_impact", assessment!.id);
      expect(due).toHaveLength(1);
      expect(localDay(due[0].dueAt)).toBe(addDays(localDay(assessment!.createdAt), 10));
    });

    it("sin registros aptos anteriores la ventana es «desde que se empezó a usar»", async () => {
      const asset = await make();
      await load(asset.id, { asFoundPoints: outOfTolerance });
      expect((await pendingOf(asset.id))?.windowFrom).toBeNull();
    });

    it("un ajuste sin as-found abre la evaluación solo en un equipo de uso crítico", async () => {
      const critical = await make({ control: control({ criticalUse: true, criticalUseReason: "Espacios confinados" }) });
      await load(critical.id, { adjusted: true, asFoundPoints: [], asLeftPoints: apt });
      expect(await pendingOf(critical.id)).toMatchObject({ trigger: "adjusted_without_as_found" });

      const common = await make();
      await load(common.id, { adjusted: true, asFoundPoints: [], asLeftPoints: apt });
      expect(await pendingOf(common.id)).toBeNull();
      expect((await getInstrument(a, common.id, {}, db, TODAY))?.view.status).toBe("valid");
    });

    it("un registro apto no abre evaluación", async () => {
      const asset = await make();
      await load(asset.id);
      expect(await db.impactAssessment.count({ where: { assetId: asset.id } })).toBe(0);
    });

    it("sin afectación: con la justificación alcanza, el equipo vuelve a «vigente» y se cierra el vencimiento", async () => {
      const asset = await make();
      await load(asset.id, { adjusted: true, asFoundPoints: outOfTolerance, asLeftPoints: apt });
      const assessment = (await pendingOf(asset.id))!;
      const result = await complete(assessment.id);
      expect(result).toMatchObject({ findingId: null, actionIds: [] });
      const detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.control.impactPending).toBe(false);
      expect(detail?.view.status).toBe("valid");
      expect(await openDues(a, "instrument_impact", assessment.id)).toHaveLength(0);
      expect(await db.impactAssessment.findUnique({ where: { id: assessment.id } })).toMatchObject({ status: "completed", outcome: "no_affected_results", completedByUserId: actor });
    });

    it("si el último resultado es no apto, completar la evaluación no habilita el equipo", async () => {
      const asset = await make();
      await load(asset.id, { asFoundPoints: outOfTolerance });
      await complete((await pendingOf(asset.id))!.id);
      expect((await getInstrument(a, asset.id, {}, db, TODAY))?.view.status).toBe("not_apt");
    });

    it("con mediciones afectadas crea el hallazgo en borrador (origen calibración) y las acciones vinculadas", async () => {
      const asset = await make({ control: control({ criticalUse: true, criticalUseReason: "Espacios confinados" }) });
      await load(asset.id, { adjusted: true, asFoundPoints: outOfTolerance, asLeftPoints: apt });
      const assessment = (await pendingOf(asset.id))!;
      const result = await complete(assessment.id, {
        outcome: "affected_results_actioned",
        actions: [{ title: "Repetir las mediciones de espacios confinados", ownerUserId: member, dueAt: addDays(TODAY, 15) }],
      });
      expect(result.findingId).not.toBeNull();
      const finding = await db.finding.findUnique({ where: { id: result.findingId! }, include: { impactAssessment: true } });
      expect(finding).toMatchObject({ status: "draft", type: "nonconformity", origin: "calibration", severity: "Crítica", location: "Base Neuquén", source: `Equipo ${asset.code}`, tenantId: a });
      expect(finding?.impactAssessment?.id).toBe(assessment.id);
      expect(finding?.description).toContain("Mediciones de atmósfera");

      const action = await db.action.findUnique({ where: { id: result.actionIds[0] }, include: { links: true, impactLinks: true } });
      expect(action).toMatchObject({ ownerUserId: member, tenantId: a });
      expect(action?.links).toMatchObject([{ targetType: "finding", targetId: result.findingId }]);
      expect(action?.impactLinks).toHaveLength(1);
      expect(await openDues(a, "operational_action", action!.id)).toHaveLength(1);

      const [done] = await listCompletedAssessments(a, asset.id, db);
      expect(done.finding?.id).toBe(result.findingId);
      expect(done.actions).toHaveLength(1);
    });

    it("«no se puede determinar» exige al menos una acción o un hallazgo; con el hallazgo opcional alcanza", async () => {
      const asset = await make();
      await load(asset.id, { asFoundPoints: outOfTolerance });
      const id = (await pendingOf(asset.id))!.id;
      await expect(complete(id, { outcome: "cannot_determine" })).rejects.toThrow("al menos una acción o un hallazgo");
      const result = await complete(id, { outcome: "cannot_determine", registerFinding: true });
      expect(result.findingId).not.toBeNull();
    });

    it("valida la decisión, la justificación, las acciones y que los responsables sean de la empresa", async () => {
      const asset = await make();
      await load(asset.id, { asFoundPoints: outOfTolerance });
      const id = (await pendingOf(asset.id))!.id;
      await expect(complete(id, { outcome: "otra" })).rejects.toThrow("Elegí qué se concluyó");
      await expect(complete(id, { rationale: "corta" })).rejects.toThrow("Justificá");
      await expect(complete(id, { affectedSummary: "" })).rejects.toThrow("qué se midió");
      await expect(complete(id, { actions: [{ title: "Hacer algo", ownerUserId: member, dueAt: null }] })).rejects.toThrow("fecha límite");
      await expect(complete(id, { actions: [{ title: "Hacer algo", ownerUserId: "", dueAt: addDays(TODAY, 5) }] })).rejects.toThrow("responsable");
      await expect(complete(id, { actions: [{ title: "Hacer algo", ownerUserId: "desconocido", dueAt: addDays(TODAY, 5) }] })).rejects.toThrow("no pertenece");
      expect(await db.impactAssessment.findUnique({ where: { id } })).toMatchObject({ status: "pending" });
      expect(await db.finding.count({ where: { tenantId: a, source: `Equipo ${asset.code}` } })).toBe(0);
    });

    it("no se completa dos veces", async () => {
      const asset = await make();
      await load(asset.id, { asFoundPoints: outOfTolerance });
      const id = (await pendingOf(asset.id))!.id;
      await complete(id);
      await expect(complete(id)).rejects.toThrow("ya está completada");
    });

    it("anular el registro que la abrió quita la evaluación pendiente y su vencimiento; una completada queda de constancia", async () => {
      const asset = await make();
      const bad = await load(asset.id, { asFoundPoints: outOfTolerance });
      const assessment = (await pendingOf(asset.id))!;
      await voidCalibrationRecord({ tenantId: a, actorUserId: actor, recordId: bad, reason: "Equipo equivocado" }, db);
      expect(await db.impactAssessment.count({ where: { assetId: asset.id } })).toBe(0);
      expect(await openDues(a, "instrument_impact", assessment.id)).toHaveLength(0);
      expect((await getInstrument(a, asset.id, {}, db, TODAY))?.control.impactPending).toBe(false);

      const kept = await make();
      const other = await load(kept.id, { asFoundPoints: outOfTolerance });
      await complete((await pendingOf(kept.id))!.id);
      await voidCalibrationRecord({ tenantId: a, actorUserId: actor, recordId: other, reason: "Se anula después de evaluar" }, db);
      const [done] = await listCompletedAssessments(a, kept.id, db);
      expect(done).toMatchObject({ status: "completed", triggerRecordId: other });
      expect((await db.calibrationRecord.findUnique({ where: { id: other } }))?.status).toBe("voided");
    });

    it("si el equipo se da de baja, la evaluación sigue pendiente y su vencimiento también", async () => {
      const asset = await make();
      await load(asset.id, { asFoundPoints: outOfTolerance });
      const assessment = (await pendingOf(asset.id))!;
      await db.asset.update({ where: { id: asset.id }, data: { status: "retired", retiredAt: new Date(), retirementReason: "Baja de prueba" } });
      await recomputeInstrumentControl(a, asset.id, db);
      expect(await pendingOf(asset.id)).not.toBeNull();
      expect(await openDues(a, "instrument_impact", assessment.id)).toHaveLength(1);
    });
  });

  describe("bloqueo en los módulos que usan el equipo", () => {
    it("el selector muestra deshabilitado el equipo con evaluación pendiente y el servidor rechaza usarlo", async () => {
      const asset = await make();
      await load(asset.id, { adjusted: true, asFoundPoints: outOfTolerance, asLeftPoints: apt });
      const found = (await searchInstruments(a, { q: asset.code }, db, TODAY)).find((i) => i.id === asset.id);
      expect(found?.usability).toMatchObject({ usable: false, reason: "Falta la evaluación de impacto de la última calibración" });
      await expect(requireUsableInstrument(a, asset.id, {}, db, TODAY)).rejects.toThrow("No se puede usar el equipo");
      await complete((await pendingOf(asset.id))!.id);
      await expect(requireUsableInstrument(a, asset.id, {}, db, TODAY)).resolves.toBeUndefined();
    });

    it("un equipo en el laboratorio o vencido se rechaza con el motivo; una medición con fecha pasada se juzga por esa fecha", async () => {
      const asset = await make();
      await load(asset.id, { performedAt: addMonths(TODAY, -8) }); // vigente hasta hace ~2 meses
      await expect(requireUsableInstrument(a, asset.id, {}, db, TODAY)).rejects.toBeInstanceOf(InspectionError);
      expect(await checkInstrumentForUse(a, asset.id, { onDate: addMonths(TODAY, -5) }, db, TODAY)).toMatchObject({ usable: true });
      expect(await checkInstrumentForUse(a, asset.id, { onDate: addMonths(TODAY, -9) }, db, TODAY)).toMatchObject({ usable: false });

      const fresh = await make();
      await load(fresh.id);
      await sendInstrumentToCalibration({ tenantId: a, actorUserId: actor, assetId: fresh.id, sentAt: TODAY }, db);
      await expect(requireUsableInstrument(a, fresh.id, {}, db, TODAY)).rejects.toThrow("En calibración");
    });
  });

  describe("aislamiento entre empresas", () => {
    it("la empresa B no completa ni ve las evaluaciones de A", async () => {
      const asset = await make();
      await load(asset.id, { asFoundPoints: outOfTolerance });
      const id = (await pendingOf(asset.id))!.id;
      await expect(completeImpactAssessment({ tenantId: b, actorUserId: actor, assessmentId: id, outcome: "no_affected_results", affectedSummary: "algo medido", rationale: "justificación larga", registerFinding: false, actions: [] }, db)).rejects.toThrow("Evaluación no encontrada");
      expect(await listCompletedAssessments(b, asset.id, db)).toEqual([]);
      expect(await db.impactAssessment.findUnique({ where: { id } })).toMatchObject({ status: "pending" });
    });

    it("los vencimientos de un equipo quedan en su empresa", async () => {
      const asset = await make();
      await load(asset.id);
      const due = await db.dueItem.findFirst({ where: { entityType: "instrument_calibration", entityId: asset.id } });
      expect(due?.tenantId).toBe(a);
      expect(await openDues(b, "instrument_calibration", asset.id)).toHaveLength(0);
    });
  });
});
