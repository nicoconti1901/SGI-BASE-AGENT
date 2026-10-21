import { addDays, addMonths } from "./dates";
import type { InspectionResult, IntervalUnit } from "./types";

export type Interval = { unit: IntervalUnit; value: number };

export type NextDue = { dueAt: string | null; kind: "periodic" | "reinspection" | "none" };

export function addInterval(isoDate: string, interval: Interval): string {
  return interval.unit === "days" ? addDays(isoDate, interval.value) : addMonths(isoDate, interval.value);
}

/**
 * Próxima fecha de una inspección periódica. El calendario se reinicia con cada inspección:
 * una cerrada tarde no recupera períodos y una anticipada corre el calendario hacia adelante.
 * Un resultado no apto pide una reinspección a los `reinspectionDays` días.
 */
export function nextInspectionDue(input: {
  /** Fecha de la inspección, AAAA-MM-DD en la zona de la empresa. */
  inspectedAt: string;
  result: InspectionResult;
  /** Nulo: control previo al uso o sin calendario. */
  interval: Interval | null;
  reinspectionDays: number;
  retireOnUnfit: boolean;
  assetRetired?: boolean;
}): NextDue {
  const none: NextDue = { dueAt: null, kind: "none" };
  if (input.assetRetired || !input.interval) return none;
  if (input.result === "unfit") {
    if (input.retireOnUnfit) return none;
    return { dueAt: addDays(input.inspectedAt, input.reinspectionDays), kind: "reinspection" };
  }
  return { dueAt: addInterval(input.inspectedAt, input.interval), kind: "periodic" };
}

export type DueDateLike = {
  /** AAAA-MM-DD */
  dueAt: string;
  leadDays: number;
  blocking: boolean;
};

export type Compliance = "ok" | "expiring" | "blocked";

/**
 * Cómo está el activo según sus vencimientos documentales (dato para mostrar, no un estado guardado):
 * `blocked` si algún vencimiento que impide el uso ya venció; `expiring` si alguno está por vencer
 * (desde `dueAt − leadDays`, la misma regla que el aviso) o ya venció sin ser bloqueante.
 */
export function assetCompliance(dueDates: readonly DueDateLike[], today: string): Compliance {
  let result: Compliance = "ok";
  for (const d of dueDates) {
    if (d.dueAt < today) {
      if (d.blocking) return "blocked";
      result = "expiring";
    } else if (addDays(d.dueAt, -Math.max(0, d.leadDays)) <= today) {
      result = "expiring";
    }
  }
  return result;
}

/** Estado de un vencimiento puntual, con la misma regla de la base común. */
export function dueState(d: Pick<DueDateLike, "dueAt" | "leadDays">, today: string): "ok" | "expiring" | "overdue" {
  if (d.dueAt < today) return "overdue";
  return addDays(d.dueAt, -Math.max(0, d.leadDays)) <= today ? "expiring" : "ok";
}
