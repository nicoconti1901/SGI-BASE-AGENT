/**
 * Reglas de capacitaciones (SPEC-training): qué se le exige a cada persona y en qué estado está.
 *
 * Son funciones puras: reciben `today` y no leen la base ni el reloj. La consulta SQL agregada
 * de `src/lib/training.ts` reproduce estas mismas reglas y un test de paridad las compara celda por celda.
 */
import { addDays, addMonths, diffDays, maxIso, minIso, type IsoDate } from "./dates";
import type {
  ComplianceSummary,
  CourseStatus,
  EffectivenessOutcome,
  ResolvedRequirement,
  TaskQualification,
  TaskQualificationBlocker,
  TrainingPerson,
  TrainingRecordInput,
  TrainingRequirement,
  TrainingStatus,
} from "./types";

/** Fecha de vencimiento de un registro: suma de meses con ajuste a fin de mes. Sin vigencia, no vence. */
export function computeValidUntil(completedAt: IsoDate, validityMonths: number | null): IsoDate | null {
  return validityMonths === null ? null : addMonths(completedAt, validityMonths);
}

/** Un requisito rige desde su fecha de vigencia. Antes, todavía no se exige. */
function isInForce(requirement: TrainingRequirement, today: IsoDate): boolean {
  return requirement.effectiveFrom <= today;
}

/** Cuándo termina el plazo de gracia de una fuente: el último día todavía cuenta (inclusivo). */
function graceEndOf(requirement: TrainingRequirement, person: TrainingPerson, sourceSince: IsoDate | null): IsoDate {
  const start = maxIso([person.hiredAt, sourceSince, requirement.effectiveFrom]) as IsoDate;
  return addDays(start, requirement.graceDays);
}

/**
 * Una fila por curso exigido a la persona. Fuentes: su puesto, cada tarea asignada y "todo el personal".
 * Si un curso se exige por varias fuentes: es obligatorio si alguna lo es y rige el plazo más estricto.
 */
export function resolveRequirements(
  person: TrainingPerson,
  requirements: readonly TrainingRequirement[],
  today: IsoDate,
): ResolvedRequirement[] {
  if (!person.active) return [];
  const assigned = new Map(person.tasks.map((t) => [t.jobTaskId, t.assignedAt]));
  const byCourse = new Map<string, { mandatory: boolean; graceEnds: IsoDate[]; reminderDays: number }>();

  for (const r of requirements) {
    if (!isInForce(r, today)) continue;
    let since: IsoDate | null;
    if (r.targetKind === "position") {
      if (r.positionId !== person.positionId) continue;
      since = person.positionSince;
    } else if (r.targetKind === "task") {
      if (r.jobTaskId === null || !assigned.has(r.jobTaskId)) continue;
      since = assigned.get(r.jobTaskId) ?? null;
    } else {
      since = null;
    }
    const entry = byCourse.get(r.courseId) ?? { mandatory: false, graceEnds: [], reminderDays: r.reminderDays };
    if (r.mandatory) {
      entry.mandatory = true;
      entry.graceEnds.push(graceEndOf(r, person, since));
    }
    byCourse.set(r.courseId, entry);
  }

  return [...byCourse.entries()].map(([courseId, e]) => ({
    courseId,
    mandatory: e.mandatory,
    graceEnd: minIso(e.graceEnds),
    reminderDays: e.reminderDays,
  }));
}

/** El mejor registro: aprobado, no anulado, ya realizado, con el mayor vencimiento (sin vencimiento = infinito). */
function bestRecord(records: readonly TrainingRecordInput[], today: IsoDate): TrainingRecordInput | null {
  let best: TrainingRecordInput | null = null;
  for (const r of records) {
    if (r.voided || r.result !== "passed" || r.completedAt > today) continue;
    if (best === null || beats(r, best)) best = r;
  }
  return best;
}

function beats(a: TrainingRecordInput, b: TrainingRecordInput): boolean {
  if (a.validUntil !== b.validUntil) {
    if (a.validUntil === null) return true;
    if (b.validUntil === null) return false;
    return a.validUntil > b.validUntil;
  }
  return a.completedAt > b.completedAt;
}

function effectivenessOf(record: TrainingRecordInput | null): EffectivenessOutcome | null {
  if (!record) return null;
  const e = record.effectiveness;
  if (e === "pending" || e === "effective" || e === "partially_effective" || e === "not_effective") return e;
  return "n/a";
}

/** Último intento (aprobado o no) ya realizado y no anulado. */
function latestAttempt(records: readonly TrainingRecordInput[], today: IsoDate): TrainingRecordInput | null {
  let last: TrainingRecordInput | null = null;
  for (const r of records) {
    if (r.voided || r.completedAt > today) continue;
    if (last === null || r.completedAt > last.completedAt) last = r;
  }
  return last;
}

function evaluate(
  courseId: string,
  required: ResolvedRequirement | null,
  records: readonly TrainingRecordInput[],
  today: IsoDate,
): CourseStatus {
  const best = bestRecord(records, today);
  const attempt = latestAttempt(records, today);
  const mandatory = required?.mandatory ?? false;

  if (!required) {
    return {
      courseId,
      status: "not_required",
      mandatory: false,
      validUntil: best?.validUntil ?? null,
      daysToExpiry: null,
      detail: null,
      effectiveness: effectivenessOf(best),
    };
  }

  if (best) {
    let status: TrainingStatus;
    let daysToExpiry: number | null = null;
    if (best.validUntil === null) status = "valid";
    else {
      daysToExpiry = diffDays(today, best.validUntil);
      if (daysToExpiry < 0) status = "expired";
      else if (daysToExpiry <= required.reminderDays) status = "expiring";
      else status = "valid";
    }
    return {
      courseId,
      status,
      mandatory,
      validUntil: best.validUntil,
      daysToExpiry: daysToExpiry !== null && daysToExpiry >= 0 ? daysToExpiry : null,
      detail: status === "expired" && attempt?.result === "failed" && attempt.completedAt > best.completedAt ? "failed" : null,
      effectiveness: effectivenessOf(best),
    };
  }

  const inGrace = mandatory && required.graceEnd !== null && today <= required.graceEnd;
  return {
    courseId,
    status: inGrace ? "in_grace" : "missing",
    mandatory,
    validUntil: null,
    daysToExpiry: null,
    detail: attempt?.result === "failed" ? "failed" : null,
    effectiveness: null,
  };
}

/**
 * Estado de la persona en cada curso que se le exige, más los cursos con registros que hoy no se exigen
 * (`not_required`: se ven en la ficha como "otros cursos" y no cuentan).
 */
export function computeTrainingStatus(
  person: TrainingPerson,
  requirements: readonly TrainingRequirement[],
  records: readonly TrainingRecordInput[],
  today: IsoDate,
): CourseStatus[] {
  const byCourse = Map.groupBy(records, (r) => r.courseId);
  const required = resolveRequirements(person, requirements, today);
  const result = required.map((r) => evaluate(r.courseId, r, byCourse.get(r.courseId) ?? [], today));
  const requiredIds = new Set(required.map((r) => r.courseId));
  for (const [courseId, courseRecords] of byCourse) {
    if (!requiredIds.has(courseId)) result.push(evaluate(courseId, null, courseRecords, today));
  }
  return result;
}

/**
 * ¿Está habilitada la persona para una tarea? Mira solo los cursos obligatorios de esa tarea:
 * cada uno tiene que estar vigente o por vencer, y su eficacia no puede ser "no eficaz".
 * "En plazo" no habilita. El cálculo no depende de que la tarea esté asignada (`assigned` lo informa).
 */
export function isQualifiedForTask(
  person: TrainingPerson,
  taskId: string,
  requirements: readonly TrainingRequirement[],
  records: readonly TrainingRecordInput[],
  today: IsoDate,
): TaskQualification {
  const assigned = person.tasks.some((t) => t.jobTaskId === taskId);
  const courseIds = new Set(
    requirements
      .filter((r) => r.targetKind === "task" && r.jobTaskId === taskId && r.mandatory && isInForce(r, today))
      .map((r) => r.courseId),
  );
  if (courseIds.size === 0) {
    return { qualified: true, hasRequirements: false, assigned, blockers: [], expiring: [] };
  }

  // Se evalúa como si tuviera la tarea (con su fecha real si la tiene) para que valga su plazo de gracia.
  const asIfAssigned: TrainingPerson = {
    ...person,
    active: true,
    tasks: assigned ? person.tasks : [...person.tasks, { jobTaskId: taskId, assignedAt: null }],
  };
  const statuses = computeTrainingStatus(asIfAssigned, requirements, records, today);
  const blockers: TaskQualificationBlocker[] = [];
  const expiring: TaskQualification["expiring"] = [];
  for (const courseId of courseIds) {
    const s = statuses.find((x) => x.courseId === courseId);
    if (!s || s.status === "missing") blockers.push({ courseId, reason: "missing" });
    else if (s.status === "expired") blockers.push({ courseId, reason: "expired" });
    else if (s.status === "in_grace") blockers.push({ courseId, reason: "in_grace" });
    else if (s.effectiveness === "not_effective") blockers.push({ courseId, reason: "ineffective" });
    else if (s.status === "expiring" && s.daysToExpiry !== null) expiring.push({ courseId, daysToExpiry: s.daysToExpiry });
  }
  return { qualified: blockers.length === 0, hasRequirements: true, assigned, blockers, expiring };
}

/**
 * % de cumplimiento = (vigentes + por vencer) / (vigentes + por vencer + vencidos + faltantes + en plazo),
 * solo de lo obligatorio. "En plazo" suma al denominador y se informa aparte.
 */
export function summarizeCompliance(
  statuses: readonly { status: TrainingStatus; mandatory: boolean }[],
): ComplianceSummary {
  const out = { valid: 0, expiring: 0, expired: 0, missing: 0, inGrace: 0 };
  for (const s of statuses) {
    if (!s.mandatory) continue;
    if (s.status === "valid") out.valid++;
    else if (s.status === "expiring") out.expiring++;
    else if (s.status === "expired") out.expired++;
    else if (s.status === "missing") out.missing++;
    else if (s.status === "in_grace") out.inGrace++;
  }
  const total = out.valid + out.expiring + out.expired + out.missing + out.inGrace;
  const percent = total === 0 ? null : Math.round(((out.valid + out.expiring) / total) * 100);
  return { percent, ...out, total };
}
