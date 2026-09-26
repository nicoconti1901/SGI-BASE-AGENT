import type { RiskStatus } from "@/domain/risks/types";

const TRANSITIONS: Record<RiskStatus, readonly RiskStatus[]> = {
  identified: ["analyzing", "closed"],
  analyzing: ["evaluated", "identified", "closed"],
  evaluated: ["response_planned", "analyzing", "closed"],
  response_planned: ["implementing", "evaluated", "closed"],
  implementing: ["effectiveness_review", "response_planned", "closed"],
  effectiveness_review: ["monitored", "implementing", "closed"],
  monitored: ["analyzing", "effectiveness_review", "closed"],
  closed: [],
};

export function canTransitionRisk(
  from: RiskStatus,
  to: RiskStatus,
): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function assertCanTransitionRisk(
  from: RiskStatus,
  to: RiskStatus,
): void {
  if (!canTransitionRisk(from, to)) {
    throw new Error(
      `Transición de riesgo inválida: ${from} → ${to}`,
    );
  }
}

export function nextStatusesForRisk(
  from: RiskStatus,
): readonly RiskStatus[] {
  return TRANSITIONS[from];
}
