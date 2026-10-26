import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { InspectionError, syncOpenDueItem, writeAudit, type Db, type Tx } from "@/lib/inspection-support";
import { recomputeInstrumentControl } from "@/lib/instruments";
import { ACTION_ENTITY_TYPE } from "@/domain/actions/types";
import { dateFromIso, endOfDayInstant, formatDateEs, isIsoDate, isoFromDate } from "@/domain/inspections/dates";
import { assessmentRequired, type Result } from "@/domain/calibration";

export const IMPACT_OUTCOMES = ["no_affected_results", "affected_results_actioned", "cannot_determine"] as const;
export type ImpactOutcome = (typeof IMPACT_OUTCOMES)[number];

export const IMPACT_OUTCOME_LABELS: Record<ImpactOutcome, string> = {
  no_affected_results: "Las mediciones no se vieron afectadas",
  affected_results_actioned: "Hubo mediciones afectadas y se tomaron acciones",
  cannot_determine: "No se puede determinar el efecto",
};

export const IMPACT_TRIGGER_LABELS = {
  as_found_not_apt: "El equipo estaba fuera de tolerancia al recibirlo",
  adjusted_without_as_found: "Se ajustó un equipo de uso crítico sin medir cómo estaba antes",
  functional_check_failed: "Falló la prueba funcional",
} as const;

/**
 * Abre la evaluación de impacto si el registro recién cerrado la exige: el as-found fuera de tolerancia, o un equipo de uso
 * crítico ajustado sin datos de antes. La ventana va del último registro apto anterior (o «desde que se usa») a la fecha del registro.
 * Va dentro de la transacción del cierre; no hace nada si ya existe una para ese registro.
 */
export async function openImpactAssessmentForRecord(
  tx: Tx,
  input: { tenantId: string; assetId: string; recordId: string; performedAt: string; asFoundResult: Result | "not_evaluated" | null; adjusted: boolean; criticalUse: boolean },
) {
  const previous = await tx.calibrationRecord.findFirst({
    where: { tenantId: input.tenantId, assetId: input.assetId, status: "closed", asLeftResult: "apt", id: { not: input.recordId }, performedAt: { lte: dateFromIso(input.performedAt) } },
    orderBy: [{ performedAt: "desc" }, { closedAt: "desc" }],
    select: { performedAt: true },
  });
  const need = assessmentRequired({
    asFoundResult: input.asFoundResult,
    adjusted: input.adjusted,
    criticalUse: input.criticalUse,
    previousAptDate: previous ? isoFromDate(previous.performedAt) : null,
    performedAt: input.performedAt,
  });
  if (!need.required) return null;
  const existing = await tx.impactAssessment.findUnique({ where: { triggerRecordId: input.recordId }, select: { id: true } });
  if (existing) return existing;
  return tx.impactAssessment.create({
    data: {
      tenantId: input.tenantId,
      assetId: input.assetId,
      triggerRecordId: input.recordId,
      trigger: need.trigger,
      windowFrom: need.windowFrom ? dateFromIso(need.windowFrom) : null,
      windowTo: dateFromIso(need.windowTo),
    },
    select: { id: true },
  });
}

/** Quita la evaluación pendiente que originó un registro que se anula (si ya estaba completada, queda como constancia). */
export async function dropPendingAssessmentOfRecord(tx: Tx, tenantId: string, recordId: string) {
  const pending = await tx.impactAssessment.findMany({ where: { tenantId, triggerRecordId: recordId, status: "pending" }, select: { id: true } });
  if (pending.length === 0) return;
  const ids = pending.map((p) => p.id);
  await tx.dueItem.updateMany({ where: { tenantId, entityType: "instrument_impact", entityId: { in: ids }, status: "open" }, data: { status: "closed" } });
  await tx.impactAssessment.deleteMany({ where: { id: { in: ids }, tenantId } });
}

export type ImpactActionInput = { title: string; ownerUserId: string; dueAt: string | null };

export type CompleteImpactInput = {
  tenantId: string;
  actorUserId: string;
  assessmentId: string;
  outcome: string;
  /** Qué se midió con el equipo en la ventana. */
  affectedSummary: string;
  rationale: string;
  /** Con «afectadas» el hallazgo en borrador se crea siempre; en los demás casos es opcional. */
  registerFinding: boolean;
  actions: ImpactActionInput[];
};

const isOutcome = (v: string): v is ImpactOutcome => (IMPACT_OUTCOMES as readonly string[]).includes(v);

/**
 * Completa la evaluación: la decisión tomada, su justificación y, si hubo mediciones afectadas o no se pudo saber,
 * al menos una acción o un hallazgo. Al completarla el equipo deja de estar bloqueado por «evaluación pendiente».
 */
export async function completeImpactAssessment(input: CompleteImpactInput, db: PrismaClient = prisma) {
  if (!isOutcome(input.outcome)) throw new InspectionError("Elegí qué se concluyó sobre las mediciones");
  const outcome = input.outcome;
  const affectedSummary = input.affectedSummary.trim();
  const rationale = input.rationale.trim();
  if (affectedSummary.length < 3) throw new InspectionError("Contá qué se midió con el equipo en ese período");
  if (rationale.length < 10) throw new InspectionError("Justificá la decisión (al menos 10 caracteres)");
  const actions = input.actions
    .map((a) => ({ title: a.title.trim(), ownerUserId: a.ownerUserId.trim(), dueAt: a.dueAt?.trim() || null }))
    .filter((a) => a.title !== "" || a.ownerUserId !== "" || a.dueAt !== null);
  for (const [i, a] of actions.entries()) {
    if (a.title.length < 2) throw new InspectionError(`Acción ${i + 1}: indicá qué hay que hacer`);
    if (!a.ownerUserId) throw new InspectionError(`Acción ${i + 1}: elegí quién es responsable`);
    if (!a.dueAt || !isIsoDate(a.dueAt)) throw new InspectionError(`Acción ${i + 1}: indicá la fecha límite`);
  }
  const wantsFinding = input.registerFinding || outcome === "affected_results_actioned";
  if (outcome !== "no_affected_results" && actions.length === 0 && !wantsFinding) {
    throw new InspectionError("Si hubo mediciones afectadas, o no se puede determinar el efecto, registrá al menos una acción o un hallazgo");
  }
  const owners = [...new Set(actions.map((a) => a.ownerUserId))];
  if (owners.length > 0) {
    const members = await db.membership.count({ where: { tenantId: input.tenantId, userId: { in: owners } } });
    if (members !== owners.length) throw new InspectionError("Algún responsable no pertenece a la empresa");
  }

  const assessment = await db.impactAssessment.findFirst({
    where: { id: input.assessmentId, tenantId: input.tenantId },
    include: { asset: { select: { id: true, code: true, description: true, siteId: true, site: { select: { name: true } }, instrControl: { select: { criticalUse: true } } } } },
  });
  if (!assessment) throw new InspectionError("Evaluación no encontrada");
  if (assessment.status !== "pending") throw new InspectionError("La evaluación ya está completada");
  const { asset } = assessment;

  return db.$transaction(async (tx) => {
    const claimed = await tx.impactAssessment.updateMany({
      where: { id: assessment.id, tenantId: input.tenantId, status: "pending" },
      data: { status: "completed", outcome, affectedSummary, rationale, completedByUserId: input.actorUserId, completedAt: new Date() },
    });
    if (claimed.count !== 1) throw new InspectionError("La evaluación ya fue completada");

    let findingId: string | null = null;
    if (wantsFinding) {
      const window = `${assessment.windowFrom ? `desde el ${formatDateEs(isoFromDate(assessment.windowFrom))}` : "desde que se empezó a usar"} hasta el ${formatDateEs(isoFromDate(assessment.windowTo))}`;
      const finding = await tx.finding.create({
        data: {
          tenantId: input.tenantId,
          type: "nonconformity",
          status: "draft",
          title: `Equipo ${asset.code} fuera de tolerancia: mediciones a revisar`,
          description: [
            `${asset.description} (${asset.code}). ${IMPACT_TRIGGER_LABELS[assessment.trigger]}.`,
            `Mediciones a revisar: ${window}.`,
            `Qué se midió: ${affectedSummary}`,
            `Conclusión: ${IMPACT_OUTCOME_LABELS[outcome]}. ${rationale}`,
          ].join("\n"),
          detectedAt: assessment.windowTo,
          source: `Equipo ${asset.code}`,
          origin: "calibration",
          location: asset.site.name,
          severity: asset.instrControl?.criticalUse ? "Crítica" : "Mayor",
          createdByUserId: input.actorUserId,
        },
        select: { id: true },
      });
      findingId = finding.id;
      await tx.impactAssessment.update({ where: { id: assessment.id }, data: { findingId } });
    }

    const actionIds: string[] = [];
    for (const a of actions) {
      const dueAt = endOfDayInstant(a.dueAt as string);
      const action = await tx.action.create({
        data: {
          tenantId: input.tenantId,
          title: a.title,
          description: `Seguimiento de la evaluación de impacto del equipo ${asset.code}.`,
          ownerUserId: a.ownerUserId,
          dueAt,
          createdByUserId: input.actorUserId,
          ...(findingId ? { links: { create: [{ targetType: "finding" as const, targetId: findingId }] } } : {}),
        },
        select: { id: true, title: true },
      });
      await tx.impactAction.create({ data: { tenantId: input.tenantId, impactAssessmentId: assessment.id, actionId: action.id } });
      await syncOpenDueItem(tx, {
        tenantId: input.tenantId,
        entityType: ACTION_ENTITY_TYPE,
        entityId: action.id,
        title: `Acción: ${action.title}`,
        dueAt,
        leadDays: 7, // el mismo aviso previo que el resto de las acciones
        ownerUserId: a.ownerUserId,
        siteId: asset.siteId,
        personId: null,
      });
      actionIds.push(action.id);
    }

    await recomputeInstrumentControl(input.tenantId, assessment.assetId, tx);
    await writeAudit(tx, {
      tenantId: input.tenantId,
      entityType: "impact_assessment",
      entityId: assessment.id,
      action: "complete",
      actorUserId: input.actorUserId,
      summary: `Evaluación de impacto de ${asset.code} completada: ${IMPACT_OUTCOME_LABELS[outcome]}`,
    });
    return { id: assessment.id, assetId: assessment.assetId, findingId, actionIds };
  });
}

/** Evaluaciones ya completadas de un equipo, con su hallazgo y sus acciones, para la ficha. */
export async function listCompletedAssessments(tenantId: string, assetId: string, db: Db = prisma, take = 10) {
  return db.impactAssessment.findMany({
    where: { tenantId, assetId, status: "completed" },
    orderBy: { completedAt: "desc" },
    take,
    include: {
      finding: { select: { id: true, title: true } },
      actions: { include: { action: { select: { id: true, title: true, status: true, dueAt: true } } } },
    },
  });
}
