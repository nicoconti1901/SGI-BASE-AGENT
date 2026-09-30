import Link from "next/link";

type EntityListProps = {
  children: React.ReactNode;
  /** Accessible name when the list is a landmark-ish region. */
  "aria-label"?: string;
};

/** Lista con marco y divisores para filas de entidad (riesgos, hallazgos, etc.). */
export function EntityList({
  children,
  "aria-label": ariaLabel,
}: EntityListProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)]"
    >
      {children}
    </ul>
  );
}

type EntityRowProps = {
  href: string;
  /** Domain type label, e.g. "Riesgo" / "Oportunidad". */
  kind: string;
  title: string;
  /** Secondary meta after the title (source, clause, …). */
  meta?: string;
  /** Usually a StatusChip. */
  chip?: React.ReactNode;
};

/** Fila: kind + título + meta + chip; toda la fila es un link con tick de acento en hover/focus. */
export function EntityRow({ href, kind, title, meta, chip }: EntityRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="relative flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[var(--color-accent)] before:opacity-0 hover:bg-[var(--color-accent-soft)] hover:before:opacity-100 focus-visible:before:opacity-100 focus-visible:outline-offset-[-2px]"
      >
        <div className="min-w-0">
          <span className="mr-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
            {kind}
          </span>
          <span className="font-medium">{title}</span>
          {meta ? (
            <span className="ml-2 text-sm text-[var(--color-ink-muted)]">
              · {meta}
            </span>
          ) : null}
        </div>
        {chip ?? null}
      </Link>
    </li>
  );
}
