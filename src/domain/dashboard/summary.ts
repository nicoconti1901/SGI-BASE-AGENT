import {
  meetsRequirementStatus,
  REQUIREMENT_STATUSES,
  type RequirementStatus,
} from "@/domain/assessment/gap";
import { classifyDueWindow } from "@/domain/automation/due";
import { dueDay } from "@/domain/due/day";
import { dueDefinition, isDestinationEnabled, type DueParentRef } from "@/domain/due/registry";
import type { ModuleKey } from "@/domain/modules/catalog";
import { diffDays, todayIso } from "@/domain/inspections/dates";

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
  /** Día calendario en que vence ("AAAA-MM-DD"). */
  dueDay: string;
  /** Días de calendario hasta el vencimiento: 0 hoy, negativo si ya venció. */
  daysLeft: number;
  tone: DueTone;
};

export function describeDueItem(
  item: { entityType: string; entityId: string | null; dueAt: Date },
  slug: string,
  now: Date,
  leadDays = 7,
  parent: DueParentRef = {},
  /** Módulos activos de la empresa; sin ellos se enlaza siempre. */
  enabled?: ReadonlySet<ModuleKey>,
): DueItemView {
  const def = dueDefinition(item.entityType);
  const day = dueDay(item.dueAt);
  const path = def?.path(item.entityId, parent);
  const classification = classifyDueWindow({ dueAt: item.dueAt, now, leadDays });
  return {
    typeLabel: def?.label ?? "Vencimiento",
    href: path && (!enabled || isDestinationEnabled(path, enabled)) ? `/t/${slug}/${path}` : null,
    dueDay: day,
    daysLeft: diffDays(todayIso(now), day),
    tone:
      classification === "overdue" ? "overdue" : classification === "upcoming" ? "soon" : "ok",
  };
}
