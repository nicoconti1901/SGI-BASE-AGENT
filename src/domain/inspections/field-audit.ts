import { addMonths } from "./dates";

/** Meta mensual razonable: un tope evita cargas absurdas (una por día hábil, con holgura). */
export const MAX_MONTHLY_TARGET = 100;

export type MonthRange = { month: string; from: string; to: string };

/** Mes calendario de una fecha AAAA-MM-DD: primer día y primer día del mes siguiente (exclusivo). */
export function monthRangeOf(iso: string): MonthRange {
  const month = iso.slice(0, 7);
  const from = `${month}-01`;
  return { month, from, to: addMonths(from, 1) };
}

export type ProgramStatus = "no_target" | "met" | "pending";

export type ProgramCompliance = {
  target: number;
  done: number;
  remaining: number;
  /** Porcentaje de la meta, redondeado; puede pasar de 100 si se hicieron más auditorías. */
  pct: number;
  status: ProgramStatus;
};

/** Cumplimiento del programa de una sede en un mes: auditorías cerradas contra la meta mensual. Sin meta no hay porcentaje. */
export function programCompliance(input: { target: number | null | undefined; done: number }): ProgramCompliance {
  const target = input.target && input.target > 0 ? Math.floor(input.target) : 0;
  const done = Math.max(0, Math.floor(input.done));
  if (target === 0) return { target: 0, done, remaining: 0, pct: 0, status: "no_target" };
  return {
    target,
    done,
    remaining: Math.max(0, target - done),
    pct: Math.round((done / target) * 100),
    status: done >= target ? "met" : "pending",
  };
}

/** La meta debe ser un entero entre 1 y `MAX_MONTHLY_TARGET`. */
export function validateMonthlyTarget(value: unknown): { ok: true; value: number } | { ok: false; message: string } {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_MONTHLY_TARGET) {
    return { ok: false, message: `La meta mensual es un número entero entre 1 y ${MAX_MONTHLY_TARGET}` };
  }
  return { ok: true, value: n };
}
