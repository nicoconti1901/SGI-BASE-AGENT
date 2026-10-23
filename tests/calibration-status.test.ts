import { describe, expect, it } from "vitest";
import { canTenantRole } from "@/domain/identity/authz";
import { instrumentsToCsv } from "@/domain/calibration/export";
import {
  calibrationStatus,
  deriveControl,
  describeEmp,
  describeRule,
  instrumentUsability,
  validateControlConfig,
  wasInstrumentValidOn,
  type RecordSummary,
  type StatusInput,
} from "@/domain/calibration";

const input = (over: Omit<Partial<StatusInput>, "hold"> & { hold?: Partial<StatusInput["hold"]> } = {}): StatusInput => ({
  today: "2027-09-20",
  requirements: { calibration: true, verification: false },
  validity: { calibrationValidUntil: "2027-10-21", verificationValidUntil: null },
  leadDays: 30,
  ...over,
  hold: { lastDecision: "apt", impactPending: false, inCalibrationSince: null, ...over.hold },
});

describe("calibrationStatus (tabla del SPEC)", () => {
  it("1 · requiere calibración y no hay ningún registro apto", () => {
    expect(calibrationStatus(input({ validity: { calibrationValidUntil: null, verificationValidUntil: null }, hold: { lastDecision: null } })).status).toBe("never_calibrated");
  });
  it("2 · el día anterior a la ventana de aviso: vigente", () => {
    expect(calibrationStatus(input({ today: "2027-09-20" })).status).toBe("valid");
  });
  it("3 · primer día de la ventana (inclusive): por vencer", () => {
    expect(calibrationStatus(input({ today: "2027-09-21" })).status).toBe("due_soon");
  });
  it("4 · último día utilizable: por vencer", () => {
    expect(calibrationStatus(input({ today: "2027-10-21" })).status).toBe("due_soon");
  });
  it("5 · al día siguiente: vencido", () => {
    const s = calibrationStatus(input({ today: "2027-10-22" }));
    expect(s.status).toBe("expired");
    expect(s.nextDueAt).toBe("2027-10-21");
  });
  it("6 · envío abierto con calibración vigente: en calibración", () => {
    expect(calibrationStatus(input({ hold: { inCalibrationSince: "2027-09-01" } })).status).toBe("in_calibration");
  });
  it("7 · último registro no apto con un anterior vigente: no apto (el último manda)", () => {
    const s = calibrationStatus(input({ hold: { lastDecision: "not_apt" } }));
    expect(s.status).toBe("not_apt");
  });
  it("8 · un registro apto posterior a uno no apto: vigente", () => {
    expect(calibrationStatus(input({ hold: { lastDecision: "apt" } })).status).toBe("valid");
  });
  it("9 · calibración vigente y verificación vencida: rige la peor", () => {
    const s = calibrationStatus(
      input({
        today: "2027-06-01",
        requirements: { calibration: true, verification: true },
        validity: { calibrationValidUntil: "2027-10-21", verificationValidUntil: "2027-05-31" },
      }),
    );
    expect(s).toMatchObject({ status: "expired", nextDueAt: "2027-05-31", dueKind: "verification" });
  });
  it("10 · último registro apto con evaluación de impacto pendiente", () => {
    expect(calibrationStatus(input({ hold: { impactPending: true } })).status).toBe("impact_pending");
  });
  it("11 · ni calibración ni verificación requeridas: sin control metrológico", () => {
    expect(calibrationStatus(input({ requirements: { calibration: false, verification: false } })).status).toBe("not_required");
  });
  it("precedencia: en calibración > no apto > evaluación > sin calibración inicial > vencido", () => {
    const all = input({
      today: "2028-01-01",
      hold: { inCalibrationSince: "2027-12-01", lastDecision: "not_apt", impactPending: true },
    });
    expect(calibrationStatus(all).reasons).toEqual(["in_calibration", "not_apt", "impact_pending", "expired"]);
    expect(calibrationStatus({ ...all, hold: { ...all.hold, inCalibrationSince: null } }).status).toBe("not_apt");
    expect(calibrationStatus({ ...all, hold: { ...all.hold, inCalibrationSince: null, lastDecision: "apt" } }).status).toBe("impact_pending");
  });
});

describe("instrumentUsability", () => {
  it("se usa solo en servicio y vigente, por vencer o sin control", () => {
    for (const status of ["valid", "due_soon", "not_required"] as const) {
      expect(instrumentUsability({ assetStatus: "in_service", status }).usable).toBe(true);
    }
    for (const status of ["expired", "not_apt", "in_calibration", "never_calibrated", "impact_pending"] as const) {
      expect(instrumentUsability({ assetStatus: "in_service", status }).usable).toBe(false);
    }
  });
  it("un equipo vigente pero fuera de servicio o dado de baja no se usa", () => {
    expect(instrumentUsability({ assetStatus: "out_of_service", status: "valid" }).usable).toBe(false);
    expect(instrumentUsability({ assetStatus: "retired", status: "valid" }).usable).toBe(false);
  });
  it("explica el motivo con la fecha y qué hacer", () => {
    expect(instrumentUsability({ assetStatus: "in_service", status: "expired", nextDueAt: "2026-09-12", dueKind: "calibration" })).toEqual({
      usable: false,
      reason: "Calibración vencida el 12/09/2026",
      action: "Cargar la nueva calibración",
    });
    expect(instrumentUsability({ assetStatus: "in_service", status: "in_calibration", expectedReturnAt: "2026-10-30" }).reason).toContain("30/10/2026");
  });
});

describe("wasInstrumentValidOn", () => {
  const rec = (over: Partial<RecordSummary> = {}): RecordSummary => ({
    kind: "calibration",
    status: "closed",
    performedAt: "2026-01-10",
    closedAt: "2026-01-11T10:00:00Z",
    asLeftResult: "apt",
    validUntil: "2027-01-10",
    ...over,
  });
  it("una medición con fecha dentro de la vigencia pasada es válida aunque hoy esté vencido", () => {
    expect(wasInstrumentValidOn([rec()], "2026-06-01")).toBe(true);
    expect(wasInstrumentValidOn([rec()], "2027-01-10")).toBe(true);
    expect(wasInstrumentValidOn([rec()], "2027-01-11")).toBe(false);
    expect(wasInstrumentValidOn([rec()], "2026-01-09")).toBe(false);
  });
  it("no cuentan los anulados, los borradores ni los no aptos", () => {
    expect(wasInstrumentValidOn([rec({ status: "voided" }), rec({ status: "draft" }), rec({ asLeftResult: "not_apt", validUntil: null })], "2026-06-01")).toBe(false);
  });
});

describe("deriveControl", () => {
  const reqs = { calibration: true, verification: false };
  const rec = (performedAt: string, over: Partial<RecordSummary> = {}): RecordSummary => ({
    kind: "calibration",
    status: "closed",
    performedAt,
    closedAt: `${performedAt}T12:00:00Z`,
    asLeftResult: "apt",
    validUntil: performedAt.replace(/^\d{4}/, (y) => String(Number(y) + 1)),
    ...over,
  });
  const derive = (records: RecordSummary[], extra: Partial<Parameters<typeof deriveControl>[0]> = {}) =>
    deriveControl({ requirements: reqs, records, pendingAssessments: 0, openShipment: null, ...extra });

  it("sin registros no hay nada derivado", () => {
    expect(derive([])).toEqual({
      calibrationValidUntil: null,
      verificationValidUntil: null,
      nextDueAt: null,
      lastDecision: null,
      impactPending: false,
      inCalibrationSince: null,
      expectedReturnAt: null,
    });
  });
  it("manda el último apto; uno anulado no cuenta y el anterior vuelve a regir", () => {
    const old = rec("2025-03-01");
    const recent = rec("2026-03-01");
    expect(derive([old, recent]).calibrationValidUntil).toBe("2027-03-01");
    expect(derive([old, { ...recent, status: "voided" }]).calibrationValidUntil).toBe("2026-03-01");
  });
  it("un último registro no apto marca la decisión y conserva la vigencia del apto anterior", () => {
    const d = derive([rec("2026-03-01"), rec("2026-08-01", { asLeftResult: "not_apt", validUntil: null })]);
    expect(d.lastDecision).toBe("not_apt");
    expect(d.calibrationValidUntil).toBe("2027-03-01");
  });
  it("el vencimiento es el menor de los controles exigidos", () => {
    const d = derive([rec("2026-03-01"), rec("2026-09-01", { kind: "verification", validUntil: "2026-12-01" })], {
      requirements: { calibration: true, verification: true },
    });
    expect(d.nextDueAt).toBe("2026-12-01");
    expect(derive([rec("2026-03-01"), rec("2026-09-01", { kind: "verification", validUntil: "2026-12-01" })]).nextDueAt).toBe("2027-03-01");
  });
  it("envío abierto y evaluación pendiente", () => {
    const d = derive([], { pendingAssessments: 1, openShipment: { sentAt: "2026-09-01", expectedReturnAt: "2026-09-20" } });
    expect(d).toMatchObject({ impactPending: true, inCalibrationSince: "2026-09-01", expectedReturnAt: "2026-09-20" });
  });
});

describe("validateControlConfig", () => {
  const channel = { key: "h2s", label: "H₂S", unit: "ppm", rangeMin: 0, rangeMax: 100, emp: { abs: 0, pctReading: 10, pctFullScale: 0 }, active: true };
  const base = { magnitude: "gas_concentration", requiresCalibration: true, calibrationIntervalMonths: 6, channels: [channel] };

  it("acepta una configuración completa y aplica los valores por defecto", () => {
    const r = validateControlConfig(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toMatchObject({ decisionRule: "guard_band", alertLeadDays: 30, criticalUse: false });
  });
  it("12 · sin ningún control exige justificación", () => {
    const r = validateControlConfig({ magnitude: "other" });
    expect(r.ok).toBe(false);
    expect(validateControlConfig({ magnitude: "other", noControlReason: "Indicativo, no decide nada" }).ok).toBe(true);
  });
  it("exige intervalo para cada control requerido", () => {
    const r = validateControlConfig({ ...base, calibrationIntervalMonths: undefined });
    expect(r.ok === false && r.issues.map((i) => i.field)).toContain("calibrationIntervalMonths");
  });
  it("rechaza un EMP en cero", () => {
    const r = validateControlConfig({ ...base, channels: [{ ...channel, emp: { abs: 0, pctReading: 0, pctFullScale: 0 } }] });
    expect(r.ok).toBe(false);
  });
  it("una regla distinta de la de banda de guarda necesita justificación", () => {
    expect(validateControlConfig({ ...base, decisionRule: "simple_acceptance" }).ok).toBe(false);
    expect(validateControlConfig({ ...base, decisionRule: "simple_acceptance", decisionRuleReason: "Lo pide el cliente" }).ok).toBe(true);
  });
  it("exige un canal activo si se evalúa por puntos y rechaza canales repetidos", () => {
    expect(validateControlConfig({ ...base, channels: [] }).ok).toBe(false);
    expect(validateControlConfig({ ...base, channels: [channel, channel] }).ok).toBe(false);
  });
  it("uso crítico necesita su motivo", () => {
    expect(validateControlConfig({ ...base, criticalUse: true }).ok).toBe(false);
  });
});

describe("permisos de Equipos de medición (SPEC)", () => {
  const can = (role: "viewer" | "contributor" | "process_owner" | "tenant_admin", action: Parameters<typeof canTenantRole>[1]) => canTenantRole(role, action);

  it("configurar el equipo, anular y evaluar impacto: admin y responsable de proceso", () => {
    expect(can("tenant_admin", "manage_calibration")).toBe(true);
    expect(can("process_owner", "manage_calibration")).toBe(true);
    expect(can("contributor", "manage_calibration")).toBe(false);
    expect(can("viewer", "manage_calibration")).toBe(false);
  });
  it("cargar calibraciones usa «write»: el colaborador sí, el lector no", () => {
    expect(can("contributor", "write")).toBe(true);
    expect(can("viewer", "write")).toBe(false);
  });
});

describe("exportación CSV", () => {
  it("escapa, no deja que una celda se tome por fórmula y usa los estados en español", () => {
    const csv = instrumentsToCsv([
      { code: "DET-1", description: '=HYPERLINK("x")', magnitude: "gas_concentration", site: "Base; Norte", responsible: null, status: "expired", usable: false, reason: "Calibración vencida el 12/09/2026", nextDueAt: "2026-09-12" },
    ]);
    expect(csv.startsWith("﻿Código;Equipo;")).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"Base; Norte"');
    expect(csv).toContain(";Vencido;No;Calibración vencida el 12/09/2026;12/09/2026");
  });
});

describe("descripciones en lenguaje llano", () => {
  it("EMP y regla", () => {
    const ch = { unit: "ppm", emp: { abs: 0.5, pctReading: 10, pctFullScale: 0 } };
    expect(describeEmp(ch)).toBe("±(0,5 ppm + 10 % de la lectura)");
    expect(describeRule("guard_band", ch)).toBe("Se acepta si el error más la incertidumbre no supera ±(0,5 ppm + 10 % de la lectura).");
  });
});
