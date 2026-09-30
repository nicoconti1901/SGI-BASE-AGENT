type FieldProps = {
  label: string;
  hint?: string;
  /** When set, renders a label htmlFor + wrapper instead of wrapping children. */
  htmlFor?: string;
  children: React.ReactNode;
  error?: string;
};

function HintOrError({ hint, error }: { hint?: string; error?: string }) {
  if (error) {
    return (
      <span
        role="alert"
        className="rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-2 py-1 text-xs text-[var(--color-danger)]"
      >
        {error}
      </span>
    );
  }
  if (hint) {
    return (
      <span className="text-xs text-[var(--color-ink-muted)]">{hint}</span>
    );
  }
  return null;
}

/** Label → control → hint/error. Prefer wrapping a single control; use htmlFor for composites. */
export function Field({ label, hint, htmlFor, children, error }: FieldProps) {
  if (htmlFor) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={htmlFor} className="font-medium">
          {label}
        </label>
        {children}
        <HintOrError hint={hint} error={error} />
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      <HintOrError hint={hint} error={error} />
    </label>
  );
}
