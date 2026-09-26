export type ReminderKind = "upcoming" | "overdue" | "none";

export type DueWindowInput = {
  dueAt: Date;
  now: Date;
  /** Días de anticipación para recordatorio “próximo a vencer”. */
  leadDays: number;
};

/** Clasifica un ítem según la ventana de vencimiento. */
export function classifyDueWindow(input: DueWindowInput): ReminderKind {
  const leadDays = Math.max(0, input.leadDays);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntil =
    (input.dueAt.getTime() - input.now.getTime()) / msPerDay;

  if (daysUntil < 0) {
    return "overdue";
  }
  if (daysUntil <= leadDays) {
    return "upcoming";
  }
  return "none";
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
