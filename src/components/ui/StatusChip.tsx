import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockAlertIcon,
  DashedCircleIcon,
  InfoCircleIcon,
  XOctagonIcon,
} from "./icons";

export type ChipStatus = "ok" | "warning" | "danger" | "pending" | "overdue" | "info";

type StatusTone = { bg: string; fg: string };

type StatusChipProps = {
  label: string;
  /** Estado semántico: soft fill + borde + ícono (la forma, no solo el color, lleva la señal). */
  status?: ChipStatus;
  /** Legacy: par inline soft/ink (mapas de tono del dominio). */
  tone?: StatusTone;
  /** Legacy: clases extra, típicamente soft-bg + ink sólido. */
  className?: string;
};

const BASE =
  "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] border px-2 font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.04em]";

const STATUS: Record<ChipStatus, { cls: string; icon: React.ReactNode }> = {
  ok: {
    cls: "border-[var(--color-success-line)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
    icon: <CheckCircleIcon />,
  },
  warning: {
    cls: "border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    icon: <AlertTriangleIcon />,
  },
  danger: {
    cls: "border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    icon: <XOctagonIcon />,
  },
  // Pendiente: borde punteado + ícono punteado, en tinta apagada.
  pending: {
    cls: "border-dashed border-[var(--color-pending-line)] bg-[var(--color-pending-soft)] text-[var(--color-pending)]",
    icon: <DashedCircleIcon />,
  },
  // Vencido: único chip con relleno sólido.
  overdue: {
    cls: "border-[var(--color-danger)] bg-[var(--color-danger)] text-[var(--color-on-solid)]",
    icon: <ClockAlertIcon />,
  },
  info: {
    cls: "border-[var(--color-info-line)] bg-[var(--color-info-soft)] text-[var(--color-info)]",
    icon: <InfoCircleIcon />,
  },
};

/** Etiqueta de estado compacta; el color nunca es la única señal: siempre lleva texto. */
export function StatusChip({ label, status, tone, className }: StatusChipProps) {
  if (status) {
    const s = STATUS[status];
    return (
      <span className={[BASE, s.cls, className].filter(Boolean).join(" ")}>
        {s.icon}
        {label}
      </span>
    );
  }
  return (
    <span
      className={[BASE, "border-[color-mix(in_srgb,currentColor_40%,transparent)]", className]
        .filter(Boolean)
        .join(" ")}
      style={tone ? { background: tone.bg, color: tone.fg } : undefined}
    >
      {label}
    </span>
  );
}
