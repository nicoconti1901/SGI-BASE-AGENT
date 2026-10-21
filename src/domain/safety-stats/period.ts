import { SAFETY_TIME_ZONE, type IsoDay, type MonthKey } from "@/domain/safety-stats/types";

const MS_PER_DAY = 86_400_000;

function parseDay(day: IsoDay): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new RangeError(`Fecha inválida: ${day}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = parseDay(value);
  return new Date(t).toISOString().slice(0, 10) === value;
}

/** Días corridos de `from` a `to` (negativo si `to` es anterior). */
export function diffDays(from: IsoDay, to: IsoDay): number {
  return Math.round((parseDay(to) - parseDay(from)) / MS_PER_DAY);
}

export function addDays(day: IsoDay, days: number): IsoDay {
  return new Date(parseDay(day) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export const monthOf = (day: IsoDay): MonthKey => day.slice(0, 7);
export const firstDayOfMonth = (month: MonthKey): IsoDay => `${month}-01`;

/** Meses "AAAA-MM" de `from` a `to`, ambos incluidos. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export type EventPeriod = {
  /** Fecha local del hecho. */
  occurredOn: IsoDay;
  /** Primer día del mes local. */
  periodMonth: IsoDay;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  hourOfDay: number;
};

/**
 * Deriva las columnas simples que usa el group by. Un hecho a las 23:30 del 31/01 hora local
 * es de enero aunque en UTC ya sea 01/02.
 */
export function deriveEventPeriod(occurredAt: Date, timeZone: string = SAFETY_TIME_ZONE): EventPeriod {
  const p = zonedParts(occurredAt, timeZone);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return {
    occurredOn: `${p.year}-${mm}-${dd}`,
    periodMonth: `${p.year}-${mm}-01`,
    weekday: new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(),
    hourOfDay: p.hour,
  };
}

/** Fecha local de un instante, "AAAA-MM-DD". */
export function localDay(instant: Date, timeZone: string = SAFETY_TIME_ZONE): IsoDay {
  return deriveEventPeriod(instant, timeZone).occurredOn;
}

/** "AAAA-MM-DDTHH:mm" (hora de pared en `timeZone`) → instante. */
export function localDateTimeToInstant(local: string, timeZone: string = SAFETY_TIME_ZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const offsetAt = (t: number) => {
    const p = zonedParts(new Date(t), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
  };
  const first = wall - offsetAt(wall);
  const instant = new Date(wall - offsetAt(first));
  const back = zonedParts(instant, timeZone);
  // Hora de pared inexistente (salto de horario de verano): se rechaza.
  if (back.hour !== Number(m[4]) || back.minute !== Number(m[5])) return null;
  return instant;
}

export type LostDays = { days: number; capped: boolean; open: boolean };

/**
 * Días perdidos: corridos, sin contar el día del accidente (D3), con tope.
 * Caso abierto (sin reintegro): `asOf − occurredOn`, mínimo 1.
 */
export function computeLostDays(input: {
  occurredOn: IsoDay;
  returnToWorkDate: IsoDay | null | undefined;
  asOf: IsoDay;
  cap: number;
}): LostDays {
  const { occurredOn, returnToWorkDate, asOf, cap } = input;
  if (returnToWorkDate) {
    const raw = diffDays(occurredOn, returnToWorkDate);
    if (raw < 0) throw new RangeError("La fecha de reintegro es anterior al accidente");
    const days = Math.max(raw - 1, 0);
    return { days: Math.min(days, cap), capped: days > cap, open: false };
  }
  const days = Math.max(diffDays(occurredOn, asOf), 1);
  return { days: Math.min(days, cap), capped: days > cap, open: true };
}
