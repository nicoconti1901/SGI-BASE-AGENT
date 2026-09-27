import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  closeDueItemsForEntity,
  upsertOpenDueItemForEntity,
} from "@/lib/automation";
import {
  assertCanTransitionAudit,
  auditCode,
  closeReadinessIssues,
  executionReadinessIssues,
  planReadinessIssues,
  reportDueAt,
  startReadinessIssues,
} from "@/domain/audits/lifecycle";
import {
  AUDIT_REPORT_ENTITY_TYPE,
  AUDIT_START_ENTITY_TYPE,
  AUDIT_START_LEAD_DAYS,
  type AuditMode,
  type AuditStandard,
  type AuditStatus,
} from "@/domain/audits/types";

/** Error de negocio con lista de lo que falta, para mostrarla tal cual en la UI. */
export class AuditGateError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join(" · "));
    this.name = "AuditGateError";
  }
}

// ─── Programa anual ─────────────────────────────────────────────────────────

export async function getProgramWithAudits(
  tenantId: string,
  year: number,
  db: PrismaClient = prisma,
) {
  const [program, audits] = await Promise.all([
    db.auditProgram.findUnique({ where: { tenantId_year: { tenantId, year } } }),
    db.audit.findMany({
      where: { tenantId, program: { year } },
      include: {
        team: { where: { role: "lead" } },
        _count: { select: { findings: true, items: true } },
      },
      orderBy: { plannedStart: "asc" },
    }),
  ]);
  return { program, audits };
}

function ensureProgram(tenantId: string, year: number, db: Prisma.TransactionClient | PrismaClient) {
  return db.auditProgram.upsert({
    where: { tenantId_year: { tenantId, year } },
    create: { tenantId, year },
    update: {},
  });
}

/**
 * Guardar un programa aprobado lo devuelve a borrador: un cambio al programa
 * necesita una nueva aprobación.
 */
export async function saveProgram(
  input: { tenantId: string; year: number; objectives: string; frequencyRationale: string },
  db: PrismaClient = prisma,
) {
  const objectives = input.objectives.trim();
  if (!objectives) throw new AuditGateError(["Definí los objetivos del programa"]);
  const data = {
    objectives,
    frequencyRationale: input.frequencyRationale.trim(),
    status: "draft" as const,
    approvedAt: null,
    approvedByUserId: null,
  };
  return db.auditProgram.upsert({
    where: { tenantId_year: { tenantId: input.tenantId, year: input.year } },
    create: { tenantId: input.tenantId, year: input.year, ...data },
    update: data,
  });
}

export async function approveProgram(
  input: { tenantId: string; year: number; userId: string },
  db: PrismaClient = prisma,
) {
  const program = await db.auditProgram.findUnique({
    where: { tenantId_year: { tenantId: input.tenantId, year: input.year } },
    include: { _count: { select: { audits: true } } },
  });
  const issues: string[] = [];
  if (!program?.objectives.trim()) issues.push("Definí los objetivos del programa");
  if (!program || program._count.audits === 0) issues.push("Planificá al menos una auditoría");
  if (issues.length > 0 || !program) throw new AuditGateError(issues);
  if (program.status === "approved") return program;

  return db.auditProgram.update({
    where: { id: program.id },
    data: { status: "approved", approvedAt: new Date(), approvedByUserId: input.userId },
  });
}

// ─── Auditoría ──────────────────────────────────────────────────────────────

export async function getAudit(tenantId: string, auditId: string, db: PrismaClient = prisma) {
  return db.audit.findFirst({
    where: { id: auditId, tenantId },
    include: {
      team: true,
      auditees: true,
      program: { select: { year: true, status: true } },
      _count: { select: { items: true, findings: true } },
    },
  });
}

async function syncAuditDueItems(
  audit: { id: string; tenantId: string; code: string; title: string; plannedStart: Date; plannedEnd: Date },
  db: PrismaClient,
) {
  await upsertOpenDueItemForEntity(
    {
      tenantId: audit.tenantId,
      title: `Inicio de auditoría ${audit.code}: ${audit.title}`,
      entityType: AUDIT_START_ENTITY_TYPE,
      entityId: audit.id,
      dueAt: audit.plannedStart,
      leadDays: AUDIT_START_LEAD_DAYS,
    },
    db,
  );
  await upsertOpenDueItemForEntity(
    {
      tenantId: audit.tenantId,
      title: `Informe de auditoría ${audit.code}: ${audit.title}`,
      entityType: AUDIT_REPORT_ENTITY_TYPE,
      entityId: audit.id,
      dueAt: reportDueAt(audit.plannedEnd),
      leadDays: 3,
    },
    db,
  );
}

function assertDates(start: Date, end: Date) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AuditGateError(["Indicá fechas de inicio y fin válidas"]);
  }
  if (end < start) {
    throw new AuditGateError(["La fecha de fin no puede ser anterior a la de inicio"]);
  }
}

export async function createAudit(
  input: {
    tenantId: string;
    title: string;
    plannedStart: Date;
    plannedEnd: Date;
    createdByUserId: string;
  },
  db: PrismaClient = prisma,
) {
  const title = input.title.trim();
  if (!title) throw new AuditGateError(["Poné un título a la auditoría"]);
  assertDates(input.plannedStart, input.plannedEnd);
  const year = input.plannedStart.getUTCFullYear();

  // El código es correlativo por año; si dos altas chocan, reintentar una vez.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const audit = await db.$transaction(async (tx) => {
        const program = await ensureProgram(input.tenantId, year, tx);
        const sameYear = await tx.audit.count({
          where: { tenantId: input.tenantId, code: { startsWith: `AI-${year}-` } },
        });
        return tx.audit.create({
          data: {
            tenantId: input.tenantId,
            programId: program.id,
            code: auditCode(year, sameYear + 1 + attempt),
            title,
            plannedStart: input.plannedStart,
            plannedEnd: input.plannedEnd,
            createdByUserId: input.createdByUserId,
          },
        });
      });
      await syncAuditDueItems(audit, db);
      return audit;
    } catch (error) {
      const duplicateCode =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!duplicateCode || attempt === 1) throw error;
    }
  }
  throw new Error("No se pudo generar el código de auditoría");
}

export type AuditPlanDraft = {
  title: string;
  objective: string;
  scope: string;
  standards: AuditStandard[];
  plannedStart: Date;
  plannedEnd: Date;
  mode: AuditMode;
  leadUserId: string | null;
  auditorUserIds: string[];
  auditees: { userId: string | null; area: string }[];
  impartialityException: string | null;
};

/** Solo se edita el plan antes de iniciar; editar una auditoría preparada la vuelve a planificada. */
export async function saveAuditPlan(
  input: { tenantId: string; auditId: string; plan: AuditPlanDraft },
  db: PrismaClient = prisma,
) {
  const audit = await db.audit.findFirst({
    where: { id: input.auditId, tenantId: input.tenantId },
  });
  if (!audit) throw new Error("Auditoría no encontrada");
  if (audit.status !== "planned" && audit.status !== "prepared") {
    throw new AuditGateError(["El plan solo se puede editar antes de iniciar la auditoría"]);
  }
  const plan = input.plan;
  if (!plan.title.trim()) throw new AuditGateError(["Poné un título a la auditoría"]);
  if (plan.auditees.some((a) => a.userId && !a.area.trim())) {
    throw new AuditGateError(["Indicá el área o proceso de cada persona auditada"]);
  }
  assertDates(plan.plannedStart, plan.plannedEnd);

  // Todas las personas del plan tienen que pertenecer a la empresa.
  const people = [
    ...(plan.leadUserId ? [plan.leadUserId] : []),
    ...plan.auditorUserIds,
    ...plan.auditees.flatMap((a) => (a.userId ? [a.userId] : [])),
  ];
  if (people.length > 0) {
    const members = await db.membership.count({
      where: { tenantId: input.tenantId, userId: { in: [...new Set(people)] } },
    });
    if (members !== new Set(people).size) {
      throw new AuditGateError(["Hay personas en el plan que no son integrantes de la empresa"]);
    }
  }

  const auditors = [...new Set(plan.auditorUserIds)].filter((id) => id !== plan.leadUserId);
  const updated = await db.$transaction(async (tx) => {
    await tx.auditTeamMember.deleteMany({ where: { auditId: audit.id } });
    await tx.auditAuditee.deleteMany({ where: { auditId: audit.id } });
    // Si cambia el año, la auditoría pasa al programa de ese año.
    const program = await ensureProgram(input.tenantId, plan.plannedStart.getUTCFullYear(), tx);
    return tx.audit.update({
      where: { id: audit.id },
      data: {
        program: { connect: { id: program.id } },
        title: plan.title.trim(),
        objective: plan.objective.trim(),
        scope: plan.scope.trim(),
        standards: plan.standards,
        plannedStart: plan.plannedStart,
        plannedEnd: plan.plannedEnd,
        mode: plan.mode,
        impartialityException: plan.impartialityException?.trim() || null,
        status: "planned",
        team: {
          create: [
            ...(plan.leadUserId ? [{ userId: plan.leadUserId, role: "lead" as const }] : []),
            ...auditors.map((userId) => ({ userId, role: "auditor" as const })),
          ],
        },
        auditees: {
          create: plan.auditees
            .filter((a) => a.area.trim())
            .map((a) => ({ userId: a.userId, area: a.area.trim() })),
        },
      },
    });
  });
  await syncAuditDueItems(updated, db);
  return updated;
}

/** Transiciones con sus controles; devuelve la lista de faltantes como AuditGateError. */
export async function transitionAudit(
  input: { tenantId: string; auditId: string; to: AuditStatus; reason?: string },
  db: PrismaClient = prisma,
) {
  const audit = await db.audit.findFirst({
    where: { id: input.auditId, tenantId: input.tenantId },
    include: { team: true, auditees: true, items: { select: { result: true, findingId: true } } },
  });
  if (!audit) throw new Error("Auditoría no encontrada");
  assertCanTransitionAudit(audit.status, input.to);

  const data: Prisma.AuditUpdateInput = { status: input.to };
  let issues: string[] = [];

  if (input.to === "prepared") {
    issues = planReadinessIssues({
      objective: audit.objective,
      scope: audit.scope,
      standards: audit.standards,
      plannedStart: audit.plannedStart,
      plannedEnd: audit.plannedEnd,
      team: audit.team,
      auditeeUserIds: audit.auditees.map((a) => a.userId),
      checklistCount: audit.items.length,
      impartialityException: audit.impartialityException,
    });
  } else if (input.to === "in_progress") {
    issues = startReadinessIssues({ plannedStart: audit.plannedStart, now: new Date(), reason: input.reason });
    data.startedAt = audit.startedAt ?? new Date();
  } else if (input.to === "reporting") {
    issues = executionReadinessIssues(audit.items);
  } else if (input.to === "closed") {
    issues = closeReadinessIssues({ conclusion: audit.reportConclusion });
    data.closedAt = new Date();
    data.reportIssuedAt = audit.reportIssuedAt ?? new Date();
  } else if (input.to === "cancelled") {
    if (!input.reason?.trim()) issues = ["Indicá el motivo de la cancelación"];
    data.cancelReason = input.reason?.trim() ?? null;
  }
  if (issues.length > 0) throw new AuditGateError(issues);

  const updated = await db.audit.update({ where: { id: audit.id }, data });

  if (input.to === "in_progress" || input.to === "cancelled") {
    await closeDueItemsForEntity(
      { tenantId: audit.tenantId, entityType: AUDIT_START_ENTITY_TYPE, entityId: audit.id },
      db,
    );
  }
  if (input.to === "closed" || input.to === "cancelled") {
    await closeDueItemsForEntity(
      { tenantId: audit.tenantId, entityType: AUDIT_REPORT_ENTITY_TYPE, entityId: audit.id },
      db,
    );
  }
  return updated;
}
