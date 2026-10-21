import { addDays } from "./dates";
import { nextEvaluationDue, type ReevaluationConfig } from "./schedule";
import { computeAttentionAt, deriveSupplierStatus } from "./status";
import type { EvaluationResultValue, SupplierCriticalityValue, SupplierStatusValue } from "./types";

export type SummaryInput = {
  supplier: { criticality: SupplierCriticalityValue; inactiveAt: Date | null };
  /** Última evaluación no anulada. */
  last: { id: string; result: EvaluationResultValue; evaluatedAt: Date; totalScore: number | null } | null;
  /** Tipos de documento activos que le aplican al tipo de proveedor y son obligatorios o bloqueantes. */
  docTypes: readonly { id: string; required: boolean; blocksEnablement: boolean }[];
  /** El documento vigente (último no anulado) de cada tipo. */
  currentDocs: readonly { typeId: string; expiresAt: Date | null }[];
  config: Partial<ReevaluationConfig>;
  /** Día de calendario de hoy (medianoche UTC). */
  today: Date;
};

export type SupplierSummary = {
  status: SupplierStatusValue;
  lastEvaluationId: string | null;
  lastEvaluatedAt: Date | null;
  lastScore: number | null;
  nextEvaluationDueAt: Date | null;
  blockingDocExpiresAt: Date | null;
  missingRequiredDocs: number;
  missingBlockingDocs: number;
  attentionAt: Date | null;
};

/**
 * El resumen desnormalizado que se guarda en el proveedor. Única fuente de verdad: lo usa
 * `recomputeSupplierSummary` después de cada escritura relevante.
 *
 * - Falta un documento obligatorio si no hay vigente, o si es no bloqueante y ya venció.
 * - Un bloqueante vencido no cuenta como faltante: su fecha de vencimiento alimenta `blockingDocExpiresAt`.
 */
export function computeSupplierSummary(input: SummaryInput): SupplierSummary {
  const { supplier, last, today } = input;
  const current = new Map(input.currentDocs.map((doc) => [doc.typeId, doc]));

  let missingRequiredDocs = 0;
  let missingBlockingDocs = 0;
  let blockingDocExpiresAt: Date | null = null;

  for (const type of input.docTypes) {
    const doc = current.get(type.id);
    if (type.blocksEnablement) {
      if (!doc) {
        missingBlockingDocs++;
        if (type.required) missingRequiredDocs++;
        continue;
      }
      if (doc.expiresAt && (!blockingDocExpiresAt || doc.expiresAt < blockingDocExpiresAt)) blockingDocExpiresAt = doc.expiresAt;
    } else if (type.required && (!doc || (doc.expiresAt && doc.expiresAt < today))) {
      missingRequiredDocs++;
    }
  }

  const status = deriveSupplierStatus(supplier.inactiveAt, last);
  const nextEvaluationDueAt = last ? nextEvaluationDue(last.evaluatedAt, supplier.criticality, last.result, input.config) : null;

  return {
    status,
    lastEvaluationId: last?.id ?? null,
    lastEvaluatedAt: last?.evaluatedAt ?? null,
    lastScore: last?.totalScore ?? null,
    nextEvaluationDueAt,
    blockingDocExpiresAt,
    missingRequiredDocs,
    missingBlockingDocs,
    attentionAt: computeAttentionAt({ status, nextEvaluationDueAt, blockingDocExpiresAt, missingBlockingDocs, today }),
  };
}

/** Fin de la ventana «por vencer» (inclusive). */
export const windowEnd = (today: Date, windowDays: number) => addDays(today, windowDays);
