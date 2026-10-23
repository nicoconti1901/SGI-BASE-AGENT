/**
 * Avisos y eficacia de las capacitaciones (SPEC-training, slice 20.5).
 *
 * - Un `DueItem` abierto por persona (`training_person`): vence el primer día en que deja de cumplir algo
 *   obligatorio. Se concilia contra el estado calculado (`planDueItemSync`) y solo se escribe la diferencia.
 * - Un `DueItem` por sesión (o por registro individual) con evaluaciones de eficacia pendientes.
 * - Alta silenciosa: lo que ya estaba vencido o faltante al importar el histórico o crear requisitos en lote
 *   no avisa; solo avisan las transiciones posteriores (se marca como ya avisado con `lastReminderKind`).
 * - Evaluación de eficacia por sesión, con excepciones por persona; "no eficaz" crea una `Action` o reprograma.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { closeDueItemsForEntity, createDueItem, upsertOpenDueItemForEntity } from "@/lib/automation";
import { ACTION_ENTITY_TYPE } from "@/domain/actions/types";
import { TrainingError, audit } from "@/lib/training-config";
import { cellsCte, trainingToday } from "@/lib/training";
import { classifyDueWindow, reminderStartsAt } from "@/domain/automation/due";
import { addDays, dateOnly, isIsoDate, type IsoDate } from "@/domain/training/dates";
import {
  EVALUATION_METHOD_LABELS,
  evaluationNeedsResolution,
  planDueItemSync,
  validateEvaluation,
  type EvaluationMethod,
  type EvaluationStatus,
  type ExistingTrainingDueItem,
  type PersonDueSummary,
} from "@/domain/training/followup";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export const TRAINING_PERSON_ENTITY = "training_person";
export const TRAINING_SESSION_EFFECTIVENESS_ENTITY = "training_session_effectiveness";
export const TRAINING_RECORD_EFFECTIVENESS_ENTITY = "training_record_effectiveness";
const EFFECTIVENESS_LEAD_DAYS = 7;
const DEFAULT_LEAD_DAYS = 30;
/** Tope de avisos abiertos que una conciliación lee de la base (una empresa grande no llega ni cerca). */
const OPEN_ITEMS_LIMIT = 50_000;

const dateFromIso = (iso: IsoDate) => new Date(`${iso}T00:00:00.000Z`);

// ─── Responsable de avisos ─────────────────────────────────────────────────

/** Quien recibe los avisos de capacitación (puede no estar definido: entonces van a los administradores). */
export async function getTrainingOwnerUserId(tenantId: string, db: Db | Tx = prisma): Promise<string | null> {
  const settings = await db.trainingSettings.findUnique({ where: { tenantId }, select: { ownerUserId: true } });
  return settings?.ownerUserId ?? null;
}

export async function setTrainingOwner(
  input: { tenantId: string; actorUserId: string; ownerUserId: string | null },
  db: Db = prisma,
) {
  if (input.ownerUserId) {
    const member = await db.membership.findFirst({
      where: { tenantId: input.tenantId, userId: input.ownerUserId },
      select: { userId: true },
    });
    if (!member) throw new TrainingError("El responsable no pertenece a la empresa");
  }
  const settings = await db.trainingSettings.upsert({
    where: { tenantId: input.tenantId },
    create: { tenantId: input.tenantId, ownerUserId: input.ownerUserId },
    update: { ownerUserId: input.ownerUserId },
  });
  await audit(db, {
    tenantId: input.tenantId,
    entityType: "settings",
    entityId: settings.id,
    action: "settings",
    actorUserId: input.actorUserId,
    summary: input.ownerUserId ? "Responsable de avisos de capacitación definido" : "Responsable de avisos de capacitación quitado",
  });
  // Los avisos abiertos pasan a su nuevo dueño sin volver a avisar.
  await reconcileTrainingDueItems(input.tenantId, { silent: true, onlyPeople: true }, db);
  return settings;
}

// ─── Avisos por persona ────────────────────────────────────────────────────

type RawSummary = {
  personId: string;
  name: string;
  siteId: string | null;
  nextDueAt: string | null;
  expired: number;
  missing: number;
  inGrace: number;
  expiring: number;
  leadDays: number;
};

/**
 * Una fila por persona activa con algo obligatorio, calculada en la base con la misma regla que la matriz
 * (`cellsCte`). El vencimiento de un curso con registro es su `validUntil`; el de uno sin registro, el fin
 * del plazo de gracia. Un curso que no vence no pone fecha.
 */
export async function queryPersonDueSummaries(
  tenantId: string,
  scope: { today: IsoDate; personIds?: string[] },
  db: Db = prisma,
): Promise<PersonDueSummary[]> {
  const rows = await db.$queryRaw<RawSummary[]>`
    ${cellsCte(tenantId, { today: scope.today, personIds: scope.personIds })}
    SELECT c.person_id AS "personId", pe."name", c.site_id AS "siteId",
           to_char(min(CASE WHEN c.has_record THEN c.valid_until ELSE c.grace_end END) FILTER (WHERE c.mandatory), 'YYYY-MM-DD') AS "nextDueAt",
           (count(*) FILTER (WHERE c.mandatory AND c.status = 'expired'))::int AS expired,
           (count(*) FILTER (WHERE c.mandatory AND c.status = 'missing'))::int AS missing,
           (count(*) FILTER (WHERE c.mandatory AND c.status = 'in_grace'))::int AS "inGrace",
           (count(*) FILTER (WHERE c.mandatory AND c.status = 'expiring'))::int AS expiring,
           COALESCE(min(c.reminder_days) FILTER (WHERE c.mandatory AND (CASE WHEN c.has_record THEN c.valid_until ELSE c.grace_end END) IS NOT NULL), ${DEFAULT_LEAD_DAYS})::int AS "leadDays"
    FROM cells c
    JOIN "person" pe ON pe."id" = c.person_id
    GROUP BY c.person_id, pe."name", c.site_id
    HAVING bool_or(c.mandatory)`;
  return rows;
}

type OpenItem = {
  id: string;
  entityId: string | null;
  title: string;
  dueAt: Date;
  leadDays: number;
  ownerUserId: string | null;
  siteId: string | null;
};

const toExisting = (item: OpenItem): ExistingTrainingDueItem => ({
  title: item.title,
  dueAt: dateOnly(item.dueAt),
  leadDays: item.leadDays,
  ownerUserId: item.ownerUserId,
  siteId: item.siteId,
});

/** Si es un alta silenciosa, el aviso nace "ya avisado" para su ventana actual. */
function silentReminderState(dueAt: Date, leadDays: number, now: Date) {
  const kind = classifyDueWindow({ dueAt, now, leadDays });
  return kind === "none" ? { lastReminderKind: null, lastRemindedAt: null } : { lastReminderKind: kind, lastRemindedAt: now };
}

export type ReconcileResult = { created: number; updated: number; closed: number; unchanged: number };

async function reconcilePeople(
  tenantId: string,
  opts: { personIds?: string[]; silent: boolean; today: IsoDate; now: Date },
  db: Db,
): Promise<ReconcileResult> {
  const owner = await getTrainingOwnerUserId(tenantId, db);
  const summaries = await queryPersonDueSummaries(tenantId, { today: opts.today, personIds: opts.personIds }, db);
  const open = await db.dueItem.findMany({
    where: {
      tenantId,
      entityType: TRAINING_PERSON_ENTITY,
      status: "open",
      ...(opts.personIds ? { entityId: { in: opts.personIds } } : {}),
    },
    select: { id: true, entityId: true, title: true, dueAt: true, leadDays: true, ownerUserId: true, siteId: true },
    orderBy: { createdAt: "desc" },
    take: OPEN_ITEMS_LIMIT,
  });
  const byPerson = new Map<string, OpenItem>();
  const duplicates: string[] = [];
  for (const item of open) {
    if (!item.entityId) continue;
    if (byPerson.has(item.entityId)) duplicates.push(item.id);
    else byPerson.set(item.entityId, item);
  }

  const result: ReconcileResult = { created: 0, updated: 0, closed: 0, unchanged: 0 };
  const seen = new Set<string>();
  for (const summary of summaries) {
    seen.add(summary.personId);
    const current = byPerson.get(summary.personId) ?? null;
    const plan = planDueItemSync(summary, current ? toExisting(current) : null, owner);
    if (plan.action === "noop") {
      result.unchanged++;
    } else if (plan.action === "create") {
      const dueAt = dateFromIso(plan.dueAt);
      const created = await createDueItem(
        {
          tenantId,
          title: plan.title,
          entityType: TRAINING_PERSON_ENTITY,
          entityId: summary.personId,
          dueAt,
          leadDays: plan.leadDays,
          ownerUserId: plan.ownerUserId,
          siteId: plan.siteId,
          personId: summary.personId,
        },
        db,
      );
      if (opts.silent) {
        await db.dueItem.update({ where: { id: created.id }, data: silentReminderState(dueAt, plan.leadDays, opts.now) });
      }
      result.created++;
    } else if (plan.action === "update" && current) {
      const dueAt = dateFromIso(plan.dueAt);
      const windowChanged = dateOnly(current.dueAt) !== plan.dueAt || current.leadDays !== plan.leadDays;
      await db.dueItem.update({
        where: { id: current.id },
        data: {
          title: plan.title,
          dueAt,
          leadDays: plan.leadDays,
          remindAt: reminderStartsAt(dueAt, plan.leadDays),
          ownerUserId: plan.ownerUserId,
          siteId: plan.siteId,
          personId: summary.personId,
          // Si solo cambiaron los conteos o el dueño, no se vuelve a avisar; si cambió la ventana, sí.
          ...(windowChanged
            ? opts.silent
              ? silentReminderState(dueAt, plan.leadDays, opts.now)
              : { lastReminderKind: null, lastRemindedAt: null }
            : {}),
        },
      });
      result.updated++;
    } else if (plan.action === "close" && current) {
      await db.dueItem.update({ where: { id: current.id }, data: { status: "closed" } });
      result.closed++;
    }
  }

  // Avisos de personas que ya no tienen nada pendiente, que se dieron de baja o que quedaron duplicados.
  const staleIds = [...byPerson.entries()].filter(([personId]) => !seen.has(personId)).map(([, item]) => item.id);
  const toClose = [...staleIds, ...duplicates];
  if (toClose.length > 0) {
    const closed = await db.dueItem.updateMany({ where: { tenantId, id: { in: toClose }, status: "open" }, data: { status: "closed" } });
    result.closed += closed.count;
  }
  return result;
}

// ─── Avisos de eficacia ────────────────────────────────────────────────────

type RawPending = {
  key: string;
  isSession: boolean;
  courseName: string;
  siteId: string | null;
  evaluatorUserId: string | null;
  dueAt: Date;
  pending: number;
};

async function queryPendingEffectiveness(
  tenantId: string,
  scope: { sessionIds?: string[]; recordIds?: string[] },
  db: Db,
): Promise<RawPending[]> {
  const filters: Prisma.Sql[] = [];
  if (scope.sessionIds) filters.push(Prisma.sql`tr."sessionId" = ANY(${scope.sessionIds}::text[])`);
  if (scope.recordIds) filters.push(Prisma.sql`(tr."sessionId" IS NULL AND tr."id" = ANY(${scope.recordIds}::text[]))`);
  const scoped = filters.length > 0 ? Prisma.sql`AND (${Prisma.join(filters, " OR ")})` : Prisma.empty;
  return db.$queryRaw<RawPending[]>`
    SELECT COALESCE(tr."sessionId", tr."id") AS key,
           (tr."sessionId" IS NOT NULL) AS "isSession",
           max(c."name") AS "courseName",
           max(COALESCE(s."siteId", p."siteId")) AS "siteId",
           max(COALESCE(s."evaluatorUserId", te."evaluatorUserId")) AS "evaluatorUserId",
           min(te."dueAt") AS "dueAt",
           count(*)::int AS pending
    FROM "training_effectiveness" te
    JOIN "training_record" tr ON tr."id" = te."recordId"
    JOIN "training_course" c ON c."id" = tr."courseId"
    JOIN "person" p ON p."id" = tr."personId"
    LEFT JOIN "training_session" s ON s."id" = tr."sessionId"
    WHERE te."tenantId" = ${tenantId} AND te."status" = 'pending' AND tr."voidedAt" IS NULL
      AND (s."id" IS NULL OR s."voidedAt" IS NULL)
      ${scoped}
    GROUP BY COALESCE(tr."sessionId", tr."id"), (tr."sessionId" IS NOT NULL)`;
}

/**
 * Deja un aviso abierto por sesión (o por registro individual) mientras haya evaluaciones pendientes, con el
 * título y la fecha de la más próxima, y lo cierra cuando todas quedan resueltas. Solo escribe diferencias.
 */
export async function syncEffectivenessDueItems(
  tenantId: string,
  scope: { sessionIds?: string[]; recordIds?: string[] } = {},
  db: Db = prisma,
): Promise<ReconcileResult> {
  const scoped = Boolean(scope.sessionIds || scope.recordIds);
  const pending = await queryPendingEffectiveness(tenantId, scope, db);
  const keys = new Set(pending.map((p) => p.key));
  const entityTypes = [TRAINING_SESSION_EFFECTIVENESS_ENTITY, TRAINING_RECORD_EFFECTIVENESS_ENTITY];
  const scopeIds = [...(scope.sessionIds ?? []), ...(scope.recordIds ?? [])];
  const open = await db.dueItem.findMany({
    where: { tenantId, status: "open", entityType: { in: entityTypes }, ...(scoped ? { entityId: { in: scopeIds } } : {}) },
    select: { id: true, entityType: true, entityId: true, title: true, dueAt: true, ownerUserId: true, siteId: true },
    take: OPEN_ITEMS_LIMIT,
  });
  const byKey = new Map(open.filter((o) => o.entityId).map((o) => [`${o.entityType}:${o.entityId}`, o]));

  const result: ReconcileResult = { created: 0, updated: 0, closed: 0, unchanged: 0 };
  for (const p of pending) {
    const entityType = p.isSession ? TRAINING_SESSION_EFFECTIVENESS_ENTITY : TRAINING_RECORD_EFFECTIVENESS_ENTITY;
    const title = `Evaluar eficacia: ${p.courseName} (${p.pending} ${p.pending === 1 ? "persona" : "personas"})`;
    const current = byKey.get(`${entityType}:${p.key}`);
    const same =
      current &&
      current.title === title &&
      dateOnly(current.dueAt) === dateOnly(p.dueAt) &&
      current.ownerUserId === p.evaluatorUserId &&
      current.siteId === p.siteId;
    if (same) {
      result.unchanged++;
      continue;
    }
    await upsertOpenDueItemForEntity(
      {
        tenantId,
        title,
        entityType,
        entityId: p.key,
        dueAt: p.dueAt,
        leadDays: EFFECTIVENESS_LEAD_DAYS,
        ownerUserId: p.evaluatorUserId,
        siteId: p.siteId,
      },
      db,
    );
    if (current) result.updated++;
    else result.created++;
  }
  const stale = open.filter((o) => o.entityId && !keys.has(o.entityId));
  if (stale.length > 0) {
    const closed = await db.dueItem.updateMany({ where: { tenantId, status: "open", id: { in: stale.map((o) => o.id) } }, data: { status: "closed" } });
    result.closed += closed.count;
  }
  return result;
}

// ─── Conciliación ──────────────────────────────────────────────────────────

export type ReconcileOptions = {
  /** Solo estas personas (después de un alta o una anulación). Sin esto, toda la empresa. */
  personIds?: string[];
  /** Solo estas sesiones / registros individuales para los avisos de eficacia. */
  sessionIds?: string[];
  recordIds?: string[];
  /** Alta silenciosa: lo que ya estaba vencido o faltante no avisa. */
  silent?: boolean;
  /** No tocar los avisos de eficacia. */
  onlyPeople?: boolean;
  now?: Date;
};

/**
 * Pone los avisos de la empresa al día con el estado calculado. Idempotente: correrla dos veces seguidas no
 * escribe nada la segunda. Se llama después de cada alta o anulación (para las personas afectadas) y en el
 * scan diario (para toda la empresa, cubre cambios de puesto o tareas hechos por otro módulo).
 */
export async function reconcileTrainingDueItems(
  tenantId: string,
  opts: ReconcileOptions = {},
  db: Db = prisma,
): Promise<{ people: ReconcileResult; effectiveness: ReconcileResult | null }> {
  const now = opts.now ?? new Date();
  const today = trainingToday(now);
  const personScoped = opts.personIds !== undefined;
  const people =
    personScoped && opts.personIds!.length === 0
      ? { created: 0, updated: 0, closed: 0, unchanged: 0 }
      : await reconcilePeople(tenantId, { personIds: opts.personIds, silent: opts.silent ?? false, today, now }, db);
  const effScoped = opts.sessionIds !== undefined || opts.recordIds !== undefined;
  const effectiveness = opts.onlyPeople
    ? null
    : personScoped && !effScoped
      ? null
      : await syncEffectivenessDueItems(tenantId, { sessionIds: opts.sessionIds, recordIds: opts.recordIds }, db);
  return { people, effectiveness };
}

/** Los avisos no son la operación principal: si fallan, se registra y el alta o la anulación ya hecha sigue en pie. */
export async function reconcileSafely(tenantId: string, opts: ReconcileOptions, db: Db = prisma): Promise<void> {
  try {
    await reconcileTrainingDueItems(tenantId, opts, db);
  } catch (error) {
    console.error(
      JSON.stringify({ event: "training.reconcile.failed", tenantId, error: error instanceof Error ? error.message : String(error) }),
    );
  }
}

/** Cierra los avisos de una persona (por ejemplo, al darla de baja desde datos maestros). */
export async function closeTrainingDueItemsForPerson(tenantId: string, personId: string, db: Db = prisma) {
  return closeDueItemsForEntity({ tenantId, entityType: TRAINING_PERSON_ENTITY, entityId: personId }, db);
}

// ─── Bandeja de eficacia ───────────────────────────────────────────────────

export const INBOX_PAGE_SIZE = 50;

export type EffectivenessInboxItem = {
  /** Sesión o registro individual. */
  kind: "session" | "record";
  id: string;
  courseName: string;
  heldAt: string;
  siteName: string | null;
  evaluatorUserId: string | null;
  evaluatorName: string | null;
  pending: number;
  dueAt: IsoDate;
  overdue: boolean;
};

/** Lo que falta evaluar, agrupado por sesión; la fecha más próxima primero. Máximo 50 por pedido. */
export async function listEffectivenessInbox(
  tenantId: string,
  opts: { evaluatorUserId?: string; today?: IsoDate; take?: number } = {},
  db: Db = prisma,
): Promise<EffectivenessInboxItem[]> {
  const today = opts.today ?? trainingToday();
  const take = Math.min(opts.take ?? INBOX_PAGE_SIZE, 200);
  const pending = await queryPendingEffectiveness(tenantId, {}, db);
  const filtered = pending
    .filter((p) => !opts.evaluatorUserId || p.evaluatorUserId === opts.evaluatorUserId)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, take);
  if (filtered.length === 0) return [];

  const sessionIds = filtered.filter((p) => p.isSession).map((p) => p.key);
  const recordIds = filtered.filter((p) => !p.isSession).map((p) => p.key);
  const [sessions, records, users, sites] = await Promise.all([
    sessionIds.length ? db.trainingSession.findMany({ where: { tenantId, id: { in: sessionIds } }, select: { id: true, heldAt: true } }) : [],
    recordIds.length ? db.trainingRecord.findMany({ where: { tenantId, id: { in: recordIds } }, select: { id: true, completedAt: true } }) : [],
    db.user.findMany({
      where: { id: { in: [...new Set(filtered.flatMap((p) => (p.evaluatorUserId ? [p.evaluatorUserId] : [])))] } },
      select: { id: true, name: true },
    }),
    db.site.findMany({ where: { tenantId, id: { in: [...new Set(filtered.flatMap((p) => (p.siteId ? [p.siteId] : [])))] } }, select: { id: true, name: true } }),
  ]);
  const heldAt = new Map<string, Date>([...sessions.map((s) => [s.id, s.heldAt] as const), ...records.map((r) => [r.id, r.completedAt] as const)]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  return filtered.map((p) => ({
    kind: p.isSession ? "session" : "record",
    id: p.key,
    courseName: p.courseName,
    heldAt: heldAt.get(p.key) ? dateOnly(heldAt.get(p.key)!) : "",
    siteName: p.siteId ? (siteName.get(p.siteId) ?? null) : null,
    evaluatorUserId: p.evaluatorUserId,
    evaluatorName: p.evaluatorUserId ? (userName.get(p.evaluatorUserId) ?? null) : null,
    pending: p.pending,
    dueAt: dateOnly(p.dueAt),
    overdue: dateOnly(p.dueAt) < today,
  }));
}

/** Las evaluaciones pendientes de una sesión o registro, con la persona, para llenar el formulario. */
export async function getEffectivenessTarget(
  tenantId: string,
  target: { sessionId?: string; recordId?: string },
  db: Db = prisma,
) {
  if (!target.sessionId && !target.recordId) return null;
  const rows = await db.trainingEffectiveness.findMany({
    where: {
      tenantId,
      status: "pending",
      record: {
        voidedAt: null,
        ...(target.sessionId ? { sessionId: target.sessionId, session: { voidedAt: null } } : { id: target.recordId, sessionId: null }),
      },
    },
    orderBy: { record: { person: { name: "asc" } } },
    take: 500,
    select: {
      id: true,
      dueAt: true,
      evaluatorUserId: true,
      rescheduledTo: true,
      record: {
        select: {
          id: true,
          completedAt: true,
          course: { select: { name: true } },
          person: { select: { id: true, name: true, employeeCode: true } },
          session: { select: { id: true, heldAt: true, siteId: true, site: { select: { name: true } } } },
        },
      },
    },
  });
  if (rows.length === 0) return null;
  const first = rows[0].record;
  return {
    kind: target.sessionId ? ("session" as const) : ("record" as const),
    id: (target.sessionId ?? target.recordId)!,
    courseName: first.course.name,
    heldAt: dateOnly(first.session?.heldAt ?? first.completedAt),
    siteName: first.session?.site?.name ?? null,
    evaluatorUserId: rows[0].evaluatorUserId,
    dueAt: dateOnly(rows.reduce((min, r) => (r.dueAt < min ? r.dueAt : min), rows[0].dueAt)),
    people: rows.map((r) => ({ recordId: r.record.id, ...r.record.person, rescheduledTo: r.rescheduledTo ? dateOnly(r.rescheduledTo) : null })),
  };
}

// ─── Evaluación de eficacia ────────────────────────────────────────────────

export type EvaluationResolution =
  | { kind: "action"; ownerUserId: string; dueAt: IsoDate; title?: string }
  | { kind: "reschedule"; rescheduledTo: IsoDate };

export type EvaluateEffectivenessInput = {
  tenantId: string;
  actorUserId: string;
  /** El que puede gestionar capacitaciones evalúa cualquiera; el resto, solo donde es el evaluador designado. */
  canManage: boolean;
  sessionId?: string;
  recordId?: string;
  status: EvaluationStatus;
  method: EvaluationMethod | null;
  note: string;
  /** Personas cuyo resultado difiere del general. */
  exceptions?: { recordId: string; status: EvaluationStatus; note?: string }[];
  /** Obligatoria si alguien quedó "no eficaz". */
  resolution?: EvaluationResolution;
  today?: IsoDate;
};

/**
 * Evalúa la eficacia de las evaluaciones pendientes de una sesión (o de un registro individual): un resultado
 * general y excepciones por persona. Un «no eficaz» exige crear una `Action` (queda vinculada en
 * `TrainingEffectiveness.actionId`) o reprogramar la evaluación de esas personas.
 */
export async function evaluateEffectiveness(input: EvaluateEffectivenessInput, db: Db = prisma) {
  if (Boolean(input.sessionId) === Boolean(input.recordId)) throw new TrainingError("Elegí una sesión o un registro para evaluar");
  const today = input.today ?? trainingToday();
  const exceptions = input.exceptions ?? [];

  const result = await db.$transaction(
    async (tx) => {
      const rows = await tx.trainingEffectiveness.findMany({
        where: {
          tenantId: input.tenantId,
          status: "pending",
          record: {
            voidedAt: null,
            ...(input.sessionId ? { sessionId: input.sessionId, session: { voidedAt: null } } : { id: input.recordId, sessionId: null }),
          },
        },
        take: 500,
        select: {
          id: true,
          recordId: true,
          evaluatorUserId: true,
          record: { select: { person: { select: { name: true } }, course: { select: { name: true } }, session: { select: { evaluatorUserId: true } } } },
        },
      });
      if (rows.length === 0) throw new TrainingError("No hay evaluaciones pendientes: alguien ya las resolvió");

      if (!input.canManage) {
        const designated = rows.every((r) => (r.record.session?.evaluatorUserId ?? r.evaluatorUserId) === input.actorUserId);
        if (!designated) throw new TrainingError("Solo quien fue designado para evaluar esta capacitación puede hacerlo");
      }

      const byRecord = new Map(rows.map((r) => [r.recordId, r]));
      const seen = new Set<string>();
      for (const e of exceptions) {
        if (!byRecord.has(e.recordId)) throw new TrainingError("Una de las excepciones no corresponde a esta capacitación");
        if (seen.has(e.recordId)) throw new TrainingError("Hay una persona repetida entre las excepciones");
        seen.add(e.recordId);
      }

      const exceptionOf = new Map(exceptions.map((e) => [e.recordId, e]));
      const decisions = rows.map((r) => {
        const e = exceptionOf.get(r.recordId);
        return { row: r, status: e?.status ?? input.status, note: (e?.note ?? input.note).trim() };
      });
      const problems = new Set<string>();
      for (const d of decisions) for (const message of validateEvaluation({ status: d.status, method: input.method, note: d.note })) problems.add(message);
      if (problems.size > 0) throw new TrainingError([...problems][0]);

      const failing = decisions.filter((d) => d.status === "not_effective");
      let actionId: string | null = null;
      let actionDue: { title: string; dueAt: Date; ownerUserId: string } | null = null;
      let rescheduledTo: IsoDate | null = null;
      if (evaluationNeedsResolution(decisions.map((d) => d.status))) {
        const resolution = input.resolution;
        if (!resolution) throw new TrainingError("Si no fue eficaz, creá una acción o reprogramá la evaluación");
        if (resolution.kind === "reschedule") {
          if (!isIsoDate(resolution.rescheduledTo) || resolution.rescheduledTo <= today) {
            throw new TrainingError("La nueva fecha de evaluación tiene que ser posterior a hoy");
          }
          if (resolution.rescheduledTo > addDays(today, 365)) throw new TrainingError("La nueva fecha no puede pasar de un año");
          rescheduledTo = resolution.rescheduledTo;
        } else {
          if (!isIsoDate(resolution.dueAt) || resolution.dueAt < today) throw new TrainingError("El plazo de la acción no puede ser anterior a hoy");
          const owner = await tx.membership.findFirst({ where: { tenantId: input.tenantId, userId: resolution.ownerUserId }, select: { userId: true } });
          if (!owner) throw new TrainingError("El responsable de la acción no pertenece a la empresa");
          const courseName = failing[0].row.record.course.name;
          const names = failing.map((d) => d.row.record.person.name);
          const action = await tx.action.create({
            data: {
              tenantId: input.tenantId,
              title: (resolution.title?.trim() || `Reforzar «${courseName}»: la capacitación no fue eficaz`).slice(0, 200),
              description: `No fue eficaz para ${names.length} persona(s): ${names.slice(0, 15).join(", ")}${names.length > 15 ? "…" : ""}.\n${failing[0].note}`,
              ownerUserId: resolution.ownerUserId,
              dueAt: dateFromIso(resolution.dueAt),
              createdByUserId: input.actorUserId,
            },
            select: { id: true, title: true, ownerUserId: true, dueAt: true },
          });
          actionId = action.id;
          actionDue = { title: action.title, dueAt: action.dueAt!, ownerUserId: action.ownerUserId };
        }
      }

      const now = new Date();
      for (const d of decisions) {
        const reschedule = d.status === "not_effective" && rescheduledTo;
        await tx.trainingEffectiveness.update({
          where: { id: d.row.id },
          data: reschedule
            ? { rescheduledTo: dateFromIso(rescheduledTo!), dueAt: dateFromIso(rescheduledTo!), method: input.method, note: d.note }
            : {
                status: d.status,
                method: input.method,
                note: d.note || null,
                evaluatedAt: now,
                evaluatorUserId: d.row.evaluatorUserId ?? input.actorUserId,
                actionId: d.status === "not_effective" ? actionId : null,
              },
        });
      }
      await audit(tx, {
        tenantId: input.tenantId,
        entityType: input.sessionId ? "training_session" : "training_record",
        entityId: (input.sessionId ?? input.recordId)!,
        action: "evaluate",
        actorUserId: input.actorUserId,
        summary: `Eficacia evaluada (${EVALUATION_METHOD_LABELS[input.method!]}): ${decisions.length} persona(s), ${failing.length} no eficaz(ces)${actionId ? ", con acción" : rescheduledTo ? `, reprogramada al ${rescheduledTo}` : ""}`,
        reason: input.note.trim() || null,
      });
      return { evaluated: decisions.length - (rescheduledTo ? failing.length : 0), notEffective: failing.length, actionId, actionDue, rescheduledTo };
    },
    { timeout: 30_000 },
  );

  // El vencimiento de la acción y los avisos de eficacia se actualizan fuera de la transacción.
  if (result.actionId && result.actionDue) {
    await upsertOpenDueItemForEntity(
      {
        tenantId: input.tenantId,
        title: `Acción: ${result.actionDue.title}`,
        entityType: ACTION_ENTITY_TYPE,
        entityId: result.actionId,
        dueAt: result.actionDue.dueAt,
        ownerUserId: result.actionDue.ownerUserId,
      },
      db,
    );
  }

  await syncEffectivenessDueItems(
    input.tenantId,
    input.sessionId ? { sessionIds: [input.sessionId] } : { recordIds: [input.recordId!] },
    db,
  );
  return { evaluated: result.evaluated, notEffective: result.notEffective, actionId: result.actionId, rescheduledTo: result.rescheduledTo };
}
