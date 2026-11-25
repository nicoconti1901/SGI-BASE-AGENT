/**
 * Día calendario de un vencimiento. `DueItem.dueAt` llega de dos formas: una fecha sin hora (medianoche UTC,
 * la de los formularios) o un instante (el fin del día de Argentina que guardan los módulos).
 * La migración `due_item_calendar_day` aplica la misma regla y la base la exige con `due_item_calendar_check`.
 */
import { reminderStartsAt } from "@/domain/automation/due";
import { addDays, dateFromIso, isoFromDate, todayIso } from "@/domain/inspections/dates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "AAAA-MM-DD" en que vence: el propio día si no tiene hora, o el de Argentina para un instante. */
export function dueDay(dueAt: Date): string {
  return dueAt.getTime() % MS_PER_DAY === 0 ? isoFromDate(dueAt) : todayIso(dueAt);
}

/** Todas las columnas de fecha de un `DueItem`. Se escriben siempre juntas, en el alta y en cada cambio. */
export function dueColumns(dueAt: Date, leadDays: number) {
  const day = dueDay(dueAt);
  return {
    dueAt,
    leadDays,
    remindAt: reminderStartsAt(dueAt, leadDays),
    dueOn: dateFromIso(day),
    remindOn: dateFromIso(addDays(day, -Math.max(0, leadDays))),
  };
}
