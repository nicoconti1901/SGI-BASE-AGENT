import Link from "next/link";
import { GAP_STATUS_LABELS, type RequirementStatus } from "@/domain/assessment/gap";
import type { DueTone } from "@/domain/dashboard/summary";
import { StatusChip, type ChipStatus } from "@/components/ui";

/** Tablero chico, solo de referencia: el trabajo se hace entrando a los módulos. */
export function TelemetryPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-card-line)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-card)] ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-4 py-2">
        <p className="font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
          {title}
        </p>
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-ink-subtle)]">
          Solo referencia
        </span>
      </header>
      {children}
    </section>
  );
}

export function TelemetryHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
      {children}
    </h2>
  );
}

/** Cifras en una fila con divisores; cada una lleva texto, no solo color. */
export function TelemetryCounts({
  items,
}: {
  items: { label: string; value: string; tone?: "danger" | "warning" }[];
}) {
  return (
    <dl
      className="grid divide-x divide-[var(--color-line)]"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-4 py-3">
          <dt
            className="truncate font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]"
            title={item.label}
          >
            {item.label}
          </dt>
          <dd
            className={`mt-0.5 font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight tabular-nums ${
              item.tone === "danger"
                ? "text-[var(--color-danger)]"
                : item.tone === "warning"
                  ? "text-[var(--color-warning)]"
                  : "text-[var(--color-ink)]"
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Orden y color de cada estado en la barra de cumplimiento; la leyenda repite el texto. */
const COMPLIANCE_SEGMENTS: { status: RequirementStatus; color: string }[] = [
  { status: "compliant", color: "var(--color-success)" },
  { status: "automated", color: "var(--color-accent)" },
  { status: "partial", color: "var(--color-warning)" },
  { status: "missing", color: "var(--color-danger)" },
  { status: "pending", color: "var(--color-ink-subtle)" },
  { status: "not_applicable", color: "var(--color-line-strong)" },
];

/** "Pendiente" se distingue por patrón (rayado) además de color. */
function segmentBackground(status: RequirementStatus, color: string): string {
  return status === "pending"
    ? `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`
    : color;
}

export function ComplianceBar({
  total,
  byStatus,
}: {
  total: number;
  byStatus: Record<RequirementStatus, number>;
}) {
  return (
    <>
      <div
        className="mt-2 flex h-2 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-card-line)] bg-[var(--color-surface-sunken)]"
        role="img"
        aria-label={`Distribución de ${total} requisitos por estado`}
      >
        {COMPLIANCE_SEGMENTS.filter((seg) => byStatus[seg.status] > 0).map((seg) => (
          <span
            key={seg.status}
            style={{
              width: `${(byStatus[seg.status] / total) * 100}%`,
              background: segmentBackground(seg.status, seg.color),
            }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {COMPLIANCE_SEGMENTS.filter((seg) => byStatus[seg.status] > 0).map((seg) => (
          <li key={seg.status} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2 rounded-[2px]"
              style={{ background: segmentBackground(seg.status, seg.color) }}
            />
            <span className="text-[var(--color-ink-muted)]">
              {GAP_STATUS_LABELS[seg.status]}
            </span>
            <span className="font-semibold tabular-nums">{byStatus[seg.status]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

const DUE_TONE_STATUS: Record<DueTone, ChipStatus> = {
  overdue: "overdue",
  soon: "warning",
  ok: "ok",
};

function dueChipText(tone: DueTone, daysLeft: number): string {
  if (tone === "overdue") {
    const d = Math.abs(daysLeft);
    return d === 0 ? "Venció hoy" : `Vencido hace ${d} d`;
  }
  return daysLeft === 0 ? "Vence hoy" : `En ${daysLeft} d`;
}

export type DueMiniItem = {
  id: string;
  title: string;
  dueAt: Date;
  typeLabel: string;
  href: string | null;
  tone: DueTone;
  daysLeft: number;
};

/** Próximos vencimientos en filas de una línea. */
export function DueMiniList({ items }: { items: readonly DueMiniItem[] }) {
  return (
    <ul className="divide-y divide-[var(--color-line)]">
      {items.map((item) => (
        <li key={item.id} className="py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--color-ink-muted)]">
              {item.dueAt.toISOString().slice(0, 10)} · {item.typeLabel}
            </span>
            <StatusChip
              status={DUE_TONE_STATUS[item.tone]}
              label={dueChipText(item.tone, item.daysLeft)}
            />
          </div>
          {item.href ? (
            <Link
              href={item.href}
              className="mt-0.5 block truncate text-sm font-medium hover:text-[var(--color-accent)] hover:underline"
            >
              {item.title}
            </Link>
          ) : (
            <p className="mt-0.5 truncate text-sm font-medium">{item.title}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
