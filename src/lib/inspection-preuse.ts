import { prisma } from "@/lib/db";
import { diffDays, isoFromDate, todayIso } from "@/domain/inspections/dates";
import type { InspectionResult } from "@/domain/inspections/types";

/**
 * Último control previo al uso cerrado de un activo (SPEC, decisión 10: no genera vencimientos, solo se muestra «hace N días»).
 * Una sola consulta con el índice del activo; nunca recorre todas las inspecciones.
 */
export async function lastPreUseControl(tenantId: string, assetId: string, templateKey: string) {
  const row = await prisma.inspection.findFirst({
    where: { tenantId, assetId, status: "closed", template: { key: templateKey } },
    orderBy: [{ inspectedAt: "desc" }, { closedAt: "desc" }],
    select: { id: true, inspectedAt: true, result: true },
  });
  if (!row) return null;
  const inspectedAt = isoFromDate(row.inspectedAt);
  return { id: row.id, inspectedAt, daysAgo: Math.max(0, diffDays(inspectedAt, todayIso())), result: row.result as InspectionResult | null };
}

/** «hoy», «ayer» o «hace N días». */
export function daysAgoLabel(days: number): string {
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}
