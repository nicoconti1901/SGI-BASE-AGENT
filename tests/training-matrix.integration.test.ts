import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import {
  TrainingError,
  applyRequirementChanges,
  createCourse,
  deactivateCourse,
  getTrainingSettings,
  importSuggestedCourses,
  listCourses,
  listImportedSuggestions,
  previewRequirementImpact,
  recalculateCourseValidity,
  reactivateCourse,
  recordMatrixReview,
  updateCourse,
} from "@/lib/training-config";
import { getPersonTrainingStatus } from "@/lib/training";
import { computeValidUntil } from "@/domain/training/rules";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TODAY = "2026-10-21";
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe.skipIf(!hasDatabase)("capacitaciones: cursos y matriz", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let siteA = "";
  let positionA = "";
  let taskA = "";
  const people: string[] = [];

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Mx ${label}`, slug: `mx-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actor = (await db.user.create({ data: { name: "Mx Admin", email: `mx-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await db.site.create({ data: { tenantId: a, name: "Base" } })).id;
    positionA = (await db.jobPosition.create({ data: { tenantId: a, name: "Operador" } })).id;
    taskA = (await db.jobTask.create({ data: { tenantId: a, name: "Altura", critical: true } })).id;
    for (let i = 0; i < 4; i++) {
      const p = await db.person.create({
        data: { tenantId: a, employeeCode: `${i}`, name: `Persona ${i}`, siteId: siteA, positionId: positionA, hiredAt: utc("2020-01-01") },
      });
      people.push(p.id);
    }
    await db.personJobTask.createMany({ data: people.slice(0, 2).map((personId) => ({ tenantId: a, personId, jobTaskId: taskA, assignedAt: utc("2026-01-01") })) });
  }, 120_000);

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.$disconnect();
  }, 60_000);

  const base = () => ({ tenantId: a, actorUserId: actor });

  it("alta de curso con valores por defecto, nombre único sin importar mayúsculas y aislado por empresa", async () => {
    const course = await createCourse({ ...base(), draft: { name: "Primeros auxilios", validityMonths: 24 } });
    expect(course).toMatchObject({ reminderDays: 30, effectivenessDays: 90, active: true, validityMonths: 24 });
    await expect(createCourse({ ...base(), draft: { name: "PRIMEROS AUXILIOS" } })).rejects.toThrow(/Ya existe/);
    // La otra empresa puede usar el mismo nombre y no ve el curso.
    await expect(createCourse({ tenantId: b, actorUserId: actor, draft: { name: "Primeros auxilios" } })).resolves.toBeTruthy();
    expect((await listCourses(b)).map((c) => c.tenantId)).toEqual([b]);
    // Rangos del SPEC.
    await expect(createCourse({ ...base(), draft: { name: "Mal", validityMonths: 200 } })).rejects.toBeInstanceOf(TrainingError);
    const audits = await db.trainingAudit.count({ where: { tenantId: a, entityType: "course", action: "create" } });
    expect(audits).toBeGreaterThanOrEqual(1);
  });

  it("edita un curso sin tocar a otro tenant", async () => {
    const course = await createCourse({ ...base(), draft: { name: "Curso editable" } });
    const edited = await updateCourse({ ...base(), id: course.id, draft: { name: "Curso editado", validityMonths: 6 } });
    expect(edited).toMatchObject({ name: "Curso editado", validityMonths: 6 });
    await expect(updateCourse({ tenantId: b, actorUserId: actor, id: course.id, draft: { name: "Hackeado" } })).rejects.toThrow(/no encontrado/);
  });

  it("importa del catálogo sugerido sin duplicar y sin crear requisitos", async () => {
    const first = await importSuggestedCourses({ ...base(), keys: ["induccion", "altura"] });
    expect(first.created).toEqual(["Inducción de seguridad al ingreso", "Trabajo en altura"]);
    const again = await importSuggestedCourses({ ...base(), keys: ["induccion", "conciencia"] });
    expect(again.created).toEqual(["Toma de conciencia del sistema de gestión"]);
    expect(again.skipped).toEqual(["Inducción de seguridad al ingreso"]);
    expect([...(await listImportedSuggestions(a))]).toEqual(expect.arrayContaining(["induccion", "altura", "conciencia"]));
    expect(await db.trainingRequirement.count({ where: { tenantId: a } })).toBe(0);
    await expect(importSuggestedCourses({ ...base(), keys: ["no-existe"] })).rejects.toThrow(/no existen/);
    await expect(importSuggestedCourses({ ...base(), keys: [] })).rejects.toBeInstanceOf(TrainingError);
  });

  it("la matriz: alta, cambio de plazo, baja y rechazo de destinos de otra empresa", async () => {
    const altura = await db.course.findFirstOrThrow({ where: { tenantId: a, name: "Trabajo en altura" } });
    const induccion = await db.course.findFirstOrThrow({ where: { tenantId: a, suggestedKey: "induccion" } });

    const created = await applyRequirementChanges({
      ...base(),
      today: TODAY,
      changes: [
        { targetKind: "task", targetId: taskA, courseId: altura.id, state: "mandatory", graceDays: 0 },
        { targetKind: "all", targetId: null, courseId: induccion.id, state: "mandatory", graceDays: 0 },
        { targetKind: "position", targetId: positionA, courseId: altura.id, state: "recommended", graceDays: 30 },
      ],
    });
    expect(created).toEqual({ created: 3, updated: 0, removed: 0 });

    // Repetir lo mismo no duplica (índices únicos parciales + actualización).
    const again = await applyRequirementChanges({
      ...base(),
      today: TODAY,
      changes: [{ targetKind: "task", targetId: taskA, courseId: altura.id, state: "mandatory", graceDays: 0 }],
    });
    expect(again).toEqual({ created: 0, updated: 1, removed: 0 });
    expect(await db.trainingRequirement.count({ where: { tenantId: a, courseId: altura.id, targetKind: "task" } })).toBe(1);

    // Recomendado -> obligatorio reinicia el plazo desde hoy.
    await applyRequirementChanges({
      ...base(),
      today: "2026-11-02",
      changes: [{ targetKind: "position", targetId: positionA, courseId: altura.id, state: "mandatory", graceDays: 10 }],
    });
    const flipped = await db.trainingRequirement.findFirstOrThrow({ where: { tenantId: a, courseId: altura.id, targetKind: "position" } });
    expect(flipped).toMatchObject({ mandatory: true, graceDays: 10 });
    expect(flipped.effectiveFrom.toISOString().slice(0, 10)).toBe("2026-11-02");

    // Un destino o curso de otra empresa se rechaza.
    const otherPosition = await db.jobPosition.create({ data: { tenantId: b, name: "Ajeno" } });
    await expect(
      applyRequirementChanges({ ...base(), changes: [{ targetKind: "position", targetId: otherPosition.id, courseId: altura.id, state: "mandatory", graceDays: 0 }] }),
    ).rejects.toThrow(/puesto no existe/);
    const otherCourse = await db.course.findFirstOrThrow({ where: { tenantId: b } });
    await expect(
      applyRequirementChanges({ ...base(), changes: [{ targetKind: "all", targetId: null, courseId: otherCourse.id, state: "mandatory", graceDays: 0 }] }),
    ).rejects.toThrow(/curso no existe/);

    // Plazo fuera de rango y destino mal formado.
    await expect(
      applyRequirementChanges({ ...base(), changes: [{ targetKind: "all", targetId: null, courseId: altura.id, state: "mandatory", graceDays: 400 }] }),
    ).rejects.toThrow(/0 a 365/);
    await expect(
      applyRequirementChanges({ ...base(), changes: [{ targetKind: "task", targetId: null, courseId: altura.id, state: "mandatory", graceDays: 0 }] }),
    ).rejects.toThrow(/Destino/);

    // Baja.
    const removed = await applyRequirementChanges({
      ...base(),
      changes: [{ targetKind: "position", targetId: positionA, courseId: altura.id, state: "none", graceDays: 0 }],
    });
    expect(removed).toEqual({ created: 0, updated: 0, removed: 1 });
    expect(await db.trainingAudit.count({ where: { tenantId: a, entityType: "requirement" } })).toBeGreaterThanOrEqual(4);
  });

  it("la matriz alimenta el cálculo: tarea crítica sin el curso deja a la persona en falta", async () => {
    const [withTask, withoutTask] = [people[0], people[3]];
    const withStatus = await getPersonTrainingStatus(a, withTask, { today: "2026-12-01" }, db);
    const altura = await db.course.findFirstOrThrow({ where: { tenantId: a, name: "Trabajo en altura" } });
    expect(withStatus?.find((s) => s.courseId === altura.id)?.status).toBe("missing");
    // Sin la tarea, el curso de la tarea no se le exige.
    const other = await getPersonTrainingStatus(a, withoutTask, { today: "2026-12-01" }, db);
    expect(other?.find((s) => s.courseId === altura.id)).toBeUndefined();
  });

  it("la baja de un curso se bloquea si está en la matriz, y se puede reactivar", async () => {
    const altura = await db.course.findFirstOrThrow({ where: { tenantId: a, name: "Trabajo en altura" } });
    await expect(deactivateCourse({ ...base(), id: altura.id })).rejects.toThrow(/se exige en/);
    const free = await db.course.findFirstOrThrow({ where: { tenantId: a, name: "Curso editado" } });
    await deactivateCourse({ ...base(), id: free.id });
    expect((await listCourses(a)).some((c) => c.id === free.id)).toBe(false);
    expect((await listCourses(a, { includeInactive: true })).some((c) => c.id === free.id)).toBe(true);
    await reactivateCourse({ ...base(), id: free.id });
    expect((await listCourses(a)).some((c) => c.id === free.id)).toBe(true);
  });

  it("vista previa del impacto: a cuántos alcanza y cuántos ya lo tienen vigente", async () => {
    const course = await createCourse({ ...base(), draft: { name: "Impacto", validityMonths: 12 } });
    // Dos personas de la tarea: una con el curso vigente y otra con el curso vencido.
    await db.trainingRecord.createMany({
      data: [
        { tenantId: a, personId: people[0], courseId: course.id, completedAt: utc("2026-06-01"), result: "passed", validUntil: utc("2027-06-01") },
        { tenantId: a, personId: people[1], courseId: course.id, completedAt: utc("2025-01-01"), result: "passed", validUntil: utc("2026-01-01") },
        // Anulado: no cuenta.
        { tenantId: a, personId: people[2], courseId: course.id, completedAt: utc("2026-06-01"), result: "passed", validUntil: utc("2027-06-01"), voidedAt: new Date(), voidReason: "error" },
      ],
    });
    const rows = await previewRequirementImpact({
      tenantId: a,
      today: TODAY,
      changes: [
        { targetKind: "task", targetId: taskA, courseId: course.id, state: "mandatory", graceDays: 0 },
        { targetKind: "position", targetId: positionA, courseId: course.id, state: "mandatory", graceDays: 30 },
        { targetKind: "all", targetId: null, courseId: course.id, state: "recommended", graceDays: 30 },
        { targetKind: "task", targetId: taskA, courseId: course.id, state: "none", graceDays: 0 },
      ],
    });
    const byKind = Object.fromEntries(rows.map((r) => [r.targetKind, r]));
    expect(byKind.task).toMatchObject({ affected: 2, covered: 1 });
    expect(byKind.position).toMatchObject({ affected: 4, covered: 1 });
    expect(byKind.all).toMatchObject({ affected: 4, covered: 1 });
    expect(rows).toHaveLength(3); // la baja no tiene impacto que previsualizar
    // La vista previa no escribe.
    expect(await db.trainingRequirement.count({ where: { tenantId: a, courseId: course.id } })).toBe(0);
    // Un puesto de otra empresa no alcanza a nadie de esta.
    const foreign = await db.jobPosition.create({ data: { tenantId: b, name: "Ajeno 2" } });
    const none = await previewRequirementImpact({ tenantId: a, today: TODAY, changes: [{ targetKind: "position", targetId: foreign.id, courseId: course.id, state: "mandatory", graceDays: 0 }] });
    expect(none[0].affected).toBe(0);
  });

  it("cambiar la vigencia del curso no toca los registros hasta ejecutar 'recalcular'", async () => {
    const course = await createCourse({ ...base(), draft: { name: "Vigencia", validityMonths: 12 } });
    const computed = await db.trainingRecord.create({
      data: { tenantId: a, personId: people[0], courseId: course.id, completedAt: utc("2026-01-31"), result: "passed", validUntil: utc("2027-01-31") },
    });
    const certificate = await db.trainingRecord.create({
      data: { tenantId: a, personId: people[1], courseId: course.id, completedAt: utc("2026-01-31"), result: "passed", validUntil: utc("2026-12-15"), validUntilSource: "certificate" },
    });
    const failed = await db.trainingRecord.create({
      data: { tenantId: a, personId: people[2], courseId: course.id, completedAt: utc("2026-01-31"), result: "failed" },
    });

    await updateCourse({ ...base(), id: course.id, draft: { name: "Vigencia", validityMonths: 1 } });
    const untouched = await db.trainingRecord.findUniqueOrThrow({ where: { id: computed.id } });
    expect(untouched.validUntil?.toISOString().slice(0, 10)).toBe("2027-01-31");

    const { updated } = await recalculateCourseValidity({ ...base(), courseId: course.id });
    expect(updated).toBe(1);
    const after = await db.trainingRecord.findUniqueOrThrow({ where: { id: computed.id } });
    // Mismo resultado que la función pura (fin de mes).
    expect(after.validUntil?.toISOString().slice(0, 10)).toBe(computeValidUntil("2026-01-31", 1));
    expect(after.validUntil?.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect((await db.trainingRecord.findUniqueOrThrow({ where: { id: certificate.id } })).validUntil?.toISOString().slice(0, 10)).toBe("2026-12-15");
    expect((await db.trainingRecord.findUniqueOrThrow({ where: { id: failed.id } })).validUntil).toBeNull();
    expect(await db.trainingAudit.count({ where: { tenantId: a, entityType: "course", entityId: course.id, action: "recalculate" } })).toBe(1);
    // Otra empresa no puede recalcular este curso.
    await expect(recalculateCourseValidity({ tenantId: b, actorUserId: actor, courseId: course.id })).rejects.toThrow(/no encontrado/);

    // Sin vigencia, el recálculo deja los vencimientos en blanco.
    await updateCourse({ ...base(), id: course.id, draft: { name: "Vigencia", validityMonths: null } });
    expect((await recalculateCourseValidity({ ...base(), courseId: course.id })).updated).toBe(1);
    expect((await db.trainingRecord.findUniqueOrThrow({ where: { id: computed.id } })).validUntil).toBeNull();
  });

  it("sello de revisión: guarda fecha, quién y nota; exige la nota; es por empresa", async () => {
    expect(await getTrainingSettings(a)).toBeNull();
    await expect(recordMatrixReview({ ...base(), note: " " })).rejects.toBeInstanceOf(TrainingError);
    const s = await recordMatrixReview({ ...base(), note: "Revisada con el delegado de seguridad y el jefe de planta" });
    expect(s).toMatchObject({ matrixReviewedByUserId: actor, matrixReviewNote: "Revisada con el delegado de seguridad y el jefe de planta" });
    expect(s.matrixReviewedAt).toBeInstanceOf(Date);
    const again = await recordMatrixReview({ ...base(), note: "Segunda revisión con el comité" });
    expect(again.id).toBe(s.id);
    expect(await getTrainingSettings(b)).toBeNull();
    expect(await db.trainingAudit.count({ where: { tenantId: a, action: "review" } })).toBe(2);
  });
});
