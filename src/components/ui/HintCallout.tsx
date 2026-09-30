import { InfoCircleIcon } from "./icons";

type HintCalloutProps = {
  children: React.ReactNode;
};

/** Accent-soft contextual help — the question the user should ask themselves. */
export function HintCallout({ children }: HintCalloutProps) {
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent-ink)]">
      <InfoCircleIcon className="mt-0.5 h-4 w-4" />
      <span>{children}</span>
    </p>
  );
}
