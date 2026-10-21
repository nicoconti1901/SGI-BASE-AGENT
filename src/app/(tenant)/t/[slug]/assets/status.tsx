import { StatusChip } from "@/components/ui";
import { ASSET_STATUS_LABELS, type AssetStatus } from "@/domain/inspections/types";
import type { Compliance } from "@/domain/inspections/schedule";

export function AssetStatusChip({ status }: { status: AssetStatus }) {
  return <StatusChip status={status === "in_service" ? "ok" : status === "out_of_service" ? "danger" : "pending"} label={ASSET_STATUS_LABELS[status]} />;
}

const COMPLIANCE: Record<Compliance, { status: "ok" | "warning" | "overdue"; label: string }> = {
  ok: { status: "ok", label: "Vencimientos al día" },
  expiring: { status: "warning", label: "Algo por vencer" },
  blocked: { status: "overdue", label: "Vencido: no usar" },
};

export function ComplianceChip({ compliance }: { compliance: Compliance }) {
  const c = COMPLIANCE[compliance];
  return <StatusChip status={c.status} label={c.label} />;
}
