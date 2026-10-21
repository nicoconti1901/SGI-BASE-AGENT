const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export type CuitCheck =
  | { valid: true; value: string }
  | { valid: false; reason: "empty" | "format" | "length" | "check_digit" };

/** Solo dígitos si el texto tiene únicamente dígitos, guiones, puntos y espacios; si no, null. */
export function normalizeCuit(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text || /[^\d\-.\s]/.test(text)) return null;
  return text.replace(/\D/g, "");
}

/**
 * Dígito verificador de los primeros 10 dígitos: 11 − (Σ dígito × peso mod 11).
 * Resto 0 → 0. Resto 1 → 10: no existe dígito posible con ese prefijo (null).
 */
export function cuitCheckDigit(first10: string): number | null {
  if (!/^\d{10}$/.test(first10)) return null;
  const sum = [...first10].reduce((acc, ch, i) => acc + Number(ch) * WEIGHTS[i], 0);
  const result = 11 - (sum % 11);
  if (result === 11) return 0;
  if (result === 10) return null;
  return result;
}

/** Valida un CUIT/CUIL y lo devuelve normalizado (11 dígitos). */
export function isValidCuit(raw: string | null | undefined): CuitCheck {
  const text = (raw ?? "").trim();
  if (!text) return { valid: false, reason: "empty" };
  const digits = normalizeCuit(text);
  if (digits === null) return { valid: false, reason: "format" };
  if (digits.length !== 11) return { valid: false, reason: "length" };
  return cuitCheckDigit(digits.slice(0, 10)) === Number(digits[10])
    ? { valid: true, value: digits }
    : { valid: false, reason: "check_digit" };
}

/** 20123456786 → 20-12345678-6 */
export function formatCuit(value: string | null | undefined): string {
  if (!value || !/^\d{11}$/.test(value)) return value ?? "";
  return `${value.slice(0, 2)}-${value.slice(2, 10)}-${value.slice(10)}`;
}

export const CUIT_ERROR_MESSAGES = {
  empty: "Falta el CUIT",
  format: "El CUIT solo puede tener números y guiones",
  length: "El CUIT debe tener 11 dígitos",
  check_digit: "El CUIT no es válido: revisá el último dígito",
} as const;
