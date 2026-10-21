import { StatusChip, type ChipStatus } from "@/components/ui";
import { supplierSemaphore } from "@/domain/suppliers/status";
import { SEMAPHORE_LABELS, type Semaphore, type SupplierStatusValue } from "@/domain/suppliers/types";

const CHIP: Record<Semaphore, ChipStatus> = { green: "ok", amber: "warning", red: "danger", gray: "pending" };

/** Semáforo del proveedor: el color nunca es la única señal, siempre lleva texto. */
export function SemaphoreChip({
  status,
  attentionAt,
  missingRequiredDocs,
  today,
}: {
  status: SupplierStatusValue;
  attentionAt: Date | null;
  missingRequiredDocs: number;
  today: Date;
}) {
  const semaphore = supplierSemaphore(status, attentionAt, missingRequiredDocs, today);
  const label = status === "inactive" ? "De baja" : status === "not_approved" ? "No aprobado" : SEMAPHORE_LABELS[semaphore];
  return <StatusChip status={CHIP[semaphore]} label={label} />;
}
