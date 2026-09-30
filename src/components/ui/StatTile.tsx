import { ArrowIcon } from "./icons";

type StatTone = "default" | "danger" | "warning";

const VALUE_TONE: Record<StatTone, string> = {
  default: "text-[var(--color-ink)]",
  danger: "text-[var(--color-danger)]",
  warning: "text-[var(--color-warning)]",
};

/** Barra izquierda de 3px: marca el tile que requiere atención (además del chip/texto). */
const ALERT_BAR: Record<StatTone, string> = {
  default: "",
  danger:
    "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--color-danger)]",
  warning:
    "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--color-warning)]",
};

type StatDelta = {
  /** Texto legible: "+2 vs. semana pasada". */
  text: string;
  trend: "up" | "down" | "flat";
};

type StatTileProps = {
  label: string;
  value: React.ReactNode;
  tone?: StatTone;
  /** Optional chip (e.g. StatusChip) aligned to the value. */
  chip?: React.ReactNode;
  /** Variación con flecha + texto (nunca solo color). */
  delta?: StatDelta;
};

/** Celda de métrica. Sin marco propio: lo aporta StatGrid o la cinta del dashboard. */
export function StatTile({
  label,
  value,
  tone = "default",
  chip,
  delta,
}: StatTileProps) {
  return (
    <div
      className={`relative min-w-0 bg-[var(--color-surface-raised)] px-4 py-3 ${ALERT_BAR[tone]}`}
    >
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
        {label}
      </p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <p
          className={`font-[family-name:var(--font-display)] text-[1.75rem] font-semibold leading-tight tabular-nums ${VALUE_TONE[tone]}`}
        >
          {value}
        </p>
        {chip ?? null}
      </div>
      {delta ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
          <ArrowIcon direction={delta.trend} className="h-3 w-3" />
          {delta.text}
        </p>
      ) : null}
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

/** Franja de métricas con un solo marco y divisores de 1px entre celdas. */
export function StatGrid({
  children,
  cols = 4,
  "aria-label": ariaLabel = "Resumen",
}: StatGridProps) {
  return (
    <section
      aria-label={ariaLabel}
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-card)]"
    >
      <div
        className={`-mb-px -mr-px grid ${GRID_COLS[cols]} [&>*]:border-b [&>*]:border-r [&>*]:border-[var(--color-line)]`}
      >
        {children}
      </div>
    </section>
  );
}
