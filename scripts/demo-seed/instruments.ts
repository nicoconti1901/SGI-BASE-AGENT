import { createInstrument } from "../../src/lib/instruments";
import {
  closeCalibrationRecord,
  saveCalibrationDraft,
  sendInstrumentToCalibration,
  uploadCalibrationCertificate,
  voidCalibrationRecord,
  type PointDraft,
  type RecordDraftInput,
} from "../../src/lib/calibration-records";
import { completeImpactAssessment } from "../../src/lib/impact-assessments";
import { addDays, todayIso } from "../../src/domain/inspections/dates";
import { db, demoPdf, step, type DemoTenant } from "./kit";

const TODAY = todayIso();
const ago = (days: number) => addDays(TODAY, -days);

type Channel = { key: string; label: string; unit: string; rangeMin: number; rangeMax: number; emp: { abs: number; pctReading: number; pctFullScale: number }; active: boolean };
const channel = (key: string, label: string, unit: string, rangeMin: number, rangeMax: number, emp: Channel["emp"]): Channel => ({ key, label, unit, rangeMin, rangeMax, emp, active: true });

const PCT10 = { abs: 0, pctReading: 10, pctFullScale: 0 };

/**
 * Tres puntos por canal (20 %, 50 %, 80 % del rango). Con un error chico los puntos quedan dentro del error máximo
 * permitido (la mitad de ese máximo más un cuarto de incertidumbre); desde 10 % quedan fuera (1,8 veces el máximo).
 */
function pointsFor(channels: Channel[], errorPct: number): PointDraft[] {
  const out: PointDraft[] = [];
  for (const c of channels) {
    for (const f of [0.2, 0.5, 0.8]) {
      const nominal = c.rangeMin + (c.rangeMax - c.rangeMin) * f;
      const emp = c.emp.abs + (c.emp.pctReading / 100) * Math.abs(nominal) + (c.emp.pctFullScale / 100) * (c.rangeMax - c.rangeMin);
      const error = errorPct >= 10 ? emp * 1.8 : emp * 0.5 * Math.min(errorPct / 2 + 0.2, 1);
      const round = (n: number) => String(Number(n.toFixed(4)));
      out.push({ channelKey: c.key, nominal: round(nominal), measured: round(nominal + error), uncertainty: round(emp * 0.25) });
    }
  }
  return out;
}

type Def = {
  code: string;
  description: string;
  site: string;
  sector: string;
  magnitude: string;
  channels: Channel[];
  brand: string;
  model: string;
  serial: string;
  control: Record<string, unknown>;
  assigned?: string;
  contractor?: string;
};

const H2S = channel("h2s", "H₂S", "ppm", 0, 100, PCT10);
const CO = channel("co", "CO", "ppm", 0, 500, { abs: 5, pctReading: 5, pctFullScale: 0 });
const O2 = channel("o2", "O₂", "%", 0, 25, { abs: 0.5, pctReading: 0, pctFullScale: 0 });

const DEFS: Def[] = [
  {
    code: "GAS-01", description: "Detector multigás (H₂S, CO, O₂)", site: "Base Añelo", sector: "Seguridad e higiene", magnitude: "gas_concentration", channels: [H2S, CO, O2],
    brand: "MSA", model: "Altair 4XR", serial: "A4XR-20871", assigned: "L-002",
    control: { requiresCalibration: true, calibrationIntervalMonths: 6, criticalUse: true, criticalUseReason: "Habilita el ingreso a espacios confinados.", alertLeadDays: 30 },
  },
  {
    code: "GAS-02", description: "Detector de H₂S personal", site: "Obra Loma Campana", sector: "Pozo 14", magnitude: "gas_concentration", channels: [H2S],
    brand: "Honeywell", model: "BW Clip", serial: "BWC-55102", assigned: "L-004",
    control: { requiresCalibration: true, calibrationIntervalMonths: 6, criticalUse: true, criticalUseReason: "Protección personal en áreas con H₂S.", alertLeadDays: 30 },
  },
  {
    code: "GAS-03", description: "Detector multigás de reserva", site: "Planta Centenario", sector: "Mantenimiento", magnitude: "gas_concentration", channels: [H2S, O2],
    brand: "Industrial Scientific", model: "Ventis MX4", serial: "MX4-77013",
    control: { requiresCalibration: true, calibrationIntervalMonths: 6, alertLeadDays: 30 },
  },
  {
    code: "SON-01", description: "Sonómetro integrador", site: "Oficina Neuquén", sector: "Higiene laboral", magnitude: "sound_level", channels: [channel("lp", "Nivel sonoro", "dB", 30, 130, { abs: 1.5, pctReading: 0, pctFullScale: 0 })],
    brand: "Quest", model: "SoundPro DL", serial: "SP-30421", assigned: "L-003",
    control: { requiresCalibration: true, calibrationIntervalMonths: 12, alertLeadDays: 45 },
  },
  {
    code: "LUX-01", description: "Luxómetro digital", site: "Planta Centenario", sector: "Higiene laboral", magnitude: "illuminance", channels: [channel("lux", "Iluminancia", "lx", 0, 20000, { abs: 0, pctReading: 5, pctFullScale: 0 })],
    brand: "Extech", model: "LT300", serial: "LT300-8841",
    control: { requiresCalibration: true, calibrationIntervalMonths: 12, alertLeadDays: 30 },
  },
  {
    code: "MAN-01", description: "Manómetro patrón", site: "Base Añelo", sector: "Taller", magnitude: "pressure", channels: [channel("p", "Presión", "bar", 0, 100, { abs: 0.25, pctReading: 0, pctFullScale: 0 })],
    brand: "WIKA", model: "CPG1500", serial: "CPG-10012",
    control: { requiresCalibration: true, calibrationIntervalMonths: 12, isReferenceStandard: true, alertLeadDays: 60 },
  },
  {
    code: "TER-01", description: "Termómetro de proceso", site: "Planta Centenario", sector: "Control de calidad", magnitude: "temperature", channels: [channel("t", "Temperatura", "°C", -20, 200, { abs: 0.5, pctReading: 0, pctFullScale: 0 })],
    brand: "Testo", model: "735-1", serial: "T735-4410", assigned: "L-010",
    control: { requiresVerification: true, verificationIntervalMonths: 3, alertLeadDays: 15 },
  },
  {
    code: "PAT-01", description: "Termómetro patrón", site: "Planta Centenario", sector: "Control de calidad", magnitude: "temperature", channels: [channel("t", "Temperatura", "°C", -20, 200, { abs: 0.1, pctReading: 0, pctFullScale: 0 })],
    brand: "Fluke", model: "1524", serial: "F1524-30045",
    control: { requiresCalibration: true, calibrationIntervalMonths: 12, isReferenceStandard: true, alertLeadDays: 60 },
  },
  {
    code: "BAL-01", description: "Balanza de laboratorio", site: "Planta Centenario", sector: "Control de calidad", magnitude: "mass", channels: [channel("m", "Masa", "g", 0, 5000, { abs: 0.5, pctReading: 0, pctFullScale: 0 })],
    brand: "Ohaus", model: "Ranger 3000", serial: "RG-33021",
    control: { requiresCalibration: true, calibrationIntervalMonths: 12, criticalUse: true, criticalUseReason: "Dosificación de productos químicos.", alertLeadDays: 30 },
  },
  {
    code: "MEG-01", description: "Telurímetro / megóhmetro", site: "Obra Loma Campana", sector: "Electricidad", magnitude: "earth_resistance", channels: [channel("r", "Resistencia", "Ω", 0, 2000, { abs: 0, pctReading: 5, pctFullScale: 0 })],
    brand: "Fluke", model: "1623-2", serial: "F1623-90117", contractor: "Servicios Eléctricos del Alto Valle SRL",
    control: { requiresCalibration: true, calibrationIntervalMonths: 12, alertLeadDays: 30 },
  },
  {
    code: "CAL-01", description: "Calibre digital", site: "Base Añelo", sector: "Taller", magnitude: "length", channels: [],
    brand: "Mitutoyo", model: "500-196", serial: "M500-6612",
    control: { requiresCalibration: false, requiresVerification: false, noControlReason: "Indicativo: no se usa para decidir la conformidad de un producto." },
  },
];

async function seedInstruments(t: DemoTenant) {
  const actorUserId = t.users.hse.userId;
  const ids: Record<string, string> = {};
  for (const d of DEFS) {
    const asset = await step(`Equipo ${d.code}`, () =>
      createInstrument({
        tenantId: t.id,
        actorUserId,
        code: d.code,
        description: d.description,
        siteId: t.siteIds[d.site],
        sector: d.sector,
        assignedPersonId: d.assigned ? t.people.find((p) => p.code === d.assigned)?.id : null,
        ownership: d.contractor ? "contractor" : "own",
        contractorName: d.contractor ?? null,
        attributes: { brand: d.brand, model: d.model, serialNumber: d.serial, inServiceSince: "2023-02-15" },
        control: { magnitude: d.magnitude, channels: d.channels, ...d.control },
      }),
    );
    if (asset) ids[d.code] = asset.id;
  }
  return ids;
}

type RecordPlan = {
  code: string;
  daysAgo: number;
  kind?: "calibration" | "verification";
  errorPct?: number;
  lab?: string;
  traceability?: "nmi" | "accredited_lab" | "in_house";
  adjusted?: boolean;
  /** Sin certificado ni cierre: queda como borrador. */
  draftOnly?: boolean;
};

const PLANS: RecordPlan[] = [
  { code: "GAS-01", daysAgo: 80, errorPct: 2, lab: "INTI Neuquén", traceability: "nmi" },
  { code: "GAS-02", daysAgo: 215, errorPct: 3, lab: "Metrología Austral SA", traceability: "accredited_lab" },
  { code: "SON-01", daysAgo: 350, errorPct: 0.5, lab: "Laboratorio Acústico del Sur", traceability: "accredited_lab" },
  { code: "LUX-01", daysAgo: 120, errorPct: 1, lab: "INTI Neuquén", traceability: "nmi" },
  { code: "MAN-01", daysAgo: 30, errorPct: 0.1, lab: "INTI Neuquén", traceability: "nmi" },
  { code: "PAT-01", daysAgo: 90, errorPct: 0.05, lab: "INTI Neuquén", traceability: "nmi" },
  { code: "TER-01", daysAgo: 40, kind: "verification", errorPct: 0.2, lab: "Verificación interna", traceability: "in_house" },
  { code: "BAL-01", daysAgo: 25, errorPct: 15, lab: "Metrología Austral SA", traceability: "accredited_lab", adjusted: true },
  { code: "GAS-03", daysAgo: 150, errorPct: 1, lab: "Metrología Austral SA", traceability: "accredited_lab" },
];

async function seedRecords(t: DemoTenant, ids: Record<string, string>) {
  const actorUserId = t.users.hse.userId;
  const closed: Record<string, string> = {};
  for (const plan of PLANS) {
    const assetId = ids[plan.code];
    const def = DEFS.find((d) => d.code === plan.code);
    if (!assetId || !def) continue;
    const input: RecordDraftInput = {
      tenantId: t.id,
      actorUserId,
      assetId,
      kind: plan.kind ?? "calibration",
      performedAt: ago(plan.daysAgo),
      certificateNumber: `CERT-${plan.code}-${plan.daysAgo}`,
      certificateIssuedAt: ago(Math.max(plan.daysAgo - 3, 0)),
      labName: plan.lab ?? "INTI Neuquén",
      traceability: plan.traceability ?? "nmi",
      accreditationBody: plan.traceability === "accredited_lab" ? "OAA" : null,
      accreditationNumber: plan.traceability === "accredited_lab" ? "LC 075" : null,
      accreditationScopeCovers: plan.traceability === "accredited_lab" ? true : null,
      traceabilityBasis: plan.traceability === "in_house" ? "Patrón MAN-01 y termómetro de referencia del laboratorio." : null,
      referenceStandardAssetId: plan.traceability === "in_house" ? ids["PAT-01"] : null,
      adjusted: plan.adjusted ?? false,
      basis: "points",
      coverageK: "2",
      asFoundPoints: pointsFor(def.channels, plan.errorPct ?? 1),
      asLeftPoints: plan.adjusted ? pointsFor(def.channels, 0.2) : [],
    };
    await step(`Calibración ${plan.code}`, async () => {
      const { id } = await saveCalibrationDraft(input);
      await uploadCalibrationCertificate({ tenantId: t.id, recordId: id, fileName: `certificado-${plan.code}.pdf`, contentType: "application/pdf", body: demoPdf(`Certificado ${plan.code}`), uploadedById: actorUserId });
      await closeCalibrationRecord({ tenantId: t.id, actorUserId, recordId: id });
      closed[plan.code] = id;
    });
  }
  return closed;
}

async function seedFollowUps(t: DemoTenant, ids: Record<string, string>, closed: Record<string, string>) {
  const actorUserId = t.users.hse.userId;

  // BAL-01 quedó fuera de tolerancia: su evaluación de impacto queda pendiente (equipo bloqueado).
  // GAS-02, en cambio, tiene una evaluación ya resuelta con acciones.
  await step("Calibración fuera de tolerancia en GAS-03 con impacto resuelto", async () => {
    const def = DEFS.find((d) => d.code === "GAS-03")!;
    const { id } = await saveCalibrationDraft({
      tenantId: t.id, actorUserId, assetId: ids["GAS-03"], kind: "calibration", performedAt: ago(10), certificateNumber: "CERT-GAS-03-FT",
      certificateIssuedAt: ago(8), labName: "Metrología Austral SA", traceability: "accredited_lab", accreditationBody: "OAA", accreditationNumber: "LC 075",
      accreditationScopeCovers: true, adjusted: true, basis: "points", coverageK: "2", asFoundPoints: pointsFor(def.channels, 18), asLeftPoints: pointsFor(def.channels, 0.3),
    });
    await uploadCalibrationCertificate({ tenantId: t.id, recordId: id, fileName: "certificado-GAS-03-fuera-tolerancia.pdf", contentType: "application/pdf", body: demoPdf("Certificado GAS-03 fuera de tolerancia"), uploadedById: actorUserId });
    await closeCalibrationRecord({ tenantId: t.id, actorUserId, recordId: id });
    const assessment = await db.impactAssessment.findFirst({ where: { tenantId: t.id, assetId: ids["GAS-03"], status: "pending" } });
    if (!assessment) throw new Error("No se abrió la evaluación de impacto de GAS-03");
    await completeImpactAssessment({
      tenantId: t.id, actorUserId, assessmentId: assessment.id, outcome: "affected_results_actioned",
      affectedSummary: "Mediciones de H₂S en espacios confinados de la planta durante los últimos 6 meses.",
      rationale: "El detector subestimaba la lectura; se repitieron las mediciones críticas con el equipo GAS-01.",
      registerFinding: true,
      actions: [{ title: "Repetir las mediciones de H₂S del sector tanques", ownerUserId: t.users.hse.userId, dueAt: addDays(TODAY, 12) }],
    });
  });

  await step("Borrador de calibración a la espera del certificado (SON-01)", async () => {
    const def = DEFS.find((d) => d.code === "SON-01")!;
    await saveCalibrationDraft({
      tenantId: t.id, actorUserId, assetId: ids["SON-01"], kind: "calibration", performedAt: ago(4), labName: "Laboratorio Acústico del Sur",
      traceability: "accredited_lab", adjusted: false, basis: "points", asFoundPoints: pointsFor(def.channels, 0.4), asLeftPoints: [],
    });
  });

  await step("Registro anulado (LUX-01)", async () => {
    const def = DEFS.find((d) => d.code === "LUX-01")!;
    const { id } = await saveCalibrationDraft({
      tenantId: t.id, actorUserId, assetId: ids["LUX-01"], kind: "calibration", performedAt: ago(60), certificateNumber: "CERT-LUX-01-ERR", certificateIssuedAt: ago(58),
      labName: "INTI Neuquén", traceability: "nmi", adjusted: false, basis: "points", coverageK: "2", asFoundPoints: pointsFor(def.channels, 1), asLeftPoints: [],
    });
    await uploadCalibrationCertificate({ tenantId: t.id, recordId: id, fileName: "certificado-LUX-01-erroneo.pdf", contentType: "application/pdf", body: demoPdf("Certificado cargado por error"), uploadedById: actorUserId });
    await closeCalibrationRecord({ tenantId: t.id, actorUserId, recordId: id });
    await voidCalibrationRecord({ tenantId: t.id, actorUserId, recordId: id, reason: "Se cargó el certificado de otro equipo por error." });
  });

  await step("MAN-01 en el laboratorio", () =>
    sendInstrumentToCalibration({ tenantId: t.id, actorUserId, assetId: ids["MAN-01"], sentAt: ago(5), expectedReturnAt: addDays(TODAY, 10), labName: "INTI Neuquén" }),
  );
  void closed;
}

export async function seedInstrumentsModule(t: DemoTenant) {
  const ids = await step("Equipos de medición", () => seedInstruments(t));
  if (!ids) return {};
  const closed = await seedRecords(t, ids);
  await seedFollowUps(t, ids, closed);
  return ids;
}
