import { AlertTriangleIcon } from "./icons";

type FieldProps = {
  label: string;
  hint?: string;
  /** When set, renders a label htmlFor + wrapper instead of wrapping children. */
  htmlFor?: string;
  children: React.ReactNode;
  error?: string;
  /** Muestra "Obligatorio" como texto (no solo un asterisco). */
  required?: boolean;
};

function HintOrError({ hint, error }: { hint?: string; error?: string }) {
  if (error) {
    return (
      <span
        role="alert"
        className="flex items-start gap-1.5 text-xs font-medium text-[var(--color-danger)]"
      >
        <AlertTriangleIcon className="mt-px h-3.5 w-3.5" />
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

function LabelText({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span className="font-semibold">{label}</span>
      {required ? (
        <span className="text-xs font-normal text-[var(--color-ink-muted)]">Obligatorio</span>
      ) : null}
    </span>
  );
}

/** Label → control → hint/error. Prefer wrapping a single control; use htmlFor for composites. */
export function Field({ label, hint, htmlFor, children, error, required }: FieldProps) {
  const invalid = error ? "true" : undefined;

  if (htmlFor) {
    return (
      <div className="flex flex-col gap-1.5 text-sm" data-invalid={invalid}>
        <label htmlFor={htmlFor}>
          <LabelText label={label} required={required} />
        </label>
        {children}
        <HintOrError hint={hint} error={error} />
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1.5 text-sm" data-invalid={invalid}>
      <LabelText label={label} required={required} />
      {children}
      <HintOrError hint={hint} error={error} />
    </label>
  );
}
