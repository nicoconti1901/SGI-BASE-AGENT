import { prisma } from "@/lib/db";
import { listRisks } from "@/lib/risks";
import { listOpportunities } from "@/lib/opportunities";
import {
  listOpenActions,
  listActionsNeedingEffectiveness,
} from "@/lib/actions";
import { isStale } from "@/domain/risks/review";

/** Agrega las 4 etapas: identificación, evaluación y decisión, tratamiento, seguimiento. */
export async function loadRisksWorkspace(tenantId: string) {
  const now = new Date();

  const [risks, opportunities, openActions, learningActions] =
    await Promise.all([
      listRisks(tenantId, { status: "all" }),
      listOpportunities(tenantId, { status: "all" }),
      listOpenActions(tenantId),
      listActionsNeedingEffectiveness(tenantId),
    ]);

  // Cada registro aparece en una sola etapa según su estado.
  const discovery = {
    risks: risks.filter((r) => ["identified", "analyzing"].includes(r.status)),
    opportunities: opportunities.filter((o) =>
      ["discovered", "analyzing"].includes(o.status),
    ),
  };

  const decisions = {
    risks: risks.filter((r) => r.status === "evaluated"),
    opportunities: opportunities.filter((o) =>
      ["evaluated", "decision"].includes(o.status),
    ),
  };

  const execution = {
    risks: risks.filter((r) =>
      ["implementing", "response_planned", "effectiveness_review"].includes(
        r.status,
      ),
    ),
    opportunities: opportunities.filter((o) =>
      ["pursuing", "implementing", "benefit_review"].includes(o.status),
    ),
    openActions,
  };

  const staleRisks = [];
  for (const r of risks) {
    if (r.status === "closed") continue;
    const overdueLinks = openActions.filter(
      (a) =>
        a.dueAt &&
        a.dueAt < now &&
        a.links.some((l) => l.targetType === "risk" && l.targetId === r.id),
    );
    if (
      isStale({
        status: r.status,
        lastAssessmentAt: r.assessments[0]?.assessedAt ?? null,
        nextReviewAt: r.nextReviewAt,
        hasOverdueAction: overdueLinks.length > 0,
        now,
      })
    ) {
      staleRisks.push(r);
    }
  }

  const staleOpps = [];
  for (const o of opportunities) {
    if (o.status === "closed" || o.status === "realized") continue;
    const overdueLinks = openActions.filter(
      (a) =>
        a.dueAt &&
        a.dueAt < now &&
        a.links.some(
          (l) => l.targetType === "opportunity" && l.targetId === o.id,
        ),
    );
    if (
      isStale({
        status: o.status,
        lastAssessmentAt: o.assessments[0]?.assessedAt ?? null,
        nextReviewAt: o.nextReviewAt,
        hasOverdueAction: overdueLinks.length > 0,
        now,
      })
    ) {
      staleOpps.push(o);
    }
  }

  const learning = {
    actionsNeedingEffectiveness: learningActions,
    staleRisks,
    staleOpportunities: staleOpps,
    monitored: risks.filter((r) => r.status === "monitored"),
    realized: opportunities.filter((o) => o.status === "realized"),
  };

  return {
    discovery,
    decisions,
    execution,
    learning,
    counts: {
      risksOpen: risks.filter((r) => r.status !== "closed").length,
      opportunitiesOpen: opportunities.filter(
        (o) => o.status !== "closed" && o.status !== "realized",
      ).length,
      openActions: openActions.length,
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
