import Link from "next/link";

type PageHeaderProps = {
  /** ISO anchor / context line (e.g. "ISO 9001 · §6.1"). */
  eyebrow: string;
  title: string;
  /** One-line purpose under the title. */
  purpose?: string;
  guideHref?: string;
  guideLabel?: string;
  /** Primary (+ secondary) actions; caller owns accent vs outline. */
  actions?: React.ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  purpose,
  guideHref,
  guideLabel = "Ver guía →",
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-ink-muted)]">{eyebrow}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {title}
        </h1>
        {purpose ? (
          <p className="mt-2 text-[var(--color-ink-muted)]">{purpose}</p>
        ) : null}
        {guideHref ? (
          <p className="mt-2">
            <Link
              href={guideHref}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              {guideLabel}
            </Link>
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
