import {
  meetsRequirementStatus,
  REQUIREMENT_STATUSES,
  type RequirementStatus,
} from "@/domain/assessment/gap";
import { classifyDueWindow } from "@/domain/automation/due";

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

/** Id del padre cuando la ruta de detalle lo necesita (se resuelve con una consulta aparte). */
export type DueParentRef = { objectiveId?: string; findingId?: string };

type DueRoute = {
  label: string;
  path: (id: string | null, parent: DueParentRef) => string;
};

/** entityType del DueItem → etiqueta y destino. Sin ruta propia por id, va al listado. */
const DUE_ROUTES: Record<string, DueRoute> = {
  risk: { label: "Riesgo", path: (id) => (id ? `risks/${id}` : "risks") },
  opportunity: {
    label: "Oportunidad",
    path: (id) => (id ? `risks/opportunities/${id}` : "risks"),
  },
  finding_verification: {
    label: "Verificación de hallazgo",
    path: (id) => (id ? `findings/${id}` : "findings"),
  },
  finding_measure: {
    label: "Medida de hallazgo",
    path: (_id, p) => (p.findingId ? `findings/${p.findingId}` : "findings"),
  },
  nonconformity: {
    label: "No conformidad",
    path: (id) => (id ? `operations/${id}` : "operations"),
  },
  corrective_action: { label: "Acción correctiva", path: () => "operations" },
  operational_action: { label: "Acción", path: () => "risks" },
  audit_start: {
    label: "Inicio de auditoría",
    path: (id) => (id ? `audits/${id}` : "audits"),
  },
  audit_report: {
    label: "Informe de auditoría",
    path: (id) => (id ? `audits/${id}` : "audits"),
  },
  audit_external_response: {
    label: "Respuesta a auditoría externa",
    path: (id) => (id ? `audits/${id}` : "audits"),
  },
  document_validity: {
    label: "Vigencia de documento",
    path: () => "documents",
  },
  indicator_measurement: {
    label: "Carga de indicador",
    path: (id, p) =>
      id && p.objectiveId ? `indicators/${p.objectiveId}/${id}` : "indicators",
  },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function describeDueItem(
  item: { entityType: string; entityId: string | null; dueAt: Date },
  slug: string,
  now: Date,
  leadDays = 7,
  parent: DueParentRef = {},
): DueItemView {
  const route = DUE_ROUTES[item.entityType];
  const classification = classifyDueWindow({ dueAt: item.dueAt, now, leadDays });
  return {
    typeLabel: route?.label ?? "Vencimiento",
    href: route ? `/t/${slug}/${route.path(item.entityId, parent)}` : null,
    daysLeft: Math.floor((item.dueAt.getTime() - now.getTime()) / MS_PER_DAY),
    tone:
      classification === "overdue" ? "overdue" : classification === "upcoming" ? "soon" : "ok",
  };
}
