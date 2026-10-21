/**
 * Las fechas de calendario (vencimientos, evaluaciones) viajan como «medianoche UTC del día».
 * Ninguna función de acá lee el reloj: la hora entra por parámetro.
 */

const DAY_MS = 86_400_000;

export const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

export const dateFromIso = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Días de calendario de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Suma meses de calendario; si el día no existe en el mes destino, queda el último día del mes. */
export function addMonthsClamped(date: Date, months: number): Date {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

const BA_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día de calendario de Buenos Aires para un instante, como medianoche UTC. */
export function buenosAiresToday(now: Date): Date {
  return dateFromIso(BA_FORMAT.format(now));
}
