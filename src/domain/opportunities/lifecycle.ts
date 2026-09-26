import type { OpportunityStatus } from "@/domain/opportunities/types";

const TRANSITIONS: Record<OpportunityStatus, readonly OpportunityStatus[]> = {
  discovered: ["analyzing", "closed"],
  analyzing: ["evaluated", "discovered", "closed"],
  evaluated: ["decision", "analyzing", "closed"],
  decision: ["pursuing", "closed", "evaluated"],
  pursuing: ["implementing", "decision", "closed"],
  implementing: ["benefit_review", "pursuing", "closed"],
  benefit_review: ["realized", "implementing", "closed"],
  realized: ["closed"],
  closed: [],
};

export function canTransitionOpportunity(
  from: OpportunityStatus,
  to: OpportunityStatus,
): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function assertCanTransitionOpportunity(
  from: OpportunityStatus,
  to: OpportunityStatus,
): void {
  if (!canTransitionOpportunity(from, to)) {
    throw new Error(
      `Transición de oportunidad inválida: ${from} → ${to}`,
    );
  }
}

export function nextStatusesForOpportunity(
  from: OpportunityStatus,
): readonly OpportunityStatus[] {
  return TRANSITIONS[from];
}
