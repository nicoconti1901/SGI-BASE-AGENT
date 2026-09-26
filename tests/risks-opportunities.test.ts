import { describe, expect, it } from "vitest";
import {
  assertCanTransitionRisk,
  canTransitionRisk,
  nextStatusesForRisk,
} from "@/domain/risks/lifecycle";
import {
  assertCanTransitionOpportunity,
  canTransitionOpportunity,
} from "@/domain/opportunities/lifecycle";
import {
  assertValidAssessmentInput,
  nextAssessmentVersion,
} from "@/domain/risks/assessment";
import { isStale, suggestReviewTriggers } from "@/domain/risks/review";
import {
  assertCanCompleteAction,
  assertCanRecordEffectiveness,
  hasLearnedFromAction,
} from "@/domain/actions/types";
import { RISK_STATUSES } from "@/domain/risks/types";
import { OPPORTUNITY_STATUSES } from "@/domain/opportunities/types";
import { buildRisksWhere } from "@/lib/risks";
import { buildOpportunitiesWhere } from "@/lib/opportunities";
import { ACTION_ENTITY_TYPE } from "@/domain/actions/types";

describe("risk vs opportunity separation", () => {
  it("keeps distinct lifecycle vocabularies", () => {
    expect(RISK_STATUSES).toContain("identified");
    expect(RISK_STATUSES).not.toContain("discovered");
    expect(OPPORTUNITY_STATUSES).toContain("discovered");
    expect(OPPORTUNITY_STATUSES).not.toContain("identified");
    expect(OPPORTUNITY_STATUSES).toContain("realized");
  });
});

describe("risk lifecycle", () => {
  it("allows identified → analyzing", () => {
    expect(canTransitionRisk("identified", "analyzing")).toBe(true);
  });

  it("rejects jumping to monitored from identified", () => {
    expect(canTransitionRisk("identified", "monitored")).toBe(false);
    expect(() =>
      assertCanTransitionRisk("identified", "monitored"),
    ).toThrow(/inválida/);
  });

  it("forbids transitions out of closed", () => {
    expect(nextStatusesForRisk("closed")).toEqual([]);
  });
});

describe("opportunity lifecycle", () => {
  it("allows discovered → analyzing → evaluated → decision", () => {
    expect(canTransitionOpportunity("discovered", "analyzing")).toBe(true);
    expect(canTransitionOpportunity("analyzing", "evaluated")).toBe(true);
    expect(canTransitionOpportunity("evaluated", "decision")).toBe(true);
  });

  it("allows do-not-pursue path via closed from decision", () => {
    expect(canTransitionOpportunity("decision", "closed")).toBe(true);
  });

  it("rejects realized → pursuing", () => {
    expect(canTransitionOpportunity("realized", "pursuing")).toBe(false);
  });
});

describe("assessment versioning rules", () => {
  it("validates qualitative input", () => {
    expect(() =>
      assertValidAssessmentInput({
        method: "qualitative",
        level: "high",
        rationale: "Exposición significativa al proveedor único",
      }),
    ).not.toThrow();
  });

  it("rejects empty rationale", () => {
    expect(() =>
      assertValidAssessmentInput({
        method: "qualitative",
        level: "low",
        rationale: "  ",
      }),
    ).toThrow(/racional/i);
  });

  it("checks P×I score consistency", () => {
    expect(() =>
      assertValidAssessmentInput({
        method: "probability_impact",
        probability: 3,
        impact: 4,
        score: 11,
        rationale: "Matriz tenant",
      }),
    ).toThrow(/inconsistente/);
    expect(() =>
      assertValidAssessmentInput({
        method: "probability_impact",
        probability: 3,
        impact: 4,
        score: 12,
        rationale: "Matriz tenant",
      }),
    ).not.toThrow();
  });

  it("increments version without overwrite semantics", () => {
    expect(nextAssessmentVersion(null)).toBe(1);
    expect(nextAssessmentVersion(1)).toBe(2);
    expect(nextAssessmentVersion(5)).toBe(6);
  });
});

describe("action effectiveness ≠ completion", () => {
  it("requires evidence to complete", () => {
    expect(() => assertCanCompleteAction(0)).toThrow(/evidencia/);
    expect(() => assertCanCompleteAction(1)).not.toThrow();
  });

  it("blocks effectiveness until completed", () => {
    expect(() =>
      assertCanRecordEffectiveness({
        actionStatus: "open",
        effectiveness: "effective",
      }),
    ).toThrow(/completada/);
  });

  it("requires note when not fully effective", () => {
    expect(() =>
      assertCanRecordEffectiveness({
        actionStatus: "completed",
        effectiveness: "not_effective",
      }),
    ).toThrow(/comentario/);
  });

  it("learned only after effectiveness recorded", () => {
    expect(hasLearnedFromAction("pending")).toBe(false);
    expect(hasLearnedFromAction("effective")).toBe(true);
  });
});

describe("review / stale", () => {
  const now = new Date("2026-09-26T12:00:00Z");

  it("marks stale when review date passed", () => {
    expect(
      isStale({
        status: "monitored",
        lastAssessmentAt: new Date("2026-01-01"),
        nextReviewAt: new Date("2026-09-01"),
        hasOverdueAction: false,
        now,
      }),
    ).toBe(true);
  });

  it("marks stale on overdue action", () => {
    expect(
      isStale({
        status: "implementing",
        lastAssessmentAt: now,
        nextReviewAt: null,
        hasOverdueAction: true,
        now,
      }),
    ).toBe(true);
  });

  it("does not mark closed items stale", () => {
    expect(
      isStale({
        status: "closed",
        lastAssessmentAt: new Date("2020-01-01"),
        nextReviewAt: new Date("2020-02-01"),
        hasOverdueAction: true,
        now,
      }),
    ).toBe(false);
  });

  it("suggests review triggers", () => {
    expect(
      suggestReviewTriggers({
        nextReviewAt: new Date("2026-09-01"),
        hasOverdueAction: true,
        hasLinkedFindingUpdate: false,
        effectivenessFailed: true,
        now,
      }),
    ).toEqual(["scheduled", "overdue_action", "effectiveness_failed"]);
  });
});

describe("canonical supplier scenario (domain)", () => {
  it("models risk + opportunity from same source without merging types", () => {
    const source = {
      sourceKind: "supplier" as const,
      sourceLabel: "Proveedor único de acero",
    };
    const riskTitle = "Interrupción de suministro de acero";
    const oppTitle = "Calificar segundo proveedor de acero";
    expect(riskTitle).not.toEqual(oppTitle);
    expect(source.sourceKind).toBe("supplier");
    expect(canTransitionRisk("identified", "analyzing")).toBe(true);
    expect(canTransitionOpportunity("discovered", "analyzing")).toBe(true);
  });
});

describe("list filters", () => {
  it("excludes closed risks by default", () => {
    const where = buildRisksWhere("t1");
    expect(where.status).toEqual({ not: "closed" });
  });

  it("excludes closed/realized opportunities by default", () => {
    const where = buildOpportunitiesWhere("t1");
    expect(where.status).toEqual({ notIn: ["closed", "realized"] });
  });
});

describe("shared action entity type", () => {
  it("uses dedicated DueItem entity type", () => {
    expect(ACTION_ENTITY_TYPE).toBe("operational_action");
  });
});
