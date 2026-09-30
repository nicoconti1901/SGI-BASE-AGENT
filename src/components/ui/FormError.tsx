import { XOctagonIcon } from "./icons";

type FormErrorProps = {
  children: React.ReactNode;
};

/** Form-level Server Action error banner (danger on danger-soft, con ícono). */
export function FormError({ children }: FormErrorProps) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]"
    >
      <XOctagonIcon className="mt-0.5 h-4 w-4" />
      <span>{children}</span>
    </p>
  );
}
