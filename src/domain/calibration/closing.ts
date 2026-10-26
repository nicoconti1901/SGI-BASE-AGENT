import { evaluateRecord, validUntil, type EvaluatedRecord } from "./record";
import { evaluatePoint } from "./decision";
import { isIsoDate } from "@/domain/inspections/dates";
import type { Channel, DecisionRule, LabStatement, PointInput, PointResult, RecordKind, Traceability } from "./types";

export type RecordFieldIssue = { field: string; message: string };

/** Datos del certificado, como los carga la persona. Sirven para guardar el borrador y para cerrar. */
export type RecordFields = {
  kind: RecordKind;
  performedAt: string;
  labName: string;
  traceability: Traceability;
  accreditationBody?: string | null;
  accreditationNumber?: string | null;
  accreditationScopeCovers?: boolean | null;
  traceabilityBasis?: string | null;
  referenceStandardAssetId?: string | null;
  basis: "points" | "certificate_statement";
};

const blank = (v: string | null | undefined) => !v || v.trim() === "";

/**
 * Reglas de forma del registro (SPEC decisiones 17–19). Los mensajes están listos para mostrar.
 * El patrón de una verificación interna también debe estar vigente, pero eso se comprueba contra la base.
 */
export function recordFieldIssues(input: RecordFields, today: string, assetId?: string): RecordFieldIssue[] {
  const issues: RecordFieldIssue[] = [];
  if (!isIsoDate(input.performedAt)) issues.push({ field: "performedAt", message: "Indicá la fecha en que se hizo la calibración" });
  else if (input.performedAt > today) issues.push({ field: "performedAt", message: "La fecha de ejecución no puede ser futura" });
  if (input.labName.trim().length < 2) issues.push({ field: "labName", message: input.traceability === "in_house" ? "Indicá quién hizo la verificación" : "Indicá el laboratorio" });
  switch (input.traceability) {
    case "accredited_lab":
      if (blank(input.accreditationBody)) issues.push({ field: "accreditationBody", message: "Indicá el organismo que acredita al laboratorio" });
      if (blank(input.accreditationNumber)) issues.push({ field: "accreditationNumber", message: "Indicá el número de acreditación" });
      break;
    case "other_lab":
      if (blank(input.traceabilityBasis)) issues.push({ field: "traceabilityBasis", message: "Explicá cómo se asegura la trazabilidad de este laboratorio" });
      break;
    case "in_house":
      if (blank(input.referenceStandardAssetId)) issues.push({ field: "referenceStandardAssetId", message: "Elegí el equipo patrón con el que se verificó" });
      else if (assetId && input.referenceStandardAssetId === assetId) issues.push({ field: "referenceStandardAssetId", message: "Un equipo no puede ser su propio patrón" });
      break;
    case "nmi":
      break;
  }
  return issues;
}

/** Para cerrar, además: el certificado es evidencia obligatoria salvo en una verificación interna. */
export function closeIssues(input: RecordFields & { attachmentCount: number }): RecordFieldIssue[] {
  const issues: RecordFieldIssue[] = [];
  if (input.traceability !== "in_house" && input.attachmentCount < 1) {
    issues.push({ field: "certificate", message: "Adjuntá el certificado (PDF o imagen) antes de cerrar. Mientras tanto podés guardar el borrador" });
  }
  return issues;
}

/** Advertencias que no impiden guardar pero conviene leer. */
export function recordWarnings(input: Pick<RecordFields, "traceability" | "accreditationScopeCovers">): string[] {
  const out: string[] = [];
  if (input.traceability === "other_lab") out.push("Un laboratorio sin acreditación ni instituto nacional: documentá en la trazabilidad por qué sus patrones son confiables.");
  if (input.traceability === "accredited_lab" && input.accreditationScopeCovers === false) {
    out.push("Si el alcance de la acreditación no cubre este servicio, la trazabilidad puede ser cuestionada por un auditor.");
  }
  return out;
}

export type OutcomeInput = {
  control: {
    decisionRule: DecisionRule;
    decisionRuleReason?: string | null;
    criticalUse: boolean;
    channels: Channel[];
    calibrationIntervalMonths?: number | null;
    verificationIntervalMonths?: number | null;
  };
  kind: RecordKind;
  performedAt: string;
  basis: "points" | "certificate_statement";
  adjusted: boolean;
  asFoundPoints: PointInput[];
  asLeftPoints: PointInput[];
  labStatement?: LabStatement | null;
};

export type RecordOutcome = EvaluatedRecord & {
  /** Regla con la que se decidió: se guarda en el registro y no cambia aunque después cambie la del equipo. */
  ruleApplied: DecisionRule;
  ruleReasonApplied: string | null;
  intervalMonthsApplied: number | null;
  validUntil: string | null;
};

/**
 * Resultado de un registro a partir de sus puntos. Es la única función que decide: la usan el cierre en el servidor
 * y el cálculo en vivo del formulario, así lo que se ve es lo que se guarda.
 * Si el equipo se evalúa por declaración del laboratorio, o el certificado solo trae «conforme», manda la declaración.
 */
export function computeRecordOutcome(input: OutcomeInput): RecordOutcome {
  const statement = input.basis === "certificate_statement" || input.control.decisionRule === "certificate_statement";
  const ruleApplied: DecisionRule = statement ? "certificate_statement" : input.control.decisionRule;
  const evaluation = evaluateRecord({
    rule: ruleApplied,
    criticalUse: input.control.criticalUse,
    channels: input.control.channels,
    adjusted: input.adjusted && !statement,
    asFoundPoints: input.asFoundPoints,
    asLeftPoints: input.asLeftPoints,
    labStatement: input.labStatement,
  });
  const intervalMonthsApplied = (input.kind === "calibration" ? input.control.calibrationIntervalMonths : input.control.verificationIntervalMonths) ?? null;
  return {
    ...evaluation,
    ruleApplied,
    ruleReasonApplied: statement && input.control.decisionRule !== "certificate_statement" ? "Se aceptó la declaración del laboratorio en el certificado" : (input.control.decisionRuleReason ?? null),
    intervalMonthsApplied,
    validUntil: evaluation.asLeftResult ? validUntil({ performedAt: input.performedAt, intervalMonths: intervalMonthsApplied, asLeftResult: evaluation.asLeftResult }) : null,
  };
}

/**
 * Resultado de cada punto para guardarlo al cerrar. Los puntos de un canal inactivo no se evalúan.
 * Con aceptación simple, un punto dentro del máximo pero con la incertidumbre pasada queda `ok` con la advertencia en `reason`.
 */
export function evaluateStoredPoints(rule: DecisionRule, channels: Channel[], points: PointInput[]): (PointResult | null)[] {
  if (rule === "certificate_statement") return points.map(() => null);
  const byKey = new Map(channels.map((c) => [c.key, c]));
  return points.map((p) => {
    const channel = byKey.get(p.channelKey);
    return channel && channel.active ? evaluatePoint(rule, channel, p) : null;
  });
}
