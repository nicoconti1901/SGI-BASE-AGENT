/**
 * Persistencia y lectura del módulo de capacitaciones (SPEC-training).
 *
 * El estado de cada persona en cada curso no se guarda: se calcula al leer, de dos maneras que dan lo
 * mismo (la función TypeScript de `src/domain/training/rules.ts` es la especificación):
 * - vistas individuales (`getPersonTrainingStatus`): la función pura con los datos de UNA persona;
 * - vistas agregadas (matriz, resumen por sede): una consulta SQL que reproduce la misma regla.
 * `tests/training.integration.test.ts` compara ambas celda por celda.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_TIME_ZONE,
  dateInZone,
  dateOnly,
  type IsoDate,
} from "@/domain/training/dates";
import { computeTrainingStatus } from "@/domain/training/rules";
import type {
  CourseStatus,
  EffectivenessOutcome,
  TrainingPerson,
  TrainingRecordInput,
  TrainingRequirement,
  TrainingStatus,
} from "@/domain/training/types";

type Db = PrismaClient;

/** Tope de filas que una vista individual trae de la base (una persona no llega ni cerca). */
const PERSON_ROWS_LIMIT = 5000;

/** "Hoy" del cliente (por defecto, la fecha de Buenos Aires). */
export function trainingToday(now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): IsoDate {
  return dateInZone(now, timeZone);
}

// ─── Vista individual: la función pura con los datos de una persona ────────

/** Datos de una persona para el cálculo: 3 consultas acotadas por `personId`. */
export async function loadPersonTrainingData(
  tenantId: string,
  personId: string,
  opts: { timeZone?: string; extraTaskIds?: string[] } = {},
  db: Db = prisma,
): Promise<{
  person: TrainingPerson;
  requirements: TrainingRequirement[];
  records: TrainingRecordInput[];
} | null> {
  const tz = opts.timeZone ?? DEFAULT_TIME_ZONE;
  const row = await db.person.findFirst({
    where: { id: personId, tenantId },
    select: {
      id: true,
      status: true,
      hiredAt: true,
      positionId: true,
      positionSince: true,
      jobTasks: { select: { jobTaskId: true, assignedAt: true } },
    },
  });
  if (!row) return null;

  const taskIds = [...new Set([...row.jobTasks.map((t) => t.jobTaskId), ...(opts.extraTaskIds ?? [])])];
  const [requirementRows, recordRows] = await Promise.all([
    db.trainingRequirement.findMany({
      where: {
        tenantId,
        OR: [
          { targetKind: "all" },
          { targetKind: "position", positionId: row.positionId },
          ...(taskIds.length ? [{ targetKind: "task" as const, jobTaskId: { in: taskIds } }] : []),
        ],
      },
      select: {
        courseId: true,
        targetKind: true,
        positionId: true,
        jobTaskId: true,
        mandatory: true,
        graceDays: true,
        effectiveFrom: true,
        course: { select: { reminderDays: true } },
      },
      take: PERSON_ROWS_LIMIT,
    }),
    db.trainingRecord.findMany({
      where: { tenantId, personId },
      select: {
        courseId: true,
        completedAt: true,
        result: true,
        validUntil: true,
        voidedAt: true,
        effectiveness: { select: { status: true } },
      },
      orderBy: [{ completedAt: "desc" }, { id: "asc" }],
      take: PERSON_ROWS_LIMIT,
    }),
  ]);

  return {
    person: {
      id: row.id,
      active: row.status === "active",
      hiredAt: row.hiredAt ? dateOnly(row.hiredAt) : null,
      positionId: row.positionId,
      positionSince: row.positionSince ? dateInZone(row.positionSince, tz) : null,
      tasks: row.jobTasks.map((t) => ({ jobTaskId: t.jobTaskId, assignedAt: dateInZone(t.assignedAt, tz) })),
    },
    requirements: requirementRows.map((r) => ({
      courseId: r.courseId,
      targetKind: r.targetKind,
      positionId: r.positionId,
      jobTaskId: r.jobTaskId,
      mandatory: r.mandatory,
      graceDays: r.graceDays,
      effectiveFrom: dateOnly(r.effectiveFrom),
      reminderDays: r.course.reminderDays,
    })),
    records: recordRows.map((r) => ({
      courseId: r.courseId,
      completedAt: dateOnly(r.completedAt),
      result: r.result,
      validUntil: r.validUntil ? dateOnly(r.validUntil) : null,
      voided: r.voidedAt !== null,
      effectiveness: r.effectiveness?.status ?? null,
    })),
  };
}

/** Estado de una persona en cada curso (los que se le exigen y los demás con registros). */
export async function getPersonTrainingStatus(
  tenantId: string,
  personId: string,
  opts: { today?: IsoDate; timeZone?: string } = {},
  db: Db = prisma,
): Promise<CourseStatus[] | null> {
  const data = await loadPersonTrainingData(tenantId, personId, { timeZone: opts.timeZone }, db);
  if (!data) return null;
  return computeTrainingStatus(data.person, data.requirements, data.records, opts.today ?? trainingToday());
}

// ─── Vistas agregadas: la misma regla en SQL ───────────────────────────────

export type ComplianceScope = {
  today: IsoDate;
  timeZone?: string;
  /** Solo estas personas (la página de la matriz). */
  personIds?: string[];
  /** Sede base o adicional. */
  siteId?: string;
  positionId?: string;
  /** Personas que tienen asignada esta tarea. */
  jobTaskId?: string;
  /** Solo estos cursos (las columnas visibles). */
  courseIds?: string[];
};

export type ComplianceCell = {
  personId: string;
  courseId: string;
  mandatory: boolean;
  status: Exclude<TrainingStatus, "not_required">;
  validUntil: IsoDate | null;
  daysToExpiry: number | null;
  effectiveness: EffectivenessOutcome;
};

/**
 * CTE con una fila por (persona activa, curso exigido): `cells`. Reproduce `rules.ts`:
 * - expande lo exigido por puesto, por tarea asignada y por "todo el personal" (solo requisitos ya vigentes);
 * - por curso: obligatorio si alguna fuente lo es, plazo = el más temprano entre las obligatorias;
 * - el mejor registro es el aprobado, no anulado y ya realizado con el mayor vencimiento (NULL = infinito);
 * - el estado sale de un CASE con `today` como parámetro.
 * Siempre filtra por `tenantId` como primer predicado.
 */
function cellsCte(tenantId: string, s: ComplianceScope): Prisma.Sql {
  const tz = s.timeZone ?? DEFAULT_TIME_ZONE;
  const today = Prisma.sql`${s.today}::date`;
  const personFilters: Prisma.Sql[] = [Prisma.sql`p."tenantId" = ${tenantId}`, Prisma.sql`p."status" = 'active'`];
  if (s.personIds) personFilters.push(Prisma.sql`p."id" = ANY(${s.personIds}::text[])`);
  if (s.siteId) {
    personFilters.push(
      Prisma.sql`(p."siteId" = ${s.siteId} OR EXISTS (SELECT 1 FROM "person_site" ps WHERE ps."personId" = p."id" AND ps."siteId" = ${s.siteId}))`,
    );
  }
  if (s.positionId) personFilters.push(Prisma.sql`p."positionId" = ${s.positionId}`);
  if (s.jobTaskId) {
    personFilters.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "person_job_task" pt WHERE pt."personId" = p."id" AND pt."jobTaskId" = ${s.jobTaskId})`,
    );
  }
  const courseFilter = s.courseIds ? Prisma.sql`AND r."courseId" = ANY(${s.courseIds}::text[])` : Prisma.empty;
  const inForce = Prisma.sql`r."tenantId" = ${tenantId} AND r."effectiveFrom" <= ${today} ${courseFilter}`;

  return Prisma.sql`
    WITH scope AS MATERIALIZED (
      SELECT p."id", p."siteId", p."positionId",
             p."hiredAt"::date AS hired,
             (p."positionSince" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date AS pos_since
      FROM "person" p
      WHERE ${Prisma.join(personFilters, " AND ")}
    ),
    sources AS (
      SELECT s."id" AS person_id, r."courseId", r."mandatory",
             GREATEST(s.hired, s.pos_since, r."effectiveFrom") + r."graceDays" AS grace_end
      FROM scope s
      JOIN "training_requirement" r ON r."targetKind" = 'position' AND r."positionId" = s."positionId"
      WHERE ${inForce}
      UNION ALL
      SELECT s."id", r."courseId", r."mandatory",
             GREATEST(s.hired, (pt."assignedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date, r."effectiveFrom") + r."graceDays"
      FROM scope s
      JOIN "person_job_task" pt ON pt."personId" = s."id"
      JOIN "training_requirement" r ON r."targetKind" = 'task' AND r."jobTaskId" = pt."jobTaskId"
      WHERE ${inForce}
      UNION ALL
      SELECT s."id", r."courseId", r."mandatory",
             GREATEST(s.hired, r."effectiveFrom") + r."graceDays"
      FROM scope s
      JOIN "training_requirement" r ON r."targetKind" = 'all'
      WHERE ${inForce}
    ),
    required AS MATERIALIZED (
      SELECT person_id, "courseId",
             bool_or("mandatory") AS mandatory,
             min(grace_end) FILTER (WHERE "mandatory") AS grace_end
      FROM sources
      GROUP BY person_id, "courseId"
    ),
    cells AS (
      SELECT rq.person_id, s."siteId" AS site_id, rq."courseId", rq.mandatory, b."validUntil" AS valid_until,
             (b."id" IS NOT NULL) AS has_record,
             COALESCE(NULLIF(e."status"::text, 'not_applicable'), 'n/a') AS effectiveness,
             CASE
               WHEN b."id" IS NOT NULL THEN
                 CASE
                   WHEN b."validUntil" IS NULL THEN 'valid'
                   WHEN b."validUntil" < ${today} THEN 'expired'
                   WHEN b."validUntil" - ${today} <= c."reminderDays" THEN 'expiring'
                   ELSE 'valid'
                 END
               WHEN rq.mandatory AND rq.grace_end IS NOT NULL AND ${today} <= rq.grace_end THEN 'in_grace'
               ELSE 'missing'
             END AS status
      FROM required rq
      JOIN scope s ON s."id" = rq.person_id
      JOIN "training_course" c ON c."id" = rq."courseId"
      LEFT JOIN LATERAL (
        SELECT tr."id", tr."validUntil"
        FROM "training_record" tr
        WHERE tr."tenantId" = ${tenantId} AND tr."personId" = rq.person_id AND tr."courseId" = rq."courseId"
          AND tr."result" = 'passed' AND tr."voidedAt" IS NULL AND tr."completedAt" <= ${today}
        ORDER BY tr."validUntil" DESC NULLS FIRST, tr."completedAt" DESC, tr."id"
        LIMIT 1
      ) b ON true
      LEFT JOIN "training_effectiveness" e ON e."recordId" = b."id"
    )`;
}

type RawCell = {
  personId: string;
  courseId: string;
  mandatory: boolean;
  status: string;
  validUntil: string | null;
  daysToExpiry: number | null;
  effectiveness: string;
};

/** Celdas persona × curso exigido, calculadas en la base. Acotá siempre con `personIds`, sede o curso. */
export async function queryComplianceCells(
  tenantId: string,
  scope: ComplianceScope,
  db: Db = prisma,
): Promise<ComplianceCell[]> {
  const today = Prisma.sql`${scope.today}::date`;
  const rows = await db.$queryRaw<RawCell[]>`
    ${cellsCte(tenantId, scope)}
    SELECT person_id AS "personId", "courseId", mandatory, status,
           to_char(valid_until, 'YYYY-MM-DD') AS "validUntil",
           CASE WHEN has_record AND valid_until >= ${today} THEN (valid_until - ${today})::int END AS "daysToExpiry",
           effectiveness
    FROM cells
    ORDER BY person_id, "courseId"`;
  return rows.map((r) => ({
    personId: r.personId,
    courseId: r.courseId,
    mandatory: r.mandatory,
    status: r.status as ComplianceCell["status"],
    validUntil: r.validUntil,
    daysToExpiry: r.daysToExpiry,
    effectiveness: r.effectiveness as EffectivenessOutcome,
  }));
}

export type SiteCompliance = {
  siteId: string;
  valid: number;
  expiring: number;
  expired: number;
  missing: number;
  inGrace: number;
  /** Personas activas de la sede base con al menos un curso obligatorio. */
  people: number;
};

/** Resumen por sede base (celdas obligatorias por estado): una sola consulta `GROUP BY`, sin traer personas. */
export async function getComplianceBySite(
  tenantId: string,
  scope: Pick<ComplianceScope, "today" | "timeZone" | "siteId">,
  db: Db = prisma,
): Promise<SiteCompliance[]> {
  const rows = await db.$queryRaw<{ siteId: string; status: string; cells: number; people: number }[]>`
    ${cellsCte(tenantId, scope)}
    SELECT site_id AS "siteId", status, count(*)::int AS cells, count(DISTINCT person_id)::int AS people
    FROM cells
    WHERE mandatory
    GROUP BY site_id, status`;
  const bySite = new Map<string, SiteCompliance>();
  for (const r of rows) {
    const entry =
      bySite.get(r.siteId) ?? { siteId: r.siteId, valid: 0, expiring: 0, expired: 0, missing: 0, inGrace: 0, people: 0 };
    if (r.status === "valid") entry.valid += r.cells;
    else if (r.status === "expiring") entry.expiring += r.cells;
    else if (r.status === "expired") entry.expired += r.cells;
    else if (r.status === "missing") entry.missing += r.cells;
    else if (r.status === "in_grace") entry.inGrace += r.cells;
    entry.people = Math.max(entry.people, r.people);
    bySite.set(r.siteId, entry);
  }
  return [...bySite.values()];
}

// ─── Matriz de cumplimiento, paginada por persona ──────────────────────────

export const MATRIX_PAGE_SIZE = 50;
export const MATRIX_MAX_COLUMNS = 25;

export type MatrixFilter = {
  today: IsoDate;
  timeZone?: string;
  siteId?: string;
  positionId?: string;
  jobTaskId?: string;
  /** Nombre o legajo. */
  q?: string;
  /** Última persona de la página anterior. */
  after?: string;
  limit?: number;
};

export type MatrixPage = {
  people: { id: string; name: string; employeeCode: string }[];
  columns: { id: string; name: string }[];
  /** Hay más cursos obligatorios que los `MATRIX_MAX_COLUMNS` mostrados. */
  hasMoreColumns: boolean;
  cells: ComplianceCell[];
  nextCursor: string | null;
};

/**
 * Cursos obligatorios para el filtro actual (las columnas). Mira los requisitos, no las personas:
 * con filtro de puesto o tarea, los de ese destino más los de "todo el personal".
 */
async function listMatrixColumns(tenantId: string, f: Pick<MatrixFilter, "positionId" | "jobTaskId">, db: Db) {
  const targets: Prisma.TrainingRequirementWhereInput[] = [{ targetKind: "all" }];
  if (f.positionId || f.jobTaskId) {
    if (f.positionId) targets.push({ targetKind: "position", positionId: f.positionId });
    if (f.jobTaskId) targets.push({ targetKind: "task", jobTaskId: f.jobTaskId });
  } else {
    targets.push({ targetKind: "position" }, { targetKind: "task" });
  }
  const courses = await db.course.findMany({
    where: { tenantId, active: true, requirements: { some: { tenantId, mandatory: true, OR: targets } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: MATRIX_MAX_COLUMNS + 1,
  });
  return { columns: courses.slice(0, MATRIX_MAX_COLUMNS), hasMore: courses.length > MATRIX_MAX_COLUMNS };
}

/** Una página de la matriz: 50 personas por nombre, y solo las celdas de esas personas y de esos cursos. */
export async function getMatrixPage(tenantId: string, filter: MatrixFilter, db: Db = prisma): Promise<MatrixPage> {
  const limit = Math.min(filter.limit ?? MATRIX_PAGE_SIZE, MATRIX_PAGE_SIZE);
  const q = filter.q?.trim();
  const people = await db.person.findMany({
    where: {
      tenantId,
      status: "active",
      ...(filter.siteId ? { OR: [{ siteId: filter.siteId }, { extraSites: { some: { siteId: filter.siteId } } }] } : {}),
      ...(filter.positionId ? { positionId: filter.positionId } : {}),
      ...(filter.jobTaskId ? { jobTasks: { some: { jobTaskId: filter.jobTaskId } } } : {}),
      ...(q
        ? { AND: [{ OR: [{ name: { contains: q, mode: "insensitive" } }, { employeeCode: { contains: q, mode: "insensitive" } }] }] }
        : {}),
    },
    select: { id: true, name: true, employeeCode: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(filter.after ? { cursor: { id: filter.after }, skip: 1 } : {}),
  });
  const page = people.slice(0, limit);
  const { columns, hasMore } = await listMatrixColumns(tenantId, filter, db);

  const cells =
    page.length > 0 && columns.length > 0
      ? await queryComplianceCells(
          tenantId,
          { today: filter.today, timeZone: filter.timeZone, personIds: page.map((p) => p.id), courseIds: columns.map((c) => c.id) },
          db,
        )
      : [];
  return {
    people: page,
    columns,
    hasMoreColumns: hasMore,
    cells,
    nextCursor: people.length > limit ? page[page.length - 1].id : null,
  };
}
