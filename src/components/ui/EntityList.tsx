import Link from "next/link";

type EntityListProps = {
  children: React.ReactNode;
  /** Accessible name when the list is a landmark-ish region. */
  "aria-label"?: string;
};

/** Bordered divide-y list for entity rows (risks, findings, etc.). */
export function EntityList({
  children,
  "aria-label": ariaLabel,
}: EntityListProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]"
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

/** List row: kind + title + meta + chip, whole row is a link. */
export function EntityRow({ href, kind, title, meta, chip }: EntityRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-[var(--color-surface)]"
      >
        <div>
          <span className="mr-2 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
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