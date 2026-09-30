import Link from "next/link";

type EmptyStateProps = {
  /** What this list/region is for (never just "No hay datos"). */
  what: string;
  /** Next step guidance; rendered as "Qué hacer: …". */
  next?: string;
  action?: { href: string; label: string };
};

export function EmptyState({ what, next, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-6 text-sm text-[var(--color-ink-muted)]"
    >
      <p>{what}</p>
      {next ? <p className="mt-2">Qué hacer: {next}</p> : null}
      {action ? (
        <p className="mt-3">
          <Link
            href={action.href}
            className="font-semibold text-[var(--color-accent)] hover:underline"
          >
            {action.label}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
