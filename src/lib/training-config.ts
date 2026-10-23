/**
 * Configuración del módulo de capacitaciones (SPEC-training, slice 20.2): cursos, catálogo sugerido,
 * matriz de requisitos con vista previa de impacto, recálculo de vigencias y sello de revisión.
 * Todo está acotado por `tenantId`; cada cambio deja registro en `TrainingAudit`.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cleanName } from "@/domain/masterdata/roster";
import { DEFAULT_TIME_ZONE, type IsoDate } from "@/domain/training/dates";
import { validateCourseInput, type CourseDraft, type CourseInput } from "@/domain/training/courses";
import { MATRIX_MAX_CHANGES, type MatrixChange } from "@/domain/training/matrix";
import { SUGGESTED_COURSES, findSuggested } from "@/domain/training/suggested-catalog";
import { trainingToday } from "@/lib/training";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

/** Error de negocio con un mensaje listo para mostrar en la UI. */
export class TrainingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrainingError";
  }
}

const dateFromIso = (iso: IsoDate) => new Date(`${iso}T00:00:00.000Z`);

export async function audit(
  db: Db | Tx,
  input: {
    tenantId: string;
    entityType: string;
    entityId: string;
    action: "create" | "update" | "deactivate" | "reactivate" | "import" | "delete" | "review" | "recalculate" | "register" | "void" | "attach" | "plan" | "evaluate" | "settings";
    actorUserId: string | null;
    summary: string;
    reason?: string | null;
  },
) {
  await db.trainingAudit.create({ data: { ...input, reason: input.reason ?? null } });
}

// ─── Cursos ────────────────────────────────────────────────────────────────

export async function listCourses(tenantId: string, opts: { includeInactive?: boolean } = {}, db: Db = prisma) {
  return db.course.findMany({
    where: { tenantId, ...(opts.includeInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
    take: 500,
  });
}

async function assertCourseNameFree(db: Db | Tx, tenantId: string, name: string, exceptId?: string) {
  const found = await db.course.findFirst({
    where: { tenantId, name: { equals: name, mode: "insensitive" }, id: { not: exceptId } },
    select: { name: true },
  });
  if (found) throw new TrainingError(`Ya existe un curso llamado «${found.name}»`);
}

function checked(draft: CourseDraft): CourseInput {
  const result = validateCourseInput(draft);
  if (!result.ok) throw new TrainingError(result.error);
  return result.value;
}

function uniqueToError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new TrainingError("Ya existe un curso con ese nombre");
  }
  throw error;
}

export async function createCourse(
  input: { tenantId: string; actorUserId: string; draft: CourseDraft; suggestedKey?: string | null },
  db: Db = prisma,
) {
  const value = checked(input.draft);
  await assertCourseNameFree(db, input.tenantId, value.name);
  try {
    const course = await db.course.create({
      data: { tenantId: input.tenantId, ...value, suggestedKey: input.suggestedKey ?? null },
    });
    await audit(db, {
      tenantId: input.tenantId,
      entityType: "course",
      entityId: course.id,
      action: "create",
      actorUserId: input.actorUserId,
      summary: `Alta del curso «${course.name}»`,
    });
    return course;
  } catch (error) {
    return uniqueToError(error);
  }
}

/** Cambiar la vigencia no toca los registros ya cargados: para eso está `recalculateCourseValidity`. */
export async function updateCourse(
  input: { tenantId: string; actorUserId: string; id: string; draft: CourseDraft },
  db: Db = prisma,
) {
  const current = await db.course.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!current) throw new TrainingError("Curso no encontrado");
  const value = checked(input.draft);
  if (value.name !== current.name) await assertCourseNameFree(db, input.tenantId, value.name, current.id);
  try {
    const course = await db.course.update({ where: { id: current.id }, data: value });
    await audit(db, {
      tenantId: input.tenantId,
      entityType: "course",
      entityId: course.id,
      action: "update",
      actorUserId: input.actorUserId,
      summary: `Edición del curso «${course.name}»`,
    });
    return course;
  } catch (error) {
    return uniqueToError(error);
  }
}

export async function deactivateCourse(input: { tenantId: string; actorUserId: string; id: string }, db: Db = prisma) {
  const course = await db.course.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!course) throw new TrainingError("Curso no encontrado");
  const requirements = await db.trainingRequirement.count({ where: { tenantId: input.tenantId, courseId: course.id } });
  if (requirements > 0) {
    throw new TrainingError(
      `«${course.name}» se exige en ${requirements} ${requirements === 1 ? "lugar" : "lugares"} de la matriz: quitalo de la matriz antes de darlo de baja`,
    );
  }
  await db.course.update({ where: { id: course.id }, data: { active: false, inactiveAt: new Date() } });
  await audit(db, {
    tenantId: input.tenantId,
    entityType: "course",
    entityId: course.id,
    action: "deactivate",
    actorUserId: input.actorUserId,
    summary: `Baja del curso «${course.name}»`,
  });
}

export async function reactivateCourse(input: { tenantId: string; actorUserId: string; id: string }, db: Db = prisma) {
  const course = await db.course.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!course) throw new TrainingError("Curso no encontrado");
  await db.course.update({ where: { id: course.id }, data: { active: true, inactiveAt: null } });
  await audit(db, {
    tenantId: input.tenantId,
    entityType: "course",
    entityId: course.id,
    action: "reactivate",
    actorUserId: input.actorUserId,
    summary: `Reactivación del curso «${course.name}»`,
  });
}

/** Cursos que se pueden importar del catálogo sugerido: los que el cliente no tiene todavía. */
export async function listImportedSuggestions(tenantId: string, db: Db = prisma): Promise<Set<string>> {
  const courses = await db.course.findMany({ where: { tenantId }, select: { name: true, suggestedKey: true }, take: 500 });
  const names = new Set(courses.map((c) => cleanName(c.name).toLowerCase()));
  const keys = new Set(courses.flatMap((c) => (c.suggestedKey ? [c.suggestedKey] : [])));
  const imported = new Set<string>();
  for (const key of keys) imported.add(key);
  // Un curso con el mismo nombre cuenta como ya cargado aunque no venga del catálogo.
  for (const s of SUGGESTED_COURSES) if (names.has(s.course.name.toLowerCase())) imported.add(s.key);
  return imported;
}

/** Importa las plantillas elegidas. Nada se activa solo: son cursos, sin requisitos. */
export async function importSuggestedCourses(
  input: { tenantId: string; actorUserId: string; keys: string[] },
  db: Db = prisma,
) {
  const keys = [...new Set(input.keys)];
  if (keys.length === 0) throw new TrainingError("Elegí al menos un curso del catálogo");
  const templates = keys.map((k) => findSuggested(k));
  if (templates.some((t) => !t)) throw new TrainingError("Hay cursos del catálogo que no existen");

  const already = await listImportedSuggestions(input.tenantId, db);
  const created: string[] = [];
  const skipped: string[] = [];
  for (const template of templates as NonNullable<(typeof templates)[number]>[]) {
    if (already.has(template.key)) {
      skipped.push(template.course.name);
      continue;
    }
    await createCourse({ tenantId: input.tenantId, actorUserId: input.actorUserId, draft: template.course, suggestedKey: template.key }, db);
    created.push(template.course.name);
  }
  if (created.length > 0) {
    await audit(db, {
      tenantId: input.tenantId,
      entityType: "course",
      entityId: "catalog",
      action: "import",
      actorUserId: input.actorUserId,
      summary: `Importación del catálogo sugerido: ${created.length} curso(s)`,
    });
  }
  return { created, skipped };
}

/**
 * Acción explícita: reescribe el vencimiento de los registros aprobados de un curso con su vigencia actual.
 * Solo toca los que se calcularon con la vigencia del curso; los que traen la fecha del certificado quedan igual.
 */
export async function recalculateCourseValidity(
  input: { tenantId: string; actorUserId: string; courseId: string },
  db: Db = prisma,
): Promise<{ updated: number }> {
  const course = await db.course.findFirst({ where: { id: input.courseId, tenantId: input.tenantId } });
  if (!course) throw new TrainingError("Curso no encontrado");
  const months = course.validityMonths;
  const updated = await db.$executeRaw`
    UPDATE "training_record" tr
    SET "validUntil" = CASE WHEN ${months}::int IS NULL THEN NULL ELSE (tr."completedAt" + make_interval(months => ${months}::int))::date END,
        "updatedAt" = now()
    WHERE tr."tenantId" = ${input.tenantId} AND tr."courseId" = ${course.id}
      AND tr."result" = 'passed' AND tr."voidedAt" IS NULL AND tr."validUntilSource" = 'computed'
      AND tr."validUntil" IS DISTINCT FROM
          CASE WHEN ${months}::int IS NULL THEN NULL ELSE (tr."completedAt" + make_interval(months => ${months}::int))::date END`;
  await audit(db, {
    tenantId: input.tenantId,
    entityType: "course",
    entityId: course.id,
    action: "recalculate",
    actorUserId: input.actorUserId,
    summary: `Recálculo de vigencias de «${course.name}» (${months === null ? "no vence" : `${months} meses`}): ${updated} registro(s)`,
  });
  return { updated };
}

// ─── Matriz de requisitos ──────────────────────────────────────────────────

export async function loadMatrix(tenantId: string, db: Db = prisma) {
  const [positions, tasks, courses, requirements] = await Promise.all([
    db.jobPosition.findMany({ where: { tenantId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 500 }),
    db.jobTask.findMany({ where: { tenantId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, critical: true }, take: 500 }),
    listCourses(tenantId, {}, db),
    db.trainingRequirement.findMany({
      where: { tenantId },
      select: { courseId: true, targetKind: true, positionId: true, jobTaskId: true, mandatory: true, graceDays: true },
      take: 10_000,
    }),
  ]);
  return { positions, tasks, courses, requirements };
}

export type ImpactRow = {
  targetKind: MatrixChange["targetKind"];
  targetId: string | null;
  courseId: string;
  /** Personas activas a las que alcanza el cambio. */
  affected: number;
  /** De ellas, las que ya tienen un registro aprobado y no vencido. */
  covered: number;
};

/**
 * Vista previa: a cuántas personas alcanza cada cambio y cuántas ya tienen el curso vigente.
 * Una sola consulta, sin importar cuántos cambios haya; no escribe nada.
 */
export async function previewRequirementImpact(
  input: { tenantId: string; changes: MatrixChange[]; today?: IsoDate },
  db: Db = prisma,
): Promise<ImpactRow[]> {
  const changes = input.changes.filter((c) => c.state !== "none").slice(0, MATRIX_MAX_CHANGES);
  if (changes.length === 0) return [];
  const today = input.today ?? trainingToday(new Date(), DEFAULT_TIME_ZONE);
  const rows = await db.$queryRaw<{ kind: string; targetId: string; courseId: string; affected: number; covered: number }[]>`
    WITH ch AS (
      SELECT * FROM unnest(${changes.map((c) => c.targetKind)}::text[], ${changes.map((c) => c.targetId ?? "")}::text[], ${changes.map((c) => c.courseId)}::text[])
        AS t(kind, target_id, course_id)
    )
    SELECT ch.kind, ch.target_id AS "targetId", ch.course_id AS "courseId",
           count(p."id")::int AS affected,
           count(p."id") FILTER (WHERE EXISTS (
             SELECT 1 FROM "training_record" tr
             WHERE tr."tenantId" = ${input.tenantId} AND tr."personId" = p."id" AND tr."courseId" = ch.course_id
               AND tr."result" = 'passed' AND tr."voidedAt" IS NULL AND tr."completedAt" <= ${today}::date
               AND (tr."validUntil" IS NULL OR tr."validUntil" >= ${today}::date)
           ))::int AS covered
    FROM ch
    LEFT JOIN "person" p ON p."tenantId" = ${input.tenantId} AND p."status" = 'active' AND (
      ch.kind = 'all'
      OR (ch.kind = 'position' AND p."positionId" = ch.target_id)
      OR (ch.kind = 'task' AND EXISTS (SELECT 1 FROM "person_job_task" pt WHERE pt."personId" = p."id" AND pt."jobTaskId" = ch.target_id))
    )
    GROUP BY ch.kind, ch.target_id, ch.course_id`;
  return rows.map((r) => ({
    targetKind: r.kind as ImpactRow["targetKind"],
    targetId: r.targetId === "" ? null : r.targetId,
    courseId: r.courseId,
    affected: r.affected,
    covered: r.covered,
  }));
}

/**
 * Aplica los cambios de celdas: alta, cambio de obligatoriedad o de plazo, o baja (`state: "none"`).
 * Un requisito nuevo (o uno recomendado que pasa a obligatorio) rige desde hoy: el personal existente
 * arranca su plazo de gracia ese día, no queda "faltante" de golpe.
 */
export async function applyRequirementChanges(
  input: { tenantId: string; actorUserId: string; changes: MatrixChange[]; today?: IsoDate },
  db: Db = prisma,
): Promise<{ created: number; updated: number; removed: number }> {
  const { tenantId, changes } = input;
  if (changes.length === 0) return { created: 0, updated: 0, removed: 0 };
  if (changes.length > MATRIX_MAX_CHANGES) throw new TrainingError(`Son demasiados cambios juntos (máximo ${MATRIX_MAX_CHANGES}): guardalos en partes`);
  const today = input.today ?? trainingToday();

  for (const c of changes) {
    if (!["position", "task", "all"].includes(c.targetKind)) throw new TrainingError("Destino inválido");
    if (c.targetKind === "all" ? c.targetId !== null : !c.targetId) throw new TrainingError("Destino inválido");
    if (!Number.isInteger(c.graceDays) || c.graceDays < 0 || c.graceDays > 365) throw new TrainingError("El plazo de gracia va de 0 a 365 días");
    if (!["none", "mandatory", "recommended"].includes(c.state)) throw new TrainingError("Estado inválido");
  }
  const courseIds = [...new Set(changes.map((c) => c.courseId))];
  const positionIds = [...new Set(changes.filter((c) => c.targetKind === "position").map((c) => c.targetId!))];
  const taskIds = [...new Set(changes.filter((c) => c.targetKind === "task").map((c) => c.targetId!))];
  const [courses, positions, tasks] = await Promise.all([
    db.course.findMany({ where: { tenantId, id: { in: courseIds } }, select: { id: true, name: true, active: true } }),
    db.jobPosition.findMany({ where: { tenantId, id: { in: positionIds } }, select: { id: true, name: true, active: true } }),
    db.jobTask.findMany({ where: { tenantId, id: { in: taskIds } }, select: { id: true, name: true, active: true } }),
  ]);
  if (courses.length !== courseIds.length) throw new TrainingError("Algún curso no existe");
  if (positions.length !== positionIds.length) throw new TrainingError("Algún puesto no existe");
  if (tasks.length !== taskIds.length) throw new TrainingError("Alguna tarea no existe");
  const inactive = changes.filter(
    (c) =>
      c.state !== "none" &&
      (!courses.find((x) => x.id === c.courseId)!.active ||
        (c.targetKind === "position" && !positions.find((x) => x.id === c.targetId)!.active) ||
        (c.targetKind === "task" && !tasks.find((x) => x.id === c.targetId)!.active)),
  );
  if (inactive.length > 0) throw new TrainingError("No se puede exigir un curso, puesto o tarea dado de baja");

  const result = { created: 0, updated: 0, removed: 0 };
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.trainingRequirement.findMany({ where: { tenantId, courseId: { in: courseIds } }, take: 10_000 });
      const find = (c: MatrixChange) =>
        existing.find(
          (e) =>
            e.courseId === c.courseId &&
            e.targetKind === c.targetKind &&
            (c.targetKind === "position" ? e.positionId === c.targetId : c.targetKind === "task" ? e.jobTaskId === c.targetId : true),
        );
      const toCreate: Prisma.TrainingRequirementCreateManyInput[] = [];
      const toRemove: string[] = [];
      for (const c of changes) {
        const current = find(c);
        if (c.state === "none") {
          if (current) {
            toRemove.push(current.id);
            result.removed++;
          }
          continue;
        }
        const mandatory = c.state === "mandatory";
        if (!current) {
          toCreate.push({
            tenantId,
            courseId: c.courseId,
            targetKind: c.targetKind,
            positionId: c.targetKind === "position" ? c.targetId : null,
            jobTaskId: c.targetKind === "task" ? c.targetId : null,
            mandatory,
            graceDays: c.graceDays,
            effectiveFrom: dateFromIso(today),
          });
          result.created++;
        } else {
          await tx.trainingRequirement.update({
            where: { id: current.id },
            data: { mandatory, graceDays: c.graceDays, ...(mandatory && !current.mandatory ? { effectiveFrom: dateFromIso(today) } : {}) },
          });
          result.updated++;
        }
      }
      if (toRemove.length) await tx.trainingRequirement.deleteMany({ where: { tenantId, id: { in: toRemove } } });
      if (toCreate.length) await tx.trainingRequirement.createMany({ data: toCreate });

      const name = (c: MatrixChange) => {
        const course = courses.find((x) => x.id === c.courseId)!.name;
        const target =
          c.targetKind === "all"
            ? "todo el personal"
            : c.targetKind === "position"
              ? `puesto ${positions.find((x) => x.id === c.targetId)!.name}`
              : `tarea ${tasks.find((x) => x.id === c.targetId)!.name}`;
        const state = c.state === "none" ? "se quita" : c.state === "mandatory" ? "obligatorio" : "recomendado";
        return `${course} → ${target}: ${state}`;
      };
      const detail = changes.slice(0, 8).map(name).join("; ") + (changes.length > 8 ? `; y ${changes.length - 8} más` : "");
      await audit(tx, {
        tenantId,
        entityType: "requirement",
        entityId: "matrix",
        action: "update",
        actorUserId: input.actorUserId,
        summary: `Matriz de requisitos: ${result.created} alta(s), ${result.updated} cambio(s), ${result.removed} baja(s). ${detail}`,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new TrainingError("Otra persona modificó la matriz al mismo tiempo: recargá la página y volvé a intentar");
    }
    throw error;
  }
  return result;
}

// ─── Sello de revisión de la matriz ────────────────────────────────────────

export async function getTrainingSettings(tenantId: string, db: Db = prisma) {
  return db.trainingSettings.findUnique({ where: { tenantId } });
}

/** Último sello de revisión de la matriz, con el nombre de quien lo registró. */
export async function getMatrixReview(tenantId: string, db: Db = prisma) {
  const settings = await getTrainingSettings(tenantId, db);
  if (!settings?.matrixReviewedAt) return null;
  const reviewer = settings.matrixReviewedByUserId
    ? await db.user.findUnique({ where: { id: settings.matrixReviewedByUserId }, select: { name: true } })
    : null;
  return { reviewedAt: settings.matrixReviewedAt, reviewerName: reviewer?.name ?? null, note: settings.matrixReviewNote ?? "" };
}

/** ISO 45001 §5.4: fecha, quién revisó y quiénes participaron o fueron consultados. */
export async function recordMatrixReview(
  input: { tenantId: string; actorUserId: string; note: string },
  db: Db = prisma,
) {
  const note = input.note.trim();
  if (note.length < 3) throw new TrainingError("Anotá quiénes participaron o fueron consultados en la revisión");
  if (note.length > 2000) throw new TrainingError("La nota es demasiado larga (máximo 2000 caracteres)");
  const now = new Date();
  const settings = await db.trainingSettings.upsert({
    where: { tenantId: input.tenantId },
    create: { tenantId: input.tenantId, matrixReviewedAt: now, matrixReviewedByUserId: input.actorUserId, matrixReviewNote: note },
    update: { matrixReviewedAt: now, matrixReviewedByUserId: input.actorUserId, matrixReviewNote: note },
  });
  await audit(db, {
    tenantId: input.tenantId,
    entityType: "matrix",
    entityId: settings.id,
    action: "review",
    actorUserId: input.actorUserId,
    summary: "Revisión de la matriz de requisitos",
    reason: note,
  });
  return settings;
}
