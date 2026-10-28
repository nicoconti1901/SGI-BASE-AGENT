import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { createAsset } from "@/lib/assets";
import { createInstrument, getInstrument, planCompliance, recomputeInstrumentControl, upcomingInstrumentDues } from "@/lib/instruments";
import { closeCalibrationRecord, saveCalibrationDraft, uploadCalibrationCertificate, type RecordDraftInput } from "@/lib/calibration-records";
import { lastFunctionalCheck } from "@/lib/functional-check";
import { addInspectionPhoto, closeInspection, correctInspectionAnswer, getInspectionView, saveAnswer, startInspection } from "@/lib/inspections";
import { InspectionError } from "@/lib/inspection-support";
import { addDays, addMonths, diffDays, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { DEFAULT_TEMPLATES } from "@/domain/inspections/templates";
import { getAssetType, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { FUNCTIONAL_CHECK_TEMPLATE_KEY } from "@/domain/calibration/types";
import { MemoryObjectStorage } from "@/lib/storage/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TODAY = todayIso();

const channel = { key: "h2s", label: "H₂S", unit: "ppm", rangeMin: 0, rangeMax: 100, emp: { abs: 0, pctReading: 10, pctFullScale: 0 }, active: true };
const control = (over: Record<string, unknown> = {}) => ({ magnitude: "gas_concentration", requiresCalibration: true, calibrationIntervalMonths: 6, channels: [channel], ...over });
const apt = [{ channelKey: "h2s", nominal: "50", measured: "50.5", uncertainty: "0.5" }];

describe("prueba funcional: plantilla y tipo de activo", () => {
  it("la plantilla precargada es del equipo de medición, sin vencimientos, y puede devolver el equipo a servicio", () => {
    const t = DEFAULT_TEMPLATES.find((x) => x.key === FUNCTIONAL_CHECK_TEMPLATE_KEY)!;
    expect(t).toMatchObject({ scope: "asset", assetTypeKey: "measuring_equipment", intervalUnit: null, canReinstate: true, retireOnUnfit: false, findingOnCritical: false });
    expect(t.items.some((i) => i.criticality === "critical")).toBe(true);
  });

  it("el motor resuelve el tipo del equipo, pero Activos no puede crearlo ni importarlo", () => {
    expect(getAssetType("measuring_equipment")).toMatchObject({ label: "Equipo de medición", periodicTemplateKey: FUNCTIONAL_CHECK_TEMPLATE_KEY });
    expect(isAssetTypeKey("measuring_equipment")).toBe(false);
  });
});

describe.skipIf(!hasDatabase)("prueba funcional y tablero (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let siteA = "";
  let siteA2 = "";
  let seq = 0;

  const make = (over: Record<string, unknown> = {}, siteId = siteA, tenantId = a) =>
    createInstrument({ tenantId, actorUserId: actor, code: `f-${++seq}`, description: "Detector de gases", siteId, control: control(), ...over }, db);

  const load = async (assetId: string, over: Partial<RecordDraftInput> = {}) => {
    const { id } = await saveCalibrationDraft(
      { tenantId: a, actorUserId: actor, assetId, kind: "calibration", performedAt: addDays(TODAY, -3), labName: "INTI", traceability: "nmi", adjusted: false, basis: "points", asFoundPoints: apt, asLeftPoints: [], ...over },
      db,
    );
    await uploadCalibrationCertificate({ tenantId: a, recordId: id, fileName: "c.pdf", contentType: "application/pdf", body: Buffer.from("%PDF"), uploadedById: actor }, { db, storage });
    await closeCalibrationRecord({ tenantId: a, actorUserId: actor, recordId: id }, db);
    return id;
  };

  /** Hace y cierra una prueba funcional; `failing` marca como no conformes esos ítems. */
  async function functionalCheck(assetId: string, failing: string[] = [], canRelease = false) {
    const { id } = await startInspection({ tenantId: a, actorUserId: actor, assetId }, db);
    const view = (await getInspectionView(a, id))!;
    for (const row of view.items) {
      const bad = failing.includes(row.item.code);
      await saveAnswer({ tenantId: a, actorUserId: actor, canEditOthers: false, inspectionId: id, itemId: row.item.id, patch: { value: bad ? "nonconform" : "conform", ...(bad ? { comment: "No respondió al gas de prueba" } : {}) } }, db);
      if (bad) await addInspectionPhoto({ tenantId: a, actorUserId: actor, canEditOthers: false, inspectionId: id, itemId: row.item.id, fileName: "foto.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage }, db);
    }
    await closeInspection({ tenantId: a, actorUserId: actor, canEditOthers: canRelease, inspectionId: id }, db);
    return id;
  }
  const pendingOf = (assetId: string) => db.impactAssessment.findFirst({ where: { assetId, status: "pending" } });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Fun ${label}`, slug: `fun-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actor = (await db.user.create({ data: { name: "Fun Admin", email: `fun-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: actor, name: "Base Neuquén" })).id;
    siteA2 = (await createSite({ tenantId: a, actorUserId: actor, name: "Obrador 1" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.$disconnect();
  });

  describe("prueba funcional", () => {
    it("una prueba apta no cambia el estado del equipo ni extiende su vigencia, y no genera vencimientos", async () => {
      const asset = await make();
      await load(asset.id);
      const before = (await getInstrument(a, asset.id, {}, db, TODAY))!;
      await functionalCheck(asset.id);
      const after = (await getInstrument(a, asset.id, {}, db, TODAY))!;
      expect(after.view.status).toBe("valid");
      expect(after.control.calibrationValidUntil).toEqual(before.control.calibrationValidUntil);
      expect(await db.impactAssessment.count({ where: { assetId: asset.id } })).toBe(0);
      expect(await db.dueItem.count({ where: { tenantId: a, entityType: "inspection_plan" } })).toBe(0);
      expect(await lastFunctionalCheck(a, asset.id, db)).toMatchObject({ inspectedAt: TODAY, result: "fit" });
    });

    it("una prueba no apta saca el equipo de servicio y abre la evaluación con la ventana desde la última comprobación apta", async () => {
      const asset = await make();
      await load(asset.id, { performedAt: addDays(TODAY, -40) });
      const good = await functionalCheck(asset.id);
      expect(good).toBeTruthy();
      await db.inspection.update({ where: { id: good }, data: { inspectedAt: new Date(`${addDays(TODAY, -6)}T00:00:00.000Z`) } });

      await functionalCheck(asset.id, ["response"]);
      const assessment = await pendingOf(asset.id);
      expect(assessment).toMatchObject({ trigger: "functional_check_failed", triggerRecordId: null, status: "pending" });
      expect(isoFromDate(assessment!.windowFrom!)).toBe(addDays(TODAY, -6));
      expect(isoFromDate(assessment!.windowTo)).toBe(TODAY);

      const detail = (await getInstrument(a, asset.id, {}, db, TODAY))!;
      expect(detail.asset.status).toBe("out_of_service");
      expect(detail.control.impactPending).toBe(true);
      expect(detail.view.status).toBe("impact_pending");
      expect(detail.view.usability).toMatchObject({ usable: false });
      expect(await db.dueItem.count({ where: { tenantId: a, entityType: "instrument_impact", entityId: assessment!.id, status: "open" } })).toBe(1);
    });

    it("la ventana arranca en la última calibración apta si no hubo pruebas buenas", async () => {
      const asset = await make();
      await load(asset.id, { performedAt: addDays(TODAY, -20) });
      await functionalCheck(asset.id, ["selftest"]);
      expect(isoFromDate((await pendingOf(asset.id))!.windowFrom!)).toBe(addDays(TODAY, -20));
    });

    it("una segunda falla no abre otra evaluación: la pendiente sigue y el equipo sigue sin poder usarse", async () => {
      const asset = await make();
      await load(asset.id);
      await functionalCheck(asset.id, ["response"]);
      const first = await pendingOf(asset.id);
      await functionalCheck(asset.id, ["alarms"]);
      expect(await db.impactAssessment.count({ where: { assetId: asset.id } })).toBe(1);
      expect((await pendingOf(asset.id))!.id).toBe(first!.id);
    });

    it("volver a servicio: una prueba apta cerrada por un responsable libera el equipo, pero la evaluación de impacto sigue bloqueando", async () => {
      const asset = await make();
      await load(asset.id);
      await functionalCheck(asset.id, ["response"]);
      await functionalCheck(asset.id, [], true);
      const detail = (await getInstrument(a, asset.id, {}, db, TODAY))!;
      expect(detail.asset.status).toBe("in_service");
      expect(detail.view.status).toBe("impact_pending");
      await db.impactAssessment.updateMany({ where: { assetId: asset.id }, data: { status: "completed", outcome: "no_affected_results", rationale: "Sin efectos", completedAt: new Date() } });
      await recomputeInstrumentControl(a, asset.id, db);
      expect((await getInstrument(a, asset.id, {}, db, TODAY))!.view.status).toBe("valid");
    });

    it("sin permiso de liberar, una prueba apta no devuelve el equipo a servicio", async () => {
      const asset = await make();
      await load(asset.id);
      await functionalCheck(asset.id, ["response"]);
      await functionalCheck(asset.id, [], false);
      expect((await getInstrument(a, asset.id, {}, db, TODAY))!.asset.status).toBe("out_of_service");
    });

    it("corregir una prueba cerrada a «no apta» también abre la evaluación", async () => {
      const asset = await make();
      await load(asset.id);
      const id = await functionalCheck(asset.id);
      expect(await pendingOf(asset.id)).toBeNull();
      const view = (await getInspectionView(a, id))!;
      const answer = view.items.find((i) => i.item.code === "response")!.answer;
      await correctInspectionAnswer({ tenantId: a, actorUserId: actor, canRelease: true, inspectionId: id, answerId: answer.id, patch: { value: "nonconform" }, reason: "El equipo no respondió, se cargó mal" }, db);
      expect(await pendingOf(asset.id)).toMatchObject({ trigger: "functional_check_failed" });
    });

    it("un equipo dado de baja no admite la prueba funcional", async () => {
      const asset = await make();
      await db.asset.update({ where: { id: asset.id }, data: { status: "retired", retiredAt: new Date(), retirementReason: "Baja de prueba" } });
      await expect(startInspection({ tenantId: a, actorUserId: actor, assetId: asset.id }, db)).rejects.toBeInstanceOf(InspectionError);
    });

    it("la empresa B no puede empezar una prueba sobre un equipo de A", async () => {
      const asset = await make();
      await expect(startInspection({ tenantId: b, actorUserId: actor, assetId: asset.id }, db)).rejects.toThrow("Activo no encontrado");
    });

    it("las demás inspecciones no se ven afectadas: un extintor no abre evaluaciones", async () => {
      const ext = await createAsset({ tenantId: a, actorUserId: actor, typeKey: "extinguisher", code: `EX-${stamp % 100000}`, description: "Pasillo", siteId: siteA, attributes: { agent: "abc", capacityKg: 5, manufacturedAt: "2022-05-10" }, dueDates: [{ kind: "maintenance", lastDoneAt: "2026-03-31" }] }, db);
      const { id } = await startInspection({ tenantId: a, actorUserId: actor, assetId: ext.id }, db);
      expect(id).toBeTruthy();
      expect(await db.impactAssessment.count({ where: { tenantId: a, assetId: ext.id } })).toBe(0);
    });
  });

  describe("tablero", () => {
    it("el cumplimiento cuenta los equipos utilizables y las recalibraciones hechas antes del vencimiento", async () => {
      const t = await createTenantWithTemplate({ name: `Fun c`, slug: `fun-c-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
      const c = t.id;
      const site = (await createSite({ tenantId: c, actorUserId: actor, name: "Base" })).id;
      const mk = (code: string) => createInstrument({ tenantId: c, actorUserId: actor, code, description: "Equipo", siteId: site, control: control() }, db);
      const loadC = async (assetId: string, performedAt: string, points = apt) => {
        const { id } = await saveCalibrationDraft({ tenantId: c, actorUserId: actor, assetId, kind: "calibration", performedAt, labName: "INTI", traceability: "nmi", adjusted: false, basis: "points", asFoundPoints: points, asLeftPoints: [] }, db);
        await uploadCalibrationCertificate({ tenantId: c, recordId: id, fileName: "c.pdf", contentType: "application/pdf", body: Buffer.from("%PDF"), uploadedById: actor }, { db, storage });
        await closeCalibrationRecord({ tenantId: c, actorUserId: actor, recordId: id }, db);
      };
      // Vigente, con una recalibración a tiempo (la anterior, de hace 5 meses, vencía dentro de 1 mes).
      const ok = await mk("OK-1");
      await loadC(ok.id, addMonths(TODAY, -5));
      await loadC(ok.id, addDays(TODAY, -3));
      // Vencido, con una recalibración tardía.
      const late = await mk("LATE-1");
      await loadC(late.id, addMonths(TODAY, -18));
      await loadC(late.id, addMonths(TODAY, -9)); // la anterior venció hace ~3 meses
      // Sin calibración inicial y uno sin control.
      await mk("NEW-1");
      await createInstrument({ tenantId: c, actorUserId: actor, code: "IND-1", description: "Indicativo", siteId: site, control: { magnitude: "other", noControlReason: "Indicativo" } }, db);

      const result = await planCompliance(c, {}, db, TODAY);
      expect(result).toEqual({ controlled: 3, usable: 1, onTime: 1, renewals: 2 });
    });

    it("lista los que vencen en 30 días, el más próximo primero, y respeta la sede y el tenant", async () => {
      const soon = await make({ code: "SOON-1" }, siteA);
      await load(soon.id, { performedAt: addMonths(addDays(TODAY, 10), -6) }); // vence en 10 días
      const sooner = await make({ code: "SOON-2" }, siteA2);
      // vence en ~4 días; al restar 6 meses de un día 31 el calendario recorta (31/10 → 30/04 → 30/10),
      // así que el vencimiento real se calcula en vez de asumir exactamente 4
      const soonerPerformedAt = addMonths(addDays(TODAY, 4), -6);
      await load(sooner.id, { performedAt: soonerPerformedAt });
      const far = await make({ code: "FAR-1" }, siteA);
      await load(far.id); // vence en ~6 meses

      const all = await upcomingInstrumentDues(a, { days: 30, limit: 50 }, db, TODAY);
      const codes = all.items.map((i) => i.code);
      expect(codes.indexOf("SOON-2")).toBeLessThan(codes.indexOf("SOON-1"));
      expect(codes).not.toContain("FAR-1");
      expect(all.items.find((i) => i.code === "SOON-2")).toMatchObject({ siteName: "Obrador 1", daysLeft: diffDays(TODAY, addMonths(soonerPerformedAt, 6)) });

      const inSite = await upcomingInstrumentDues(a, { siteId: siteA2, limit: 50 }, db, TODAY);
      expect(inSite.items.map((i) => i.code)).toEqual(["SOON-2"]);
      expect((await upcomingInstrumentDues(b, { limit: 50 }, db, TODAY)).items).toEqual([]);
    });
  });
});
