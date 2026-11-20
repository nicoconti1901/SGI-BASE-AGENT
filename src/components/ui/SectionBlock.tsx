type SectionBlockProps = {
  title: string;
  /** Línea mono sobre el título (p. ej. "ISO 9001 · §6.1"). */
  eyebrow?: string;
  /** Short "what this section is". */
  what?: string;
  /** Guidance line; rendered as "Qué hacer: …". */
  next?: string;
  /** Acción/es alineadas a la derecha del encabezado. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  id?: string;
  /** false = sin caja propia: título grande con línea arriba (para secciones que ya contienen tarjetas o listas con marco). */
  framed?: boolean;
};

/** Sección con marco: card con borde + encabezado separado por hairline. */
export function SectionBlock({
  title,
  eyebrow,
  what,
  next,
  actions,
  children,
  id,
  framed = true,
}: SectionBlockProps) {
  return (
    <section
      id={id}
      className={
        framed
          ? "flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-card-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-card)] sm:p-6"
          : "flex flex-col gap-4 border-t-2 border-[var(--color-line-strong)] pt-5"
      }
    >
      <header
        className={`flex flex-wrap items-start justify-between gap-3 ${framed ? "border-b border-[var(--color-line)] pb-3" : ""}`}
      >
        <div className="min-w-0">
          {eyebrow ? (
            <p className="font-[family-name:var(--font-mono)] text-xs font-medium text-[var(--color-ink-muted)]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[1.375rem] font-semibold leading-snug tracking-tight">
            <span aria-hidden className="h-0.5 w-4 shrink-0 bg-[var(--color-accent)]" />
            {title}
          </h2>
          {what ? (
            <p className="mt-1 max-w-[70ch] text-base leading-relaxed text-[var(--color-ink)]">{what}</p>
          ) : null}
          {next ? (
            <p className="mt-1 max-w-[70ch] text-base leading-relaxed text-[var(--color-ink)]">
              <span className="font-semibold">Qué hacer:</span> {next}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
