type StatTone = "default" | "danger" | "warning";

const VALUE_TONE: Record<StatTone, string> = {
  default: "text-[var(--color-ink)]",
  danger: "text-[var(--color-danger)]",
  warning: "text-[var(--color-warning)]",
};

type StatTileProps = {
  label: string;
  value: React.ReactNode;
  tone?: StatTone;
  /** Optional chip (e.g. StatusChip) aligned to the value. */
  chip?: React.ReactNode;
};

export function StatTile({
  label,
  value,
  tone = "default",
  chip,
}: StatTileProps) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className={`text-2xl font-semibold tabular-nums ${VALUE_TONE[tone]}`}>
          {value}
        </p>
        {chip ?? null}
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{label}</p>
    </div>
  );
}

const GRID_COLS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

type StatGridProps = {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
  /** Accessible name for the metrics region. */
  "aria-label"?: string;
};

export function StatGrid({
  children,
  cols = 4,
  "aria-label": ariaLabel = "Resumen",
}: StatGridProps) {
  return (
    <section aria-label={ariaLabel} className={`grid gap-3 ${GRID_COLS[cols]}`}>
      {children}
    </section>
  );
}
