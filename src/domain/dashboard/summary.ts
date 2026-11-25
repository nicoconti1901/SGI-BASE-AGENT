import {
  meetsRequirementStatus,
  REQUIREMENT_STATUSES,
  type RequirementStatus,
} from "@/domain/assessment/gap";
import { classifyDueWindow } from "@/domain/automation/due";
import { dueDefinition, type DueParentRef } from "@/domain/due/registry";

export type ComplianceSummary = {
  total: number;
  /** Requisitos que aplican (todo menos "No aplica"). */
  applicable: number;
  /** Conforme + automatizado. */
  conforming: number;
  /** Conformes sobre aplicables, 0–100; null si no hay aplicables. */
  percent: number | null;
  byStatus: Record<RequirementStatus, number>;
};

export function summarizeCompliance(statuses: RequirementStatus[]): ComplianceSummary {
  const byStatus = Object.fromEntries(
    REQUIREMENT_STATUSES.map((s) => [s, 0]),
  ) as Record<RequirementStatus, number>;
  for (const s of statuses) byStatus[s] += 1;

  const applicable = statuses.length - byStatus.not_applicable;
  const conforming = statuses.filter(meetsRequirementStatus).length;
  return {
    total: statuses.length,
    applicable,
    conforming,
    percent: applicable === 0 ? null : Math.round((conforming / applicable) * 100),
    byStatus,
  };
}

export type DueTone = "overdue" | "soon" | "ok";

export type DueItemView = {
  typeLabel: string;
  href: string | null;
  /** Días enteros hasta el vencimiento; negativo si ya venció. */
  daysLeft: number;
  tone: DueTone;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function describeDueItem(
  item: { entityType: string; entityId: string | null; dueAt: Date },
  slug: string,
  now: Date,
  leadDays = 7,
  parent: DueParentRef = {},
): DueItemView {
  const def = dueDefinition(item.entityType);
  const classification = classifyDueWindow({ dueAt: item.dueAt, now, leadDays });
  return {
    typeLabel: def?.label ?? "Vencimiento",
    href: def ? `/t/${slug}/${def.path(item.entityId, parent)}` : null,
    daysLeft: Math.floor((item.dueAt.getTime() - now.getTime()) / MS_PER_DAY),
    tone:
      classification === "overdue" ? "overdue" : classification === "upcoming" ? "soon" : "ok",
  };
}
