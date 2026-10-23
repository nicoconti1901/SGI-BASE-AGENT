import { z } from "zod";
import type { Numeric } from "./decimal";

/** Clave del tipo de activo de los equipos de medición. No está en el registro de inspecciones: tiene su propio módulo. */
export const INSTRUMENT_TYPE_KEY = "measuring_equipment";

export const DECISION_RULES = ["guard_band", "simple_acceptance", "certificate_statement"] as const;
export type DecisionRule = (typeof DECISION_RULES)[number];

export const DECISION_RULE_LABELS: Record<DecisionRule, string> = {
  guard_band: "Error más incertidumbre dentro del máximo permitido",
  simple_acceptance: "Error dentro del máximo permitido",
  certificate_statement: "Declaración «conforme» del laboratorio",
};

export const RECORD_KINDS = ["calibration", "verification"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
export const RECORD_KIND_LABELS: Record<RecordKind, string> = { calibration: "Calibración", verification: "Verificación" };

export const TRACEABILITIES = ["nmi", "accredited_lab", "other_lab", "in_house"] as const;
export type Traceability = (typeof TRACEABILITIES)[number];
export const TRACEABILITY_LABELS: Record<Traceability, string> = {
  nmi: "Instituto nacional de metrología (INTI)",
  accredited_lab: "Laboratorio acreditado",
  other_lab: "Otro laboratorio",
  in_house: "Verificación interna",
};

export type Result = "apt" | "not_apt";

/** Coeficientes del error máximo permitido (EMP) de un canal; los tres son decimales no negativos. */
export type EmpSpec = { abs: Numeric; pctReading: Numeric; pctFullScale: Numeric };

const toNumber = (v: Numeric): number => (typeof v === "number" ? v : v.trim() === "" ? Number.NaN : Number(v.replace(",", ".")));

const nonNegative = z
  .union([z.number(), z.string()])
  .refine((v) => Number.isFinite(toNumber(v)), "Indicá un número")
  .refine((v) => toNumber(v) >= 0, "No puede ser negativo");

const anyNumber = z.union([z.number(), z.string()]).refine((v) => Number.isFinite(toNumber(v)), "Indicá un número");

/** Un canal es un sensor o magnitud del equipo (un multigás tiene O₂, CO, H₂S y LEL). */
export const channelSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, "Cada canal necesita una clave")
      .max(30)
      .regex(/^[a-z0-9_]+$/, "La clave admite minúsculas, números y guion bajo"),
    label: z.string().trim().min(1, "Cada canal necesita un nombre").max(60),
    unit: z.string().trim().min(1, "Indicá la unidad").max(20),
    rangeMin: anyNumber,
    rangeMax: anyNumber,
    resolution: nonNegative.optional(),
    emp: z.object({ abs: nonNegative, pctReading: nonNegative, pctFullScale: nonNegative }),
    requiredPoints: z.number().int().min(1).max(20).optional(),
    active: z.boolean().default(true),
  })
  .refine((c) => toNumber(c.rangeMax) > toNumber(c.rangeMin), { message: "El máximo del rango debe ser mayor que el mínimo", path: ["rangeMax"] })
  .refine((c) => [c.emp.abs, c.emp.pctReading, c.emp.pctFullScale].some((v) => toNumber(v) > 0), {
    message: "El error máximo permitido no puede ser cero: indicá al menos un valor",
    path: ["emp"],
  });
export type Channel = z.infer<typeof channelSchema>;

export const channelsSchema = z
  .array(channelSchema)
  .max(12, "Hasta 12 canales por equipo")
  .superRefine((channels, ctx) => {
    const seen = new Set<string>();
    channels.forEach((c, index) => {
      if (seen.has(c.key)) ctx.addIssue({ code: "custom", message: `Canal repetido: ${c.key}`, path: [index, "key"] });
      seen.add(c.key);
    });
  });

export type PointInput = {
  channelKey: string;
  nominal: Numeric;
  measured: Numeric;
  /** Incertidumbre expandida informada, en las unidades del mensurando. */
  uncertainty?: Numeric | null;
};

export type PointReason =
  | "within"
  | "error_exceeds_emp"
  | "in_guard_band"
  | "uncertainty_exceeds_emp"
  | "missing_uncertainty"
  | "emp_zero_at_point"
  | "invalid_value"
  | "unknown_channel";

export const POINT_REASON_LABELS: Record<PointReason, string> = {
  within: "Dentro del máximo permitido",
  error_exceeds_emp: "El error supera el máximo permitido",
  in_guard_band: "El error entra, pero con la incertidumbre se pasa del máximo",
  uncertainty_exceeds_emp: "La incertidumbre sola supera el máximo permitido",
  missing_uncertainty: "Falta la incertidumbre",
  emp_zero_at_point: "El máximo permitido vale cero en este punto: usá otro punto o definí un piso absoluto",
  invalid_value: "Valor inválido",
  unknown_channel: "Canal inexistente",
};

export type PointResult = {
  channelKey: string;
  unit: string;
  nominal: string;
  measured: string;
  uncertainty: string | null;
  /** medido − nominal */
  error: string;
  /** EMP aplicado en este punto. */
  emp: string;
  /** EMP − (|error| + U), o EMP − |error| con aceptación simple. Negativo: no pasa. */
  margin: string | null;
  ok: boolean;
  reason: PointReason;
  /** Falla definitiva (cuenta como no apto) o dato que falta (deja el registro incompleto). */
  incomplete: boolean;
};

export type IncompleteCode =
  | "missing_channel"
  | "missing_points"
  | "no_points"
  | "missing_statement"
  | "missing_spec"
  | "missing_decision_rule"
  | "certificate_not_allowed_for_critical_use"
  | PointReason;

export type IncompleteReason = { code: IncompleteCode; channelKey?: string; message: string };

export type DecisionBasis = "points" | "certificate_statement";

export type Decision = {
  result: Result | "incomplete";
  basis: DecisionBasis;
  points: PointResult[];
  incompleteReasons: IncompleteReason[];
};

export type LabStatement = {
  statement: "conforme" | "no_conforme";
  /** Especificación contra la que el laboratorio declaró conformidad. */
  spec?: string | null;
  /** Regla de decisión que usó el laboratorio. */
  decisionRule?: string | null;
};

export const MAGNITUDES = [
  "gas_concentration",
  "pressure",
  "temperature",
  "mass",
  "sound_level",
  "illuminance",
  "earth_resistance",
  "length",
  "electrical",
  "flow",
  "humidity",
  "torque",
  "other",
] as const;
export type Magnitude = (typeof MAGNITUDES)[number];

export type MagnitudeDef = { label: string; calibrationMonths: number; intervalReason: string };

/** Sugerencias editables por magnitud. No hay un intervalo normativo universal. */
export const MAGNITUDE_DEFS: Record<Magnitude, MagnitudeDef> = {
  gas_concentration: { label: "Concentración de gas", calibrationMonths: 6, intervalReason: "Detectores portátiles de gases: tope de 180 días de varios fabricantes." },
  pressure: { label: "Presión", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  temperature: { label: "Temperatura", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  mass: { label: "Masa (balanzas)", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  sound_level: { label: "Nivel sonoro (sonómetros)", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  illuminance: { label: "Iluminancia (luxímetros)", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  earth_resistance: { label: "Resistencia de puesta a tierra", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  length: { label: "Longitud y dimensiones", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  electrical: { label: "Magnitudes eléctricas", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  flow: { label: "Caudal", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  humidity: { label: "Humedad", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  torque: { label: "Torque", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
  other: { label: "Otra magnitud", calibrationMonths: 12, intervalReason: "Intervalo general sugerido." },
};

export function isMagnitude(value: string): value is Magnitude {
  return (MAGNITUDES as readonly string[]).includes(value);
}

export function magnitudeLabel(value: string): string {
  return isMagnitude(value) ? MAGNITUDE_DEFS[value].label : value;
}
