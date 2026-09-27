import type { FindingStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  closeDueItemsForEntity,
  upsertOpenDueItemForEntity,
} from "@/lib/automation";
import {
  FINDING_VERIFICATION_ENTITY_TYPE,
  VERIFICATION_RESULT_LABELS,
  assertCanApplyFindingAction,
  defaultVerificationDueAt,
  deriveStatusFromMeasures,
  reasonIssues,
  verificationIssues,
  type VerificationResult,
} from "@/domain/findings/lifecycle";
import {
  FINDING_MEASURE_ENTITY_TYPE,
  FINDING_STATUS_LABELS,
  type MeasureKind,
} from "@/domain/findings/types";

/**
 * Ciclo de vida del hallazgo (Task 10d) — SPEC-findings-lifecycle.md.
 * Cada cambio de estado pasa por `changeStatus`, que deja el evento de historial.
 */

/** Error de negocio con la lista de lo que falta, para mostrarla tal cual. */
export class FindingGateError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join(" · "));
    this.name = "FindingGateError";
  }
}

type Db = PrismaClient | Prisma.TransactionClient;

async function changeStatus(
  db: Db,
  input: {
    tenantId: string;
    findingId: string;
    from: FindingStatus;
    to: FindingStatus;
    actorUserId: string | null;
    reason?: string | null;
    data?: Prisma.FindingUpdateInput;
  },
) {
  // Estado y evento de historial van juntos: nunca uno sin el otro.
  const run = async (tx: Prisma.TransactionClient) => {
    await tx.finding.update({
      where: { id: input.findingId },
      data: { ...input.data, status: input.to },
    });
    await tx.findingStatusEvent.create({
      data: {
        tenantId: input.tenantId,
        findingId: input.findingId,
        fromStatus: input.from,
        toStatus: input.to,
        actorUserId: input.actorUserId,
        reason: input.reason?.trim() || null,
      },
    });
  };
  if ("$transaction" in db) await db.$transaction(run);
  else await run(db);
}

/** Aviso en la app para notificados y responsables de medidas. */
async function notifyFindingPeople(
  db: Db,
  finding: { id: string; tenantId: string; title: string },
  title: string,
  body: string,
) {
  const [recipients, owners] = await Promise.all([
    db.findingNotifyRecipient.findMany({ where: { findingId: finding.id }, select: { userId: true } }),
    db.findingMeasure.findMany({ where: { findingId: finding.id }, select: { ownerUserId: true } }),
  ]);
  const userIds = new Set([...recipients.map((r) => r.userId), ...owners.map((o) => o.ownerUserId)]);
  if (userIds.size === 0) return;
  await db.inAppNotification.createMany({
    data: [...userIds].map((userId) => ({ tenantId: finding.tenantId, userId, title, body })),
  });
}

async function loadFinding(db: Db, tenantId: string, findingId: string) {
  const finding = await db.finding.findFirst({
    where: { id: findingId, tenantId },
    include: {
      measures: {
        select: { id: true, status: true, kind: true, createdAt: true, ownerUserId: true },
      },
    },
  });
  if (!finding) throw new Error("Hallazgo no encontrado");
  return finding;
}

/**
 * Recalcula el estado según las medidas (R2, R3). Idempotente: si no cambia,
 * no hace nada. Al entrar en verificación programa el vencimiento (P2).
 */
export async function syncFindingStatus(
  input: { tenantId: string; findingId: string; actorUserId: string | null; now?: Date },
  db: PrismaClient = prisma,
) {
  const finding = await loadFinding(db, input.tenantId, input.findingId);
  const target = deriveStatusFromMeasures({
    status: finding.status,
    type: finding.type,
    reworkSince: finding.reworkSince,
    measures: finding.measures,
  });
  if (target === finding.status) return finding.status;

  const now = input.now ?? new Date();
  if (target === "verification") {
    const dueAt = defaultVerificationDueAt(now);
    await changeStatus(db, {
      tenantId: input.tenantId,
      findingId: finding.id,
      from: finding.status,
      to: target,
      actorUserId: input.actorUserId,
      reason: "Todas las medidas cerradas con evidencia",
      data: { verificationDueAt: dueAt },
    });
    await upsertOpenDueItemForEntity(
      {
        tenantId: input.tenantId,
        title: `Verificar eficacia: ${finding.title}`,
        entityType: FINDING_VERIFICATION_ENTITY_TYPE,
        entityId: finding.id,
        dueAt,
      },
      db,
    );
    await notifyFindingPeople(
      db,
      finding,
      `Hallazgo en verificación: ${finding.title}`,
      "Todas las medidas están cerradas. Falta verificar que el problema no vuelva a ocurrir.",
    );
  } else if (target === "closed") {
    await changeStatus(db, {
      tenantId: input.tenantId,
      findingId: finding.id,
      from: finding.status,
      to: target,
      actorUserId: input.actorUserId,
      reason: "Todas las medidas cerradas con evidencia",
      data: { closedAt: now },
    });
  } else {
    await changeStatus(db, {
      tenantId: input.tenantId,
      findingId: finding.id,
      from: finding.status,
      to: target,
      actorUserId: input.actorUserId,
    });
  }
  return target;
}

function assertWorkable(status: FindingStatus) {
  if (status !== "published" && status !== "in_progress") {
    throw new FindingGateError([
      `Las medidas se gestionan con el hallazgo publicado o en curso (está "${FINDING_STATUS_LABELS[status]}")`,
    ]);
  }
}

/** El responsable indica que empezó a trabajar en la medida (R2). */
export async function startFindingMeasure(
  input: { tenantId: string; measureId: string; actorUserId: string },
  db: PrismaClient = prisma,
) {
  const measure = await db.findingMeasure.findFirst({
    where: { id: input.measureId, tenantId: input.tenantId },
    include: { finding: { select: { id: true, status: true } } },
  });
  if (!measure) throw new Error("Medida no encontrada");
  assertWorkable(measure.finding.status);
  if (measure.status !== "open") {
    throw new FindingGateError(["La medida ya está iniciada o cerrada"]);
  }
  await db.findingMeasure.update({
    where: { id: measure.id },
    data: { status: "in_progress", startedAt: new Date() },
  });
  return syncFindingStatus(
    { tenantId: input.tenantId, findingId: measure.finding.id, actorUserId: input.actorUserId },
    db,
  );
}

/** Nueva medida sobre un hallazgo publicado (p. ej. tras verificación no eficaz, R6). */
export async function addFindingMeasure(
  input: {
    tenantId: string;
    findingId: string;
    actorUserId: string;
    measure: {
      kind: MeasureKind;
      title: string;
      description?: string;
      ownerUserId: string;
      dueAt: Date | null;
      linkedRootCause: boolean;
    };
  },
  db: PrismaClient = prisma,
) {
  const finding = await loadFinding(db, input.tenantId, input.findingId);
  assertWorkable(finding.status);
  const m = input.measure;
  const issues: string[] = [];
  if (m.title.trim().length < 2) issues.push("La medida necesita título");
  if (m.kind === "corrective" && !m.dueAt) issues.push("Las medidas correctivas requieren fecha de vencimiento");
  const isMember = await db.membership.count({
    where: { tenantId: input.tenantId, userId: m.ownerUserId },
  });
  if (!isMember) issues.push("El responsable tiene que ser integrante de la empresa");
  if (issues.length > 0) throw new FindingGateError(issues);

  const created = await db.findingMeasure.create({
    data: {
      tenantId: input.tenantId,
      findingId: finding.id,
      kind: m.kind,
      title: m.title.trim(),
      description: m.description?.trim() || null,
      ownerUserId: m.ownerUserId,
      dueAt: m.dueAt,
      linkedRootCause: m.linkedRootCause,
      status: "open",
    },
  });
  if (created.dueAt) {
    await upsertOpenDueItemForEntity(
      {
        tenantId: input.tenantId,
        title: `Medida: ${created.title}`,
        entityType: FINDING_MEASURE_ENTITY_TYPE,
        entityId: created.id,
        dueAt: created.dueAt,
      },
      db,
    );
  }
  await db.inAppNotification.create({
    data: {
      tenantId: input.tenantId,
      userId: created.ownerUserId,
      title: `Medida asignada: ${created.title}`,
      body: `Nueva medida del hallazgo "${finding.title}".`,
    },
  });
  await syncFindingStatus({ tenantId: input.tenantId, findingId: finding.id, actorUserId: input.actorUserId }, db);
  return created;
}

/** Verificación de eficacia (R4–R6, P2, P3). */
export async function verifyFinding(
  input: {
    tenantId: string;
    findingId: string;
    actorUserId: string;
    result: VerificationResult | null;
    evidence: string;
    independenceException: string | null;
    earlyReason: string | null;
    now?: Date;
  },
  db: PrismaClient = prisma,
) {
  const finding = await loadFinding(db, input.tenantId, input.findingId);
  const now = input.now ?? new Date();
  const issues = verificationIssues({
    status: finding.status,
    result: input.result,
    evidence: input.evidence,
    verifierUserId: input.actorUserId,
    measureOwnerIds: finding.measures.map((m) => m.ownerUserId),
    independenceException: input.independenceException,
    verificationDueAt: finding.verificationDueAt,
    now,
    earlyReason: input.earlyReason,
  });
  if (issues.length > 0 || !input.result) throw new FindingGateError(issues);
  const result = input.result;

  await db.$transaction(async (tx) => {
    await tx.findingVerification.create({
      data: {
        tenantId: input.tenantId,
        findingId: finding.id,
        result,
        evidence: input.evidence.trim(),
        independenceException: input.independenceException?.trim() || null,
        earlyReason: input.earlyReason?.trim() || null,
        verifiedByUserId: input.actorUserId,
        verifiedAt: now,
      },
    });
    await changeStatus(tx, {
      tenantId: input.tenantId,
      findingId: finding.id,
      from: finding.status,
      to: result === "effective" ? "closed" : "in_progress",
      actorUserId: input.actorUserId,
      reason: `Verificación: ${VERIFICATION_RESULT_LABELS[result]}. ${input.evidence.trim()}`,
      data:
        result === "effective"
          ? { closedAt: now }
          : { reworkSince: now, verificationDueAt: null },
    });
  });

  await closeDueItemsForEntity(
    { tenantId: input.tenantId, entityType: FINDING_VERIFICATION_ENTITY_TYPE, entityId: finding.id },
    db,
  );
  await notifyFindingPeople(
    db,
    finding,
    result === "effective"
      ? `Hallazgo cerrado: ${finding.title}`
      : `Acciones no eficaces: ${finding.title}`,
    result === "effective"
      ? "Se verificó la eficacia de las acciones y el hallazgo quedó cerrado."
      : "La verificación indicó que el problema persiste. Hace falta una nueva medida correctiva.",
  );
}

/** Cambiar la fecha programada de verificación (P2: 30 días, editable). */
export async function rescheduleVerification(
  input: { tenantId: string; findingId: string; dueAt: Date },
  db: PrismaClient = prisma,
) {
  const finding = await loadFinding(db, input.tenantId, input.findingId);
  if (finding.status !== "verification") {
    throw new FindingGateError(["Solo se reprograma un hallazgo en verificación"]);
  }
  if (Number.isNaN(input.dueAt.getTime())) throw new FindingGateError(["Fecha inválida"]);
  await db.finding.update({ where: { id: finding.id }, data: { verificationDueAt: input.dueAt } });
  await upsertOpenDueItemForEntity(
    {
      tenantId: input.tenantId,
      title: `Verificar eficacia: ${finding.title}`,
      entityType: FINDING_VERIFICATION_ENTITY_TYPE,
      entityId: finding.id,
      dueAt: input.dueAt,
    },
    db,
  );
}

/** Anular con motivo (R7). Los vencimientos de medidas y verificación se cierran. */
export async function cancelFinding(
  input: { tenantId: string; findingId: string; actorUserId: string; reason: string },
  db: PrismaClient = prisma,
) {
  const finding = await loadFinding(db, input.tenantId, input.findingId);
  assertCanApplyFindingAction("cancel", finding.status);
  const issues = reasonIssues(input.reason, "cancel");
  if (issues.length > 0) throw new FindingGateError(issues);

  const now = new Date();
  await db.$transaction(async (tx) => {
    await changeStatus(tx, {
      tenantId: input.tenantId,
      findingId: finding.id,
      from: finding.status,
      to: "cancelled",
      actorUserId: input.actorUserId,
      reason: input.reason,
      data: { cancelledAt: now, cancelledByUserId: input.actorUserId, cancelReason: input.reason.trim() },
    });
  });
  for (const m of finding.measures) {
    await closeDueItemsForEntity(
      { tenantId: input.tenantId, entityType: FINDING_MEASURE_ENTITY_TYPE, entityId: m.id },
      db,
    );
  }
  await closeDueItemsForEntity(
    { tenantId: input.tenantId, entityType: FINDING_VERIFICATION_ENTITY_TYPE, entityId: finding.id },
    db,
  );
  if (finding.status !== "draft") {
    await notifyFindingPeople(db, finding, `Hallazgo anulado: ${finding.title}`, `Motivo: ${input.reason.trim()}`);
  }
}

/** Reabrir un cerrado ante recurrencia (R8): exige una medida correctiva nueva. */
export async function reopenFinding(
  input: { tenantId: string; findingId: string; actorUserId: string; reason: string },
  db: PrismaClient = prisma,
) {
  const finding = await loadFinding(db, input.tenantId, input.findingId);
  assertCanApplyFindingAction("reopen", finding.status);
  const issues = reasonIssues(input.reason, "reopen");
  if (issues.length > 0) throw new FindingGateError(issues);

  await db.$transaction(async (tx) => {
    await changeStatus(tx, {
      tenantId: input.tenantId,
      findingId: finding.id,
      from: finding.status,
      to: "in_progress",
      actorUserId: input.actorUserId,
      reason: input.reason,
      data: { closedAt: null, reworkSince: new Date(), verificationDueAt: null },
    });
  });
  await notifyFindingPeople(db, finding, `Hallazgo reabierto: ${finding.title}`, `Motivo: ${input.reason.trim()}`);
}

/**
 * Recalcula el estado de los hallazgos publicados o en curso (migración única
 * de datos existentes; idempotente).
 */
export async function recalculateFindingStatuses(tenantId?: string, db: PrismaClient = prisma) {
  const findings = await db.finding.findMany({
    where: { status: { in: ["published", "in_progress"] }, ...(tenantId ? { tenantId } : {}) },
    select: { id: true, tenantId: true, status: true },
  });
  const changes: { id: string; from: FindingStatus; to: FindingStatus }[] = [];
  for (const f of findings) {
    const to = await syncFindingStatus({ tenantId: f.tenantId, findingId: f.id, actorUserId: null }, db);
    if (to !== f.status) changes.push({ id: f.id, from: f.status, to });
  }
  return changes;
}
