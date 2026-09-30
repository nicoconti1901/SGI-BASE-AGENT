/**
 * Shared control chrome. Borde siempre visible (line-strong, ≥3:1 contra la superficie),
 * focus = borde accent + anillo 3px, error vía aria-invalid o <Field error>.
 */
export const INPUT_CLASS = [
  "min-h-10 rounded-[var(--radius-md)] border border-[var(--color-line-strong)]",
  "bg-[var(--color-field-fill)] px-3 py-2 text-sm text-[var(--color-ink)]",
  "placeholder:text-[var(--color-ink-muted)]",
  "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
  "hover:border-[var(--color-ink-muted)]",
  "focus:border-[var(--color-accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--color-accent-ring)]",
  "aria-[invalid=true]:border-[var(--color-danger)] aria-[invalid=true]:focus:shadow-[0_0_0_3px_var(--color-danger-ring)]",
  "disabled:cursor-not-allowed disabled:border-dashed disabled:border-[var(--color-line)]",
  "disabled:bg-[var(--color-surface-sunken)] disabled:text-[var(--color-ink-muted)]",
].join(" ");
