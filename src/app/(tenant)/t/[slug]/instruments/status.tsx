import { StatusChip, type ChipStatus } from "@/components/ui";
import { STATUS_LABELS, STATUS_TONES, type InstrumentStatus, type StatusTone, type Usability } from "@/domain/calibration";

const CHIP: Record<StatusTone, ChipStatus> = { ok: "ok", warning: "warning", danger: "danger", info: "info", neutral: "pending" };

/** Estado metrológico con su etiqueta. El color nunca es la única señal. */
export function InstrumentStatusChip({ status }: { status: InstrumentStatus }) {
  return <StatusChip status={status === "expired" ? "overdue" : CHIP[STATUS_TONES[status]]} label={STATUS_LABELS[status]} />;
}

/** «No usar» con el motivo en texto, o el estado si se puede usar. */
export function UsabilityCell({ status, usability }: { status: InstrumentStatus; usability: Usability }) {
  if (usability.usable) return <InstrumentStatusChip status={status} />;
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusChip status="overdue" label="No usar" />
      {usability.reason ? <span className="text-xs text-[var(--color-ink-muted)]">{usability.reason}</span> : null}
    </div>
  );
}
