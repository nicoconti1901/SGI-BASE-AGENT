import Link from "next/link";

type DueCardProps = {
  /** Fecha ISO (YYYY-MM-DD) mostrada en mono. */
  date: string;
  /** Tipo de ítem ("Acción", "Auditoría"…). */
  kind: string;
  title: string;
  /** Normalmente un StatusChip. */
  chip: React.ReactNode;
  href?: string | null;
};

const CARD =
  "flex w-[232px] shrink-0 snap-start flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2.5";

const INTERACTIVE =
  "transition-[transform,border-color] duration-[var(--duration-med)] ease-[var(--ease-out)] hover:border-[var(--color-line-strong)] motion-safe:hover:-translate-y-0.5";

/** Card de vencimiento del carril: fecha mono + tipo + título + chip de estado. */
export function DueCard({ date, kind, title, chip, href }: DueCardProps) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <time
          dateTime={date}
          className="shrink-0 whitespace-nowrap font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--color-ink-muted)]"
        >
          {date}
        </time>
        <span className="min-w-0 truncate font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
          {kind}
        </span>
      </span>
      <span className="truncate text-sm font-medium" title={title}>
        {title}
      </span>
      <span className="flex">{chip}</span>
    </>
  );

  return href ? (
    <Link href={href} className={`${CARD} ${INTERACTIVE}`}>
      {body}
    </Link>
  ) : (
    <div className={CARD}>{body}</div>
  );
}
