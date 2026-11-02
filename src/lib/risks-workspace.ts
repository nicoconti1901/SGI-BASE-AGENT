import { prisma } from "@/lib/db";
import { listRisks } from "@/lib/risks";
import { listOpportunities } from "@/lib/opportunities";
import {
  listOpenActions,
  listActionsNeedingEffectiveness,
} from "@/lib/actions";
import { isStale } from "@/domain/risks/review";
import { assessmentLevelLabel } from "@/domain/risks/assessment";
import { opportunityProgress, riskProgress, type ActionSnapshot } from "@/domain/risks/progress";

export type RegisterRow = {
  id: string;
  title: string;
  /** Una línea: causa → efecto (riesgo) o situación → beneficio (oportunidad). */
  summary: string;
  level: string | null;
  status: string;
  closed: boolean;
  nextStep: string;
  /** Quién tiene que dar el próximo paso (null = nadie). */
  responsibleUserId: string | null;
  nextReviewAt: Date | null;
  stale: boolean;
  sourceLabel: string;
};

function joinArrow(...parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(" → ");
}

/**
 * Registro de riesgos y oportunidades: cada fila dice qué es, su nivel, su estado,
 * el próximo paso y quién lo tiene que dar (la misma lógica que la ficha).
 */
export async function loadRiskRegister(tenantId: string) {
  const now = new Date();
  const [risks, opportunities, openActions, learningActions, links] = await Promise.all([
    listRisks(tenantId, { status: "all" }),
    listOpportunities(tenantId, { status: "all" }),
    listOpenActions(tenantId),
    listActionsNeedingEffectiveness(tenantId),
    prisma.actionLink.findMany({
      where: { targetType: { in: ["risk", "opportunity"] }, action: { tenantId } },
      select: { targetType: true, targetId: true, action: { select: { status: true, effectivenessStatus: true } } },
    }),
  ]);

  const actionsOf = (targetType: "risk" | "opportunity", id: string): ActionSnapshot[] =>
    links.filter((l) => l.targetType === targetType && l.targetId === id).map((l) => l.action);
  const hasOverdue = (targetType: "risk" | "opportunity", id: string) =>
    openActions.some(
      (a) => a.dueAt && a.dueAt < now && a.links.some((l) => l.targetType === targetType && l.targetId === id),
    );

  const riskRows: RegisterRow[] = risks.map((r) => {
    const latest = r.assessments[0] ?? null;
    const progress = riskProgress({
      status: r.status,
      statementComplete: Boolean(r.cause.trim() && r.event.trim() && r.effect.trim()),
      assessments: r._count.assessments,
      decision: r.responseDecision,
      actions: actionsOf("risk", r.id),
    });
    return {
      id: r.id,
      title: r.title,
      summary: joinArrow(r.cause, r.event, r.effect),
      level: latest ? assessmentLevelLabel(latest.method, latest.resultJson) : null,
      status: r.status,
      closed: r.status === "closed",
      nextStep: progress.nextStep,
      responsibleUserId:
        progress.who === "owner" ? r.responseOwnerUserId : progress.who === "creator" ? r.createdByUserId : null,
      nextReviewAt: r.nextReviewAt,
      stale:
        r.status !== "closed" &&
        isStale({
          status: r.status,
          lastAssessmentAt: latest?.assessedAt ?? null,
          nextReviewAt: r.nextReviewAt,
          hasOverdueAction: hasOverdue("risk", r.id),
          now,
        }),
      sourceLabel: r.sourceLabel,
    };
  });

  const opportunityRows: RegisterRow[] = opportunities.map((o) => {
    const latest = o.assessments[0] ?? null;
    const progress = opportunityProgress({
      status: o.status,
      statementComplete: Boolean(o.condition.trim() && o.circumstance.trim() && o.benefit.trim()),
      assessments: o._count.assessments,
      decided: Boolean(o.pursuitDecision),
      actions: actionsOf("opportunity", o.id),
    });
    const closed = o.status === "closed" || o.status === "realized";
    return {
      id: o.id,
      title: o.title,
      summary: joinArrow(o.condition, o.benefit),
      level: latest ? assessmentLevelLabel(latest.method, latest.resultJson) : null,
      status: o.status,
      closed,
      nextStep: progress.nextStep,
      responsibleUserId:
        progress.who === "owner" ? o.pursuitOwnerUserId : progress.who === "creator" ? o.createdByUserId : null,
      nextReviewAt: o.nextReviewAt,
      stale:
        !closed &&
        isStale({
          status: o.status,
          lastAssessmentAt: latest?.assessedAt ?? null,
          nextReviewAt: o.nextReviewAt,
          hasOverdueAction: hasOverdue("opportunity", o.id),
          now,
        }),
      sourceLabel: o.sourceLabel,
    };
  });

  return {
    risks: riskRows,
    opportunities: opportunityRows,
    openActions,
    actionsNeedingEffectiveness: learningActions,
    counts: {
      risksOpen: riskRows.filter((r) => !r.closed).length,
      opportunitiesOpen: opportunityRows.filter((o) => !o.closed).length,
      openActions: openActions.length,
      stale: [...riskRows, ...opportunityRows].filter((r) => r.stale).length,
    },
  };
}

export async function listRecentFindingsForLink(
  tenantId: string,
  take = 30,
) {
  return prisma.finding.findMany({
    where: { tenantId, status: { not: "cancelled" } },
    select: { id: true, title: true, type: true, status: true },
    orderBy: { updatedAt: "desc" },
    take,
  });
}
