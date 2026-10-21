import { addDays, daysBetween } from "./dates";
import {
  DEFAULT_WARN_DAYS,
  type EvaluationResultValue,
  type Semaphore,
  type SupplierStatusValue,
} from "./types";

/** El estado del proveedor se deriva de su última evaluación no anulada; solo la baja es manual. */
export function deriveSupplierStatus(
  inactiveAt: Date | null,
  lastNonVoided: { result: EvaluationResultValue } | null,
): SupplierStatusValue {
  if (inactiveAt) return "inactive";
  return lastNonVoided ? lastNonVoided.result : "potential";
}

export type DocumentStatus = "valid" | "expiring" | "expired";

/** Sin vencimiento no vence. El día del vencimiento todavía es válido (queda «por vencer»). */
export function documentStatus(expiresAt: Date | null, today: Date, warnDays: number): DocumentStatus {
  if (!expiresAt) return "valid";
  const days = daysBetween(today, expiresAt);
  if (days < 0) return "expired";
  return days <= warnDays ? "expiring" : "valid";
}

/**
 * Semáforo de la lista. Se calcula contra la hora de lectura: no hay cron que lo actualice.
 * `now` es el día de calendario (medianoche UTC): vencer «hoy» es ámbar, no rojo.
 */
export function supplierSemaphore(
  status: SupplierStatusValue,
  attentionAt: Date | null,
  missingRequiredDocs: number,
  now: Date,
  windowDays: number = DEFAULT_WARN_DAYS,
): Semaphore {
  if (status === "potential" || status === "inactive") return "gray";
  if (status === "not_approved") return "red";
  if (attentionAt && attentionAt.getTime() < now.getTime()) return "red";
  if (attentionAt && attentionAt.getTime() <= addDays(now, windowDays).getTime()) return "amber";
  if (status === "conditional" || missingRequiredDocs > 0) return "amber";
  return "green";
}

/** Habilitado = aprobado o condicional, sin documento bloqueante faltante ni vencido. Independiente del puntaje. */
export function isEnabled(
  status: SupplierStatusValue,
  missingBlockingDocs: number,
  blockingDocExpiresAt: Date | null,
  now: Date,
): boolean {
  if (status !== "approved" && status !== "conditional") return false;
  if (missingBlockingDocs > 0) return false;
  return !blockingDocExpiresAt || blockingDocExpiresAt.getTime() >= now.getTime();
}

/**
 * Cuándo necesita atención el proveedor: el menor entre la reevaluación y el vencimiento de un
 * documento bloqueante; si falta uno bloqueante ya está vencido (el día anterior a hoy).
 */
export function computeAttentionAt(input: {
  status: SupplierStatusValue;
  nextEvaluationDueAt: Date | null;
  blockingDocExpiresAt: Date | null;
  missingBlockingDocs: number;
  today: Date;
}): Date | null {
  if (input.status !== "approved" && input.status !== "conditional") return null;
  const dates = [
    input.nextEvaluationDueAt,
    input.blockingDocExpiresAt,
    input.missingBlockingDocs > 0 ? addDays(input.today, -1) : null,
  ].filter((x): x is Date => x !== null);
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((x) => x.getTime())));
}

const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** Texto corto de la columna «Próxima atención» de la lista. */
export function describeAttention(input: {
  status: SupplierStatusValue;
  nextEvaluationDueAt: Date | null;
  blockingDocExpiresAt: Date | null;
  missingBlockingDocs: number;
  missingRequiredDocs: number;
  today: Date;
}): string {
  const { status, today } = input;
  if (status === "inactive") return "";
  if (status === "potential") return "Todavía sin evaluar";
  if (status === "not_approved") return "No aprobado: se reevalúa a pedido";

  if (input.missingBlockingDocs > 0) return "Falta documentación obligatoria";

  const reeval = input.nextEvaluationDueAt ? daysBetween(today, input.nextEvaluationDueAt) : null;
  const doc = input.blockingDocExpiresAt ? daysBetween(today, input.blockingDocExpiresAt) : null;

  if (doc !== null && doc < 0) return `Documentación vencida hace ${days(-doc)}`;
  if (reeval !== null && reeval < 0) return `Reevaluación vencida hace ${days(-reeval)}`;
  if (input.missingRequiredDocs > 0) return "Falta documentación";

  const upcoming: { n: number; text: string }[] = [];
  if (doc !== null) upcoming.push({ n: doc, text: doc === 0 ? "Documentación vence hoy" : `Documentación vence en ${days(doc)}` });
  if (reeval !== null) upcoming.push({ n: reeval, text: reeval === 0 ? "Reevaluar hoy" : `Reevaluar en ${days(reeval)}` });
  upcoming.sort((a, b) => a.n - b.n);
  return upcoming[0]?.text ?? "";
}
