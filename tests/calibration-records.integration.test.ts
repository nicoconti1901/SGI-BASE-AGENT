import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { InspectionError } from "@/lib/inspection-support";
import { createInstrument, getInstrument, readCalibrationAttachment } from "@/lib/instruments";
import {
  closeCalibrationRecord,
  discardCalibrationDraft,
  getCalibrationRecord,
  registerInstrumentReturn,
  removeCalibrationCertificate,
  saveCalibrationDraft,
  sendInstrumentToCalibration,
  uploadCalibrationCertificate,
  voidCalibrationRecord,
  type RecordDraftInput,
} from "@/lib/calibration-records";
import { addDays, addMonths, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { MemoryObjectStorage } from "@/lib/storage/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TODAY = todayIso();
const PERFORMED = addDays(TODAY, -3);

const channel = { key: "h2s", label: "H₂S", unit: "ppm", rangeMin: 0, rangeMax: 100, emp: { abs: 0, pctReading: 10, pctFullScale: 0 }, active: true };
const control = (over: Record<string, unknown> = {}) => ({
  magnitude: "gas_concentration",
  requiresCalibration: true,
  calibrationIntervalMonths: 6,
  channels: [channel],
  ...over,
});
const goodPoints = [
  { channelKey: "h2s", nominal: "10", measured: "10,5", uncertainty: "0,3" },
  { channelKey: "h2s", nominal: "25", measured: "27.2", uncertainty: "0.3" },
  { channelKey: "h2s", nominal: "50", measured: "53", uncertainty: "0.5" },
];

describe.skipIf(!hasDatabase)("carga de calibraciones (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let siteA = "";
  let siteB = "";
  let seq = 0;

  const make = (over: Record<string, unknown> = {}, tenantId = a, siteId = siteA) =>
    createInstrument({ tenantId, actorUserId: actor, code: `r-${++seq}`, description: "Detector de gases", siteId, control: control(), ...over });

  const draftInput = (assetId: string, over: Partial<RecordDraftInput> = {}): RecordDraftInput => ({
    tenantId: a,
    actorUserId: actor,
    assetId,
    kind: "calibration",
    performedAt: PERFORMED,
    labName: "INTI",
    traceability: "nmi",
    adjusted: false,
    basis: "points",
    asFoundPoints: goodPoints,
    asLeftPoints: [],
    ...over,
  });

  const upload = (recordId: string, tenantId = a) =>
    uploadCalibrationCertificate({ tenantId, recordId, fileName: "certificado 123.pdf", contentType: "application/pdf", body: Buffer.from("%PDF-1.4 demo"), uploadedById: actor }, { db, storage });

  /** Borrador completo con certificado, listo para cerrar. */
  const loaded = async (assetId: string, over: Partial<RecordDraftInput> = {}) => {
    const { id } = await saveCalibrationDraft(draftInput(assetId, over), db);
    await upload(id);
    return id;
  };
  const close = (recordId: string, tenantId = a) => closeCalibrationRecord({ tenantId, actorUserId: actor, recordId }, db);

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Reg ${label}`, slug: `reg-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actor = (await db.user.create({ data: { name: "Reg Admin", email: `reg-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: actor, name: "Base Neuquén" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: actor, name: "Base Neuquén" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.$disconnect();
  });

  describe("borrador", () => {
    it("guarda el borrador con los puntos en decimal y sin calcular nada", async () => {
      const asset = await make();
      const { id } = await saveCalibrationDraft(draftInput(asset.id), db);
      const record = await getCalibrationRecord(a, asset.id, id, db);
      expect(record).toMatchObject({ status: "draft", kind: "calibration", labName: "INTI", asLeftResult: null, validUntil: null });
      expect(record?.points.map((p) => [p.stage, p.nominal.toString(), p.measured.toString(), p.uncertainty?.toString(), p.error])).toEqual([
        ["as_found", "10", "10.5", "0.3", null],
        ["as_found", "25", "27.2", "0.3", null],
        ["as_found", "50", "53", "0.5", null],
      ]);
      expect(record?.points[0].coverageK?.toString()).toBe("2");
    });

    it("editar el borrador reemplaza los puntos; filas vacías se descartan", async () => {
      const asset = await make();
      const { id } = await saveCalibrationDraft(draftInput(asset.id), db);
      await saveCalibrationDraft(
        draftInput(asset.id, { recordId: id, labName: "Otro lab", traceability: "other_lab", traceabilityBasis: "Patrones del fabricante", asFoundPoints: [goodPoints[0], { channelKey: "h2s", nominal: "", measured: "", uncertainty: "" }] }),
        db,
      );
      const record = await getCalibrationRecord(a, asset.id, id, db);
      expect(record?.labName).toBe("Otro lab");
      expect(record?.points).toHaveLength(1);
      expect(await db.calibrationRecord.count({ where: { assetId: asset.id } })).toBe(1);
    });

    it("rechaza fechas futuras, puntos mal escritos, canales que no existen y equipos sin control", async () => {
      const asset = await make();
      await expect(saveCalibrationDraft(draftInput(asset.id, { performedAt: addDays(TODAY, 1) }), db)).rejects.toThrow("futura");
      await expect(saveCalibrationDraft(draftInput(asset.id, { asFoundPoints: [{ channelKey: "h2s", nominal: "diez", measured: "10" }] }), db)).rejects.toThrow("números");
      await expect(saveCalibrationDraft(draftInput(asset.id, { asFoundPoints: [{ channelKey: "co", nominal: "10", measured: "10" }] }), db)).rejects.toThrow("canal");
      await expect(saveCalibrationDraft(draftInput(asset.id, { kind: "verification" }), db)).rejects.toThrow("no exige verificación");
      const free = await make({ control: { magnitude: "other", noControlReason: "Indicativo" } });
      await expect(saveCalibrationDraft(draftInput(free.id), db)).rejects.toThrow("no lleva calibración");
    });

    it("un borrador se descarta con sus archivos; uno cerrado no", async () => {
      const asset = await make();
      const { id } = await saveCalibrationDraft(draftInput(asset.id), db);
      const file = await upload(id);
      await discardCalibrationDraft({ tenantId: a, actorUserId: actor, recordId: id }, db, storage);
      expect(await db.calibrationRecord.count({ where: { id } })).toBe(0);
      expect(await storage.getObject(file.storageKey)).toBeNull();

      const closedId = await loaded(asset.id);
      await close(closedId);
      await expect(discardCalibrationDraft({ tenantId: a, actorUserId: actor, recordId: closedId }, db, storage)).rejects.toThrow("se anula");
    });
  });

  describe("cierre", () => {
    it("el caso del detector de 3 puntos: calcula, guarda el error y el EMP por punto y deja el equipo vigente", async () => {
      const asset = await make();
      const id = await loaded(asset.id);
      const { outcome } = await close(id);
      expect(outcome).toMatchObject({ asLeftResult: "apt", validUntil: addMonths(PERFORMED, 6) });

      const record = await getCalibrationRecord(a, asset.id, id, db);
      expect(record).toMatchObject({ status: "closed", asFoundResult: "apt", asLeftResult: "apt", ruleApplied: "guard_band", intervalMonthsApplied: 6 });
      expect(record?.closedAt).not.toBeNull();
      expect(record?.points.map((p) => [p.error?.toString(), p.empApplied?.toString(), p.ok, p.reason, p.unit])).toEqual([
        ["0.5", "1", true, "within", "ppm"],
        ["2.2", "2.5", true, "within", "ppm"],
        ["3", "5", true, "within", "ppm"],
      ]);

      const detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.view.status).toBe("valid");
      expect(isoFromDate(detail!.control.calibrationValidUntil!)).toBe(addMonths(PERFORMED, 6));
      expect(detail?.control.lastDecision).toBe("apt");
    });

    it("un punto fuera de tolerancia deja el equipo no apto y sin vigencia", async () => {
      const asset = await make();
      const id = await loaded(asset.id, { asFoundPoints: [{ channelKey: "h2s", nominal: "50", measured: "55,6", uncertainty: "0,5" }] });
      const { outcome } = await close(id);
      expect(outcome).toMatchObject({ asFoundResult: "not_apt", asLeftResult: "not_apt", validUntil: null });
      const points = (await getCalibrationRecord(a, asset.id, id, db))!.points;
      expect(points[0]).toMatchObject({ ok: false, reason: "error_exceeds_emp" });
      const detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.view.status).toBe("not_apt");
      expect(detail?.view.usability.usable).toBe(false);
    });

    it("con ajuste: el as-left decide si vuelve a servir y se guardan los dos juegos", async () => {
      const asset = await make();
      const id = await loaded(asset.id, {
        adjusted: true,
        asFoundPoints: [{ channelKey: "h2s", nominal: "50", measured: "58", uncertainty: "0.5" }],
        asLeftPoints: [{ channelKey: "h2s", nominal: "50", measured: "50.5", uncertainty: "0.5" }],
      });
      const { outcome } = await close(id);
      expect(outcome).toMatchObject({ asFoundResult: "not_apt", asLeftResult: "apt", validUntil: addMonths(PERFORMED, 6) });
      const record = await getCalibrationRecord(a, asset.id, id, db);
      expect(record?.points.map((p) => [p.stage, p.ok])).toEqual([["as_found", false], ["as_left", true]]);
    });

    it("no cierra si faltan datos (incertidumbre, canal, as-left) y explica qué falta", async () => {
      const asset = await make({ control: control({ channels: [channel, { ...channel, key: "co", label: "CO" }] }) });
      const noUncertainty = await loaded(asset.id, { asFoundPoints: [{ channelKey: "h2s", nominal: "10", measured: "10.1" }, { channelKey: "co", nominal: "10", measured: "10.1", uncertainty: "0.1" }] });
      await expect(close(noUncertainty)).rejects.toThrow("Falta la incertidumbre");
      const missingChannel = await loaded(asset.id, { asFoundPoints: [{ channelKey: "h2s", nominal: "10", measured: "10.1", uncertainty: "0.1" }] });
      await expect(close(missingChannel)).rejects.toThrow("canal CO");
      const noAsLeft = await loaded(asset.id, { adjusted: true, asFoundPoints: [{ channelKey: "h2s", nominal: "10", measured: "10.1", uncertainty: "0.1" }, { channelKey: "co", nominal: "10", measured: "10.1", uncertainty: "0.1" }] });
      await expect(close(noAsLeft)).rejects.toBeInstanceOf(InspectionError);
      expect((await db.calibrationRecord.findUnique({ where: { id: noUncertainty } }))?.status).toBe("draft");
    });

    it("sin certificado no cierra, salvo una verificación interna con un patrón vigente", async () => {
      const asset = await make({ control: control({ requiresVerification: true, verificationIntervalMonths: 1 }) });
      const { id } = await saveCalibrationDraft(draftInput(asset.id), db);
      await expect(close(id)).rejects.toThrow("Adjuntá el certificado");

      const standard = await make({ control: control({ isReferenceStandard: true }) });
      await close(await loaded(standard.id));
      const inHouse = await saveCalibrationDraft(draftInput(asset.id, { kind: "verification", traceability: "in_house", labName: "Calidad", referenceStandardAssetId: standard.id }), db);
      const { outcome } = await close(inHouse.id);
      expect(outcome).toMatchObject({ asLeftResult: "apt", validUntil: addMonths(PERFORMED, 1) });
    });

    it("una verificación interna con el patrón vencido o sin patrón no se cierra como apta", async () => {
      const asset = await make({ control: control({ requiresVerification: true, verificationIntervalMonths: 1 }) });
      const noStandard = await saveCalibrationDraft(draftInput(asset.id, { kind: "verification", traceability: "in_house", labName: "Calidad" }), db);
      await expect(close(noStandard.id)).rejects.toThrow("patrón");

      const expired = await make();
      await close(await loaded(expired.id, { performedAt: addMonths(TODAY, -12) }));
      const draft = await saveCalibrationDraft(draftInput(asset.id, { kind: "verification", traceability: "in_house", labName: "Calidad", referenceStandardAssetId: expired.id }), db);
      await expect(close(draft.id)).rejects.toThrow("patrón no estaba vigente");
    });

    it("el laboratorio acreditado necesita organismo y número; otro laboratorio, la base de la trazabilidad", async () => {
      const asset = await make();
      const accredited = await loaded(asset.id, { traceability: "accredited_lab" });
      await expect(close(accredited)).rejects.toThrow("organismo");
      const other = await loaded(asset.id, { traceability: "other_lab" });
      await expect(close(other)).rejects.toThrow("trazabilidad");
      await saveCalibrationDraft(draftInput(asset.id, { recordId: accredited, traceability: "accredited_lab", accreditationBody: "OAA", accreditationNumber: "LC 123", accreditationScopeCovers: true }), db);
      await expect(close(accredited)).resolves.toBeDefined();
    });

    it("«conforme» del laboratorio: pide especificación y regla, y no vale en un equipo de uso crítico", async () => {
      const asset = await make();
      const statement = { basis: "certificate_statement" as const, asFoundPoints: [], labStatement: "conforme" as const };
      const incomplete = await loaded(asset.id, statement);
      await expect(close(incomplete)).rejects.toThrow("especificación");
      await saveCalibrationDraft(draftInput(asset.id, { ...statement, recordId: incomplete, labStatementSpec: "Manual MSA", labDecisionRule: "ILAC-G8 aceptación simple" }), db);
      const { outcome } = await close(incomplete);
      expect(outcome).toMatchObject({ asLeftResult: "apt", ruleApplied: "certificate_statement" });

      const critical = await make({ control: control({ criticalUse: true, criticalUseReason: "Espacios confinados" }) });
      const rejected = await loaded(critical.id, { ...statement, labStatementSpec: "Manual", labDecisionRule: "ILAC" });
      await expect(close(rejected)).rejects.toThrow("uso crítico");
    });

    it("cerrar dos veces no duplica ni pisa el resultado", async () => {
      const asset = await make();
      const id = await loaded(asset.id);
      await Promise.allSettled([close(id), close(id)]);
      await expect(close(id)).rejects.toThrow("ya está cerrado");
      expect(await db.calibrationRecord.count({ where: { assetId: asset.id, status: "closed" } })).toBe(1);
    });

    it("un registro cerrado no se edita, ni admite más certificados", async () => {
      const asset = await make();
      const id = await loaded(asset.id);
      await close(id);
      await expect(saveCalibrationDraft(draftInput(asset.id, { recordId: id }), db)).rejects.toThrow("ya está cerrado");
      await expect(upload(id)).rejects.toThrow("cerrado");
    });

    it("cambiar la regla del equipo después no cambia el resultado de un registro cerrado", async () => {
      const asset = await make();
      const id = await loaded(asset.id);
      await close(id);
      await db.instrumentControl.update({ where: { assetId: asset.id }, data: { decisionRule: "simple_acceptance", decisionRuleReason: "prueba", channels: [{ ...channel, emp: { abs: 0, pctReading: 0.1, pctFullScale: 0 } }] } });
      const record = await getCalibrationRecord(a, asset.id, id, db);
      expect(record).toMatchObject({ ruleApplied: "guard_band", asLeftResult: "apt" });
      expect(record?.points[0].empApplied?.toString()).toBe("1");
    });
  });

  describe("anulación", () => {
    it("anula con motivo: no cuenta y el registro anterior vuelve a regir", async () => {
      const asset = await make();
      const first = await loaded(asset.id, { performedAt: addDays(TODAY, -40) });
      await close(first);
      const second = await loaded(asset.id, { asFoundPoints: [{ channelKey: "h2s", nominal: "50", measured: "58", uncertainty: "0.5" }] });
      await close(second);
      expect((await getInstrument(a, asset.id, {}, db, TODAY))?.view.status).toBe("not_apt");

      await expect(voidCalibrationRecord({ tenantId: a, actorUserId: actor, recordId: second, reason: "no" }, db)).rejects.toThrow("motivo");
      await voidCalibrationRecord({ tenantId: a, actorUserId: actor, recordId: second, reason: "Se cargó en el equipo equivocado" }, db);
      const voided = await db.calibrationRecord.findUnique({ where: { id: second } });
      expect(voided).toMatchObject({ status: "voided", voidReason: "Se cargó en el equipo equivocado", voidedByUserId: actor });
      const detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.view.status).toBe("valid");
      expect(isoFromDate(detail!.control.calibrationValidUntil!)).toBe(addMonths(addDays(TODAY, -40), 6));
      await expect(voidCalibrationRecord({ tenantId: a, actorUserId: actor, recordId: second, reason: "otra vez" }, db)).rejects.toThrow("ya está anulado");
    });

    it("un borrador no se anula", async () => {
      const asset = await make();
      const { id } = await saveCalibrationDraft(draftInput(asset.id), db);
      await expect(voidCalibrationRecord({ tenantId: a, actorUserId: actor, recordId: id, reason: "motivo válido" }, db)).rejects.toThrow("se descarta");
    });
  });

  describe("envío a calibrar", () => {
    it("el equipo queda «en calibración» hasta que vuelve; volver no lo deja vigente", async () => {
      const asset = await make();
      await close(await loaded(asset.id));
      await sendInstrumentToCalibration({ tenantId: a, actorUserId: actor, assetId: asset.id, sentAt: addDays(TODAY, -1), expectedReturnAt: addDays(TODAY, 10), labName: "INTI" }, db);
      let detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.view.status).toBe("in_calibration");
      expect(detail?.view.usability.usable).toBe(false);
      expect(detail?.view.usability.reason).toContain("regreso estimado");

      await expect(sendInstrumentToCalibration({ tenantId: a, actorUserId: actor, assetId: asset.id, sentAt: TODAY }, db)).rejects.toThrow("ya está en el laboratorio");
      await expect(registerInstrumentReturn({ tenantId: a, actorUserId: actor, assetId: asset.id, returnedAt: addDays(TODAY, -5) }, db)).rejects.toThrow("anterior al envío");
      await registerInstrumentReturn({ tenantId: a, actorUserId: actor, assetId: asset.id, returnedAt: TODAY }, db);
      detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.view.status).toBe("valid");
      await expect(registerInstrumentReturn({ tenantId: a, actorUserId: actor, assetId: asset.id, returnedAt: TODAY }, db)).rejects.toThrow("no figura");
    });

    it("valida fechas: ni futuras ni un regreso estimado anterior al envío", async () => {
      const asset = await make();
      await expect(sendInstrumentToCalibration({ tenantId: a, actorUserId: actor, assetId: asset.id, sentAt: addDays(TODAY, 2) }, db)).rejects.toThrow("futura");
      await expect(sendInstrumentToCalibration({ tenantId: a, actorUserId: actor, assetId: asset.id, sentAt: TODAY, expectedReturnAt: addDays(TODAY, -1) }, db)).rejects.toThrow("anterior");
    });
  });

  describe("certificados", () => {
    it("se guarda con la clave del tenant, se descarga y se puede quitar del borrador", async () => {
      const asset = await make();
      const { id } = await saveCalibrationDraft(draftInput(asset.id), db);
      const file = await upload(id);
      expect(file.storageKey.startsWith(`tenants/${a}/calibration/${asset.id}/${id}/`)).toBe(true);
      expect(file.fileName).toBe("certificado 123.pdf");
      const read = await readCalibrationAttachment(file.id, { db, storage });
      expect(read?.body.toString()).toBe("%PDF-1.4 demo");
      await removeCalibrationCertificate({ tenantId: a, attachmentId: file.id }, db, storage);
      expect(await readCalibrationAttachment(file.id, { db, storage })).toBeNull();
    });

    it("rechaza tipos no permitidos, archivos vacíos y los que superan 15 MB", async () => {
      const asset = await make();
      const { id } = await saveCalibrationDraft(draftInput(asset.id), db);
      const put = (over: Partial<Parameters<typeof uploadCalibrationCertificate>[0]>) =>
        uploadCalibrationCertificate({ tenantId: a, recordId: id, fileName: "x.pdf", contentType: "application/pdf", body: Buffer.from("x"), uploadedById: actor, ...over }, { db, storage });
      await expect(put({ fileName: "virus.exe", contentType: "application/x-msdownload" })).rejects.toThrow("no permitido");
      await expect(put({ body: Buffer.alloc(0) })).rejects.toThrow("vacío");
      await expect(put({ body: Buffer.alloc(15 * 1024 * 1024 + 1) })).rejects.toThrow("15 MB");
    });
  });

  describe("aislamiento entre empresas", () => {
    it("la empresa B no lee, edita, cierra, anula ni sube archivos a registros de A", async () => {
      const asset = await make();
      const id = await loaded(asset.id);
      expect(await getCalibrationRecord(b, asset.id, id, db)).toBeNull();
      await expect(saveCalibrationDraft({ ...draftInput(asset.id, { recordId: id }), tenantId: b }, db)).rejects.toThrow("Equipo no encontrado");
      await expect(close(id, b)).rejects.toThrow("Registro no encontrado");
      await expect(upload(id, b)).rejects.toThrow("Registro no encontrado");
      await close(id);
      await expect(voidCalibrationRecord({ tenantId: b, actorUserId: actor, recordId: id, reason: "intento ajeno" }, db)).rejects.toThrow("Registro no encontrado");
      await expect(sendInstrumentToCalibration({ tenantId: b, actorUserId: actor, assetId: asset.id, sentAt: TODAY }, db)).rejects.toThrow("Equipo no encontrado");
    });

    it("el patrón de una verificación interna debe ser un equipo de la misma empresa", async () => {
      const asset = await make({ control: control({ requiresVerification: true, verificationIntervalMonths: 1 }) });
      const foreign = await make({ code: "AJENO-1" }, b, siteB);
      await expect(
        saveCalibrationDraft(draftInput(asset.id, { kind: "verification", traceability: "in_house", labName: "Calidad", referenceStandardAssetId: foreign.id }), db),
      ).rejects.toThrow("patrón");
    });
  });
});
