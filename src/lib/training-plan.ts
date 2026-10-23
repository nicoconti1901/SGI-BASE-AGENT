/**
 * Plan anual de capacitación (SPEC-training, decisión 12 · Dec. 351/79 art. 211 y Res. SRT 905/15).
 *
 * Una sesión planificada es una `TrainingSession` con `status = planned`. Al dictarla (`registerSession` con
 * `plannedSessionId`) pasa a `held` y conserva `plannedFor`, la fecha con la que nació en el plan: así se
 * compara lo planificado con lo realizado sin duplicar filas. Las sesiones sin `plannedFor` son extra.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { TrainingError, audit } from "@/lib/training-config";
import { trainingToday } from "@/lib/training";
import { addDays, dateOnly, isIsoDate, type IsoDate } from "@/domain/training/dates";

type Db = PrismaClient;

const dateFromIso = (iso: IsoDate) => new Date(`${iso}T00:00:00.000Z`);

export const PLAN_LIST_LIMIT = 500;
export const PLAN_EXPORT_LIMIT = 5000;

export type PlanSessionInput = {
  tenantId: string;
  actorUserId: string;
  courseId: string;
  plannedFor: IsoDate;
  siteId?: string | null;
  level?: "senior" | "middle" | "operational" | null;
  notes?: string | null;
};

/** Agrega una sesión al plan. No crea registros de asistencia ni avisos: es una intención. */
export async function planSession(input: PlanSessionInput, db: Db = prisma) {
  const today = trainingToday();
  if (!isIsoDate(input.plannedFor)) throw new TrainingError("Fecha planificada inválida");
  if (input.plannedFor < addDays(today, -366) || input.plannedFor > addDays(today, 365 * 2)) {
    throw new TrainingError("La fecha planificada tiene que estar dentro de los próximos dos años");
  }
  const course = await db.course.findFirst({ where: { id: input.courseId, tenantId: input.tenantId } });
  if (!course) throw new TrainingError("El curso no existe");
  if (!course.active) throw new TrainingError("El curso está dado de baja: reactivalo para planificarlo");
  if (input.siteId) {
    const site = await db.site.findFirst({ where: { id: input.siteId, tenantId: input.tenantId }, select: { id: true } });
    if (!site) throw new TrainingError("La sede no existe");
  }
  return db.$transaction(async (tx) => {
    const session = await tx.trainingSession.create({
      data: {
        tenantId: input.tenantId,
        courseId: course.id,
        status: "planned",
        heldAt: dateFromIso(input.plannedFor),
        plannedFor: dateFromIso(input.plannedFor),
        siteId: input.siteId || null,
        level: input.level ?? null,
        notes: input.notes?.trim() || null,
        createdByUserId: input.actorUserId,
      },
      select: { id: true },
    });
    await audit(tx, {
      tenantId: input.tenantId,
      entityType: "training_session",
      entityId: session.id,
      action: "plan",
      actorUserId: input.actorUserId,
      summary: `Sesión «${course.name}» planificada para el ${input.plannedFor}`,
    });
    return session;
  });
}

/** Reprograma una sesión que todavía no se dictó. La fecha original del plan (`plannedFor`) no cambia. */
export async function reschedulePlannedSession(
  input: { tenantId: string; actorUserId: string; sessionId: string; heldAt: IsoDate },
  db: Db = prisma,
) {
  if (!isIsoDate(input.heldAt)) throw new TrainingError("Fecha inválida");
  const done = await db.trainingSession.updateMany({
    where: { id: input.sessionId, tenantId: input.tenantId, status: "planned", voidedAt: null },
    data: { heldAt: dateFromIso(input.heldAt) },
  });
  if (done.count === 0) throw new TrainingError("La sesión ya no está pendiente");
  await audit(db, {
    tenantId: input.tenantId,
    entityType: "training_session",
    entityId: input.sessionId,
    action: "plan",
    actorUserId: input.actorUserId,
    summary: `Sesión planificada reprogramada al ${input.heldAt}`,
  });
}

/** La sesión pendiente del plan, lista para pre-llenar el formulario de registro. */
export async function getPlannedSession(tenantId: string, sessionId: string, db: Db = prisma) {
  const row = await db.trainingSession.findFirst({
    where: { id: sessionId, tenantId, status: "planned", voidedAt: null },
    select: { id: true, courseId: true, heldAt: true, siteId: true, level: true },
  });
  return row ? { id: row.id, courseId: row.courseId, heldAt: dateOnly(row.heldAt), siteId: row.siteId, level: row.level } : null;
}

export type PlanSiteSummary = {
  siteId: string | null;
  siteName: string;
  /** Sesiones que nacieron en el plan del año (sin contar las anuladas). */
  planned: number;
  /** De esas, las que ya se dictaron. */
  done: number;
  /** Pendientes con fecha futura o de hoy. */
  upcoming: number;
  /** Pendientes cuya fecha ya pasó. */
  overdue: number;
  /** Dictadas sin haber estado en el plan. */
  extra: number;
};

type RawPlan = { siteId: string | null; planned: number; done: number; upcoming: number; overdue: number; extra: number };

/**
 * Plan vs. realizado del año por sede: una sola consulta `GROUP BY`, sin traer sesiones.
 * El año de una sesión es el de su fecha planificada; las no planificadas cuentan por la fecha en que se dictaron.
 */
export async function getPlanSummary(
  tenantId: string,
  year: number,
  today: IsoDate = trainingToday(),
  db: Db = prisma,
): Promise<PlanSiteSummary[]> {
  const rows = await db.$queryRaw<RawPlan[]>`
    SELECT s."siteId",
           (count(*) FILTER (WHERE s."plannedFor" IS NOT NULL))::int AS planned,
           (count(*) FILTER (WHERE s."plannedFor" IS NOT NULL AND s."status" = 'held'))::int AS done,
           (count(*) FILTER (WHERE s."status" = 'planned' AND s."heldAt" >= ${today}::date))::int AS upcoming,
           (count(*) FILTER (WHERE s."status" = 'planned' AND s."heldAt" < ${today}::date))::int AS overdue,
           (count(*) FILTER (WHERE s."plannedFor" IS NULL AND s."status" = 'held'))::int AS extra
    FROM "training_session" s
    WHERE s."tenantId" = ${tenantId} AND s."voidedAt" IS NULL AND s."status" <> 'cancelled'
      AND EXTRACT(YEAR FROM COALESCE(s."plannedFor", s."heldAt"))::int = ${year}
    GROUP BY s."siteId"`;
  const siteIds = rows.flatMap((r) => (r.siteId ? [r.siteId] : []));
  const sites = siteIds.length ? await db.site.findMany({ where: { tenantId, id: { in: siteIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(sites.map((s) => [s.id, s.name]));
  return rows
    .map((r) => ({ ...r, siteName: r.siteId ? (names.get(r.siteId) ?? "Sede") : "Sin sede" }))
    .sort((a, b) => a.siteName.localeCompare(b.siteName, "es"));
}

export type PlanSessionRow = {
  id: string;
  courseName: string;
  siteName: string | null;
  level: "senior" | "middle" | "operational" | null;
  plannedFor: IsoDate;
  heldAt: IsoDate;
  status: "planned" | "held";
  instructorName: string;
};

/** Sesiones del plan del año, por fecha. Acotado por `take`. */
export async function listPlanSessions(
  tenantId: string,
  filter: { year: number; siteId?: string; status?: "planned" | "held"; take?: number },
  db: Db = prisma,
): Promise<PlanSessionRow[]> {
  const rows = await db.trainingSession.findMany({
    where: {
      tenantId,
      voidedAt: null,
      plannedFor: { gte: dateFromIso(`${filter.year}-01-01`), lt: dateFromIso(`${filter.year + 1}-01-01`) },
      status: filter.status ?? { in: ["planned", "held"] },
      ...(filter.siteId ? { siteId: filter.siteId } : {}),
    },
    orderBy: [{ plannedFor: "asc" }, { id: "asc" }],
    take: Math.min(filter.take ?? PLAN_LIST_LIMIT, PLAN_EXPORT_LIMIT),
    select: {
      id: true,
      status: true,
      level: true,
      plannedFor: true,
      heldAt: true,
      instructorName: true,
      course: { select: { name: true } },
      site: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    courseName: r.course.name,
    siteName: r.site?.name ?? null,
    level: r.level,
    plannedFor: dateOnly(r.plannedFor!),
    heldAt: dateOnly(r.heldAt),
    status: r.status === "held" ? "held" : "planned",
    instructorName: r.instructorName,
  }));
}

export const PLAN_LEVEL_LABELS = {
  senior: "Nivel superior",
  middle: "Nivel intermedio",
  operational: "Nivel operativo",
} as const;

/** CSV del plan para imprimir y firmar (lo firmado se sube a Documentos). */
export function planToCsv(rows: readonly PlanSessionRow[], siteLabel: string): string {
  const cell = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = ["Curso", "Sede", "Nivel", "Fecha planificada", "Estado", "Fecha en que se dictó", "Instructor"];
  const lines = rows.map((r) =>
    [
      r.courseName,
      r.siteName ?? siteLabel,
      r.level ? PLAN_LEVEL_LABELS[r.level] : "",
      r.plannedFor,
      r.status === "held" ? "Realizada" : "Pendiente",
      r.status === "held" ? r.heldAt : "",
      r.instructorName,
    ]
      .map(cell)
      .join(","),
  );
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
