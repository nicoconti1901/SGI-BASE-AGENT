import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { listAssets, retireAsset, searchAssets } from "@/lib/assets";
import { InspectionError } from "@/lib/inspection-support";
import {
  checkInstrumentForUse,
  createInstrument,
  exportInstrumentRows,
  getInstrument,
  instrumentCounters,
  instrumentView,
  listInstruments,
  readCalibrationAttachment,
  recomputeInstrumentControl,
  searchInstruments,
  updateInstrument,
} from "@/lib/instruments";
import { STATUS_GROUPS, type StatusGroup } from "@/domain/calibration";
import { dateFromIso } from "@/domain/inspections/dates";
import { getSharedMemoryStorage } from "@/lib/storage/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TODAY = "2027-06-15";

const channel = { key: "h2s", label: "H₂S", unit: "ppm", rangeMin: 0, rangeMax: 100, emp: { abs: 0, pctReading: 10, pctFullScale: 0 }, active: true };
const control = (over: Record<string, unknown> = {}) => ({
  magnitude: "gas_concentration",
  requiresCalibration: true,
  calibrationIntervalMonths: 6,
  channels: [channel],
  ...over,
});

describe.skipIf(!hasDatabase)("equipos de medición (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let siteA = "";
  let siteA2 = "";
  let siteB = "";
  let seq = 0;

  const make = (over: Record<string, unknown> = {}, tenantId = a, siteId = siteA) =>
    createInstrument({ tenantId, actorUserId: actor, code: `det-${++seq}`, description: "Detector de gases", siteId, control: control(), ...over });

  /** Un registro cerrado y apto, como lo dejaría la carga de la Task 16.3. */
  const closedRecord = (tenantId: string, assetId: string, performedAt: string, validUntil: string | null, over: Record<string, unknown> = {}) =>
    db.calibrationRecord.create({
      data: {
        tenantId,
        assetId,
        kind: "calibration",
        status: "closed",
        performedAt: dateFromIso(performedAt),
        labName: "INTI",
        traceability: "nmi",
        ruleApplied: "guard_band",
        asFoundResult: "apt",
        asLeftResult: "apt",
        intervalMonthsApplied: 6,
        validUntil: validUntil ? dateFromIso(validUntil) : null,
        loadedByUserId: actor,
        closedAt: new Date(`${performedAt}T15:00:00Z`),
        ...over,
      },
    });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Cal ${label}`, slug: `cal-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actor = (await db.user.create({ data: { name: "Cal Admin", email: `cal-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: actor, name: "Base Neuquén" })).id;
    siteA2 = (await createSite({ tenantId: a, actorUserId: actor, name: "Obrador 1" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: actor, name: "Base Neuquén" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.$disconnect();
  });

  describe("alta y edición", () => {
    it("crea el activo y su control juntos, con el código en mayúsculas", async () => {
      const asset = await make({ code: " det 00-1 ", attributes: { brand: "MSA", model: "Altair 4XR", serialNumber: "S123" } });
      expect(asset.typeKey).toBe("measuring_equipment");
      expect(asset.code).toBe("DET 00-1");
      const detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.control).toMatchObject({ magnitude: "gas_concentration", decisionRule: "guard_band", alertLeadDays: 30, calibrationIntervalMonths: 6 });
      expect(detail?.channels).toHaveLength(1);
      expect(detail?.view.status).toBe("never_calibrated");
      expect(detail?.view.usability).toMatchObject({ usable: false, reason: "Sin calibración inicial" });
    });

    it("rechaza un código repetido, una sede de otra empresa y una configuración inválida, sin dejar un activo a medias", async () => {
      await make({ code: "DUP-1" });
      await expect(make({ code: "dup-1" })).rejects.toThrow("Ya existe un activo con ese código");
      await expect(make({ code: "CROSS-1" }, a, siteB)).rejects.toThrow("sede");
      await expect(make({ code: "BAD-1", control: control({ calibrationIntervalMonths: undefined }) })).rejects.toBeInstanceOf(InspectionError);
      await expect(make({ code: "BAD-2", control: control({ channels: [{ ...channel, emp: { abs: 0, pctReading: 0, pctFullScale: 0 } }] }) })).rejects.toThrow("no puede ser cero");
      expect(await db.asset.count({ where: { tenantId: a, code: { in: ["BAD-1", "BAD-2", "CROSS-1"] } } })).toBe(0);
    });

    it("un equipo sin control exige justificación y queda como «sin control metrológico»", async () => {
      await expect(make({ code: "IND-0", control: { magnitude: "other" } })).rejects.toThrow("por qué");
      const asset = await make({ code: "IND-1", control: { magnitude: "other", noControlReason: "Indicativo, no decide nada" } });
      const detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.view).toMatchObject({ status: "not_required" });
      expect(detail?.view.usability.usable).toBe(true);
    });

    it("editar la regla o el EMP no cambia el resultado de los registros cerrados", async () => {
      const asset = await make({ code: "EDIT-1" });
      const record = await closedRecord(a, asset.id, "2027-03-01", "2027-09-01");
      await updateInstrument({
        tenantId: a,
        actorUserId: actor,
        assetId: asset.id,
        description: "Detector con otra regla",
        siteId: siteA2,
        control: control({ decisionRule: "simple_acceptance", decisionRuleReason: "Lo pide el cliente", channels: [{ ...channel, emp: { abs: 0, pctReading: 1, pctFullScale: 0 } }] }),
      });
      const after = await db.calibrationRecord.findUniqueOrThrow({ where: { id: record.id } });
      expect(after).toMatchObject({ ruleApplied: "guard_band", asLeftResult: "apt" });
      expect(after.validUntil?.toISOString().slice(0, 10)).toBe("2027-09-01");
      const detail = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(detail?.control.decisionRule).toBe("simple_acceptance");
      expect(detail?.asset.siteId).toBe(siteA2);
      // la vigencia derivada sigue saliendo del registro
      expect(detail?.control.calibrationValidUntil?.toISOString().slice(0, 10)).toBe("2027-09-01");
    });

    it("no se edita un equipo de otra empresa ni uno dado de baja", async () => {
      const asset = await make({ code: "EDIT-2" });
      const input = { actorUserId: actor, assetId: asset.id, description: "x ok", siteId: siteB, control: control() };
      await expect(updateInstrument({ ...input, tenantId: b })).rejects.toThrow("Equipo no encontrado");
      await retireAsset({ tenantId: a, actorUserId: actor, assetId: asset.id, reason: "Vendido a un tercero" });
      await expect(updateInstrument({ ...input, tenantId: a, siteId: siteA })).rejects.toThrow("dado de baja");
    });
  });

  describe("recomputeInstrumentControl", () => {
    it("deriva vigencia, decisión, envío y evaluación pendiente, y es idempotente", async () => {
      const asset = await make({ code: "RC-1" });
      await closedRecord(a, asset.id, "2026-12-01", "2027-06-01");
      const newer = await closedRecord(a, asset.id, "2027-03-01", "2027-09-01");
      const first = await recomputeInstrumentControl(a, asset.id, db);
      const second = await recomputeInstrumentControl(a, asset.id, db);
      expect(second).toEqual({ ...first, updatedAt: second.updatedAt });
      expect(first.calibrationValidUntil?.toISOString().slice(0, 10)).toBe("2027-09-01");
      expect(first.nextDueAt?.toISOString().slice(0, 10)).toBe("2027-09-01");
      expect(first.lastDecision).toBe("apt");

      // un registro anulado no cuenta: el anterior vuelve a regir
      await db.calibrationRecord.update({ where: { id: newer.id }, data: { status: "voided", voidReason: "Se cargó con la fecha equivocada" } });
      const afterVoid = await recomputeInstrumentControl(a, asset.id, db);
      expect(afterVoid.calibrationValidUntil?.toISOString().slice(0, 10)).toBe("2027-06-01");

      await db.instrumentShipment.create({ data: { tenantId: a, assetId: asset.id, sentAt: dateFromIso("2027-06-10"), expectedReturnAt: dateFromIso("2027-06-30") } });
      const shipped = await recomputeInstrumentControl(a, asset.id, db);
      expect(shipped.inCalibrationSince?.toISOString().slice(0, 10)).toBe("2027-06-10");
      expect(instrumentView(shipped, "in_service", TODAY)).toMatchObject({ status: "in_calibration", usability: { usable: false } });

      await db.impactAssessment.create({ data: { tenantId: a, assetId: asset.id, trigger: "as_found_not_apt", windowTo: dateFromIso("2027-03-01") } });
      expect((await recomputeInstrumentControl(a, asset.id, db)).impactPending).toBe(true);
    });

    it("un último registro no apto manda: no apto aunque el anterior siga vigente", async () => {
      const asset = await make({ code: "RC-2" });
      await closedRecord(a, asset.id, "2027-02-01", "2027-08-01");
      await closedRecord(a, asset.id, "2027-05-01", null, { asFoundResult: "not_apt", asLeftResult: "not_apt", validUntil: null });
      const derived = await recomputeInstrumentControl(a, asset.id, db);
      expect(derived.lastDecision).toBe("not_apt");
      expect(instrumentView(derived, "in_service", TODAY).status).toBe("not_apt");
    });
  });

  describe("lista, contadores y estado en la base", () => {
    const scenarios: Record<string, Record<string, unknown>> = {};

    it("el estado calculado en SQL coincide con el de la función pura, en todos los casos", async () => {
      const setup: [string, string | null, Record<string, unknown>?][] = [
        // [código, vigente hasta, columnas derivadas extra]
        ["S-VALID", "2027-12-31"],
        ["S-LASTDAY", "2027-06-15"],
        ["S-SOON-FIRST", "2027-07-15"],
        ["S-SOON", "2027-06-20"],
        ["S-EXPIRED", "2027-06-14"],
        ["S-NEVER", null],
        ["S-NOTAPT", "2027-12-31", { lastDecision: "not_apt" }],
        ["S-IMPACT", "2027-12-31", { impactPending: true }],
        ["S-INCAL", "2027-12-31", { inCalibrationSince: dateFromIso("2027-06-01") }],
        ["S-INCAL-EXPIRED", "2027-01-01", { inCalibrationSince: dateFromIso("2027-06-01") }],
      ];
      for (const [code, until, extra] of setup) {
        const asset = await make({ code });
        await db.instrumentControl.update({
          where: { assetId: asset.id },
          data: { calibrationValidUntil: until ? dateFromIso(until) : null, nextDueAt: until ? dateFromIso(until) : null, ...extra },
        });
        scenarios[code] = { id: asset.id };
      }
      // calibración + verificación: rige la peor
      const both = await make({ code: "S-BOTH", control: control({ requiresVerification: true, verificationIntervalMonths: 3 }) });
      await db.instrumentControl.update({
        where: { assetId: both.id },
        data: { calibrationValidUntil: dateFromIso("2027-12-31"), verificationValidUntil: dateFromIso("2027-06-01"), nextDueAt: dateFromIso("2027-06-01") },
      });
      // verificación sin hacer nunca
      const noVerif = await make({ code: "S-NOVERIF", control: control({ requiresVerification: true, verificationIntervalMonths: 3 }) });
      await db.instrumentControl.update({ where: { assetId: noVerif.id }, data: { calibrationValidUntil: dateFromIso("2027-12-31"), nextDueAt: dateFromIso("2027-12-31") } });
      const none = await make({ code: "S-NONE", control: { magnitude: "other", noControlReason: "Indicativo" } });

      const all = await db.instrumentControl.findMany({ where: { tenantId: a, asset: { code: { startsWith: "S-" } } }, include: { asset: true } });
      const expected = new Map(all.map((c) => [c.assetId, instrumentView(c, c.asset.status, TODAY).status]));
      expect(expected.get(scenarios["S-VALID"].id as string)).toBe("valid");
      expect(expected.get(scenarios["S-LASTDAY"].id as string)).toBe("due_soon");
      expect(expected.get(scenarios["S-SOON-FIRST"].id as string)).toBe("due_soon");
      expect(expected.get(scenarios["S-EXPIRED"].id as string)).toBe("expired");
      expect(expected.get(scenarios["S-NEVER"].id as string)).toBe("never_calibrated");
      expect(expected.get(both.id)).toBe("expired");
      expect(expected.get(noVerif.id)).toBe("never_calibrated");
      expect(expected.get(none.id)).toBe("not_required");

      // El filtro por grupo en SQL devuelve exactamente los mismos equipos que la función pura.
      for (const group of Object.keys(STATUS_GROUPS) as StatusGroup[]) {
        const fromSql = new Set<string>();
        for (let page = 1; ; page++) {
          const result = await listInstruments(a, { q: "S-", group, page }, db, TODAY);
          result.items.forEach((i) => fromSql.add(i.assetId));
          if (page >= result.pages) break;
        }
        const statuses: readonly string[] = STATUS_GROUPS[group];
        const fromPure = new Set([...expected].filter(([, st]) => statuses.includes(st)).map(([id]) => id));
        expect(fromSql, group).toEqual(fromPure);
      }

      // Los contadores salen de una sola consulta agregada y suman el total.
      const counters = await instrumentCounters(a, { q: "S-" }, db, TODAY);
      expect(counters.total).toBe(all.length);
      for (const group of Object.keys(STATUS_GROUPS) as StatusGroup[]) {
        const statuses: readonly string[] = STATUS_GROUPS[group];
        expect(counters[group], group).toBe([...expected.values()].filter((st) => statuses.includes(st)).length);
      }
    });

    it("ordena primero lo que hay que atender y después por vencimiento más próximo", async () => {
      const result = await listInstruments(a, { q: "S-" }, db, TODAY);
      const codes = result.items.map((i) => i.asset.code);
      expect(codes[0]).toBe("S-NOTAPT");
      expect(codes.indexOf("S-EXPIRED")).toBeLessThan(codes.indexOf("S-NEVER"));
      expect(codes.indexOf("S-LASTDAY")).toBeLessThan(codes.indexOf("S-SOON"));
      expect(codes.indexOf("S-SOON")).toBeLessThan(codes.indexOf("S-VALID"));
      expect(codes.at(-1)).toBe("S-NONE");
    });

    it("filtra por sede, magnitud y texto", async () => {
      const pressure = await make({ code: "F-PRES", description: "Manómetro", control: control({ magnitude: "pressure" }) }, a, siteA2);
      expect((await listInstruments(a, { magnitude: "pressure" }, db, TODAY)).items.map((i) => i.assetId)).toEqual([pressure.id]);
      const bySite = await listInstruments(a, { siteId: siteA2, q: "F-" }, db, TODAY);
      expect(bySite.items.map((i) => i.assetId)).toEqual([pressure.id]);
      expect((await listInstruments(a, { q: "manómetro" }, db, TODAY)).total).toBe(1);
      // los comodines de LIKE se toman como texto
      expect((await listInstruments(a, { q: "%" }, db, TODAY)).total).toBe(0);
    });

    it("pagina de a 25 con el total sin cargar todo, y los dados de baja no figuran", async () => {
      for (let i = 0; i < 30; i++) await make({ code: `PGN-${String(i).padStart(2, "0")}` });
      const first = await listInstruments(a, { q: "PGN-" }, db, TODAY);
      expect(first).toMatchObject({ total: 30, page: 1, pages: 2 });
      expect(first.items).toHaveLength(25);
      const second = await listInstruments(a, { q: "PGN-", page: 2 }, db, TODAY);
      expect(second.items).toHaveLength(5);
      expect(new Set([...first.items, ...second.items].map((i) => i.assetId)).size).toBe(30);

      const victim = first.items[0];
      await retireAsset({ tenantId: a, actorUserId: actor, assetId: victim.assetId, reason: "Dado de baja por prueba" });
      expect((await listInstruments(a, { q: "PGN-" }, db, TODAY)).total).toBe(29);
      const rows = await exportInstrumentRows(a, { q: "PGN-" }, db, TODAY);
      expect(rows.rows).toHaveLength(29);
      expect(rows.rows[0]).toMatchObject({ status: "never_calibrated", usable: false, reason: "Sin calibración inicial" });
    });

    it("la lista usa pocas consultas aunque haya muchos equipos", async () => {
      const events: string[] = [];
      const probe = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
      probe.$on("query", (e: Prisma.QueryEvent) => events.push(e.query));
      try {
        await listInstruments(a, { q: "PGN-" }, probe, TODAY);
        await instrumentCounters(a, {}, probe, TODAY);
      } finally {
        await probe.$disconnect();
      }
      // 1 aggregate list + 1 página de controles/activos/sede/persona + 1 contadores
      expect(events.length).toBeLessThanOrEqual(8);
    });
  });

  describe("aislamiento entre empresas", () => {
    it("la empresa B no ve equipos, historial ni certificados de la A", async () => {
      const asset = await make({ code: "ISO-A1" });
      const record = await closedRecord(a, asset.id, "2027-05-01", "2027-11-01");
      const attachment = await db.calibrationAttachment.create({
        data: { tenantId: a, recordId: record.id, storageKey: `${a}/calibration/${record.id}/cert.pdf`, fileName: "cert.pdf", contentType: "application/pdf", sizeBytes: 4 },
      });
      await getSharedMemoryStorage().putObject(attachment.storageKey, Buffer.from("%PDF"), "application/pdf");
      await make({ code: "ISO-B1" }, b, siteB);

      expect(await getInstrument(b, asset.id, {}, db, TODAY)).toBeNull();
      expect((await listInstruments(b, { q: "ISO-A" }, db, TODAY)).total).toBe(0);
      expect((await instrumentCounters(b, {}, db, TODAY)).total).toBe(1);
      expect((await searchInstruments(b, { q: "ISO-A" }, db, TODAY)).length).toBe(0);
      expect((await exportInstrumentRows(b, {}, db, TODAY)).rows.map((r) => r.code)).toEqual(["ISO-B1"]);
      expect((await checkInstrumentForUse(b, asset.id, {}, db, TODAY)).usable).toBe(false);

      const own = await getInstrument(a, asset.id, {}, db, TODAY);
      expect(own?.records[0].attachments[0].id).toBe(attachment.id);
      const file = await readCalibrationAttachment(attachment.id, { db, storage: getSharedMemoryStorage() });
      expect(file?.body.toString()).toBe("%PDF");
      expect(file?.attachment.tenantId).toBe(a); // la ruta de descarga compara este tenant con la membresía
    });

    it("los activos genéricos no incluyen los equipos de medición", async () => {
      await make({ code: "GEN-1" });
      expect((await listAssets(a, { q: "GEN-1" }, db)).items).toHaveLength(0);
      expect(await searchAssets(a, { q: "GEN-1" }, db)).toHaveLength(0);
      expect((await listAssets(a, { typeKey: "measuring_equipment" }, db)).total).toBe(0);
    });
  });

  describe("uso desde otros módulos", () => {
    it("el selector lista todos, con los no utilizables y su motivo; el servidor rechaza igual", async () => {
      const ok = await make({ code: "USE-OK" });
      await closedRecord(a, ok.id, "2027-05-01", "2027-11-01");
      await recomputeInstrumentControl(a, ok.id, db);
      const expired = await make({ code: "USE-EXP" });
      await closedRecord(a, expired.id, "2026-01-01", "2026-07-01");
      await recomputeInstrumentControl(a, expired.id, db);

      const found = await searchInstruments(a, { q: "USE-" }, db, TODAY);
      expect(found.map((f) => [f.code, f.usability.usable])).toEqual([
        ["USE-EXP", false],
        ["USE-OK", true],
      ]);
      expect(found[0].usability.reason).toBe("Calibración vencida el 01/07/2026");
      expect((await checkInstrumentForUse(a, expired.id, {}, db, TODAY)).usable).toBe(false);
      expect((await checkInstrumentForUse(a, ok.id, {}, db, TODAY)).usable).toBe(true);
    });

    it("una medición con fecha pasada es válida si el equipo estaba vigente ese día, aunque hoy esté vencido", async () => {
      const asset = await make({ code: "PAST-1" });
      await closedRecord(a, asset.id, "2026-01-01", "2026-07-01");
      await recomputeInstrumentControl(a, asset.id, db);
      expect((await checkInstrumentForUse(a, asset.id, {}, db, TODAY)).usable).toBe(false);
      expect((await checkInstrumentForUse(a, asset.id, { onDate: "2026-03-15" }, db, TODAY)).usable).toBe(true);
      expect((await checkInstrumentForUse(a, asset.id, { onDate: "2026-07-02" }, db, TODAY)).usable).toBe(false);
      expect((await checkInstrumentForUse(a, asset.id, { onDate: "2025-12-31" }, db, TODAY)).usable).toBe(false);
    });
  });

  describe("invariantes en la base", () => {
    it("rechaza un control exigido sin intervalo y un registro cerrado sin resultado", async () => {
      const asset = await make({ code: "INV-1" });
      await expect(db.instrumentControl.update({ where: { assetId: asset.id }, data: { calibrationIntervalMonths: null } })).rejects.toThrow();
      await expect(
        db.calibrationRecord.create({
          data: { tenantId: a, assetId: asset.id, kind: "calibration", status: "closed", performedAt: dateFromIso("2027-01-01"), labName: "X", traceability: "nmi", ruleApplied: "guard_band", loadedByUserId: actor },
        }),
      ).rejects.toThrow();
    });

    it("un equipo no puede tener dos envíos abiertos", async () => {
      const asset = await make({ code: "INV-2" });
      const row = { tenantId: a, assetId: asset.id, sentAt: dateFromIso("2027-06-01") };
      await db.instrumentShipment.create({ data: row });
      await expect(db.instrumentShipment.create({ data: row })).rejects.toThrow();
      await db.instrumentShipment.updateMany({ where: { assetId: asset.id }, data: { returnedAt: dateFromIso("2027-06-05") } });
      await db.instrumentShipment.create({ data: row });
    });

    it("una verificación interna cerrada necesita el patrón", async () => {
      const asset = await make({ code: "INV-3" });
      await expect(closedRecord(a, asset.id, "2027-01-01", "2027-07-01", { traceability: "in_house" })).rejects.toThrow();
    });
  });
});
