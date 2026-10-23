import { ArrowIcon } from "@/components/ui/icons";
import { StatusChip } from "@/components/ui";
import type { GoalView } from "@/lib/safety-dashboard";

const fmt = (n: number, d: number) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

type IndexCardProps = {
  title: string;
  help: string;
  unit: string;
  value: number | null;
  decimals: number;
  /** Hay datos pero ningún caso con baja no fatal (solo ID). */
  noCases?: boolean;
  noData: boolean;
  trend: "up" | "down" | "flat" | null;
  /** Con qué se compara; sin esto no se muestra la flecha. */
  trendAgainst: string | null;
  goal?: GoalView;
  extra?: string;
};

const TREND_TEXT = { up: "Sube", down: "Baja", flat: "Igual" } as const;

/** Tarjeta de un índice: valor, unidad, tendencia con flecha y texto, y meta del Indicador vinculado. */
export function IndexCard({ title, help, unit, value, decimals, noCases, noData, trend, trendAgainst, goal, extra }: IndexCardProps) {
  const display = noCases ? "Sin casos" : value === null ? "Sin datos" : fmt(value, decimals);
  const muted = value === null && !noCases;
  return (
    <article className="flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-card)]">
      <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">{title}</h3>
      <p className={`font-[family-name:var(--font-display)] text-[1.75rem] font-semibold leading-tight tabular-nums ${muted ? "text-[var(--color-ink-muted)]" : ""}`}>{display}</p>
      <p className="text-xs text-[var(--color-ink-muted)]">{noData || muted ? help : unit}</p>
      {trend && trendAgainst ? (
        <p className="flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
          <ArrowIcon direction={trend} className="h-3 w-3" />
          {TREND_TEXT[trend]} respecto de {trendAgainst}
        </p>
      ) : null}
      {extra ? <p className="text-xs text-[var(--color-ink-muted)]">{extra}</p> : null}
      {goal ? (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--color-ink-muted)]">
            Meta ({goal.indicatorName}): {goal.direction === "lower_better" ? "no más de" : "al menos"} {fmt(goal.target, goal.target % 1 === 0 ? 0 : 2)} {goal.unit}
          </span>
          {goal.status === "met" ? <StatusChip status="ok" label="Cumple" /> : goal.status === "off" ? <StatusChip status="danger" label="Fuera de meta" /> : <StatusChip status="pending" label="Sin dato" />}
        </p>
      ) : null}
    </article>
  );
}

type BarsProps = { title?: string; rows: { key: string; label: string; count: number }[]; empty: string; keepZero?: boolean };

/** Barras horizontales con el número al lado: la cantidad se lee del texto, no solo del largo. */
export function Bars({ title, rows, empty, keepZero }: BarsProps) {
  const shown = keepZero ? rows : rows.filter((r) => r.count > 0);
  const max = Math.max(...rows.map((r) => r.count), 0);
  return (
    <div className="flex flex-col gap-2">
      {title ? <h4 className="text-sm font-semibold">{title}</h4> : null}
      {shown.length === 0 || max === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {shown.map((r) => (
            <li key={r.key} className="grid grid-cols-[minmax(6rem,10rem)_1fr_2.5rem] items-center gap-2">
              <span className="truncate" title={r.label}>
                {r.label}
              </span>
              <span aria-hidden className="h-2 rounded-full bg-[var(--color-surface-sunken)]">
                <span className="block h-2 rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
              </span>
              <span className="text-right tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
