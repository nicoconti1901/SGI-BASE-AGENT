import { describe, expect, it } from "vitest";
import {
  closeIssues,
  computeRecordOutcome,
  evaluateStoredPoints,
  recordFieldIssues,
  recordWarnings,
  type Channel,
  type OutcomeInput,
  type RecordFields,
} from "@/domain/calibration";

const TODAY = "2027-06-15";

const h2s: Channel = { key: "h2s", label: "H₂S", unit: "ppm", rangeMin: 0, rangeMax: 100, emp: { abs: 0, pctReading: 10, pctFullScale: 0 }, active: true };
const co: Channel = { ...h2s, key: "co", label: "CO" };

const control = (over: Partial<OutcomeInput["control"]> = {}): OutcomeInput["control"] => ({
  decisionRule: "guard_band",
  criticalUse: false,
  channels: [h2s],
  calibrationIntervalMonths: 6,
  verificationIntervalMonths: 1,
  ...over,
});

const outcome = (over: Partial<OutcomeInput> = {}) =>
  computeRecordOutcome({
    control: control(),
    kind: "calibration",
    performedAt: "2027-06-10",
    basis: "points",
    adjusted: false,
    asFoundPoints: [
      { channelKey: "h2s", nominal: 10, measured: 10.5, uncertainty: 0.3 },
      { channelKey: "h2s", nominal: 25, measured: 27.2, uncertainty: 0.3 },
      { channelKey: "h2s", nominal: 50, measured: 53, uncertainty: 0.5 },
    ],
    asLeftPoints: [],
    ...over,
  });

const fields = (over: Partial<RecordFields> = {}): RecordFields => ({
  kind: "calibration",
  performedAt: "2027-06-10",
  labName: "INTI",
  traceability: "nmi",
  basis: "points",
  ...over,
});

describe("computeRecordOutcome", () => {
  it("detector de 3 puntos (caso 9): apto, vigente 6 meses desde la ejecución", () => {
    const o = outcome();
    expect(o).toMatchObject({ complete: true, asFoundResult: "apt", asLeftResult: "apt", ruleApplied: "guard_band", intervalMonthsApplied: 6, validUntil: "2027-12-10" });
  });

  it("caso 10: un punto fuera deja el equipo no apto y sin vigencia", () => {
    const o = outcome({ asFoundPoints: [{ channelKey: "h2s", nominal: 50, measured: 55.6, uncertainty: 0.5 }] });
    expect(o).toMatchObject({ complete: true, asFoundResult: "not_apt", asLeftResult: "not_apt", validUntil: null });
  });

  it("incompleto si falta la incertidumbre: no se puede cerrar", () => {
    const o = outcome({ asFoundPoints: [{ channelKey: "h2s", nominal: 10, measured: 10.2, uncertainty: null }] });
    expect(o.complete).toBe(false);
    expect(o.asLeftResult).toBeNull();
    expect(o.validUntil).toBeNull();
  });

  it("la verificación usa su propio intervalo", () => {
    expect(outcome({ kind: "verification" })).toMatchObject({ intervalMonthsApplied: 1, validUntil: "2027-07-10" });
  });

  it("ajustado: as-found fuera y as-left dentro → vuelve a servir pero el as-found queda no apto", () => {
    const o = outcome({
      adjusted: true,
      asFoundPoints: [{ channelKey: "h2s", nominal: 50, measured: 58, uncertainty: 0.5 }],
      asLeftPoints: [{ channelKey: "h2s", nominal: 50, measured: 50.5, uncertainty: 0.5 }],
    });
    expect(o).toMatchObject({ complete: true, asFoundResult: "not_apt", asLeftResult: "apt", validUntil: "2027-12-10" });
  });

  it("ajustado sin as-found: no evaluado", () => {
    const o = outcome({ adjusted: true, asFoundPoints: [], asLeftPoints: [{ channelKey: "h2s", nominal: 50, measured: 50.5, uncertainty: 0.5 }] });
    expect(o).toMatchObject({ complete: true, asFoundResult: "not_evaluated", asLeftResult: "apt", missingAsFound: true });
  });

  it("ajustado sin as-left: incompleto", () => {
    const o = outcome({ adjusted: true, asFoundPoints: [{ channelKey: "h2s", nominal: 50, measured: 50.5, uncertainty: 0.5 }], asLeftPoints: [] });
    expect(o.complete).toBe(false);
  });

  it("declaración del laboratorio en un equipo por puntos: queda anotado por qué se aceptó", () => {
    const o = outcome({ basis: "certificate_statement", asFoundPoints: [], labStatement: { statement: "conforme", spec: "Manual del fabricante", decisionRule: "ILAC-G8" } });
    expect(o).toMatchObject({ ruleApplied: "certificate_statement", asLeftResult: "apt", validUntil: "2027-12-10" });
    expect(o.ruleReasonApplied).toMatch(/declaración del laboratorio/);
  });

  it("declaración «conforme» en un equipo de uso crítico: incompleta", () => {
    const o = outcome({
      control: control({ criticalUse: true }),
      basis: "certificate_statement",
      asFoundPoints: [],
      labStatement: { statement: "conforme", spec: "x", decisionRule: "y" },
    });
    expect(o.complete).toBe(false);
    expect(o.incompleteReasons[0].code).toBe("certificate_not_allowed_for_critical_use");
  });

  it("un equipo configurado por declaración ignora el ajuste y usa la declaración", () => {
    const o = outcome({
      control: control({ decisionRule: "certificate_statement", decisionRuleReason: "El laboratorio informa conformidad" }),
      adjusted: true,
      asFoundPoints: [],
      labStatement: { statement: "no_conforme" },
    });
    expect(o).toMatchObject({ complete: true, asLeftResult: "not_apt", ruleApplied: "certificate_statement", ruleReasonApplied: "El laboratorio informa conformidad" });
  });

  it("sin intervalo no hay vigencia aunque sea apto", () => {
    expect(outcome({ control: control({ calibrationIntervalMonths: null }) }).validUntil).toBeNull();
  });
});

describe("evaluateStoredPoints", () => {
  it("evalúa cada punto con su canal y salta los de canales inactivos", () => {
    const rows = evaluateStoredPoints(
      "guard_band",
      [h2s, { ...co, active: false }],
      [
        { channelKey: "h2s", nominal: 10, measured: 10.2, uncertainty: 0.2 },
        { channelKey: "co", nominal: 10, measured: 99, uncertainty: 0.2 },
      ],
    );
    expect(rows[0]).toMatchObject({ error: "0.2", emp: "1", ok: true, reason: "within" });
    expect(rows[1]).toBeNull();
  });

  it("con declaración del laboratorio no hay puntos que evaluar", () => {
    expect(evaluateStoredPoints("certificate_statement", [h2s], [{ channelKey: "h2s", nominal: 1, measured: 1 }])).toEqual([null]);
  });
});

describe("recordFieldIssues", () => {
  const messages = (f: RecordFields, assetId?: string) => recordFieldIssues(f, TODAY, assetId).map((i) => i.field);

  it("un registro completo no tiene problemas", () => {
    expect(messages(fields())).toEqual([]);
  });
  it("la fecha es obligatoria y no puede ser futura", () => {
    expect(messages(fields({ performedAt: "" }))).toEqual(["performedAt"]);
    expect(messages(fields({ performedAt: "2027-06-16" }))).toEqual(["performedAt"]);
    expect(messages(fields({ performedAt: TODAY }))).toEqual([]);
  });
  it("laboratorio acreditado pide organismo y número", () => {
    expect(messages(fields({ traceability: "accredited_lab" }))).toEqual(["accreditationBody", "accreditationNumber"]);
    expect(messages(fields({ traceability: "accredited_lab", accreditationBody: "OAA", accreditationNumber: "LC 123" }))).toEqual([]);
  });
  it("otro laboratorio pide documentar la base de la trazabilidad", () => {
    expect(messages(fields({ traceability: "other_lab" }))).toEqual(["traceabilityBasis"]);
  });
  it("verificación interna pide un patrón distinto del propio equipo", () => {
    expect(messages(fields({ traceability: "in_house" }))).toEqual(["referenceStandardAssetId"]);
    expect(messages(fields({ traceability: "in_house", referenceStandardAssetId: "a1" }), "a1")).toEqual(["referenceStandardAssetId"]);
    expect(messages(fields({ traceability: "in_house", referenceStandardAssetId: "p1" }), "a1")).toEqual([]);
  });
});

describe("closeIssues y advertencias", () => {
  it("sin certificado no se cierra, salvo una verificación interna", () => {
    expect(closeIssues({ ...fields(), attachmentCount: 0 }).map((i) => i.field)).toEqual(["certificate"]);
    expect(closeIssues({ ...fields(), attachmentCount: 1 })).toEqual([]);
    expect(closeIssues({ ...fields({ traceability: "in_house", referenceStandardAssetId: "p" }), attachmentCount: 0 })).toEqual([]);
  });
  it("avisa de otro laboratorio y de un alcance que no cubre el servicio", () => {
    expect(recordWarnings({ traceability: "other_lab" })).toHaveLength(1);
    expect(recordWarnings({ traceability: "accredited_lab", accreditationScopeCovers: false })).toHaveLength(1);
    expect(recordWarnings({ traceability: "accredited_lab", accreditationScopeCovers: true })).toHaveLength(0);
    expect(recordWarnings({ traceability: "nmi" })).toHaveLength(0);
  });
});
