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
  computeCoverage,
  executionReadinessIssues,
  externalAuditCode,
  findingFromItemResult,
  planReadinessIssues,
  reportDueAt,
  startReadinessIssues,
} from "@/domain/audits/lifecycle";
import {
  AUDIT_REPORT_ENTITY_TYPE,
  AUDIT_EXTERNAL_RESPONSE_ENTITY_TYPE,
  AUDIT_START_ENTITY_TYPE,
  AUDIT_START_LEAD_DAYS,
  type AuditItemResult,
  type AuditMode,
  type AuditStandard,
  type AuditStatus,
  type ExternalAuditType,
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
      where: { tenantId, kind: "internal", program: { year } },
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
  if (!audit || audit.kind !== "internal") throw new Error("Auditoría no encontrada");
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
  if (audit.kind === "external" && input.to !== "cancelled") {
    throw new AuditGateError(["Las auditorías externas solo se marcan como realizadas o canceladas"]);
  }
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

// ─── Informe y cobertura (11b.5) ────────────────────────────────────────────

/** El informe se redacta con la auditoría en etapa de informe; cerrar lo emite. */
export async function saveAuditReport(
  input: {
    tenantId: string;
    auditId: string;
    conclusion: string;
    strengths: string;
    workersCommunicated: boolean;
  },
  db: PrismaClient = prisma,
) {
  const audit = await db.audit.findFirst({
    where: { id: input.auditId, tenantId: input.tenantId },
  });
  if (!audit) throw new Error("Auditoría no encontrada");
  if (audit.status !== "reporting") {
    throw new AuditGateError(["El informe se redacta cuando la lista de verificación está completa"]);
  }
  return db.audit.update({
    where: { id: audit.id },
    data: {
      reportConclusion: input.conclusion.trim() || null,
      reportStrengths: input.strengths.trim() || null,
      workersCommunicated: audit.standards.includes("ISO45001") && input.workersCommunicated,
    },
  });
}

/** Cobertura del programa: requisitos de la empresa auditados en auditorías cerradas del año. */
export async function getProgramCoverage(
  tenantId: string,
  year: number,
  db: PrismaClient = prisma,
) {
  const [requirements, items] = await Promise.all([
    db.tenantRequirement.findMany({
      where: { tenantId },
      select: { id: true, requirement: { select: { standard: true } } },
    }),
    db.auditChecklistItem.findMany({
      where: { tenantId, audit: { program: { year }, status: "closed" } },
      select: { tenantRequirementId: true, result: true },
    }),
  ]);
  return computeCoverage(
    requirements.map((r) => ({ id: r.id, standard: r.requirement.standard })),
    items.map((i) => ({ ...i, auditClosed: true })),
  );
}

// ─── Auditorías externas ────────────────────────────────────────────────────
// No pertenecen al programa anual ni a la cobertura (programId null, kind external);
// sí generan hallazgos con auditId.

export async function listExternalAudits(tenantId: string, year: number, db: PrismaClient = prisma) {
  return db.audit.findMany({
    where: {
      tenantId,
      kind: "external",
      plannedStart: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
    },
    include: { _count: { select: { findings: true } } },
    orderBy: { plannedStart: "asc" },
  });
}

export type ExternalAuditDraft = {
  title: string;
  externalBody: string;
  externalType: ExternalAuditType | null;
  externalAuditor: string;
  externalResult: string;
  responseDueAt: Date | null;
  scope: string;
  standards: AuditStandard[];
  plannedStart: Date;
  plannedEnd: Date;
};

function assertExternalDraft(draft: ExternalAuditDraft) {
  if (!draft.title.trim()) throw new AuditGateError(["Poné un título a la auditoría"]);
  if (!draft.externalBody.trim()) throw new AuditGateError(["Indicá la entidad que audita"]);
  if (!draft.externalType) throw new AuditGateError(["Elegí el tipo de auditoría externa"]);
  assertDates(draft.plannedStart, draft.plannedEnd);
  if (draft.responseDueAt && Number.isNaN(draft.responseDueAt.getTime())) {
    throw new AuditGateError(["La fecha límite de respuesta no es válida"]);
  }
}

function externalData(draft: ExternalAuditDraft) {
  return {
    title: draft.title.trim(),
    externalBody: draft.externalBody.trim(),
    externalType: draft.externalType,
    externalAuditor: draft.externalAuditor.trim() || null,
    externalResult: draft.externalResult.trim() || null,
    responseDueAt: draft.responseDueAt,
    scope: draft.scope.trim(),
    standards: draft.standards,
    plannedStart: draft.plannedStart,
    plannedEnd: draft.plannedEnd,
  };
}

/** Un vencimiento abierto para responder las NC del organismo, mientras la auditoría siga vigente. */
async function syncExternalResponseDue(
  audit: { id: string; tenantId: string; code: string; title: string; status: AuditStatus; responseDueAt: Date | null },
  db: PrismaClient,
) {
  if (audit.responseDueAt && audit.status !== "cancelled") {
    await upsertOpenDueItemForEntity(
      {
        tenantId: audit.tenantId,
        title: `Responder a la auditoría externa ${audit.code}: ${audit.title}`,
        entityType: AUDIT_EXTERNAL_RESPONSE_ENTITY_TYPE,
        entityId: audit.id,
        dueAt: audit.responseDueAt,
        leadDays: 7,
      },
      db,
    );
  } else {
    await closeDueItemsForEntity(
      { tenantId: audit.tenantId, entityType: AUDIT_EXTERNAL_RESPONSE_ENTITY_TYPE, entityId: audit.id },
      db,
    );
  }
}

export async function createExternalAudit(
  input: { tenantId: string; createdByUserId: string; draft: ExternalAuditDraft },
  db: PrismaClient = prisma,
) {
  assertExternalDraft(input.draft);
  const year = input.draft.plannedStart.getUTCFullYear();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const audit = await db.$transaction(async (tx) => {
        const sameYear = await tx.audit.count({
          where: { tenantId: input.tenantId, code: { startsWith: `AE-${year}-` } },
        });
        return tx.audit.create({
          data: {
            ...externalData(input.draft),
            tenantId: input.tenantId,
            kind: "external",
            code: externalAuditCode(year, sameYear + 1 + attempt),
            createdByUserId: input.createdByUserId,
          },
        });
      });
      await syncExternalResponseDue(audit, db);
      return audit;
    } catch (error) {
      const duplicateCode =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!duplicateCode || attempt === 1) throw error;
    }
  }
  throw new Error("No se pudo generar el código de auditoría");
}

async function findExternalAudit(tenantId: string, auditId: string, db: PrismaClient) {
  const audit = await db.audit.findFirst({ where: { id: auditId, tenantId, kind: "external" } });
  if (!audit) throw new Error("Auditoría no encontrada");
  return audit;
}

export async function saveExternalAudit(
  input: { tenantId: string; auditId: string; draft: ExternalAuditDraft },
  db: PrismaClient = prisma,
) {
  const audit = await findExternalAudit(input.tenantId, input.auditId, db);
  if (audit.status !== "planned") {
    throw new AuditGateError(["Solo se edita el plan de una auditoría externa pendiente"]);
  }
  assertExternalDraft(input.draft);
  const updated = await db.audit.update({ where: { id: audit.id }, data: externalData(input.draft) });
  await syncExternalResponseDue(updated, db);
  return updated;
}

/** Marca la auditoría externa como realizada; no exige checklist ni informe propios. */
export async function completeExternalAudit(
  input: { tenantId: string; auditId: string },
  db: PrismaClient = prisma,
) {
  const audit = await findExternalAudit(input.tenantId, input.auditId, db);
  if (audit.status !== "planned") {
    throw new AuditGateError(["La auditoría externa ya no está pendiente"]);
  }
  return db.audit.update({
    where: { id: audit.id },
    data: { status: "closed", closedAt: new Date() },
  });
}

/** Registra un hallazgo de auditoría externa como borrador en Hallazgos. */
export async function createExternalFinding(
  input: {
    tenantId: string;
    auditId: string;
    userId: string;
    result: AuditItemResult;
    title: string;
    description: string;
    detectedAt: Date;
  },
  db: PrismaClient = prisma,
) {
  const audit = await findExternalAudit(input.tenantId, input.auditId, db);
  if (audit.status === "cancelled") {
    throw new AuditGateError(["La auditoría externa está cancelada"]);
  }
  const mapping = findingFromItemResult(input.result);
  const title = input.title.trim();
  const description = input.description.trim();
  const issues: string[] = [];
  if (!mapping) issues.push("Elegí el tipo de hallazgo");
  if (!title) issues.push("Poné un título al hallazgo");
  if (!description) issues.push("Describí el hallazgo y su evidencia");
  if (Number.isNaN(input.detectedAt.getTime())) issues.push("Indicá la fecha del hallazgo");
  if (issues.length > 0 || !mapping) throw new AuditGateError(issues);
  return db.finding.create({
    data: {
      tenantId: input.tenantId,
      auditId: audit.id,
      type: mapping.type,
      severity: mapping.severity,
      title,
      description,
      status: "draft",
      detectedAt: input.detectedAt,
      source: `Auditoría externa ${audit.code} · ${audit.externalBody ?? ""}`,
      createdByUserId: input.userId,
    },
  });
}
