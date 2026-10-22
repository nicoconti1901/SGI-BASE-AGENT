import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { MemoryObjectStorage } from "@/lib/storage/types";
import {
  addIndividualRecord,
  applyTrainingImport,
  listAttendeeCandidates,
  listPersonRecords,
  listSessions,
  previewTrainingImport,
  readTrainingAttachment,
  registerSession,
  uploadTrainingAttachment,
  voidRecord,
  voidSession,
} from "@/lib/training-records";
import { TrainingError } from "@/lib/training-config";
import {
  exportComplianceBatches,
  getComplianceBySite,
  getExpiryBuckets,
  getMatrixPage,
  getPersonTrainingStatus,
  getTopMissingCourses,
  trainingToday,
} from "@/lib/training";
import { addDays } from "@/domain/training/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("registro y seguimiento de capacitaciones (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const today = trainingToday();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let siteA = "";
  let siteB = "";
  let positionA = "";
  let height = ""; // curso con vigencia de 12 meses y eficacia
  let induction = ""; // curso que no vence
  let personIds: string[] = [];
  let foreignPerson = "";

  const attendees = (ids: string[], result: "passed" | "failed" = "passed") => ids.map((personId) => ({ personId, result }));
  const session = (over: Partial<Parameters<typeof registerSession>[0]> = {}) =>
    registerSession({
      tenantId: a,
      actorUserId: actor,
      courseId: height,
      heldAt: addDays(today, -5),
      instructorKind: "internal",
      instructorName: "Ana Instructora",
      attendees: attendees(personIds.slice(0, 3)),
      ...over,
    });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `TrainR ${label}`, slug: `trainr-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    actor = (await db.user.create({ data: { name: "Rita Registra", email: `trainr-${stamp}@test.dev`, emailVerified: true } })).id;
    await db.membership.create({ data: { tenantId: a, userId: actor, role: "process_owner" } });
    siteA = (await db.site.create({ data: { tenantId: a, name: "Base" } })).id;
    siteB = (await db.site.create({ data: { tenantId: a, name: "Norte" } })).id;
    positionA = (await db.jobPosition.create({ data: { tenantId: a, name: "Operario" } })).id;
    height = (await db.course.create({ data: { tenantId: a, name: "Trabajo en altura", code: "ALT-01", validityMonths: 12, requiresEffectiveness: true, effectivenessDays: 90 } })).id;
    induction = (await db.course.create({ data: { tenantId: a, name: "Inducción", validityMonths: null } })).id;
    await db.trainingRequirement.createMany({
      data: [height, induction].map((courseId) => ({ tenantId: a, courseId, targetKind: "position" as const, positionId: positionA, mandatory: true, graceDays: 0, effectiveFrom: new Date("2020-01-01") })),
    });
    const people = await db.person.createManyAndReturn({
      data: Array.from({ length: 12 }, (_, i) => ({
        tenantId: a,
        employeeCode: `R${i}`,
        name: `Persona ${String(i).padStart(2, "0")}`,
        siteId: i < 8 ? siteA : siteB,
        positionId: positionA,
        hiredAt: new Date("2020-01-01"),
        ...(i === 11 ? { status: "inactive" as const } : {}),
      })),
      select: { id: true },
    });
    personIds = people.map((p) => p.id);
    const otherSite = await db.site.create({ data: { tenantId: b, name: "Otra" } });
    const otherPosition = await db.jobPosition.create({ data: { tenantId: b, name: "Otro puesto" } });
    foreignPerson = (await db.person.create({ data: { tenantId: b, employeeCode: "X1", name: "Ajena", siteId: otherSite.id, positionId: otherPosition.id } })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.$disconnect();
  });

  describe("sesión con asistentes", () => {
    it("crea un registro por asistente con el vencimiento del curso y la eficacia pendiente de los aprobados", async () => {
      const ids = personIds.slice(0, 10);
      const result = await session({ attendees: [...attendees(ids.slice(0, 9)), { personId: ids[9], result: "failed", score: 40 }], evaluatorUserId: actor, siteId: siteA });
      expect(result.records).toBe(10);

      const records = await db.trainingRecord.findMany({ where: { sessionId: result.sessionId }, include: { effectiveness: true } });
      expect(records).toHaveLength(10);
      const passed = records.filter((r) => r.result === "passed");
      expect(passed.every((r) => r.validUntil?.toISOString().slice(0, 10) === addDays(today, -5).replace(/^(\d{4})-/, (_, y) => `${Number(y) + 1}-`))).toBe(true);
      expect(passed.every((r) => r.effectiveness?.status === "pending" && r.effectiveness.evaluatorUserId === actor)).toBe(true);
      const failed = records.find((r) => r.result === "failed")!;
      expect(failed).toMatchObject({ validUntil: null, score: 40, source: "session" });
      expect(failed.effectiveness).toBeNull();

      const status = await getPersonTrainingStatus(a, ids[0], { today });
      expect(status!.find((s) => s.courseId === height)).toMatchObject({ status: "valid", mandatory: true });
      expect((await getPersonTrainingStatus(a, ids[9], { today }))!.find((s) => s.courseId === height)).toMatchObject({ status: "missing", detail: "failed" });
    });

    it("repetir el mismo registro no duplica: se rechaza", async () => {
      const again = personIds.slice(0, 2);
      await expect(session({ attendees: attendees(again) })).rejects.toThrow("ya tiene registrado");
      expect(await db.trainingRecord.count({ where: { tenantId: a, personId: { in: again }, courseId: height, voidedAt: null } })).toBe(1 * again.length);
    });

    it("valida fecha, asistentes, personas y curso", async () => {
      await expect(session({ heldAt: addDays(today, 3) })).rejects.toThrow("futura");
      await expect(session({ attendees: [] })).rejects.toThrow("al menos un asistente");
      await expect(session({ attendees: attendees([personIds[0], personIds[0]]) })).rejects.toThrow("repetida");
      await expect(session({ attendees: attendees([foreignPerson]) })).rejects.toThrow("no existe o está dada de baja");
      await expect(session({ attendees: attendees([personIds[11]]) })).rejects.toThrow("no existe o está dada de baja"); // inactiva
      await expect(session({ instructorName: " " })).rejects.toThrow("quién dictó");
      await expect(session({ attendees: [{ personId: personIds[5], result: "passed", score: 140 }] })).rejects.toThrow("nota");
      await expect(session({ evaluatorUserId: "no-es-miembro" })).rejects.toThrow("no pertenece");
      await expect(session({ siteId: "no-existe" })).rejects.toThrow("sede");
      const inactive = await db.course.create({ data: { tenantId: a, name: `Baja ${stamp}`, active: false } });
      await expect(session({ courseId: inactive.id })).rejects.toThrow("dado de baja");
      await expect(registerSession({ tenantId: b, actorUserId: actor, courseId: height, heldAt: addDays(today, -1), instructorKind: "internal", instructorName: "Otra", attendees: attendees([foreignPerson]) })).rejects.toThrow("curso no existe");
    });
  });

  describe("carga individual", () => {
    it("un certificado trae su propio vencimiento", async () => {
      const due = addDays(today, 200);
      const { id } = await addIndividualRecord({ tenantId: a, actorUserId: actor, personId: personIds[6], courseId: height, completedAt: addDays(today, -30), result: "passed", validUntil: due, certificateNumber: "C-123", providerName: "Seguridad SA" });
      const record = await db.trainingRecord.findUniqueOrThrow({ where: { id }, include: { effectiveness: true } });
      expect(record).toMatchObject({ source: "individual", validUntilSource: "certificate", certificateNumber: "C-123" });
      expect(record.validUntil?.toISOString().slice(0, 10)).toBe(due);
      expect(record.effectiveness?.status).toBe("pending");
    });

    it("sin vencimiento del certificado usa la vigencia del curso; un curso que no vence no tiene fecha", async () => {
      const { id } = await addIndividualRecord({ tenantId: a, actorUserId: actor, personId: personIds[6], courseId: induction, completedAt: addDays(today, -400), result: "passed" });
      expect((await db.trainingRecord.findUniqueOrThrow({ where: { id } })).validUntil).toBeNull();
    });

    it("rechaza un vencimiento anterior, uno en un reprobado y una fecha futura", async () => {
      const base = { tenantId: a, actorUserId: actor, personId: personIds[7], courseId: height };
      await expect(addIndividualRecord({ ...base, completedAt: addDays(today, -10), result: "passed", validUntil: addDays(today, -20) })).rejects.toThrow("anterior");
      await expect(addIndividualRecord({ ...base, completedAt: addDays(today, -10), result: "failed", validUntil: addDays(today, 20) })).rejects.toThrow("aprobada");
      await expect(addIndividualRecord({ ...base, completedAt: addDays(today, 1), result: "passed" })).rejects.toThrow("futura");
      await expect(addIndividualRecord({ ...base, personId: foreignPerson, completedAt: addDays(today, -1), result: "passed" })).rejects.toThrow("no existe o está dada de baja");
    });
  });

  describe("anulación con motivo", () => {
    it("un registro anulado sale del cálculo y queda en el historial con el motivo", async () => {
      const person = personIds[8];
      const { id } = await addIndividualRecord({ tenantId: a, actorUserId: actor, personId: person, courseId: induction, completedAt: addDays(today, -2), result: "passed" });
      expect((await getPersonTrainingStatus(a, person, { today }))!.find((s) => s.courseId === induction)!.status).toBe("valid");

      await expect(voidRecord({ tenantId: a, actorUserId: actor, recordId: id, reason: "corto" })).rejects.toThrow("motivo");
      await expect(voidRecord({ tenantId: b, actorUserId: actor, recordId: id, reason: "Intento desde otra empresa" })).rejects.toThrow("no encontrado");
      await voidRecord({ tenantId: a, actorUserId: actor, recordId: id, reason: "Se cargó a la persona equivocada" });
      await expect(voidRecord({ tenantId: a, actorUserId: actor, recordId: id, reason: "Segundo intento de anular" })).rejects.toThrow("ya está anulado");

      expect((await getPersonTrainingStatus(a, person, { today }))!.find((s) => s.courseId === induction)!.status).toBe("missing");
      const history = await listPersonRecords(a, person);
      expect(history.find((h) => h.id === id)).toMatchObject({ voidReason: "Se cargó a la persona equivocada", voidedByUserId: actor });
    });

    it("anular una sesión anula todos sus registros", async () => {
      const ids = personIds.slice(3, 6);
      const { sessionId } = await session({ courseId: induction, attendees: attendees(ids) });
      const out = await voidSession({ tenantId: a, actorUserId: actor, sessionId, reason: "La sesión nunca se dictó" });
      expect(out.voidedRecords).toBe(3);
      expect(await db.trainingRecord.count({ where: { sessionId, voidedAt: null } })).toBe(0);
      expect(await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId } })).toMatchObject({ status: "cancelled", voidReason: "La sesión nunca se dictó" });
      await expect(voidSession({ tenantId: a, actorUserId: actor, sessionId, reason: "Otra vez lo mismo, sí" })).rejects.toThrow("ya está anulada");
      // Se puede volver a cargar la misma gente ese día: los anulados no cuentan.
      await expect(session({ courseId: induction, attendees: attendees(ids) })).resolves.toBeTruthy();
    });
  });

  describe("adjuntos", () => {
    it("guarda la planilla firmada de una sesión y se puede leer; solo PDF, JPG o PNG", async () => {
      const { sessionId } = await session({ courseId: height, heldAt: addDays(today, -40), attendees: attendees([personIds[9]]) });
      const file = await uploadTrainingAttachment({ tenantId: a, actorUserId: actor, target: { sessionId }, fileName: "planilla firmada.pdf", contentType: "application/pdf", body: Buffer.from("%PDF-1.4"), storage });
      expect(file.storageKey).toContain(`tenants/${a}/training/${sessionId}/`);
      const read = await readTrainingAttachment(file.id, { storage });
      expect(read?.body.toString()).toBe("%PDF-1.4");

      await expect(uploadTrainingAttachment({ tenantId: a, actorUserId: actor, target: { sessionId }, fileName: "virus.exe", contentType: "application/octet-stream", body: Buffer.from("x"), storage })).rejects.toThrow("PDF, JPG o PNG");
      await expect(uploadTrainingAttachment({ tenantId: a, actorUserId: actor, target: { sessionId }, fileName: "vacio.pdf", contentType: "application/pdf", body: Buffer.alloc(0), storage })).rejects.toThrow("vacío");
      await expect(uploadTrainingAttachment({ tenantId: b, actorUserId: actor, target: { sessionId }, fileName: "x.pdf", contentType: "application/pdf", body: Buffer.from("x"), storage })).rejects.toThrow("No se encontró");
    });

    it("no se adjunta a algo anulado", async () => {
      const { id } = await addIndividualRecord({ tenantId: a, actorUserId: actor, personId: personIds[10], courseId: induction, completedAt: addDays(today, -3), result: "passed" });
      await voidRecord({ tenantId: a, actorUserId: actor, recordId: id, reason: "Cargado por error de tipeo" });
      await expect(uploadTrainingAttachment({ tenantId: a, actorUserId: actor, target: { recordId: id }, fileName: "c.png", contentType: "image/png", body: Buffer.from("png"), storage })).rejects.toThrow("anulado");
    });
  });

  describe("importación del histórico", () => {
    const header = "legajo;curso;fecha;resultado;nota;vence;proveedor;certificado";
    const csv = (...rows: string[]) => [header, ...rows].join("\n");
    const day = addDays(today, -100).split("-").reverse().join("/");

    it("crea lo nuevo, informa los errores por fila y no genera eficacia ni avisos", async () => {
      const file = csv(`R0;Inducción;${day};aprobado;90;;Prov;`, `R1;ALT-01;${day};aprobado;;;;C-9`, `NOEXISTE;Inducción;${day};aprobado;;;;`, `R2;Curso fantasma;${day};aprobado;;;;`);
      const preview = await previewTrainingImport(a, file);
      expect(preview.plan.counts).toMatchObject({ create: 2, error: 2 });
      expect(preview.plan.items.filter((i) => i.action === "error").map((i) => i.message)).toEqual([expect.stringContaining("legajo NOEXISTE"), expect.stringContaining("Curso fantasma")]);

      const before = await db.trainingRecord.count({ where: { tenantId: a } });
      expect(await db.trainingRecord.count({ where: { tenantId: a } })).toBe(before); // la vista previa no guardó nada

      const done = await applyTrainingImport({ tenantId: a, actorUserId: actor, csv: file });
      expect(done.counts).toMatchObject({ create: 2, error: 2 });
      expect(await db.trainingRecord.count({ where: { tenantId: a } })).toBe(before + 2);
      const imported = await db.trainingRecord.findMany({ where: { tenantId: a, source: "import" }, include: { effectiveness: true } });
      expect(imported.length).toBeGreaterThanOrEqual(2);
      expect(imported.every((r) => r.effectiveness === null)).toBe(true);
      expect(await db.dueItem.count({ where: { tenantId: a } })).toBe(0);
    });

    it("reimportar el mismo archivo no duplica; un cambio de nota actualiza", async () => {
      const file = csv(`R3;Inducción;${day};aprobado;80;;;`);
      await applyTrainingImport({ tenantId: a, actorUserId: actor, csv: file });
      const again = await applyTrainingImport({ tenantId: a, actorUserId: actor, csv: file });
      expect(again.counts).toMatchObject({ create: 0, update: 0, unchanged: 1 });
      expect(await db.trainingRecord.count({ where: { tenantId: a, personId: personIds[3], courseId: induction, completedAt: new Date(`${addDays(today, -100)}T00:00:00.000Z`) } })).toBe(1);

      const changed = await applyTrainingImport({ tenantId: a, actorUserId: actor, csv: csv(`R3;Inducción;${day};aprobado;95;;;`) });
      expect(changed.counts.update).toBe(1);
      const row = await db.trainingRecord.findFirstOrThrow({ where: { tenantId: a, personId: personIds[3], courseId: induction, source: "import" } });
      expect(row.score).toBe(95);
    });

    it("el legajo no distingue mayúsculas y otra empresa no ve a mis personas", async () => {
      const preview = await previewTrainingImport(a, csv(`r4;inducción;${day};aprobado;;;;`));
      expect(preview.plan.counts.create).toBe(1);
      const other = await previewTrainingImport(b, csv(`R4;Inducción;${day};aprobado;;;;`));
      expect(other.plan.counts).toMatchObject({ create: 0, error: 1 });
    });
  });

  describe("seguimiento", () => {
    it("lista sesiones y candidatos por sede, y aísla empresas", async () => {
      const sessions = await listSessions(a, { take: 100 });
      expect(sessions.items.length).toBeGreaterThanOrEqual(3);
      expect(sessions.items[0].course.name).toBeTruthy();
      expect((await listSessions(b)).items).toHaveLength(0);

      const north = await listAttendeeCandidates(a, { siteId: siteB });
      expect(north.map((p) => p.employeeCode)).toEqual(expect.arrayContaining(["R8", "R9", "R10"]));
      expect(north.map((p) => p.employeeCode)).not.toContain("R11"); // inactiva
      expect(north.map((p) => p.employeeCode)).not.toContain("R0");
      expect(await listAttendeeCandidates(a, { q: "persona 03" })).toHaveLength(1);
    });

    it("tablero: cumplimiento por sede, vencimientos a 30/60/90 y cursos que más faltan", async () => {
      const scope = { today };
      const bySite = await getComplianceBySite(a, scope);
      expect(bySite.map((s) => s.siteId).sort()).toEqual([siteA, siteB].sort());
      expect(bySite.reduce((n, s) => n + s.valid + s.expiring + s.expired + s.missing + s.inGrace, 0)).toBe(11 * 2); // 11 activas × 2 cursos obligatorios

      const buckets = await getExpiryBuckets(a, scope);
      const total = buckets.reduce((n, b) => ({ in30: n.in30 + b.in30, in60: n.in60 + b.in60, in90: n.in90 + b.in90 }), { in30: 0, in60: 0, in90: 0 });
      expect(total.in90).toBeGreaterThanOrEqual(total.in60);
      expect(total.in60).toBeGreaterThanOrEqual(total.in30);

      const top = await getTopMissingCourses(a, scope, 5);
      expect(top[0].people).toBeGreaterThan(0);
      expect(top.map((t) => t.name)).toEqual(expect.arrayContaining(["Inducción"]));
      expect(await getTopMissingCourses(b, scope)).toEqual([]);
    });

    it("la matriz filtra por estado: solo personas con algún curso obligatorio en ese estado", async () => {
      const missing = await getMatrixPage(a, { today, status: "missing" });
      expect(missing.people.length).toBeGreaterThan(0);
      for (const p of missing.people) {
        expect(missing.cells.some((c) => c.personId === p.id && c.mandatory && c.status === "missing")).toBe(true);
      }
      const bySite = await getMatrixPage(a, { today, siteId: siteB });
      expect(bySite.people.every((p) => ["R8", "R9", "R10"].includes(p.employeeCode))).toBe(true);
    });

    it("la exportación entrega una fila por persona y curso exigido, en tandas, solo de la empresa", async () => {
      const rows = [];
      for await (const batch of exportComplianceBatches(a, { today })) rows.push(...batch);
      expect(rows).toHaveLength(11 * 2);
      expect(rows.every((r) => r.courseName === "Inducción" || r.courseName === "Trabajo en altura")).toBe(true);
      const empty = [];
      for await (const batch of exportComplianceBatches(b, { today })) empty.push(...batch);
      expect(empty).toEqual([]);
    });

    it("la cantidad de consultas de la matriz no depende de la cantidad de personas", async () => {
      const queries = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
      let n = 0;
      queries.$on("query" as never, () => void n++);
      await getMatrixPage(a, { today, limit: 2 }, queries);
      const small = n;
      n = 0;
      await getMatrixPage(a, { today, limit: 50 }, queries);
      const large = n;
      await queries.$disconnect();
      expect(large).toBe(small);
    });
  });
});
