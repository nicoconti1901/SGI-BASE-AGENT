/**
 * Aritmética decimal exacta para la regla de decisión. Un `number` binario falla en el límite
 * (0,4 − 0,1 = 0,30000000000000004): acá los valores son enteros escalados a 12 decimales.
 */

export type Numeric = number | string;

const DIGITS = 12;
export const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const SCALE = BigInt(10) ** BigInt(DIGITS);
const DECIMAL = /^([+-]?)(\d*)(?:[.,](\d*))?$/;

/** Lee un decimal ("10,5", "10.5", 10.5). Devuelve `null` si no es un número finito o tiene más de 12 decimales. */
export function parseDecimal(input: Numeric | null | undefined): bigint | null {
  if (input === null || input === undefined) return null;
  let text: string;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    text = /e/i.test(String(input)) ? input.toFixed(DIGITS) : String(input);
  } else {
    text = input.trim();
  }
  const m = DECIMAL.exec(text);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) return null;
  const frac = m[3] ?? "";
  if (frac.replace(/0+$/, "").length > DIGITS) return null;
  const whole = BigInt(m[2] || "0") * SCALE;
  const part = BigInt((frac + "0".repeat(DIGITS)).slice(0, DIGITS));
  const value = whole + part;
  return m[1] === "-" ? -value : value;
}

export function absDecimal(a: bigint): bigint {
  return a < ZERO ? -a : a;
}

/** a × b / 100 (porcentaje), truncado al décimo segundo decimal. */
export function percentOf(percent: bigint, base: bigint): bigint {
  return (percent * base) / (SCALE * HUNDRED);
}

/** Texto con coma-punto neutro (punto) y sin ceros de más: 300000000000 → "0.3". */
export function formatDecimal(value: bigint): string {
  const negative = value < ZERO;
  const abs = negative ? -value : value;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(DIGITS, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** Para mostrar en pantalla con coma decimal: "0,3". */
export function formatDecimalEs(value: bigint): string {
  return formatDecimal(value).replace(".", ",");
}
