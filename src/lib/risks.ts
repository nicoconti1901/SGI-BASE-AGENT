import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCanTransitionRisk } from "@/domain/risks/lifecycle";
import {
  assertValidAssessmentInput,
  nextAssessmentVersion,
} from "@/domain/risks/assessment";
import { isStale } from "@/domain/risks/review";
import type {
  AssessmentInput,
  RiskDraft,
  RiskResponseDecision,
  RiskStatus,
  SourceKind,
} from "@/domain/risks/types";
import { hasOverdueActionsForTarget } from "@/lib/actions";

export type RisksListFilters = {
  status?: RiskStatus | "all";
  q?: string;
  sourceKind?: SourceKind;
};

export function buildRisksWhere(
  tenantId: string,
  filters: RisksListFilters = {},
): Prisma.RiskWhereInput {
  const where: Prisma.RiskWhereInput = { tenantId };

  if (!filters.status || filters.status === "all") {
    if (!filters.status) {
      where.status = { not: "closed" };
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
      { cause: { contains: q, mode: "insensitive" } },
      { event: { contains: q, mode: "insensitive" } },
      { effect: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listRisks(
  tenantId: string,
  filters: RisksListFilters = {},
  db: PrismaClient = prisma,
) {
  return db.risk.findMany({
    where: buildRisksWhere(tenantId, filters),
    include: {
      assessments: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { assessments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getRisk(
  tenantId: string,
  id: string,
  db: PrismaClient = prisma,
) {
  return db.risk.findFirst({
    where: { id, tenantId },
    include: {
      assessments: { orderBy: { version: "desc" } },
      finding: { select: { id: true, title: true, status: true } },
    },
  });
}

function parseControls(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === "string");
}

export async function createRisk(
  input: {
    tenantId: string;
    draft: RiskDraft;
    createdByUserId?: string;
  },
  db: PrismaClient = prisma,
) {
  const { draft } = input;
  if (draft.title.trim().length < 2) {
    throw new Error("El título del riesgo es obligatorio");
  }

  return db.risk.create({
    data: {
      tenantId: input.tenantId,
      title: draft.title.trim(),
      cause: draft.statement.cause.trim(),
      event: draft.statement.event.trim(),
      effect: draft.statement.effect.trim(),
      existingControlsJson: draft.existingControls.filter((c) => c.trim()),
      sourceKind: draft.sourceKind,
      sourceLabel: draft.sourceLabel.trim(),
      findingId: draft.findingId || null,
      createdByUserId: input.createdByUserId ?? null,
      status: "identified",
    },
  });
}

export async function updateRiskCanvas(
  input: {
    tenantId: string;
    riskId: string;
    title: string;
    cause: string;
    event: string;
    effect: string;
    existingControls: string[];
  },
  db: PrismaClient = prisma,
) {
  const risk = await getRisk(input.tenantId, input.riskId, db);
  if (!risk) throw new Error("Riesgo no encontrado");
  if (risk.status === "closed") {
    throw new Error("No se puede editar un riesgo cerrado");
  }

  const data: Prisma.RiskUpdateInput = {
    title: input.title.trim(),
    cause: input.cause.trim(),
    event: input.event.trim(),
    effect: input.effect.trim(),
    existingControlsJson: input.existingControls.filter((c) => c.trim()),
  };

  if (risk.status === "identified") {
    assertCanTransitionRisk(risk.status, "analyzing");
    data.status = "analyzing";
  }

  return db.risk.update({
    where: { id: risk.id },
    data,
  });
}

export async function addRiskAssessment(
  input: {
    tenantId: string;
    riskId: string;
    assessment: AssessmentInput;
    assessedById?: string;
  },
  db: PrismaClient = prisma,
) {
  const risk = await getRisk(input.tenantId, input.riskId, db);
  if (!risk) throw new Error("Riesgo no encontrado");
  if (risk.status === "closed") {
    throw new Error("No se puede evaluar un riesgo cerrado");
  }

  assertValidAssessmentInput(input.assessment);

  const maxVersion = risk.assessments[0]?.version ?? null;
  const version = nextAssessmentVersion(maxVersion);

  const resultJson =
    input.assessment.method === "qualitative"
      ? { level: input.assessment.level }
      : {
          probability: input.assessment.probability,
          impact: input.assessment.impact,
          score: input.assessment.score,
        };

  const assessment = await db.riskAssessment.create({
    data: {
      tenantId: input.tenantId,
      riskId: risk.id,
      version,
      method: input.assessment.method,
      resultJson,
      rationale: input.assessment.rationale.trim(),
      assessedById: input.assessedById ?? null,
    },
  });

  if (
    risk.status === "identified" ||
    risk.status === "analyzing" ||
    risk.status === "monitored"
  ) {
    const from = risk.status === "monitored" ? "monitored" : risk.status === "identified" ? "identified" : "analyzing";
    // From identified we need analyzing first if jumping — allow evaluated from analyzing
    const next: RiskStatus = "evaluated";
    if (from === "identified") {
      await db.risk.update({
        where: { id: risk.id },
        data: { status: "analyzing" },
      });
      assertCanTransitionRisk("analyzing", "evaluated");
    } else if (from === "monitored") {
      assertCanTransitionRisk("monitored", "analyzing");
      await db.risk.update({
        where: { id: risk.id },
        data: { status: "analyzing" },
      });
      assertCanTransitionRisk("analyzing", "evaluated");
    } else {
      assertCanTransitionRisk("analyzing", "evaluated");
    }
    await db.risk.update({
      where: { id: risk.id },
      data: { status: next },
    });
  }

  return assessment;
}

export async function setRiskResponseDecision(
  input: {
    tenantId: string;
    riskId: string;
    decision: RiskResponseDecision;
    rationale: string;
    ownerUserId: string;
    nextReviewAt?: Date | null;
  },
  db: PrismaClient = prisma,
) {
  const risk = await getRisk(input.tenantId, input.riskId, db);
  if (!risk) throw new Error("Riesgo no encontrado");
  if (!input.rationale.trim()) {
    throw new Error("La justificación de la decisión es obligatoria");
  }
  if (!input.ownerUserId) {
    throw new Error("Asigná un responsable de la respuesta");
  }

  if (risk.status === "evaluated") {
    assertCanTransitionRisk("evaluated", "response_planned");
  } else if (risk.status !== "response_planned") {
    throw new Error(
      "La decisión de respuesta requiere un riesgo evaluado",
    );
  }

  return db.risk.update({
    where: { id: risk.id },
    data: {
      status: "response_planned",
      responseDecision: input.decision,
      responseRationale: input.rationale.trim(),
      responseOwnerUserId: input.ownerUserId,
      nextReviewAt: input.nextReviewAt ?? null,
    },
  });
}

export async function transitionRiskStatus(
  input: {
    tenantId: string;
    riskId: string;
    to: RiskStatus;
    closeReason?: string;
    closeRationale?: string;
  },
  db: PrismaClient = prisma,
) {
  const risk = await getRisk(input.tenantId, input.riskId, db);
  if (!risk) throw new Error("Riesgo no encontrado");
  assertCanTransitionRisk(risk.status, input.to);

  return db.risk.update({
    where: { id: risk.id },
    data: {
      status: input.to,
      closeReason: input.to === "closed" ? input.closeReason ?? null : undefined,
      closeRationale:
        input.to === "closed" ? input.closeRationale?.trim() ?? null : undefined,
    },
  });
}

export async function riskHealthSignals(
  tenantId: string,
  riskId: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
) {
  const risk = await getRisk(tenantId, riskId, db);
  if (!risk) return null;

  const lastAssessmentAt = risk.assessments[0]?.assessedAt ?? null;
  const overdue = await hasOverdueActionsForTarget(
    tenantId,
    "risk",
    riskId,
    now,
    db,
  );

  return {
    stale: isStale({
      status: risk.status,
      lastAssessmentAt,
      nextReviewAt: risk.nextReviewAt,
      hasOverdueAction: overdue,
      now,
    }),
    hasOverdueAction: overdue,
    lastAssessmentAt,
    controls: parseControls(risk.existingControlsJson),
  };
}

export async function listRisksNeedingDecision(
  tenantId: string,
  db: PrismaClient = prisma,
) {
  return db.risk.findMany({
    where: {
      tenantId,
      status: { in: ["evaluated", "analyzing", "identified"] },
    },
    orderBy: { updatedAt: "desc" },
  });
}
