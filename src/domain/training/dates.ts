/**
 * Fechas del módulo de capacitaciones. Todo el dominio trabaja con días calendario en formato
 * `AAAA-MM-DD` (sin hora ni zona), así que las comparaciones son de texto y la aritmética es en UTC.
 */
export type IsoDate = string;

/** Zona por defecto de las empresas (la hora de corte del "hoy" del cálculo). */
export const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const DAY_MS = 86_400_000;

function toUtcMs(iso: IsoDate): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(iso) + days * DAY_MS);
}

/** Días de `to` menos días de `from` (positivo si `to` es posterior). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function maxIso(dates: readonly (IsoDate | null | undefined)[]): IsoDate | null {
  let best: IsoDate | null = null;
  for (const d of dates) if (d && (best === null || d > best)) best = d;
  return best;
}

export function minIso(dates: readonly (IsoDate | null | undefined)[]): IsoDate | null {
  let best: IsoDate | null = null;
  for (const d of dates) if (d && (best === null || d < best)) best = d;
  return best;
}

/** Día calendario de un instante en una zona horaria (el "hoy" del cliente, no el de UTC). */
export function dateInZone(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Una fecha sin hora guardada como medianoche UTC (`@db.Date`, `hiredAt`). */
export function dateOnly(value: Date): IsoDate {
  return value.toISOString().slice(0, 10);
}

/** Suma meses calendario; si el día no existe en el mes destino, queda el último día del mes. */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return fromUtcMs(Date.UTC(year, month, Math.min(d, lastDay)));
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && fromUtcMs(toUtcMs(value)) === value;
}
