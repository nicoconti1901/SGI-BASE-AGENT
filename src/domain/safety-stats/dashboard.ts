/**
 * Tablero de accidentabilidad (SPEC-accident-stats.md, slice 17.4): ventanas de tiempo, grupos a mostrar,
 * explicación de los «sin datos», meta de un Indicador y bloques horarios. Funciones puras.
 */
import { monthLabel, shiftMonth } from "./exposure-import";
import type { Segment, WindowResult } from "./indices";
import type { EmployerKind, MonthKey } from "./types";

export type WindowKind = "month" | "ytd" | "rolling12";
export const WINDOW_KINDS: readonly WindowKind[] = ["month", "ytd", "rolling12"];
export const WINDOW_LABELS: Record<WindowKind, string> = {
  month: "Un mes",
  ytd: "Año acumulado",
  rolling12: "Últimos 12 meses",
};

export type ResolvedWindow = {
  kind: WindowKind;
  months: MonthKey[];
  /** Ventana anterior de igual largo, para la flecha de tendencia. */
  previousMonths: MonthKey[];
  label: string;
};

const range = (from: MonthKey, count: number): MonthKey[] => Array.from({ length: count }, (_, i) => shiftMonth(from, i));

/** Meses de la ventana que termina en `anchor` y de la anterior, de igual largo. */
export function resolveWindow(kind: WindowKind, anchor: MonthKey): ResolvedWindow {
  if (kind === "month") {
    return { kind, months: [anchor], previousMonths: [shiftMonth(anchor, -1)], label: monthLabel(anchor) };
  }
  if (kind === "ytd") {
    const year = anchor.slice(0, 4);
    const count = Number(anchor.slice(5, 7));
    const months = range(`${year}-01`, count);
    const previousMonths = range(`${Number(year) - 1}-01`, count);
    return { kind, months, previousMonths, label: count === 1 ? monthLabel(anchor) : `${monthLabel(months[0]).split(" ")[0]} a ${monthLabel(anchor)}` };
  }
  const start = shiftMonth(anchor, -11);
  return { kind, months: range(start, 12), previousMonths: range(shiftMonth(start, -12), 12), label: `${monthLabel(start)} a ${monthLabel(anchor)}` };
}

export type GroupFilter = "total" | EmployerKind;

/** Sede × grupo que entran en el cálculo: «total» exige los dos grupos de cada sede. */
export function segmentsFor(sites: readonly { id: string }[], group: GroupFilter): Segment[] {
  const kinds: EmployerKind[] = group === "total" ? ["own", "contractor"] : [group];
  return sites.flatMap((s) => kinds.map((employerKind) => ({ siteId: s.id, employerKind })));
}

const KIND_NOUN: Record<EmployerKind, string> = { own: "personal propio", contractor: "contratistas" };

/**
 * Qué falta para que el índice tenga datos o deje de ser parcial, una frase por sede, mes y grupo:
 * «Falta cargar las horas de marzo 2026 en Planta Norte (contratistas).» Muestra hasta `limit` y cuenta el resto.
 */
export function describeGaps(result: WindowResult, siteNames: ReadonlyMap<string, string>, limit = 4): string[] {
  const lines = result.monthsExcluded.map((x) => {
    const where = `${siteNames.get(x.segment.siteId) ?? "una sede"} (${KIND_NOUN[x.segment.employerKind]})`;
    return x.reason === "missing"
      ? `Falta cargar las horas de ${monthLabel(x.month)} en ${where}.`
      : `${where[0].toUpperCase()}${where.slice(1)} tiene accidentes en ${monthLabel(x.month)} pero 0 horas cargadas: revisá las horas de ese mes.`;
  });
  if (lines.length <= limit) return lines;
  return [...lines.slice(0, limit), `Y ${lines.length - limit} más.`];
}

export type GoalInput = { target: number; direction: "higher_better" | "lower_better" };

/** ¿El valor cumple la meta del Indicador vinculado? El tablero solo lee la meta: no escribe mediciones. */
export function goalStatus(value: number | null, goal: GoalInput): "met" | "off" | "no_data" {
  if (value === null) return "no_data";
  const met = goal.direction === "lower_better" ? value <= goal.target : value >= goal.target;
  return met ? "met" : "off";
}

/** Bloque de 4 horas al que pertenece la hora del accidente. */
export function hourBlock(hour: number): string {
  const start = Math.floor(Math.min(Math.max(hour, 0), 23) / 4) * 4;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(start)} a ${pad(start + 3)} h`;
}

export const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
