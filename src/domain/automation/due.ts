import { dueDay } from "@/domain/due/day";
import { addDays, todayIso } from "@/domain/inspections/dates";

export type ReminderKind = "upcoming" | "overdue" | "none";

export type DueWindowInput = {
  dueAt: Date;
  now: Date;
  /** Días de anticipación para recordatorio “próximo a vencer”. */
  leadDays: number;
};

export { reminderStartsAt } from "@/domain/due/day";

/** Clasifica por día calendario de Argentina: lo que vence hoy sigue "por vencer" hasta que termina el día. */
export function classifyDueWindow(input: DueWindowInput): ReminderKind {
  const day = dueDay(input.dueAt);
  const today = todayIso(input.now);
  if (day < today) {
    return "overdue";
  }
  return addDays(day, -Math.max(0, input.leadDays)) <= today ? "upcoming" : "none";
}

/**
 * Emite una sola vez por transición: upcoming → (opcional) overdue.
 * No reenvía el mismo tipo si ya se recordó.
 */
export function shouldEmitReminder(input: {
  classification: ReminderKind;
  lastReminderKind: ReminderKind | string | null | undefined;
}): boolean {
  const { classification, lastReminderKind } = input;
  if (classification === "none") {
    return false;
  }
  if (classification === "overdue") {
    return lastReminderKind !== "overdue";
  }
  // upcoming
  return lastReminderKind !== "upcoming" && lastReminderKind !== "overdue";
}

export const DUE_REMINDERS_OFFER_CODE = "due_reminders";

export type OfferDefinition = {
  code: string;
  name: string;
  description: string;
  kind: "native" | "integration";
};

/** Catálogo inicial MVP: solo el motor de vencimientos (SPEC). */
export const NATIVE_OFFER_CATALOG: OfferDefinition[] = [
  {
    code: DUE_REMINDERS_OFFER_CODE,
    name: "Recordatorios de vencimiento",
    description:
      "Escanea ítems con fecha de vencimiento y emite recordatorios próximos y vencidos (in-app + email stub).",
    kind: "native",
  },
];

export const REMINDER_KIND_LABELS: Record<
  Exclude<ReminderKind, "none">,
  string
> = {
  upcoming: "Próximo a vencer",
  overdue: "Vencido",
};

export function labelReminderKind(
  kind: ReminderKind | string | null | undefined,
): string {
  if (kind === "upcoming" || kind === "overdue") {
    return REMINDER_KIND_LABELS[kind];
  }
  return "Sin recordatorio";
}
