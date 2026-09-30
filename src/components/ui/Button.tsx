export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 py-2 text-sm font-semibold " +
  "transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] " +
  "motion-safe:active:translate-y-px disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-[var(--color-accent-hover)] bg-[var(--color-accent)] text-[var(--color-on-solid)] hover:bg-[var(--color-accent-hover)] " +
    "disabled:border-[var(--color-line)] disabled:bg-[var(--color-line)] disabled:text-[var(--color-ink-muted)]",
  secondary:
    "border-[var(--color-accent)] bg-transparent text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] " +
    "disabled:border-[var(--color-line)] disabled:bg-transparent disabled:text-[var(--color-ink-muted)]",
  ghost:
    "border-transparent bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-surface-sunken)] " +
    "active:bg-[var(--color-line)] disabled:text-[var(--color-ink-muted)]",
  danger:
    "border-[var(--color-danger)] bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] " +
    "disabled:border-[var(--color-line)] disabled:bg-transparent disabled:text-[var(--color-ink-muted)]",
};

/** Clases para usar sobre <Link>/<a> con el mismo aspecto que <Button>. */
export function buttonClass(variant: ButtonVariant = "primary", extra?: string): string {
  return [BASE, VARIANT[variant], extra].filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

/** Una sola acción primary por vista; el resto secondary/ghost. Etiquetá con el verbo ("Registrar riesgo"). */
export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
