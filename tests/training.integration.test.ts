import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import {
  MATRIX_MAX_COLUMNS,
  MATRIX_PAGE_SIZE,
  getComplianceBySite,
  getMatrixPage,
  getPersonTrainingStatus,
  queryComplianceCells,
  type ComplianceCell,
} from "@/lib/training";
import { computeValidUntil, summarizeCompliance } from "@/domain/training/rules";
import { addDays } from "@/domain/training/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

/** Generador determinista: el mismo conjunto de datos en cada corrida. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TODAY = "2026-10-21";
const NOW_MS = Date.UTC(2026, 9, 21);
const DAY_MS = 86_400_000;
const utcDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type Rng = () => number;
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

type Dataset = { peopleIds: string[]; courseIds: string[]; siteIds: string[]; positionIds: string[]; taskIds: string[] };

/**
 * Siembra un conjunto con de todo: cambios de puesto, tareas con fechas de asignación, personas inactivas,
 * sedes adicionales, requisitos de los tres destinos (algunos futuros), registros fuera de orden,
 * anulados, futuros y reprobados, y evaluaciones de eficacia.
 */
async function seedDataset(
  db: PrismaClient,
  tenantId: string,
  rng: Rng,
  size: { people: number; courses: number; positions: number; tasks: number; sites: number; recordDensity: number },
): Promise<Dataset> {
  const sites = await db.site.createManyAndReturn({
    data: Array.from({ length: size.sites }, (_, i) => ({ tenantId, name: `Sede ${i}` })),
    select: { id: true },
  });
  const positions = await db.jobPosition.createManyAndReturn({
    data: Array.from({ length: size.positions }, (_, i) => ({ tenantId, name: `Puesto ${i}` })),
    select: { id: true },
  });
  const tasks = await db.jobTask.createManyAndReturn({
    data: Array.from({ length: size.tasks }, (_, i) => ({ tenantId, name: `Tarea ${i}`, critical: i % 2 === 0 })),
    select: { id: true },
  });
  const courses = await db.course.createManyAndReturn({
    data: Array.from({ length: size.courses }, (_, i) => ({
      tenantId,
      name: `Curso ${i}`,
      validityMonths: pick(rng, [null, 6, 12, 12, 24]),
      reminderDays: pick(rng, [15, 30, 30, 60]),
    })),
    select: { id: true, validityMonths: true },
  });

  const people = await db.person.createManyAndReturn({
    data: Array.from({ length: size.people }, (_, i) => ({
      tenantId,
      employeeCode: `L${i}`,
      name: `Persona ${String(i).padStart(4, "0")}`,
      employer: rng() < 0.15 ? ("contractor" as const) : ("own" as const),
      siteId: pick(rng, sites).id,
      positionId: pick(rng, positions).id,
      status: rng() < 0.08 ? ("inactive" as const) : ("active" as const),
      hiredAt: rng() < 0.15 ? null : new Date(NOW_MS - Math.floor(rng() * 2500) * DAY_MS),
      // Instantes cerca de medianoche UTC: en Buenos Aires caen el día anterior.
      positionSince: rng() < 0.5 ? null : new Date(NOW_MS - Math.floor(rng() * 400) * DAY_MS + Math.floor(rng() * 6) * 3_600_000),
    })),
    select: { id: true, siteId: true },
  });

  const personTasks = people.flatMap((p) => {
    const count = Math.floor(rng() * 4);
    return [...new Set(Array.from({ length: count }, () => pick(rng, tasks).id))].map((jobTaskId) => ({
      tenantId,
      personId: p.id,
      jobTaskId,
      assignedAt: new Date(NOW_MS - Math.floor(rng() * 300) * DAY_MS + Math.floor(rng() * 5) * 3_600_000),
    }));
  });
  await db.personJobTask.createMany({ data: personTasks });
  await db.personSite.createMany({
    data: people
      .filter(() => rng() < 0.2)
      .map((p) => ({ tenantId, personId: p.id, siteId: pick(rng, sites.filter((s) => s.id !== p.siteId)).id })),
  });

  // Requisitos: únicos por (curso, destino), como exigen los índices parciales.
  const requirements: Prisma.TrainingRequirementCreateManyInput[] = [];
  for (const course of courses) {
    const base = {
      tenantId,
      courseId: course.id,
      mandatory: rng() < 0.7,
      graceDays: pick(rng, [0, 15, 30, 60]),
      effectiveFrom: utcDate(isoOf(NOW_MS - Math.floor(rng() * 1500) * DAY_MS + (rng() < 0.05 ? 2000 * DAY_MS : 0))),
    };
    if (rng() < 0.25) requirements.push({ ...base, targetKind: "all" });
    for (const position of positions) {
      if (rng() < 0.3) requirements.push({ ...base, mandatory: rng() < 0.7, graceDays: pick(rng, [0, 30]), targetKind: "position", positionId: position.id });
    }
    for (const task of tasks) {
      if (rng() < 0.25) requirements.push({ ...base, mandatory: rng() < 0.8, graceDays: 0, targetKind: "task", jobTaskId: task.id });
    }
  }
  await db.trainingRequirement.createMany({ data: requirements });

  const records: Prisma.TrainingRecordCreateManyInput[] = [];
  const used = new Set<string>();
  for (const person of people) {
    for (const course of courses) {
      if (rng() > size.recordDensity) continue;
      for (let n = Math.floor(rng() * 3) + 1; n > 0; n--) {
        const completedAt = isoOf(NOW_MS - Math.floor(rng() * 900) * DAY_MS + (rng() < 0.05 ? 1000 * DAY_MS : 0));
        const result = rng() < 0.85 ? "passed" : "failed";
        const voided = rng() < 0.1;
        const key = `${person.id}|${course.id}|${completedAt}|${result}`;
        if (!voided && used.has(key)) continue;
        if (!voided) used.add(key);
        // Algunos con el vencimiento propio del certificado; otros, sin vencimiento.
        const own = rng() < 0.15 ? addDays(completedAt, 30 + Math.floor(rng() * 500)) : computeValidUntil(completedAt, course.validityMonths);
        records.push({
          tenantId,
          personId: person.id,
          courseId: course.id,
          completedAt: utcDate(completedAt),
          result,
          validUntil: result === "passed" && own ? utcDate(own) : null,
          validUntilSource: "computed",
          ...(voided ? { voidedAt: new Date(NOW_MS), voidReason: "Carga equivocada" } : {}),
        });
      }
    }
  }
  const created = await db.trainingRecord.createManyAndReturn({ data: records, select: { id: true, result: true, voidedAt: true } });
  await db.trainingEffectiveness.createMany({
    data: created
      .filter((r) => r.result === "passed" && r.voidedAt === null && rng() < 0.2)
      .map((r) => ({
        tenantId,
        recordId: r.id,
        dueAt: utcDate(TODAY),
        status: pick(rng, ["pending", "effective", "partially_effective", "not_effective", "not_applicable"] as const),
      })),
  });

  return {
    peopleIds: people.map((p) => p.id),
    courseIds: courses.map((c) => c.id),
    siteIds: sites.map((s) => s.id),
    positionIds: positions.map((p) => p.id),
    taskIds: tasks.map((t) => t.id),
  };
}

describe.skipIf(!hasDatabase)("capacitaciones: SQL agregado vs función pura", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let dataA: Dataset;
  let dataB: Dataset;

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({
        name: `Cap ${label}`,
        slug: `cap-${label}-${stamp}`,
        size: "small",
        activity: "servicios",
      });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    dataA = await seedDataset(db, a, mulberry32(20261021), { people: 320, courses: 12, positions: 6, tasks: 6, sites: 3, recordDensity: 0.45 });
    dataB = await seedDataset(db, b, mulberry32(7), { people: 40, courses: 5, positions: 3, tasks: 3, sites: 2, recordDensity: 0.5 });
  }, 240_000);

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.$disconnect();
  }, 120_000);

  async function parity(today: string) {
    const sqlCells = await queryComplianceCells(a, { today }, db);
    const bySql = new Map(sqlCells.map((c) => [`${c.personId}|${c.courseId}`, c]));
    expect(bySql.size).toBe(sqlCells.length);

    const tsCells = new Map<string, Omit<ComplianceCell, "personId">>();
    const activeIds: string[] = [];
    const inactive = await db.person.findMany({ where: { tenantId: a, status: "inactive" }, select: { id: true } });
    for (let i = 0; i < dataA.peopleIds.length; i += 25) {
      const chunk = dataA.peopleIds.slice(i, i + 25);
      const statuses = await Promise.all(chunk.map((id) => getPersonTrainingStatus(a, id, { today }, db)));
      statuses.forEach((list, idx) => {
        for (const s of list ?? []) {
          if (s.status === "not_required") continue;
          activeIds.push(chunk[idx]);
          tsCells.set(`${chunk[idx]}|${s.courseId}`, {
            courseId: s.courseId,
            mandatory: s.mandatory,
            status: s.status,
            validUntil: s.validUntil,
            daysToExpiry: s.daysToExpiry,
            effectiveness: s.effectiveness ?? "n/a",
          });
        }
      });
    }
    // Las personas inactivas no tienen filas en ninguna de las dos formas.
    expect(inactive.length).toBeGreaterThan(0);
    for (const p of inactive) expect(sqlCells.some((c) => c.personId === p.id)).toBe(false);

    expect([...bySql.keys()].sort()).toEqual([...tsCells.keys()].sort());
    const mismatches: string[] = [];
    for (const [key, ts] of tsCells) {
      const sql = bySql.get(key)!;
      const left = { courseId: sql.courseId, mandatory: sql.mandatory, status: sql.status, validUntil: sql.validUntil, daysToExpiry: sql.daysToExpiry, effectiveness: sql.effectiveness };
      if (JSON.stringify(left) !== JSON.stringify(ts)) mismatches.push(`${key}: sql=${JSON.stringify(left)} ts=${JSON.stringify(ts)}`);
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
    return sqlCells;
  }

  it("paridad celda por celda (≥ 300 personas) con hoy = 2026-10-21", async () => {
    const cells = await parity(TODAY);
    // El conjunto tiene que ejercitar todos los estados, o el test no prueba nada.
    const seen = new Set(cells.map((c) => c.status));
    for (const status of ["valid", "expiring", "expired", "missing", "in_grace"] as const) {
      expect(seen.has(status), `sin celdas ${status}`).toBe(true);
    }
    expect(cells.some((c) => !c.mandatory)).toBe(true);
    expect(cells.some((c) => c.effectiveness === "not_effective")).toBe(true);
  }, 240_000);

  it("paridad con otra fecha (el estado es función del tiempo)", async () => {
    await parity("2027-03-15");
  }, 240_000);

  it("el filtro por sede incluye a quien la tiene como sede adicional", async () => {
    const siteId = dataA.siteIds[0];
    const extra = await db.personSite.findMany({ where: { tenantId: a, siteId }, select: { personId: true } });
    expect(extra.length).toBeGreaterThan(0);
    const cells = await queryComplianceCells(a, { today: TODAY, siteId }, db);
    const inCells = new Set(cells.map((c) => c.personId));
    const expected = await db.person.findMany({
      where: { tenantId: a, status: "active", OR: [{ siteId }, { extraSites: { some: { siteId } } }] },
      select: { id: true },
    });
    const all = new Set((await queryComplianceCells(a, { today: TODAY }, db)).map((c) => c.personId));
    for (const p of expected) expect(inCells.has(p.id) || !all.has(p.id)).toBe(true);
    for (const id of inCells) expect(expected.some((p) => p.id === id)).toBe(true);
  }, 120_000);

  it("el resumen por sede coincide con las celdas obligatorias agrupadas por sede base", async () => {
    const cells = await queryComplianceCells(a, { today: TODAY }, db);
    const people = await db.person.findMany({ where: { tenantId: a }, select: { id: true, siteId: true } });
    const siteOf = new Map(people.map((p) => [p.id, p.siteId]));
    const summary = await getComplianceBySite(a, { today: TODAY }, db);
    for (const site of summary) {
      const own = cells.filter((c) => siteOf.get(c.personId) === site.siteId);
      const s = summarizeCompliance(own);
      expect(site).toMatchObject({ valid: s.valid, expiring: s.expiring, expired: s.expired, missing: s.missing, inGrace: s.inGrace });
    }
    expect(summary.length).toBeGreaterThan(0);
  }, 120_000);

  it("dos tenants: las celdas de uno nunca incluyen personas ni cursos del otro", async () => {
    const cellsA = await queryComplianceCells(a, { today: TODAY }, db);
    const cellsB = await queryComplianceCells(b, { today: TODAY }, db);
    expect(cellsB.length).toBeGreaterThan(0);
    const idsA = new Set([...dataA.peopleIds]);
    const coursesA = new Set(dataA.courseIds);
    for (const c of cellsA) {
      expect(idsA.has(c.personId)).toBe(true);
      expect(coursesA.has(c.courseId)).toBe(true);
    }
    for (const c of cellsB) expect(dataB.peopleIds).toContain(c.personId);
    // Una persona de otro tenant no existe para este.
    expect(await getPersonTrainingStatus(a, dataB.peopleIds[0], { today: TODAY }, db)).toBeNull();
    const page = await getMatrixPage(a, { today: TODAY, limit: 50 }, db);
    for (const p of page.people) expect(idsA.has(p.id)).toBe(true);
  }, 120_000);

  it("la matriz pagina por persona con cursor y ordena por nombre", async () => {
    const first = await getMatrixPage(a, { today: TODAY, limit: 20 }, db);
    expect(first.people).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await getMatrixPage(a, { today: TODAY, limit: 20, after: first.nextCursor! }, db);
    const names = [...first.people, ...second.people].map((p) => p.name);
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
    // Las celdas de una página son solo de sus personas.
    const ids = new Set(second.people.map((p) => p.id));
    for (const c of second.cells) expect(ids.has(c.personId)).toBe(true);
    const buscado = await getMatrixPage(a, { today: TODAY, q: "Persona 0007" }, db);
    expect(buscado.people.map((p) => p.name)).toEqual(["Persona 0007"]);
  }, 120_000);
});

describe.skipIf(!hasDatabase)("capacitaciones: invariantes del esquema", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  let tenantId = "";
  let courseId = "";
  let positionId = "";
  let taskId = "";
  let personId = "";

  beforeAll(async () => {
    const t = await createTenantWithTemplate({ name: "Cap inv", slug: `cap-inv-${stamp}`, size: "small", activity: "servicios" });
    tenantId = t.id;
    const site = await db.site.create({ data: { tenantId, name: "Base" } });
    positionId = (await db.jobPosition.create({ data: { tenantId, name: "Operario" } })).id;
    taskId = (await db.jobTask.create({ data: { tenantId, name: "Altura", critical: true } })).id;
    personId = (await db.person.create({ data: { tenantId, employeeCode: "1", name: "Ana", siteId: site.id, positionId } })).id;
    courseId = (await db.course.create({ data: { tenantId, name: "Altura" } })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  }, 60_000);

  const base = () => ({ tenantId, courseId, mandatory: true, graceDays: 30 });

  it("un requisito exige exactamente la FK que corresponde a su destino", async () => {
    await expect(db.trainingRequirement.create({ data: { ...base(), targetKind: "task", positionId } })).rejects.toThrow();
    await expect(db.trainingRequirement.create({ data: { ...base(), targetKind: "position" } })).rejects.toThrow();
    await expect(db.trainingRequirement.create({ data: { ...base(), targetKind: "all", jobTaskId: taskId } })).rejects.toThrow();
  });

  it("no se repite el requisito de un curso para el mismo destino (puesto, tarea o todos)", async () => {
    await db.trainingRequirement.create({ data: { ...base(), targetKind: "position", positionId } });
    await expect(db.trainingRequirement.create({ data: { ...base(), targetKind: "position", positionId } })).rejects.toThrow();
    await db.trainingRequirement.create({ data: { ...base(), targetKind: "task", jobTaskId: taskId } });
    await expect(db.trainingRequirement.create({ data: { ...base(), targetKind: "task", jobTaskId: taskId } })).rejects.toThrow();
    await db.trainingRequirement.create({ data: { ...base(), targetKind: "all" } });
    await expect(db.trainingRequirement.create({ data: { ...base(), targetKind: "all" } })).rejects.toThrow();
    await expect(db.trainingRequirement.create({ data: { ...base(), targetKind: "all", graceDays: 400, courseId: (await db.course.create({ data: { tenantId, name: "Otro" } })).id } })).rejects.toThrow();
  });

  it("el nombre del curso no se repite aunque cambien las mayúsculas", async () => {
    await expect(db.course.create({ data: { tenantId, name: "ALTURA" } })).rejects.toThrow();
  });

  it("rangos del curso: vigencia 1–120, aviso 15–90, eficacia 30–180", async () => {
    await expect(db.course.create({ data: { tenantId, name: "A", validityMonths: 0 } })).rejects.toThrow();
    await expect(db.course.create({ data: { tenantId, name: "B", validityMonths: 121 } })).rejects.toThrow();
    await expect(db.course.create({ data: { tenantId, name: "C", reminderDays: 10 } })).rejects.toThrow();
    await expect(db.course.create({ data: { tenantId, name: "D", effectivenessDays: 200 } })).rejects.toThrow();
    await expect(db.course.create({ data: { tenantId, name: "E", validityMonths: 12, reminderDays: 90, effectivenessDays: 30 } })).resolves.toBeTruthy();
  });

  const record = (o: Partial<Prisma.TrainingRecordUncheckedCreateInput> = {}): Prisma.TrainingRecordUncheckedCreateInput => ({
    tenantId,
    personId,
    courseId,
    completedAt: utcDate("2026-05-01"),
    result: "passed",
    ...o,
  });

  it("un registro no se duplica (persona, curso, día, resultado), salvo que esté anulado", async () => {
    const first = await db.trainingRecord.create({ data: record() });
    await expect(db.trainingRecord.create({ data: record() })).rejects.toThrow();
    // Otro resultado el mismo día sí se puede.
    await db.trainingRecord.create({ data: record({ result: "failed" }) });
    // Anulado con motivo: se vuelve a cargar.
    await db.trainingRecord.update({ where: { id: first.id }, data: { voidedAt: new Date(), voidReason: "Fecha equivocada" } });
    await expect(db.trainingRecord.create({ data: record() })).resolves.toBeTruthy();
  });

  it("nota entre 0 y 100, vencimiento no anterior a la fecha y anulación siempre con motivo", async () => {
    await expect(db.trainingRecord.create({ data: record({ completedAt: utcDate("2026-01-01"), score: 101 }) })).rejects.toThrow();
    await expect(db.trainingRecord.create({ data: record({ completedAt: utcDate("2026-01-02"), validUntil: utcDate("2026-01-01") }) })).rejects.toThrow();
    await expect(db.trainingRecord.create({ data: record({ completedAt: utcDate("2026-01-03"), voidedAt: new Date() }) })).rejects.toThrow();
    await expect(db.trainingRecord.create({ data: record({ completedAt: utcDate("2026-01-04"), result: "failed", validUntil: utcDate("2027-01-01") }) })).rejects.toThrow();
  });

  it("un adjunto es de una sesión o de un registro, nunca de ambos ni de ninguno", async () => {
    const session = await db.trainingSession.create({ data: { tenantId, courseId, heldAt: utcDate("2026-05-01") } });
    const rec = await db.trainingRecord.create({ data: record({ completedAt: utcDate("2026-02-01") }) });
    const file = { tenantId, storageKey: "k", fileName: "planilla.pdf", contentType: "application/pdf", sizeBytes: 10 };
    await expect(db.trainingAttachment.create({ data: file })).rejects.toThrow();
    await expect(db.trainingAttachment.create({ data: { ...file, sessionId: session.id, recordId: rec.id } })).rejects.toThrow();
    await expect(db.trainingAttachment.create({ data: { ...file, sessionId: session.id } })).resolves.toBeTruthy();
    await expect(db.trainingAttachment.create({ data: { ...file, recordId: rec.id } })).resolves.toBeTruthy();
  });

  it("dos registros de una misma sesión para la misma persona no se permiten", async () => {
    const session = await db.trainingSession.create({ data: { tenantId, courseId, heldAt: utcDate("2026-06-01") } });
    await db.trainingRecord.create({ data: record({ completedAt: utcDate("2026-06-01"), sessionId: session.id, source: "session" }) });
    await expect(
      db.trainingRecord.create({ data: record({ completedAt: utcDate("2026-06-01"), result: "failed", sessionId: session.id, source: "session" }) }),
    ).rejects.toThrow();
  });
});

describe.skipIf(!hasDatabase)("capacitaciones: presupuesto de consultas (500 personas × 20 cursos)", () => {
  const stamp = Date.now();
  const queries: { query: string; duration: number }[] = [];
  const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  let tenantId = "";
  let siteIds: string[] = [];

  beforeAll(async () => {
    db.$on("query", (e) => queries.push({ query: e.query, duration: Number(e.duration) }));
    const t = await createTenantWithTemplate({ name: "Cap perf", slug: `cap-perf-${stamp}`, size: "small", activity: "servicios" });
    tenantId = t.id;
    const data = await seedDataset(db, tenantId, mulberry32(99), { people: 500, courses: 20, positions: 8, tasks: 6, sites: 4, recordDensity: 0.5 });
    siteIds = data.siteIds;
    // En producción autovacuum mantiene las estadísticas; acá se fuerzan tras la carga masiva.
    await db.$executeRawUnsafe(
      'ANALYZE "person", "person_job_task", "person_site", "training_course", "training_requirement", "training_record", "training_effectiveness"',
    );
    // Los 20 cursos se exigen a todo el personal: 500 × 20 = 10.000 celdas posibles.
    await db.trainingRequirement.deleteMany({ where: { tenantId } });
    await db.trainingRequirement.createMany({
      data: data.courseIds.map((courseId) => ({ tenantId, courseId, targetKind: "all" as const, mandatory: true, graceDays: 30, effectiveFrom: utcDate("2026-01-01") })),
    });
  }, 300_000);

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  }, 120_000);

  const run = async <T>(fn: () => Promise<T>) => {
    queries.length = 0;
    const started = performance.now();
    const result = await fn();
    return { result, elapsed: performance.now() - started, count: queries.length, sql: queries.map((q) => q.query) };
  };

  it("una página de la matriz hace un número fijo de consultas y solo trae a 50 personas", async () => {
    const { result, count, elapsed, sql } = await run(() => getMatrixPage(tenantId, { today: TODAY }, db));
    expect(result.people).toHaveLength(MATRIX_PAGE_SIZE);
    expect(result.columns.length).toBeLessThanOrEqual(MATRIX_MAX_COLUMNS);
    expect(result.cells.length).toBeLessThanOrEqual(MATRIX_PAGE_SIZE * 20);
    expect(result.cells.length).toBeGreaterThan(0);
    // personas + columnas + celdas: no depende de cuántas personas haya.
    expect(count).toBeLessThanOrEqual(3);
    // La lista de personas está acotada (LIMIT) y las celdas se piden solo para esas 50.
    expect(sql.some((q) => /FROM "public"\."person"/.test(q) && /LIMIT/.test(q))).toBe(true);
    expect(sql.every((q) => !/SELECT[^;]*FROM "public"\."training_record"[^;]*WHERE[^;]*"personId"\s*=\s*\$/.test(q))).toBe(true);
    expect(elapsed).toBeLessThan(3000);
  }, 60_000);

  it("la segunda página cuesta lo mismo que la primera", async () => {
    const first = await getMatrixPage(tenantId, { today: TODAY }, db);
    const { result, count } = await run(() => getMatrixPage(tenantId, { today: TODAY, after: first.nextCursor! }, db));
    expect(result.people).toHaveLength(MATRIX_PAGE_SIZE);
    expect(count).toBeLessThanOrEqual(3);
  }, 60_000);

  it("el resumen por sede es una sola consulta y devuelve a lo sumo una fila por sede y estado", async () => {
    const { result, count, elapsed } = await run(() => getComplianceBySite(tenantId, { today: TODAY }, db));
    expect(count).toBe(1);
    expect(result.length).toBeLessThanOrEqual(siteIds.length);
    expect(result.reduce((n, s) => n + s.valid + s.expiring + s.expired + s.missing + s.inGrace, 0)).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(3000);
  }, 60_000);

  it("la ficha de una persona son consultas acotadas por persona (Prisma carga cada relación aparte)", async () => {
    const person = await db.person.findFirstOrThrow({ where: { tenantId, status: "active" }, select: { id: true } });
    const { count, result } = await run(() => getPersonTrainingStatus(tenantId, person.id, { today: TODAY }, db));
    expect(result?.length).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(6);
  }, 60_000);
});
