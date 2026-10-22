/**
 * Fechas de calendario como texto AAAA-MM-DD, sin horas: así no dependen del huso del servidor.
 * La empresa trabaja en hora de Argentina (UTC-3, sin horario de verano).
 */

export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function parts(iso: string): [number, number, number] {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`Fecha inválida: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function format(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return format(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Suma meses de calendario; si el día no existe en el mes de destino, cae en su último día. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return format(ny, nm, Math.min(d, lastDay));
}

export function addYears(iso: string, years: number): string {
  return addMonths(iso, years * 12);
}

/** Días entre dos fechas (b − a). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Hoy en el huso de la empresa. */
export function todayIso(now: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Medianoche UTC de una fecha de calendario (así se guardan las columnas `@db.Date`). */
export function dateFromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isoFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Último instante del día en hora argentina: un vencimiento "al 15" vale hasta las 23:59 del 15. */
export function endOfDayInstant(iso: string): Date {
  return new Date(`${iso}T23:59:59.999-03:00`);
}

export function formatDateEs(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
