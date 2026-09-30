type FormErrorProps = {
  children: React.ReactNode;
};

/** Form-level Server Action error banner (danger on danger-soft). */
export function FormError({ children }: FormErrorProps) {
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]"
    >
      {children}
    </p>
  );
}