/**
 * Hallazgos y comunicaciones de un proveedor (SPEC-suppliers, 19.5). Funciones puras: sin base ni reloj propio.
 */

export const SUPPLIER_FINDING_KINDS = ["quality", "delivery", "safety", "environment", "documentation", "claim"] as const;
export type SupplierFindingKindValue = (typeof SUPPLIER_FINDING_KINDS)[number];

export const SUPPLIER_FINDING_KIND_LABELS: Record<SupplierFindingKindValue, string> = {
  quality: "Calidad",
  delivery: "Entrega",
  safety: "Seguridad",
  environment: "Ambiente",
  documentation: "Documentación",
  claim: "Reclamo",
};

export const SUPPLIER_COMMUNICATION_KINDS = ["requirements", "evaluation_result"] as const;
export type SupplierCommunicationKindValue = (typeof SUPPLIER_COMMUNICATION_KINDS)[number];

export const SUPPLIER_COMMUNICATION_KIND_LABELS: Record<SupplierCommunicationKindValue, string> = {
  requirements: "Requisitos comunicados",
  evaluation_result: "Resultado de la evaluación",
};

export const SUPPLIER_COMMUNICATION_CHANNELS = ["email", "letter", "meeting", "other"] as const;
export type SupplierCommunicationChannelValue = (typeof SUPPLIER_COMMUNICATION_CHANNELS)[number];

export const SUPPLIER_COMMUNICATION_CHANNEL_LABELS: Record<SupplierCommunicationChannelValue, string> = {
  email: "Correo",
  letter: "Carta",
  meeting: "Reunión",
  other: "Otro",
};

/** Título del hallazgo: «Calidad · Proveedor SA: <resumen corto>». Acotado para que entre en listas. */
export function buildSupplierFindingTitle(kind: SupplierFindingKindValue, supplierName: string, summary: string): string {
  const head = `${SUPPLIER_FINDING_KIND_LABELS[kind]} · ${supplierName.trim()}`;
  const line = summary.trim().split(/\r?\n/)[0] ?? "";
  const full = line ? `${head}: ${line}` : head;
  return full.length > 140 ? `${full.slice(0, 137).trimEnd()}…` : full;
}

export type CommunicationInputErrors = Partial<Record<"sentAt" | "summary" | "kind" | "channel", string>>;

/** Validaciones de un registro de comunicación. `today` es el día de calendario de hoy (medianoche UTC). */
export function validateCommunication(
  input: { kind: string; channel: string; sentAt: Date | null; summary: string },
  today: Date,
): CommunicationInputErrors {
  const errors: CommunicationInputErrors = {};
  if (!(SUPPLIER_COMMUNICATION_KINDS as readonly string[]).includes(input.kind)) errors.kind = "Elegí qué se comunicó";
  if (!(SUPPLIER_COMMUNICATION_CHANNELS as readonly string[]).includes(input.channel)) errors.channel = "Elegí cómo se comunicó";
  if (!input.sentAt || Number.isNaN(input.sentAt.getTime())) errors.sentAt = "Indicá la fecha en que se comunicó";
  else if (input.sentAt.getTime() > today.getTime()) errors.sentAt = "La fecha no puede ser futura";
  if (input.summary.trim().length < 3) errors.summary = "Escribí un resumen de lo que se comunicó";
  return errors;
}

export type TrendPoint = { evaluatedAt: Date; score: number };

/**
 * Evolución del puntaje: del más antiguo al más reciente, con la diferencia respecto de la evaluación anterior.
 * Las evaluaciones sin puntaje (aceptación con motivo) y las anuladas no entran.
 */
export function scoreTrend(
  evaluations: readonly { evaluatedAt: Date; createdAt?: Date; totalScore: number | null; voided: boolean }[],
  limit = 12,
): (TrendPoint & { delta: number | null })[] {
  // Dos evaluaciones del mismo día se ordenan por el momento en que se cargaron.
  const points = evaluations
    .filter((e) => !e.voided && e.totalScore !== null)
    .map((e) => ({ evaluatedAt: e.evaluatedAt, createdAt: e.createdAt?.getTime() ?? 0, score: e.totalScore as number }))
    .sort((a, b) => a.evaluatedAt.getTime() - b.evaluatedAt.getTime() || a.createdAt - b.createdAt)
    .slice(-limit);
  return points.map((p, i) => ({ ...p, delta: i === 0 ? null : Math.round((p.score - points[i - 1].score) * 10) / 10 }));
}
