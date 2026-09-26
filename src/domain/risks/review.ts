import type { RiskStatus } from "@/domain/risks/types";
import type { OpportunityStatus } from "@/domain/opportunities/types";

export type StaleSignalInput = {
  status: RiskStatus | OpportunityStatus;
  lastAssessmentAt: Date | null;
  nextReviewAt: Date | null;
  hasOverdueAction: boolean;
  now: Date;
  /** Días sin evaluación antes de marcar stale (default 180). */
  staleAfterDays?: number;
};

export function isClosedStatus(
  status: RiskStatus | OpportunityStatus,
): boolean {
  return status === "closed" || status === "realized";
}

/**
 * Ítem abierto con evaluación antigua, revisión vencida o acciones vencidas.
 */
export function isStale(input: StaleSignalInput): boolean {
  if (isClosedStatus(input.status)) return false;

  if (input.hasOverdueAction) return true;

  if (input.nextReviewAt && input.nextReviewAt.getTime() < input.now.getTime()) {
    return true;
  }

  if (!input.lastAssessmentAt) return false;

  const days =
    (input.now.getTime() - input.lastAssessmentAt.getTime()) /
    (24 * 60 * 60 * 1000);
  const threshold = input.staleAfterDays ?? 180;
  return days > threshold;
}

export type ReviewTrigger =
  | "scheduled"
  | "overdue_action"
  | "linked_finding"
  | "effectiveness_failed"
  | "manual";

export function suggestReviewTriggers(input: {
  nextReviewAt: Date | null;
  hasOverdueAction: boolean;
  hasLinkedFindingUpdate: boolean;
  effectivenessFailed: boolean;
  now: Date;
}): ReviewTrigger[] {
  const triggers: ReviewTrigger[] = [];
  if (
    input.nextReviewAt &&
    input.nextReviewAt.getTime() <= input.now.getTime()
  ) {
    triggers.push("scheduled");
  }
  if (input.hasOverdueAction) triggers.push("overdue_action");
  if (input.hasLinkedFindingUpdate) triggers.push("linked_finding");
  if (input.effectivenessFailed) triggers.push("effectiveness_failed");
  return triggers;
}
