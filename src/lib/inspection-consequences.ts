import type { Asset, InspectionResult, InspectionTemplate } from "@prisma/client";
import { InspectionError, closeOpenDueItems, ownerOfPerson, syncOpenDueItem, writeAudit, type Tx } from "@/lib/inspection-support";
import { getAssetType } from "@/domain/inspections/asset-types";
import { assetStatusAfter, type StatusChange } from "@/domain/inspections/asset-status";
import { followUpDueDate, planFollowUp, type NonconformingItem } from "@/domain/inspections/consequences";
import { dateFromIso, endOfDayInstant, isIsoDate, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { nextInspectionDue, type Interval } from "@/domain/inspections/schedule";
import { ACTION_ENTITY_TYPE } from "@/domain/actions/types";

type Template = Pick<InspectionTemplate, "id" | "name" | "intervalUnit" | "intervalValue" | "leadDays" | "reinspectionDays" | "findingOnCritical" | "canReinstate" | "retireOnUnfit">;

function intervalOf(t: Pick<Template, "intervalUnit" | "intervalValue">): Interval | null {
  return t.intervalUnit && t.intervalValue ? { unit: t.intervalUnit, value: t.intervalValue } : null;
}

/** Nombre corto del sujeto para los títulos: «Extintor EXT-001» o el nombre de la plantilla. */
export function subjectLabel(asset: Pick<Asset, "typeKey" | "code"> | null, template: Pick<Template, "name">): string {
  return asset ? `${getAssetType(asset.typeKey).label} ${asset.code}` : template.name;
}

// ─── Estado del activo ─────────────────────────────────────────────────────

/** Aplica `assetStatusAfter` y deja el evento. Una baja definitiva cierra el programa y los avisos del activo. */
export async function applyAssetStatus(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    inspectionId: string;
    asset: Pick<Asset, "id" | "status" | "code">;
    result: InspectionResult;
    template: Pick<Template, "canReinstate" | "retireOnUnfit">;
    canRelease: boolean;
    origin: "close" | "correction";
  },
): Promise<StatusChange | null> {
  const { status, change } = assetStatusAfter({
    current: input.asset.status,
    result: input.result,
    policy: { retireOnUnfit: input.template.retireOnUnfit, canReinstate: input.template.canReinstate },
    canRelease: input.canRelease,
    origin: input.origin,
  });
  if (!change) return null;

  const now = new Date();
  const reason = REASON_TEXT[change.reasonCode];
  const updated = await tx.asset.updateMany({
    where: { id: input.asset.id, tenantId: input.tenantId, status: input.asset.status },
    data: {
      status,
      statusReason: reason,
      statusChangedAt: now,
      ...(status === "retired" ? { retiredAt: now, retirementReason: reason } : {}),
    },
  });
  if (updated.count === 0) return null; // otro cierre ya cambió el estado
  await tx.assetStatusEvent.create({
    data: { tenantId: input.tenantId, assetId: input.asset.id, fromStatus: change.from, toStatus: change.to, reasonCode: change.reasonCode, inspectionId: input.inspectionId, byUserId: input.actorUserId },
  });
  if (status === "retired") {
    const plans = await tx.inspectionPlan.findMany({ where: { assetId: input.asset.id }, select: { id: true } });
    await tx.inspectionPlan.updateMany({ where: { assetId: input.asset.id }, data: { active: false, nextDueAt: null } });
    await closeOpenDueItems(tx, input.tenantId, "inspection_plan", plans.map((p) => p.id));
    const dueDates = await tx.assetDueDate.findMany({ where: { assetId: input.asset.id }, select: { id: true } });
    await closeOpenDueItems(tx, input.tenantId, "asset_due_date", dueDates.map((d) => d.id));
  }
  return change;
}

const REASON_TEXT = {
  inspection_unfit: "Inspección no apta",
  inspection_unfit_retired: "Inspección no apta: baja definitiva",
  reinstated: "Reinspección apta: vuelve a servicio",
  correction_unfit: "Corrección de una inspección: ahora no apta",
  correction_unfit_retired: "Corrección de una inspección: ahora no apta, baja definitiva",
} as const;

// ─── Programa y próximo vencimiento ────────────────────────────────────────

/**
 * Actualiza el programa (una fila por plantilla y sujeto) y deja exactamente un vencimiento abierto, o ninguno.
 * El programa se bloquea mientras se decide, para que dos cierres a la vez no creen dos avisos.
 * `lastInspected` solo avanza: cerrar una inspección con fecha anterior a la última no la pisa.
 */
export async function updatePlan(
  tx: Tx,
  input: {
    tenantId: string;
    template: Template;
    asset: Pick<Asset, "id" | "code" | "typeKey" | "siteId" | "assignedPersonId"> | null;
    siteId: string;
    inspectionId: string;
    inspectedAt: string;
    result: InspectionResult;
    assetRetired: boolean;
  },
) {
  const subjectKey = input.asset ? `asset:${input.asset.id}` : `site:${input.siteId}`;
  await tx.$queryRaw`SELECT id FROM inspection_plan WHERE "templateId" = ${input.template.id} AND "subjectKey" = ${subjectKey} FOR UPDATE`;
  const interval = intervalOf(input.template);
  let plan = await tx.inspectionPlan.findFirst({ where: { templateId: input.template.id, subjectKey, tenantId: input.tenantId } });
  if (!plan && !interval) return null; // control previo al uso: no tiene programa
  if (!plan) {
    plan = await tx.inspectionPlan.create({
      data: { tenantId: input.tenantId, templateId: input.template.id, subjectKey, assetId: input.asset?.id ?? null, siteId: input.siteId },
    });
  }

  const lastIso = plan.lastInspectedAt ? isoFromDate(plan.lastInspectedAt) : null;
  const isNewest = !lastIso || input.inspectedAt >= lastIso || plan.lastInspectionId === input.inspectionId;
  if (!isNewest) return plan;

  const next = nextInspectionDue({
    inspectedAt: input.inspectedAt,
    result: input.result,
    interval,
    reinspectionDays: input.template.reinspectionDays,
    retireOnUnfit: input.template.retireOnUnfit,
    assetRetired: input.assetRetired,
  });
  const updated = await tx.inspectionPlan.update({
    where: { id: plan.id },
    data: {
      lastInspectionId: input.inspectionId,
      lastInspectedAt: dateFromIso(input.inspectedAt),
      lastResult: input.result,
      nextDueAt: next.dueAt ? dateFromIso(next.dueAt) : null,
      active: !input.assetRetired,
    },
  });

  if (next.dueAt) {
    const base = input.asset ? `${getAssetType(input.asset.typeKey).label.toLowerCase()} ${input.asset.code}` : input.template.name.toLowerCase();
    await syncOpenDueItem(tx, {
      tenantId: input.tenantId,
      entityType: "inspection_plan",
      entityId: plan.id,
      title: next.kind === "reinspection" ? `Reinspección de ${base}` : `Inspección de ${base}`,
      dueAt: endOfDayInstant(next.dueAt),
      leadDays: input.template.leadDays,
      ownerUserId: input.asset ? await ownerOfPerson(tx, input.tenantId, input.asset.assignedPersonId) : null,
      siteId: input.siteId,
      personId: input.asset?.assignedPersonId ?? null,
    });
  } else {
    await closeOpenDueItems(tx, input.tenantId, "inspection_plan", [plan.id]);
  }
  return updated;
}

// ─── Acción y hallazgo ─────────────────────────────────────────────────────

export type FollowUpChoice = { ownerUserId?: string | null; dueAt?: string | null };

/**
 * Crea la acción de seguimiento (siempre que haya no conformidades) y, si la plantilla lo pide y hay una crítica,
 * el hallazgo en borrador, vinculados a la inspección. Si la inspección ya tiene los suyos no crea otros.
 * El responsable y el plazo propuestos los puede cambiar el inspector al cerrar.
 */
export async function createFollowUp(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    inspection: { id: string; actionId: string | null; findingId: string | null; siteId: string };
    template: Template;
    asset: Pick<Asset, "typeKey" | "code" | "assignedPersonId"> | null;
    nonconforming: NonconformingItem[];
    statusChange: StatusChange | null;
    choice?: FollowUpChoice;
    detectedAt: string;
  },
): Promise<{ actionId: string | null; findingId: string | null }> {
  const plan = planFollowUp({
    subjectLabel: subjectLabel(input.asset, input.template),
    nonconforming: input.nonconforming,
    statusChange: input.statusChange,
    typeKey: input.asset?.typeKey ?? null,
    findingOnCritical: input.template.findingOnCritical,
  });
  if (!plan.action || input.inspection.actionId) return { actionId: input.inspection.actionId, findingId: input.inspection.findingId };

  let ownerUserId = input.choice?.ownerUserId || null;
  // Quien cierra siempre puede quedarse con la acción (el administrador de plataforma no es miembro de la empresa).
  if (ownerUserId && ownerUserId !== input.actorUserId) {
    const member = await tx.membership.findFirst({ where: { tenantId: input.tenantId, userId: ownerUserId }, select: { userId: true } });
    if (!member) throw new InspectionError("El responsable elegido no pertenece a la empresa");
  }
  ownerUserId ??= (await ownerOfPerson(tx, input.tenantId, input.asset?.assignedPersonId ?? null)) ?? input.actorUserId;

  const chosenDue = input.choice?.dueAt || null;
  if (chosenDue && !isIsoDate(chosenDue)) throw new InspectionError("Fecha del plazo inválida");
  const dueIso = chosenDue ?? followUpDueDate(todayIso(), plan.action.criticality);

  let findingId = input.inspection.findingId;
  if (plan.finding && !findingId) {
    const site = await tx.site.findFirst({ where: { id: input.inspection.siteId, tenantId: input.tenantId }, select: { name: true } });
    const finding = await tx.finding.create({
      data: {
        tenantId: input.tenantId,
        type: "nonconformity",
        status: "draft",
        title: plan.finding.title,
        description: plan.finding.description,
        detectedAt: dateFromIso(input.detectedAt),
        source: `Inspección: ${input.template.name}`,
        origin: "inspection",
        location: site?.name ?? null,
        severity: plan.finding.severity,
        createdByUserId: input.actorUserId,
      },
      select: { id: true },
    });
    findingId = finding.id;
  }

  const action = await tx.action.create({
    data: {
      tenantId: input.tenantId,
      title: plan.action.title,
      description: plan.action.description,
      ownerUserId,
      dueAt: endOfDayInstant(dueIso),
      createdByUserId: input.actorUserId,
      ...(findingId ? { links: { create: [{ targetType: "finding" as const, targetId: findingId }] } } : {}),
    },
    select: { id: true, title: true },
  });
  await syncOpenDueItem(tx, {
    tenantId: input.tenantId,
    entityType: ACTION_ENTITY_TYPE,
    entityId: action.id,
    title: `Acción: ${action.title}`,
    dueAt: endOfDayInstant(dueIso),
    leadDays: 7, // el mismo aviso previo que el resto de las acciones
    ownerUserId,
    siteId: input.inspection.siteId,
    personId: null,
  });
  await tx.inspection.update({ where: { id: input.inspection.id }, data: { actionId: action.id, ...(findingId ? { findingId } : {}) } });
  await writeAudit(tx, {
    tenantId: input.tenantId,
    entityType: "inspection",
    entityId: input.inspection.id,
    action: "follow_up",
    actorUserId: input.actorUserId,
    summary: `Acción de seguimiento creada${findingId ? " y hallazgo en borrador" : ""} por ${input.nonconforming.length} no conformidad(es)`,
  });
  return { actionId: action.id, findingId };
}
