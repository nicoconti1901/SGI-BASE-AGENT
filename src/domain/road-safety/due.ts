import { shiftMonth } from "@/domain/safety-stats/exposure-import";
import type { IsoDay, MonthKey } from "@/domain/safety-stats/types";

/** Día del mes siguiente hasta el que se confirman los km (SPEC plan 18.2). */
export const KM_DUE_DAY = 10;
/** Días de aviso antes del vencimiento. */
export const KM_LEAD_DAYS = 5;

/** Los km de un mes se confirman hasta el día 10 del mes siguiente. */
export function kmDueDay(month: MonthKey): IsoDay {
  return `${shiftMonth(month, 1)}-${String(KM_DUE_DAY).padStart(2, "0")}`;
}

/** Último mes cerrado: el que hay que confirmar hoy. */
export function lastClosedMonth(today: IsoDay): MonthKey {
  return shiftMonth(today.slice(0, 7), -1);
}

/** Un mes se puede cargar cuando ya cerró (el actual todavía está en curso). */
export function isKmMonthClosed(month: MonthKey, today: IsoDay): boolean {
  return month < today.slice(0, 7);
}
