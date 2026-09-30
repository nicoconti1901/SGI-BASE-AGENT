type HintCalloutProps = {
  children: React.ReactNode;
};

/** Accent-soft contextual help — the question the user should ask themselves. */
export function HintCallout({ children }: HintCalloutProps) {
  return (
    <p className="rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent-ink)]">
      {children}
    </p>
  );
}