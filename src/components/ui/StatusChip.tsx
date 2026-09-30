type StatusTone = { bg: string; fg: string };

type StatusChipProps = {
  label: string;
  /** Inline soft/ink pair (domain tone maps). Prefer over inventing classes. */
  tone?: StatusTone;
  /** Extra classes, typically soft-bg + solid-ink token utilities. */
  className?: string;
};

const BASE =
  "inline-flex whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-semibold";

/** Compact status label; color never the only signal — always carries text. */
export function StatusChip({ label, tone, className }: StatusChipProps) {
  return (
    <span
      className={[BASE, className].filter(Boolean).join(" ")}
      style={tone ? { background: tone.bg, color: tone.fg } : undefined}
    >
      {label}
    </span>
  );
}
