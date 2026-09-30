type SectionBlockProps = {
  title: string;
  /** Short "what this section is". */
  what?: string;
  /** Guidance line; rendered as "Qué hacer: …". */
  next?: string;
  children?: React.ReactNode;
  id?: string;
};

/** Workspace/content section: border-t + display h2 + optional what/next. */
export function SectionBlock({
  title,
  what,
  next,
  children,
  id,
}: SectionBlockProps) {
  return (
    <section
      id={id}
      className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6"
    >
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">{title}</h2>
        {what ? (
          <p className="text-sm text-[var(--color-ink-muted)]">{what}</p>
        ) : null}
        {next ? (
          <p className="mt-1 text-sm">
            <span className="font-medium">Qué hacer:</span> {next}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}