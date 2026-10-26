import { prisma } from "@/lib/db";
import { writeAudit, type Db, type Tx } from "@/lib/inspection-support";
import { recomputeInstrumentControl } from "@/lib/instruments";
import { dateFromIso, isoFromDate } from "@/domain/inspections/dates";
import { FUNCTIONAL_CHECK_TEMPLATE_KEY, INSTRUMENT_TYPE_KEY } from "@/domain/calibration/types";
import type { InspectionResult } from "@/domain/inspections/types";

/** Última prueba funcional cerrada del equipo, para la ficha («último control previo: hace N días»). */
export async function lastFunctionalCheck(tenantId: string, assetId: string, db: Db | Tx = prisma) {
  const check = await db.inspection.findFirst({
    where: { tenantId, assetId, status: "closed", template: { key: FUNCTIONAL_CHECK_TEMPLATE_KEY } },
    orderBy: [{ inspectedAt: "desc" }, { closedAt: "desc" }],
    select: { id: true, inspectedAt: true, result: true },
  });
  return check ? { id: check.id, inspectedAt: isoFromDate(check.inspectedAt), result: check.result } : null;
}

/**
 * Una prueba funcional no apta deja al equipo sin garantías desde la última comprobación buena: se abre la evaluación de
 * impacto (gatillo «falló la prueba funcional»). La ventana va de la última comprobación apta (calibración, verificación o
 * prueba funcional) a la fecha de esta prueba. Si ya hay una evaluación pendiente, no se abre otra: se extiende su ventana.
 * El motor de inspecciones ya sacó el equipo de servicio (`applyAssetStatus`); acá se suma la evaluación y se recalcula el estado.
 */
export async function onFunctionalCheckClosed(
  tx: Tx,
  input: { tenantId: string; actorUserId: string; inspection: { id: string; assetId: string | null; inspectedAt: string }; result: InspectionResult },
) {
  if (input.result !== "unfit" || !input.inspection.assetId) return;
  const assetId = input.inspection.assetId;
  const asset = await tx.asset.findFirst({ where: { id: assetId, tenantId: input.tenantId, typeKey: INSTRUMENT_TYPE_KEY }, select: { id: true, code: true, instrControl: { select: { id: true } } } });
  if (!asset?.instrControl) return;
  const windowTo = input.inspection.inspectedAt;

  const [lastRecord, lastCheck] = await Promise.all([
    tx.calibrationRecord.findFirst({
      where: { tenantId: input.tenantId, assetId, status: "closed", asLeftResult: "apt", performedAt: { lte: dateFromIso(windowTo) } },
      orderBy: [{ performedAt: "desc" }, { closedAt: "desc" }],
      select: { performedAt: true },
    }),
    tx.inspection.findFirst({
      where: {
        tenantId: input.tenantId,
        assetId,
        status: "closed",
        id: { not: input.inspection.id },
        result: { in: ["fit", "fit_with_observations"] },
        inspectedAt: { lte: dateFromIso(windowTo) },
        template: { key: FUNCTIONAL_CHECK_TEMPLATE_KEY },
      },
      orderBy: [{ inspectedAt: "desc" }, { closedAt: "desc" }],
      select: { inspectedAt: true },
    }),
  ]);
  const candidates = [lastRecord?.performedAt, lastCheck?.inspectedAt].filter((d): d is Date => Boolean(d)).map(isoFromDate).sort();
  const windowFrom = candidates.at(-1) ?? null;

  const pending = await tx.impactAssessment.findFirst({ where: { tenantId: input.tenantId, assetId, status: "pending" }, orderBy: { createdAt: "desc" } });
  if (pending) {
    if (isoFromDate(pending.windowTo) < windowTo) await tx.impactAssessment.update({ where: { id: pending.id }, data: { windowTo: dateFromIso(windowTo) } });
  } else {
    await tx.impactAssessment.create({
      data: {
        tenantId: input.tenantId,
        assetId,
        trigger: "functional_check_failed",
        windowFrom: windowFrom ? dateFromIso(windowFrom) : null,
        windowTo: dateFromIso(windowTo),
      },
    });
  }
  await recomputeInstrumentControl(input.tenantId, assetId, tx);
  await writeAudit(tx, {
    tenantId: input.tenantId,
    entityType: "instrument",
    entityId: assetId,
    action: "functional_check_failed",
    actorUserId: input.actorUserId,
    summary: `Prueba funcional no apta de ${asset.code}: se pide la evaluación de impacto`,
  });
}
