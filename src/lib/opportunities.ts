import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCanTransitionOpportunity } from "@/domain/opportunities/lifecycle";
import {
  assertValidAssessmentInput,
  nextAssessmentVersion,
} from "@/domain/risks/assessment";
import { isStale } from "@/domain/risks/review";
import type {
  OpportunityDraft,
  OpportunityPursuitDecision,
  OpportunityStatus,
} from "@/domain/opportunities/types";
import type { AssessmentInput, SourceKind } from "@/domain/risks/types";
import { hasOverdueActionsForTarget } from "@/lib/actions";

export type OpportunitiesListFilters = {
  status?: OpportunityStatus | "all";
  q?: string;
  sourceKind?: SourceKind;
};

export function buildOpportunitiesWhere(
  tenantId: string,
  filters: OpportunitiesListFilters = {},
): Prisma.OpportunityWhereInput {
  const where: Prisma.OpportunityWhereInput = { tenantId };

  if (!filters.status || filters.status === "all") {
    if (!filters.status) {
      where.status = { notIn: ["closed", "realized"] };
    }
  } else {
    where.status = filters.status;
  }

  if (filters.sourceKind) {
    where.sourceKind = filters.sourceKind;
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { sourceLabel: { contains: q, mode: "insensitive" } },
      { condition: { contains: q, mode: "insensitive" } },
      { circumstance: { contains: q, mode: "insensitive" } },
      { benefit: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listOpportunities(
  tenantId: string,
  filters: OpportunitiesListFilters = {},
  db: PrismaClient = prisma,
) {
  return db.opportunity.findMany({
    where: buildOpportunitiesWhere(tenantId, filters),
    include: {
      assessments: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { assessments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getOpportunity(
  tenantId: string,
  id: string,
  db: PrismaClient = prisma,
) {
  return db.opportunity.findFirst({
    where: { id, tenantId },
    include: {
      assessments: { orderBy: { version: "desc" } },
      finding: { select: { id: true, title: true, status: true } },
    },
  });
}

export async function createOpportunity(
  input: {
    tenantId: string;
    draft: OpportunityDraft;
    createdByUserId?: string;
  },
  db: PrismaClient = prisma,
) {
  const { draft } = input;
  if (draft.title.trim().length < 2) {
    throw new Error("El título de la oportunidad es obligatorio");
  }

  return db.opportunity.create({
    data: {
      tenantId: input.tenantId,
      title: draft.title.trim(),
      condition: draft.hypothesis.condition.trim(),
      circumstance: draft.hypothesis.circumstance.trim(),
      benefit: draft.hypothesis.benefit.trim(),
      sourceKind: draft.sourceKind,
      sourceLabel: draft.sourceLabel.trim(),
      findingId: draft.findingId || null,
      createdByUserId: input.createdByUserId ?? null,
      status: "discovered",
    },
  });
}

export async function updateOpportunityCanvas(
  input: {
    tenantId: string;
    opportunityId: string;
    title: string;
    condition: string;
    circumstance: string;
    benefit: string;
  },
  db: PrismaClient = prisma,
) {
  const opp = await getOpportunity(input.tenantId, input.opportunityId, db);
  if (!opp) throw new Error("Oportunidad no encontrada");
  if (opp.status === "closed" || opp.status === "realized") {
    throw new Error("No se puede editar una oportunidad cerrada");
  }

  const data: Prisma.OpportunityUpdateInput = {
    title: input.title.trim(),
    condition: input.condition.trim(),
    circumstance: input.circumstance.trim(),
    benefit: input.benefit.trim(),
  };

  if (opp.status === "discovered") {
    assertCanTransitionOpportunity(opp.status, "analyzing");
    data.status = "analyzing";
  }

  return db.opportunity.update({
    where: { id: opp.id },
    data,
  });
}

export async function addOpportunityAssessment(
  input: {
    tenantId: string;
    opportunityId: string;
    assessment: AssessmentInput;
    assessedById?: string;
  },
  db: PrismaClient = prisma,
) {
  const opp = await getOpportunity(input.tenantId, input.opportunityId, db);
  if (!opp) throw new Error("Oportunidad no encontrada");
  if (opp.status === "closed" || opp.status === "realized") {
    throw new Error("No se puede evaluar una oportunidad cerrada");
  }

  assertValidAssessmentInput(input.assessment);

  const maxVersion = opp.assessments[0]?.version ?? null;
  const version = nextAssessmentVersion(maxVersion);

  const resultJson =
    input.assessment.method === "qualitative"
      ? { level: input.assessment.level }
      : {
          probability: input.assessment.probability,
          impact: input.assessment.impact,
          score: input.assessment.score,
        };

  const assessment = await db.opportunityAssessment.create({
    data: {
      tenantId: input.tenantId,
      opportunityId: opp.id,
      version,
      method: input.assessment.method,
      resultJson,
      rationale: input.assessment.rationale.trim(),
      assessedById: input.assessedById ?? null,
    },
  });

  if (
    opp.status === "discovered" ||
    opp.status === "analyzing"
  ) {
    if (opp.status === "discovered") {
      await db.opportunity.update({
        where: { id: opp.id },
        data: { status: "analyzing" },
      });
    }
    assertCanTransitionOpportunity("analyzing", "evaluated");
    await db.opportunity.update({
      where: { id: opp.id },
      data: { status: "evaluated" },
    });
  }

  return assessment;
}

export async function setOpportunityPursuitDecision(
  input: {
    tenantId: string;
    opportunityId: string;
    decision: OpportunityPursuitDecision;
    rationale: string;
    ownerUserId?: string;
    nextReviewAt?: Date | null;
  },
  db: PrismaClient = prisma,
) {
  const opp = await getOpportunity(input.tenantId, input.opportunityId, db);
  if (!opp) throw new Error("Oportunidad no encontrada");
  if (!input.rationale.trim()) {
    throw new Error("La justificación de la decisión es obligatoria");
  }

  if (opp.status !== "evaluated" && opp.status !== "decision") {
    throw new Error("La decisión requiere una oportunidad evaluada");
  }

  if (opp.status === "evaluated") {
    assertCanTransitionOpportunity("evaluated", "decision");
  }

  let nextStatus: OpportunityStatus = "decision";
  if (input.decision === "do_not_pursue" || input.decision === "close") {
    assertCanTransitionOpportunity("decision", "closed");
    nextStatus = "closed";
  } else if (input.decision === "pursue_now") {
    assertCanTransitionOpportunity("decision", "pursuing");
    nextStatus = "pursuing";
  }

  return db.opportunity.update({
    where: { id: opp.id },
    data: {
      status: nextStatus,
      pursuitDecision: input.decision,
      pursuitRationale: input.rationale.trim(),
      pursuitOwnerUserId: input.ownerUserId || null,
      nextReviewAt: input.nextReviewAt ?? null,
      closeRationale:
        nextStatus === "closed" ? input.rationale.trim() : undefined,
    },
  });
}

export async function transitionOpportunityStatus(
  input: {
    tenantId: string;
    opportunityId: string;
    to: OpportunityStatus;
    closeRationale?: string;
  },
  db: PrismaClient = prisma,
) {
  const opp = await getOpportunity(input.tenantId, input.opportunityId, db);
  if (!opp) throw new Error("Oportunidad no encontrada");
  assertCanTransitionOpportunity(opp.status, input.to);

  return db.opportunity.update({
    where: { id: opp.id },
    data: {
      status: input.to,
      closeRationale:
        input.to === "closed" || input.to === "realized"
          ? input.closeRationale?.trim() ?? null
          : undefined,
    },
  });
}

export async function opportunityHealthSignals(
  tenantId: string,
  opportunityId: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
) {
  const opp = await getOpportunity(tenantId, opportunityId, db);
  if (!opp) return null;

  const lastAssessmentAt = opp.assessments[0]?.assessedAt ?? null;
  const overdue = await hasOverdueActionsForTarget(
    tenantId,
    "opportunity",
    opportunityId,
    now,
    db,
  );

  return {
    stale: isStale({
      status: opp.status,
      lastAssessmentAt,
      nextReviewAt: opp.nextReviewAt,
      hasOverdueAction: overdue,
      now,
    }),
    hasOverdueAction: overdue,
    lastAssessmentAt,
  };
}

export async function listOpportunitiesNeedingDecision(
  tenantId: string,
  db: PrismaClient = prisma,
) {
  return db.opportunity.findMany({
    where: {
      tenantId,
      status: { in: ["evaluated", "decision", "analyzing", "discovered"] },
    },
    orderBy: { updatedAt: "desc" },
  });
}
