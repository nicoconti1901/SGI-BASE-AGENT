import { ZERO, formatDecimalEs, parseDecimal, type Numeric } from "./decimal";
import type { Channel, DecisionRule } from "./types";

const es = (v: Numeric): string => {
  const d = parseDecimal(v);
  return d === null ? String(v) : formatDecimalEs(d);
};

const positive = (v: Numeric): boolean => (parseDecimal(v) ?? ZERO) > ZERO;

/** El error máximo permitido en lenguaje llano: «±0,5 ppm + 10 % de la lectura». */
export function describeEmp(channel: Pick<Channel, "emp" | "unit">): string {
  const parts: string[] = [];
  if (positive(channel.emp.abs)) parts.push(`${es(channel.emp.abs)} ${channel.unit}`);
  if (positive(channel.emp.pctReading)) parts.push(`${es(channel.emp.pctReading)} % de la lectura`);
  if (positive(channel.emp.pctFullScale)) parts.push(`${es(channel.emp.pctFullScale)} % del fondo de escala`);
  return parts.length > 0 ? `±(${parts.join(" + ")})` : "sin definir";
}

/** Cómo se decide si el equipo es apto, para mostrar en la ficha. */
export function describeRule(rule: DecisionRule, channel?: Pick<Channel, "emp" | "unit">): string {
  const limit = channel ? ` ${describeEmp(channel)}` : " el error máximo permitido";
  switch (rule) {
    case "guard_band":
      return `Se acepta si el error más la incertidumbre no supera${limit}.`;
    case "simple_acceptance":
      return `Se acepta si el error no supera${limit}, sin sumar la incertidumbre.`;
    case "certificate_statement":
      return "Se acepta lo que declara el laboratorio en el certificado (conforme o no conforme).";
  }
}
