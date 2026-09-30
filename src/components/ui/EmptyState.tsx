import Link from "next/link";
import { buttonClass } from "./Button";
import { InboxIcon } from "./icons";

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
      className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-sunken)] px-5 py-6 text-sm sm:flex-row sm:gap-4"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] text-[var(--color-ink-muted)]">
        <InboxIcon className="h-6 w-6" />
      </span>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p className="font-semibold text-[var(--color-ink)]">{what}</p>
        {next ? (
          <p className="max-w-[52ch] text-[var(--color-ink-muted)]">Qué hacer: {next}</p>
        ) : null}
        {action ? (
          <Link href={action.href} className={buttonClass("secondary", "mt-2")}>
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
