import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { getTaskQualification, getTaskQualifications, trainingToday } from "@/lib/training";
import { addDays } from "@/domain/training/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("habilitación para una tarea crítica (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const today = trainingToday();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let height = ""; // curso obligatorio de la tarea crítica
  let altura = ""; // tarea crítica
  let libre = ""; // tarea sin requisitos
  let ok = "";
  let expiring = "";
  let expired = "";
  let missing = "";
  let ineffective = "";
  let inGrace = "";
  let inactive = "";
  let foreign = "";

  const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  async function person(tenantId: string, code: string, positionId: string, siteId: string, extra: { status?: "inactive"; hiredAt?: string } = {}) {
    return (
      await db.person.create({
        data: { tenantId, employeeCode: code, name: `Persona ${code}`, siteId, positionId, hiredAt: date(extra.hiredAt ?? "2020-01-01"), ...(extra.status ? { status: extra.status } : {}) },
      })
    ).id;
  }

  async function approve(tenantId: string, personId: string, courseId: string, completed: string, validUntil: string | null) {
    return db.trainingRecord.create({
      data: { tenantId, personId, courseId, completedAt: date(completed), result: "passed", validUntil: validUntil ? date(validUntil) : null },
    });
  }

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `TrainQ ${label}`, slug: `trainq-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    const site = await db.site.create({ data: { tenantId: a, name: "Base" } });
    const position = await db.jobPosition.create({ data: { tenantId: a, name: "Operario" } });
    altura = (await db.jobTask.create({ data: { tenantId: a, name: "Trabajo en altura", critical: true } })).id;
    libre = (await db.jobTask.create({ data: { tenantId: a, name: "Tarea sin cursos", critical: false } })).id;
    height = (await db.course.create({ data: { tenantId: a, name: "Altura", validityMonths: 12, requiresEffectiveness: true, reminderDays: 30 } })).id;
    await db.trainingRequirement.create({
      data: { tenantId: a, courseId: height, targetKind: "task", jobTaskId: altura, mandatory: true, graceDays: 0, effectiveFrom: date("2020-01-01") },
    });

    ok = await person(a, "OK", position.id, site.id);
    expiring = await person(a, "EXP", position.id, site.id);
    expired = await person(a, "VEN", position.id, site.id);
    missing = await person(a, "FAL", position.id, site.id);
    ineffective = await person(a, "INE", position.id, site.id);
    inGrace = await person(a, "GRA", position.id, site.id, { hiredAt: today });
    inactive = await person(a, "BAJA", position.id, site.id, { status: "inactive" });

    await approve(a, ok, height, addDays(today, -30), addDays(today, 335));
    await approve(a, expiring, height, addDays(today, -340), addDays(today, 10));
    await approve(a, expired, height, addDays(today, -400), addDays(today, -35));
    const record = await approve(a, ineffective, height, addDays(today, -30), addDays(today, 335));
    await db.trainingEffectiveness.create({ data: { tenantId: a, recordId: record.id, dueAt: date(addDays(today, -1)), status: "not_effective" } });
    // La que está "en plazo" tiene la tarea asignada hoy con gracia 0 del requisito, pero el curso se exige desde hoy.
    await db.personJobTask.create({ data: { tenantId: a, personId: inGrace, jobTaskId: altura } });
    await db.trainingRequirement.updateMany({ where: { tenantId: a, courseId: height }, data: { graceDays: 0, effectiveFrom: date(today) } });

    const siteB = await db.site.create({ data: { tenantId: b, name: "Otra" } });
    const positionB = await db.jobPosition.create({ data: { tenantId: b, name: "Operario" } });
    foreign = await person(b, "AJ", positionB.id, siteB.id);
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.$disconnect();
  });

  it("habilita a quien tiene el curso vigente o por vencer, e informa los días que le quedan", async () => {
    const q = await getTaskQualifications(a, [ok, expiring], altura, {}, db);
    expect(q?.get(ok)).toMatchObject({ qualified: true, hasRequirements: true, blockers: [] });
    expect(q?.get(expiring)).toMatchObject({ qualified: true });
    expect(q?.get(expiring)?.expiring).toEqual([{ courseId: height, daysToExpiry: 10 }]);
  });

  it("no habilita al vencido, al que le falta el curso, al «no eficaz» ni al que todavía está en plazo", async () => {
    const q = await getTaskQualifications(a, [expired, missing, ineffective, inGrace], altura, { today }, db);
    expect(q?.get(expired)?.blockers).toEqual([{ courseId: height, reason: "expired" }]);
    expect(q?.get(ineffective)?.blockers).toEqual([{ courseId: height, reason: "ineffective" }]);
    expect(q?.get(missing)?.qualified).toBe(false);
    expect(q?.get(inGrace)?.qualified).toBe(false);
  });

  it("una tarea sin cursos obligatorios habilita a todos y lo informa", async () => {
    const q = await getTaskQualifications(a, [ok, missing], libre, {}, db);
    expect(q?.get(missing)).toMatchObject({ qualified: true, hasRequirements: false });
  });

  it("coincide con la consulta de una sola persona y calcula todos juntos", async () => {
    const all = [ok, expiring, expired, missing, ineffective, inGrace];
    const batch = await getTaskQualifications(a, all, altura, { today }, db);
    for (const id of all) {
      expect(await getTaskQualification(a, id, altura, { today }, db)).toEqual(batch?.get(id));
    }
  });

  it("ignora a las personas dadas de baja y a las de otra empresa; la tarea tiene que ser de la empresa", async () => {
    const q = await getTaskQualifications(a, [ok, inactive, foreign], altura, {}, db);
    expect([...(q?.keys() ?? [])]).toEqual([ok]);
    expect(await getTaskQualification(a, foreign, altura, {}, db)).toBeNull();
    expect(await getTaskQualifications(b, [foreign], altura, {}, db)).toBeNull();
    expect(await getTaskQualifications(a, [], altura, {}, db)).toEqual(new Map());
  });
});
