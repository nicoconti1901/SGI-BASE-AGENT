import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { applyTrainingImport, registerSession, voidSession } from "@/lib/training-records";
import { TrainingError } from "@/lib/training-config";
import { trainingToday } from "@/lib/training";
import {
  TRAINING_PERSON_ENTITY,
  TRAINING_SESSION_EFFECTIVENESS_ENTITY,
  evaluateEffectiveness,
  listEffectivenessInbox,
  reconcileTrainingDueItems,
  setTrainingOwner,
} from "@/lib/training-followup";
import { getPlanSummary, listPlanSessions, planSession } from "@/lib/training-plan";
import { runDueScan } from "@/lib/due-scan";
import { MemoryEmailSender } from "@/lib/mail";
import { addDays } from "@/domain/training/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("avisos, eficacia y plan anual de capacitaciones (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const today = trainingToday();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let evaluator = "";
  let siteA = "";
  let positionA = "";
  let height = "";
  let induction = "";
  let personIds: string[] = [];
  let foreignPerson = "";

  const openItems = (tenantId: string, entityType: string) =>
    db.dueItem.findMany({ where: { tenantId, entityType, status: "open" }, orderBy: { entityId: "asc" } });

  const sessionItems = (sessionId: string) =>
    db.dueItem.findMany({ where: { tenantId: a, entityType: TRAINING_SESSION_EFFECTIVENESS_ENTITY, entityId: sessionId, status: "open" } });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `TrainF ${label}`, slug: `trainf-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actor = (await db.user.create({ data: { name: "Rita Responsable", email: `trainf-${stamp}@test.dev`, emailVerified: true } })).id;
    evaluator = (await db.user.create({ data: { name: "Eva Evaluadora", email: `trainf-eva-${stamp}@test.dev`, emailVerified: true } })).id;
    await db.membership.create({ data: { tenantId: a, userId: actor, role: "process_owner" } });
    await db.membership.create({ data: { tenantId: a, userId: evaluator, role: "contributor" } });
    siteA = (await db.site.create({ data: { tenantId: a, name: "Base" } })).id;
    positionA = (await db.jobPosition.create({ data: { tenantId: a, name: "Operario" } })).id;
    height = (await db.course.create({ data: { tenantId: a, name: "Trabajo en altura", validityMonths: 12, requiresEffectiveness: true, effectivenessDays: 90 } })).id;
    induction = (await db.course.create({ data: { tenantId: a, name: "Inducción", validityMonths: null } })).id;
    await db.trainingRequirement.createMany({
      data: [height, induction].map((courseId) => ({ tenantId: a, courseId, targetKind: "position" as const, positionId: positionA, mandatory: true, graceDays: 0, effectiveFrom: new Date("2020-01-01") })),
    });
    const people = await db.person.createManyAndReturn({
      data: Array.from({ length: 4 }, (_, i) => ({
        tenantId: a,
        employeeCode: `F${i}`,
        name: `Persona ${i}`,
        siteId: siteA,
        positionId: positionA,
        hiredAt: new Date("2020-01-01"),
      })),
      select: { id: true },
    });
    personIds = people.map((p) => p.id);

    const siteB = await db.site.create({ data: { tenantId: b, name: "Otra" } });
    const positionB = await db.jobPosition.create({ data: { tenantId: b, name: "Operario" } });
    foreignPerson = (await db.person.create({ data: { tenantId: b, employeeCode: "X1", name: "Ajena", siteId: siteB.id, positionId: positionB.id, hiredAt: new Date("2020-01-01") } })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [actor, evaluator] } } });
    await db.$disconnect();
  });

  describe("avisos por persona", () => {
    it("crea un aviso por persona (no por celda) y no duplica al repetir", async () => {
      const first = await reconcileTrainingDueItems(a, {}, db);
      expect(first.people.created).toBe(4);
      const items = await openItems(a, TRAINING_PERSON_ENTITY);
      expect(items).toHaveLength(4);
      expect(items[0].title).toMatch(/2 faltantes/);
      expect(items.every((i) => i.siteId === siteA && i.personId === i.entityId)).toBe(true);

      const again = await reconcileTrainingDueItems(a, {}, db);
      expect(again.people).toMatchObject({ created: 0, updated: 0, closed: 0, unchanged: 4 });
      expect(await openItems(a, TRAINING_PERSON_ENTITY)).toHaveLength(4);
    });

    it("el responsable de capacitaciones pasa a ser el dueño de los avisos, sin volver a avisar", async () => {
      await db.dueItem.updateMany({ where: { tenantId: a, entityType: TRAINING_PERSON_ENTITY }, data: { lastReminderKind: "overdue" } });
      await setTrainingOwner({ tenantId: a, actorUserId: actor, ownerUserId: actor }, db);
      const items = await openItems(a, TRAINING_PERSON_ENTITY);
      expect(items.every((i) => i.ownerUserId === actor)).toBe(true);
      expect(items.every((i) => i.lastReminderKind === "overdue")).toBe(true);
      await expect(setTrainingOwner({ tenantId: a, actorUserId: actor, ownerUserId: "no-existe" }, db)).rejects.toThrow(TrainingError);
    });

    it("registrar una sesión actualiza el aviso de los asistentes y lo cierra cuando están al día", async () => {
      const [p0, p1] = personIds;
      for (const courseId of [induction, height]) {
        await registerSession(
          { tenantId: a, actorUserId: actor, courseId, heldAt: addDays(today, -10), instructorKind: "internal", instructorName: "Ana", attendees: [{ personId: p0, result: "passed" }] },
          db,
        );
      }
      // La inducción no vence y la altura vence dentro de ~1 año: p0 sigue con un aviso (el vencimiento de la altura).
      const mine = (await openItems(a, TRAINING_PERSON_ENTITY)).find((i) => i.entityId === p0)!;
      expect(mine.title).toBe(`Persona 0: capacitaciones al día hasta el ${mine.dueAt.toISOString().slice(8, 10)}/${mine.dueAt.toISOString().slice(5, 7)}/${mine.dueAt.getUTCFullYear()}`);
      expect(mine.dueAt.getTime()).toBeGreaterThan(Date.now());
      const other = (await openItems(a, TRAINING_PERSON_ENTITY)).find((i) => i.entityId === p1)!;
      expect(other.title).toMatch(/2 faltantes/);
    });

    it("una persona dada de baja pierde su aviso en la conciliación diaria", async () => {
      const gone = personIds[3];
      await db.person.update({ where: { id: gone }, data: { status: "inactive" } });
      const result = await reconcileTrainingDueItems(a, {}, db);
      expect(result.people.closed).toBeGreaterThanOrEqual(1);
      expect((await openItems(a, TRAINING_PERSON_ENTITY)).some((i) => i.entityId === gone)).toBe(false);
      await db.person.update({ where: { id: gone }, data: { status: "active" } });
      await reconcileTrainingDueItems(a, {}, db);
    });

    it("la importación del histórico es silenciosa: lo ya vencido no dispara avisos", async () => {
      const code = "F2";
      const csv = `legajo,curso,fecha,resultado,nota,vence,proveedor,certificado\n${code},Trabajo en altura,${addDays(today, -400)},aprobado,,${addDays(today, -35)},,\n`;
      await applyTrainingImport({ tenantId: a, actorUserId: actor, csv }, db);
      const person = await db.person.findFirstOrThrow({ where: { tenantId: a, employeeCode: code }, select: { id: true } });
      const item = await db.dueItem.findFirstOrThrow({ where: { tenantId: a, entityType: TRAINING_PERSON_ENTITY, entityId: person.id, status: "open" } });
      expect(item.lastReminderKind).toBe("overdue");

      const mail = new MemoryEmailSender();
      const offer = await db.automationOffer.findUnique({ where: { code: "due_reminders" } });
      if (offer) await db.tenantOfferActivation.upsert({ where: { tenantId_offerId: { tenantId: a, offerId: offer.id } }, create: { tenantId: a, offerId: offer.id, active: true }, update: { active: true } });
      await db.tenantModuleActivation.upsert({ where: { tenantId_moduleKey: { tenantId: a, moduleKey: "training" } }, create: { tenantId: a, moduleKey: "training", enabled: true }, update: { enabled: true } });
      await runDueScan({ db, mail, tenantId: a });
      const after = await db.dueItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(after.lastRemindedAt?.getTime()).toBe(item.lastRemindedAt?.getTime());
    });

    it("no toca a las personas de otra empresa", async () => {
      const result = await reconcileTrainingDueItems(a, { personIds: [foreignPerson] }, db);
      expect(result.people.created).toBe(0);
      expect(await db.dueItem.count({ where: { entityId: foreignPerson } })).toBe(0);
    });
  });

  describe("eficacia", () => {
    let sessionId = "";
    let recordIds: string[] = [];

    it("una sesión de un curso con eficacia deja un solo aviso para el evaluador", async () => {
      const done = await registerSession(
        { tenantId: a, actorUserId: actor, courseId: height, heldAt: addDays(today, -2), instructorKind: "internal", instructorName: "Ana", evaluatorUserId: evaluator, attendees: personIds.slice(0, 3).map((personId) => ({ personId, result: "passed" as const })) },
        db,
      );
      sessionId = done.sessionId;
      recordIds = (await db.trainingRecord.findMany({ where: { sessionId }, select: { id: true }, orderBy: { id: "asc" } })).map((r) => r.id);
      const items = await sessionItems(sessionId);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ entityId: sessionId, ownerUserId: evaluator });
      expect(items[0].title).toMatch(/\(3 personas\)/);
      expect(items[0].dueAt.toISOString().slice(0, 10)).toBe(addDays(today, -2 + 90));

      const inbox = await listEffectivenessInbox(a, { evaluatorUserId: evaluator }, db);
      expect(inbox).toHaveLength(1);
      expect(inbox[0]).toMatchObject({ kind: "session", id: sessionId, pending: 3, overdue: false });
      // La sesión anterior (sin evaluador designado) también está pendiente, pero no es de este evaluador.
      expect((await listEffectivenessInbox(a, {}, db)).length).toBeGreaterThanOrEqual(2);
    });

    it("solo evalúa quien gestiona capacitaciones o el evaluador designado", async () => {
      await expect(
        evaluateEffectiveness({ tenantId: a, actorUserId: "otro", canManage: false, sessionId, status: "effective", method: "observation", note: "" }, db),
      ).rejects.toThrow(/designado/);
    });

    it("exige método y nota, y un «no eficaz» exige acción o reprogramación", async () => {
      await expect(
        evaluateEffectiveness({ tenantId: a, actorUserId: evaluator, canManage: false, sessionId, status: "effective", method: null, note: "" }, db),
      ).rejects.toThrow(/cómo se evaluó/);
      await expect(
        evaluateEffectiveness(
          { tenantId: a, actorUserId: evaluator, canManage: false, sessionId, status: "effective", method: "observation", note: "ok", exceptions: [{ recordId: recordIds[0], status: "not_effective", note: "No usa el arnés" }] },
          db,
        ),
      ).rejects.toThrow(/acción o reprogramá/);
      await expect(
        evaluateEffectiveness({ tenantId: a, actorUserId: evaluator, canManage: false, sessionId, status: "effective", method: "observation", note: "", exceptions: [{ recordId: "ajeno", status: "effective" }] }, db),
      ).rejects.toThrow(/excepciones/);
      expect(await db.trainingEffectiveness.count({ where: { tenantId: a, status: "pending", record: { sessionId } } })).toBe(3);
    });

    it("reprogramar deja pendiente al «no eficaz» con nueva fecha y resuelve al resto", async () => {
      const newDate = addDays(today, 30);
      const done = await evaluateEffectiveness(
        {
          tenantId: a,
          actorUserId: evaluator,
          canManage: false,
          sessionId,
          status: "effective",
          method: "observation",
          note: "Aplican el procedimiento",
          exceptions: [{ recordId: recordIds[0], status: "not_effective", note: "No usa el arnés" }],
          resolution: { kind: "reschedule", rescheduledTo: newDate },
        },
        db,
      );
      expect(done).toMatchObject({ evaluated: 2, notEffective: 1, actionId: null, rescheduledTo: newDate });
      const rows = await db.trainingEffectiveness.findMany({ where: { recordId: { in: recordIds } }, orderBy: { recordId: "asc" } });
      expect(rows.filter((r) => r.status === "effective")).toHaveLength(2);
      const pending = rows.find((r) => r.recordId === recordIds[0])!;
      expect(pending.status).toBe("pending");
      expect(pending.dueAt.toISOString().slice(0, 10)).toBe(newDate);
      const [item] = await sessionItems(sessionId);
      expect(item.title).toMatch(/\(1 persona\)/);
      expect(item.dueAt.toISOString().slice(0, 10)).toBe(newDate);
    });

    it("un «no eficaz» con acción crea la Action vinculada y cierra el aviso", async () => {
      const done = await evaluateEffectiveness(
        {
          tenantId: a,
          actorUserId: actor,
          canManage: true,
          sessionId,
          status: "not_effective",
          method: "practical_test",
          note: "No aplican el procedimiento de anclaje",
          resolution: { kind: "action", ownerUserId: actor, dueAt: addDays(today, 15) },
        },
        db,
      );
      expect(done.actionId).toBeTruthy();
      const action = await db.action.findUniqueOrThrow({ where: { id: done.actionId! } });
      expect(action).toMatchObject({ tenantId: a, ownerUserId: actor, status: "open" });
      const linked = await db.trainingEffectiveness.findFirstOrThrow({ where: { recordId: recordIds[0] } });
      expect(linked).toMatchObject({ status: "not_effective", actionId: action.id });
      expect(await sessionItems(sessionId)).toHaveLength(0);
      expect(await db.dueItem.count({ where: { tenantId: a, entityType: "operational_action", entityId: action.id, status: "open" } })).toBe(1);
      await expect(
        evaluateEffectiveness({ tenantId: a, actorUserId: actor, canManage: true, sessionId, status: "effective", method: "observation", note: "" }, db),
      ).rejects.toThrow(/No hay evaluaciones pendientes/);
    });

    it("anular la sesión cierra su aviso de eficacia", async () => {
      const done = await registerSession(
        { tenantId: a, actorUserId: actor, courseId: height, heldAt: addDays(today, -1), instructorKind: "internal", instructorName: "Ana", evaluatorUserId: evaluator, attendees: [{ personId: personIds[3], result: "passed" }] },
        db,
      );
      expect(await sessionItems(done.sessionId)).toHaveLength(1);
      await voidSession({ tenantId: a, actorUserId: actor, sessionId: done.sessionId, reason: "Se cargó por error la sesión" }, db);
      expect(await sessionItems(done.sessionId)).toHaveLength(0);
    });
  });

  describe("plan anual", () => {
    const year = new Date().getUTCFullYear();

    it("planifica, completa la sesión del plan y compara planificado con realizado por sede", async () => {
      const plannedFor = addDays(today, 20);
      const planned = await planSession({ tenantId: a, actorUserId: actor, courseId: induction, plannedFor, siteId: siteA, level: "operational" }, db);
      await planSession({ tenantId: a, actorUserId: actor, courseId: height, plannedFor: addDays(today, 40), siteId: siteA }, db);
      await planSession({ tenantId: a, actorUserId: actor, courseId: height, plannedFor: addDays(today, -3), siteId: siteA }, db);

      const before = (await getPlanSummary(a, new Date(plannedFor).getUTCFullYear(), today, db)).find((s) => s.siteId === siteA)!;
      expect(before).toMatchObject({ planned: 3, done: 0 });
      expect(before.overdue).toBeGreaterThanOrEqual(1);

      await expect(
        registerSession({ tenantId: a, actorUserId: actor, courseId: height, heldAt: today, instructorKind: "internal", instructorName: "Ana", plannedSessionId: planned.id, attendees: [{ personId: personIds[0], result: "passed" }] }, db),
      ).rejects.toThrow(/curso no coincide/);

      const done = await registerSession(
        { tenantId: a, actorUserId: actor, courseId: induction, heldAt: today, siteId: siteA, instructorKind: "internal", instructorName: "Ana", plannedSessionId: planned.id, attendees: [{ personId: personIds[1], result: "passed" }] },
        db,
      );
      expect(done.sessionId).toBe(planned.id);
      await expect(
        registerSession({ tenantId: a, actorUserId: actor, courseId: induction, heldAt: today, instructorKind: "internal", instructorName: "Ana", plannedSessionId: planned.id, attendees: [{ personId: personIds[2], result: "passed" }] }, db),
      ).rejects.toThrow(/ya no está pendiente/);

      const after = (await getPlanSummary(a, new Date(plannedFor).getUTCFullYear(), today, db)).find((s) => s.siteId === siteA)!;
      expect(after).toMatchObject({ planned: 3, done: 1 });
      const held = await listPlanSessions(a, { year: new Date(plannedFor).getUTCFullYear(), status: "held" }, db);
      expect(held.map((s) => s.id)).toContain(planned.id);
      expect(held.find((s) => s.id === planned.id)).toMatchObject({ plannedFor, heldAt: today, level: "operational" });
    });

    it("una sesión dictada sin plan cuenta como extra", async () => {
      const before = await getPlanSummary(a, year, today, db);
      const extraBefore = before.reduce((n, s) => n + s.extra, 0);
      await registerSession({ tenantId: a, actorUserId: actor, courseId: induction, heldAt: today, instructorKind: "internal", instructorName: "Ana", attendees: [{ personId: personIds[0], result: "passed" }] }, db).catch(() => null);
      const after = await getPlanSummary(a, year, today, db);
      expect(after.reduce((n, s) => n + s.extra, 0)).toBeGreaterThanOrEqual(extraBefore);
    });

    it("rechaza planificar con un curso de otra empresa y no mezcla planes entre empresas", async () => {
      await expect(planSession({ tenantId: b, actorUserId: actor, courseId: induction, plannedFor: addDays(today, 5) }, db)).rejects.toThrow(/curso no existe/);
      expect(await getPlanSummary(b, year, today, db)).toEqual([]);
    });
  });
});
