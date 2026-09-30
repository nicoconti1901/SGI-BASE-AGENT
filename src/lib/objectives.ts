import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { closeDueItemsForEntity, upsertOpenDueItemForEntity } from "@/lib/automation";
import {
  indicatorDefinitionIssues,
  measurementDueAt,
  nextPendingPeriod,
  objectiveCode,
} from "@/domain/indicators/rules";
import {
  INDICATOR_MEASUREMENT_ENTITY_TYPE,
  type IndicatorDirection,
  type IndicatorFrequency,
  type IndicatorKind,
} from "@/domain/indicators/types";
import type { AuditStandard } from "@/domain/audits/types";

/** Error de negocio con la lista de lo que falta, para mostrarla tal cual en la UI. */
export class ObjectiveGateError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join(" · "));
    this.name = "ObjectiveGateError";
  }
}

type Db = PrismaClient;

async function assertMembers(tenantId: string, userIds: string[], db: Db) {
  const unique = [...new Set(userIds)];
  const members = await db.membership.count({ where: { tenantId, userId: { in: unique } } });
  if (members !== unique.length) {
    throw new ObjectiveGateError(["El responsable tiene que ser integrante de la empresa"]);
  }
}

// ─── Consultas ──────────────────────────────────────────────────────────────

const indicatorInclude = {
  where: { active: true },
  orderBy: { createdAt: "asc" },
  include: { measurements: { orderBy: { periodStart: "desc" }, take: 6 } },
} satisfies Prisma.Objective$indicatorsArgs;

export async function listObjectives(tenantId: string, db: Db = prisma) {
  return db.objective.findMany({
    where: { tenantId },
    include: { indicators: indicatorInclude },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

export async function getObjective(tenantId: string, objectiveId: string, db: Db = prisma) {
  return db.objective.findFirst({
    where: { id: objectiveId, tenantId },
    include: {
      indicators: {
        orderBy: { createdAt: "asc" },
        include: { measurements: { orderBy: { periodStart: "desc" }, take: 1 } },
      },
    },
  });
}

// ─── Vencimientos ───────────────────────────────────────────────────────────

/**
 * Un DueItem abierto por indicador activo de un objetivo vigente, con la fecha
 * de la próxima carga. Se recalcula al crear, editar, cargar o cerrar.
 */
export async function syncIndicatorDue(indicatorId: string, db: Db = prisma) {
  const indicator = await db.indicator.findUnique({
    where: { id: indicatorId },
    include: {
      objective: { select: { status: true } },
      measurements: { orderBy: { periodStart: "desc" }, take: 1, select: { periodStart: true } },
    },
  });
  if (!indicator) return;
  const key = { tenantId: indicator.tenantId, entityType: INDICATOR_MEASUREMENT_ENTITY_TYPE, entityId: indicator.id };
  if (!indicator.active || indicator.objective.status !== "active") {
    await closeDueItemsForEntity(key, db);
    return;
  }
  const period = nextPendingPeriod({
    frequency: indicator.frequency,
    lastLoadedStart: indicator.measurements[0]?.periodStart ?? null,
    createdAt: indicator.createdAt,
  });
  await upsertOpenDueItemForEntity(
    {
      ...key,
      title: `Cargar indicador ${indicator.name}: ${period.label}`,
      dueAt: measurementDueAt(period),
      leadDays: 3,
    },
    db,
  );
}

// ─── Objetivos ──────────────────────────────────────────────────────────────

export type ObjectiveDraft = {
  title: string;
  description: string;
  standards: AuditStandard[];
  ownerUserId: string;
  dueDate: Date;
  plan: string;
};

function objectiveIssues(draft: ObjectiveDraft): string[] {
  const issues: string[] = [];
  if (draft.title.trim().length < 3) issues.push("Poné un título al objetivo");
  if (draft.standards.length === 0) issues.push("Elegí al menos una norma");
  if (!draft.ownerUserId) issues.push("Elegí un responsable");
  if (Number.isNaN(draft.dueDate.getTime())) issues.push("Indicá la fecha de cumplimiento");
  return issues;
}

function objectiveData(draft: ObjectiveDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    standards: draft.standards,
    ownerUserId: draft.ownerUserId,
    dueDate: draft.dueDate,
    plan: draft.plan.trim(),
  };
}

export async function createObjective(
  input: { tenantId: string; createdByUserId: string; draft: ObjectiveDraft },
  db: Db = prisma,
) {
  const issues = objectiveIssues(input.draft);
  if (issues.length > 0) throw new ObjectiveGateError(issues);
  await assertMembers(input.tenantId, [input.draft.ownerUserId], db);
  const year = new Date().getUTCFullYear();

  // El código es correlativo por año; si dos altas chocan, se reintenta una vez.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const sameYear = await db.objective.count({
        where: { tenantId: input.tenantId, code: { startsWith: `OBJ-${year}-` } },
      });
      return await db.objective.create({
        data: {
          ...objectiveData(input.draft),
          tenantId: input.tenantId,
          code: objectiveCode(year, sameYear + 1 + attempt),
          createdByUserId: input.createdByUserId,
        },
      });
    } catch (error) {
      const duplicateCode = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!duplicateCode || attempt === 1) throw error;
    }
  }
  throw new Error("No se pudo generar el código del objetivo");
}

async function findActiveObjective(tenantId: string, objectiveId: string, db: Db) {
  const objective = await db.objective.findFirst({ where: { id: objectiveId, tenantId } });
  if (!objective) throw new Error("Objetivo no encontrado");
  if (objective.status !== "active") {
    throw new ObjectiveGateError(["El objetivo ya está cerrado y no se puede modificar"]);
  }
  return objective;
}

export async function updateObjective(
  input: { tenantId: string; objectiveId: string; draft: ObjectiveDraft },
  db: Db = prisma,
) {
  const objective = await findActiveObjective(input.tenantId, input.objectiveId, db);
  const issues = objectiveIssues(input.draft);
  if (issues.length > 0) throw new ObjectiveGateError(issues);
  await assertMembers(input.tenantId, [input.draft.ownerUserId], db);
  return db.objective.update({ where: { id: objective.id }, data: objectiveData(input.draft) });
}

/** Cierra el objetivo (cumplido / no cumplido / cancelado); deja de pedir cargas. */
export async function closeObjective(
  input: {
    tenantId: string;
    objectiveId: string;
    result: "achieved" | "not_achieved" | "cancelled";
    note: string;
  },
  db: Db = prisma,
) {
  const objective = await findActiveObjective(input.tenantId, input.objectiveId, db);
  if (!input.note.trim()) {
    throw new ObjectiveGateError([
      input.result === "cancelled" ? "Indicá el motivo de la cancelación" : "Escribí el comentario del cierre",
    ]);
  }
  const closed = await db.objective.update({
    where: { id: objective.id },
    data: { status: input.result, closingNote: input.note.trim(), closedAt: new Date() },
    include: { indicators: { select: { id: true } } },
  });
  for (const indicator of closed.indicators) await syncIndicatorDue(indicator.id, db);
  return closed;
}

// ─── Indicadores ────────────────────────────────────────────────────────────

export type IndicatorDraft = {
  name: string;
  formula: string;
  unit: string;
  direction: IndicatorDirection;
  target: number;
  alertThreshold: number | null;
  frequency: IndicatorFrequency;
  kind: IndicatorKind;
  ownerUserId: string;
};

function indicatorIssues(draft: IndicatorDraft): string[] {
  const issues = indicatorDefinitionIssues({
    name: draft.name,
    unit: draft.unit,
    direction: draft.direction,
    target: draft.target,
    alertThreshold: draft.alertThreshold,
  });
  if (!draft.ownerUserId) issues.push("Elegí quién carga el indicador");
  return issues;
}

function indicatorData(draft: IndicatorDraft) {
  return {
    name: draft.name.trim(),
    formula: draft.formula.trim(),
    unit: draft.unit.trim(),
    direction: draft.direction,
    target: draft.target,
    alertThreshold: draft.alertThreshold,
    frequency: draft.frequency,
    kind: draft.kind,
    ownerUserId: draft.ownerUserId,
  };
}

export async function createIndicator(
  input: { tenantId: string; objectiveId: string; draft: IndicatorDraft },
  db: Db = prisma,
) {
  const objective = await findActiveObjective(input.tenantId, input.objectiveId, db);
  const issues = indicatorIssues(input.draft);
  if (issues.length > 0) throw new ObjectiveGateError(issues);
  await assertMembers(input.tenantId, [input.draft.ownerUserId], db);
  const indicator = await db.indicator.create({
    data: { ...indicatorData(input.draft), tenantId: input.tenantId, objectiveId: objective.id },
  });
  await syncIndicatorDue(indicator.id, db);
  return indicator;
}

async function findIndicatorOfActiveObjective(tenantId: string, indicatorId: string, db: Db) {
  const indicator = await db.indicator.findFirst({ where: { id: indicatorId, tenantId } });
  if (!indicator) throw new Error("Indicador no encontrado");
  await findActiveObjective(tenantId, indicator.objectiveId, db);
  return indicator;
}

export async function updateIndicator(
  input: { tenantId: string; indicatorId: string; draft: IndicatorDraft },
  db: Db = prisma,
) {
  const indicator = await findIndicatorOfActiveObjective(input.tenantId, input.indicatorId, db);
  const issues = indicatorIssues(input.draft);
  if (issues.length > 0) throw new ObjectiveGateError(issues);
  await assertMembers(input.tenantId, [input.draft.ownerUserId], db);
  const updated = await db.indicator.update({ where: { id: indicator.id }, data: indicatorData(input.draft) });
  await syncIndicatorDue(updated.id, db);
  return updated;
}

/** Desactivar conserva el historial de mediciones y deja de pedir cargas. */
export async function setIndicatorActive(
  input: { tenantId: string; indicatorId: string; active: boolean },
  db: Db = prisma,
) {
  const indicator = await findIndicatorOfActiveObjective(input.tenantId, input.indicatorId, db);
  const updated = await db.indicator.update({ where: { id: indicator.id }, data: { active: input.active } });
  await syncIndicatorDue(updated.id, db);
  return updated;
}
