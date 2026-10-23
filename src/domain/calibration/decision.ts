import { ZERO, absDecimal, formatDecimal, parseDecimal, percentOf, type Numeric } from "./decimal";
import {
  POINT_REASON_LABELS,
  type Channel,
  type Decision,
  type DecisionRule,
  type EmpSpec,
  type IncompleteReason,
  type LabStatement,
  type PointInput,
  type PointReason,
  type PointResult,
} from "./types";



function empAt(emp: EmpSpec, nominal: bigint, span: bigint): bigint | null {
  const abs = parseDecimal(emp.abs);
  const reading = parseDecimal(emp.pctReading);
  const fullScale = parseDecimal(emp.pctFullScale);
  if (abs === null || reading === null || fullScale === null) return null;
  return abs + percentOf(reading, absDecimal(nominal)) + percentOf(fullScale, span);
}

/**
 * Error máximo permitido en un punto: `abs + %lectura × |nominal| + %fondo de escala × rango`.
 * Devuelve el decimal como texto. Con todos los coeficientes en cero es un error de configuración.
 */
export function resolveEmp(emp: EmpSpec, nominal: Numeric, rangeSpan: Numeric): string {
  const n = parseDecimal(nominal);
  const span = parseDecimal(rangeSpan);
  if (n === null || span === null) throw new Error("Valor numérico inválido");
  const value = empAt(emp, n, span);
  if (value === null) throw new Error("Coeficiente del error máximo inválido");
  return formatDecimal(value);
}

function span(channel: Channel): bigint {
  const min = parseDecimal(channel.rangeMin) ?? ZERO;
  const max = parseDecimal(channel.rangeMax) ?? ZERO;
  return max - min;
}

function blank(channelKey: string, unit: string, p: PointInput, reason: PointReason): PointResult {
  const text = (v: Numeric | null | undefined) => {
    const d = parseDecimal(v);
    return d === null ? "" : formatDecimal(d);
  };
  return {
    channelKey,
    unit,
    nominal: text(p.nominal),
    measured: text(p.measured),
    uncertainty: text(p.uncertainty) || null,
    error: "",
    emp: "",
    margin: null,
    ok: false,
    reason,
    incomplete: true,
  };
}

/** Evalúa un punto contra su canal con la regla elegida. Los valores se comparan en decimal exacto. */
export function evaluatePoint(rule: Exclude<DecisionRule, "certificate_statement">, channel: Channel, p: PointInput): PointResult {
  const nominal = parseDecimal(p.nominal);
  const measured = parseDecimal(p.measured);
  const hasU = p.uncertainty !== null && p.uncertainty !== undefined && String(p.uncertainty).trim() !== "";
  const u = hasU ? parseDecimal(p.uncertainty) : null;
  if (nominal === null || measured === null || (hasU && (u === null || u < ZERO))) return blank(channel.key, channel.unit, p, "invalid_value");

  const error = measured - nominal;
  const emp = empAt(channel.emp, nominal, span(channel));
  const base = {
    channelKey: channel.key,
    unit: channel.unit,
    nominal: formatDecimal(nominal),
    measured: formatDecimal(measured),
    uncertainty: u === null ? null : formatDecimal(u),
    error: formatDecimal(error),
    emp: emp === null ? "" : formatDecimal(emp),
  };
  if (emp === null || emp <= ZERO) return { ...base, margin: null, ok: false, reason: "emp_zero_at_point", incomplete: true };

  const absError = absDecimal(error);
  if (rule === "guard_band") {
    if (u === null) return { ...base, margin: null, ok: false, reason: "missing_uncertainty", incomplete: true };
    const total = absError + u;
    const margin = formatDecimal(emp - total);
    if (total <= emp) return { ...base, margin, ok: true, reason: "within", incomplete: false };
    const reason: PointReason = absError > emp ? "error_exceeds_emp" : u > emp ? "uncertainty_exceeds_emp" : "in_guard_band";
    return { ...base, margin, ok: false, reason, incomplete: false };
  }
  // Aceptación simple: pasa si el error entra; si con la incertidumbre se pasa, es una advertencia, no una falla.
  const margin = formatDecimal(emp - absError);
  if (absError > emp) return { ...base, margin, ok: false, reason: "error_exceeds_emp", incomplete: false };
  const warning = u !== null && absError + u > emp;
  return { ...base, margin, ok: true, reason: warning ? "in_guard_band" : "within", incomplete: false };
}

function distinctNominals(points: PointInput[]): number {
  const set = new Set<string>();
  for (const p of points) {
    const n = parseDecimal(p.nominal);
    set.add(n === null ? `invalid:${String(p.nominal)}` : n.toString());
  }
  return set.size;
}

export type DecisionInput = {
  rule: DecisionRule;
  criticalUse: boolean;
  channels: Channel[];
  points: PointInput[];
  labStatement?: LabStatement | null;
};

function statementDecision(input: DecisionInput): Decision {
  const s = input.labStatement;
  const base = { basis: "certificate_statement" as const, points: [] as PointResult[] };
  if (!s) return { ...base, result: "incomplete", incompleteReasons: [{ code: "missing_statement", message: "Indicá lo que declara el certificado" }] };
  if (s.statement === "no_conforme") return { ...base, result: "not_apt", incompleteReasons: [] };
  const missing: IncompleteReason[] = [];
  if (input.criticalUse) {
    missing.push({
      code: "certificate_not_allowed_for_critical_use",
      message: "En un equipo de uso crítico no alcanza la declaración «conforme»: cargá los puntos medidos",
    });
  }
  if (!s.spec?.trim()) missing.push({ code: "missing_spec", message: "Falta la especificación contra la que el laboratorio declaró conformidad" });
  if (!s.decisionRule?.trim()) missing.push({ code: "missing_decision_rule", message: "Falta la regla de decisión que usó el laboratorio" });
  return missing.length > 0 ? { ...base, result: "incomplete", incompleteReasons: missing } : { ...base, result: "apt", incompleteReasons: [] };
}

/**
 * Decide si el equipo es apto con los puntos medidos y la regla elegida. Es una función pura:
 * nadie tipea el resultado. «No apto» manda sobre «incompleto»: si un punto ya falla, el equipo no sirve
 * aunque falten otros datos.
 */
export function calibrationDecision(input: DecisionInput): Decision {
  if (input.rule === "certificate_statement") return statementDecision(input);

  const rule = input.rule;
  const active = input.channels.filter((c) => c.active);
  const byKey = new Map(input.channels.map((c) => [c.key, c]));
  const results: PointResult[] = [];
  const reasons: IncompleteReason[] = [];
  const pointsByChannel = new Map<string, PointInput[]>();

  for (const p of input.points) {
    const channel = byKey.get(p.channelKey);
    if (!channel) {
      const r = blank(p.channelKey, "", p, "unknown_channel");
      results.push(r);
      reasons.push({ code: "unknown_channel", channelKey: p.channelKey, message: POINT_REASON_LABELS.unknown_channel });
      continue;
    }
    if (!channel.active) continue; // un sensor retirado no cuenta
    results.push(evaluatePoint(rule, channel, p));
    pointsByChannel.set(channel.key, [...(pointsByChannel.get(channel.key) ?? []), p]);
  }

  for (const r of results) {
    if (r.incomplete && r.reason !== "unknown_channel") {
      reasons.push({ code: r.reason, channelKey: r.channelKey, message: `${POINT_REASON_LABELS[r.reason]} (${r.channelKey}, nominal ${r.nominal || "?"})` });
    }
  }

  if (active.length === 0) {
    reasons.push({ code: "no_points", message: "El equipo no tiene canales activos para evaluar" });
  }
  for (const channel of active) {
    const own = pointsByChannel.get(channel.key) ?? [];
    if (own.length === 0) {
      reasons.push({ code: "missing_channel", channelKey: channel.key, message: `Falta cargar puntos del canal ${channel.label}` });
    } else if (channel.requiredPoints && distinctNominals(own) < channel.requiredPoints) {
      reasons.push({
        code: "missing_points",
        channelKey: channel.key,
        message: `El canal ${channel.label} pide al menos ${channel.requiredPoints} puntos distintos`,
      });
    }
  }

  const failed = results.some((r) => !r.incomplete && !r.ok);
  const result = failed ? "not_apt" : reasons.length > 0 ? "incomplete" : "apt";
  return { result, basis: "points", points: results, incompleteReasons: failed ? [] : reasons };
}
