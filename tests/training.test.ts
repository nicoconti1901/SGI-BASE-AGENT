import { describe, expect, it } from "vitest";
import {
  computeTrainingStatus,
  computeValidUntil,
  isQualifiedForTask,
  resolveRequirements,
  summarizeCompliance,
} from "@/domain/training/rules";
import { addDays, addMonths, dateInZone, diffDays } from "@/domain/training/dates";
import type {
  TrainingPerson,
  TrainingRecordInput,
  TrainingRequirement,
} from "@/domain/training/types";

// Convención del SPEC-training: hoy = 2026-10-21, aviso a 30 días.
const TODAY = "2026-10-21";

const person = (o: Partial<TrainingPerson> = {}): TrainingPerson => ({
  id: "p1",
  active: true,
  hiredAt: "2020-01-01",
  positionId: "posA",
  positionSince: null,
  tasks: [],
  ...o,
});

const req = (o: Partial<TrainingRequirement> = {}): TrainingRequirement => ({
  courseId: "X",
  targetKind: "position",
  positionId: "posA",
  jobTaskId: null,
  mandatory: true,
  graceDays: 30,
  effectiveFrom: "2020-01-01",
  reminderDays: 30,
  ...o,
});

const taskReq = (jobTaskId: string, o: Partial<TrainingRequirement> = {}) =>
  req({ targetKind: "task", positionId: null, jobTaskId, graceDays: 0, ...o });

const allReq = (o: Partial<TrainingRequirement> = {}) =>
  req({ targetKind: "all", positionId: null, jobTaskId: null, ...o });

const rec = (o: Partial<TrainingRecordInput> = {}): TrainingRecordInput => ({
  courseId: "X",
  completedAt: "2026-01-01",
  result: "passed",
  validUntil: null,
  voided: false,
  ...o,
});

function statusOf(
  p: TrainingPerson,
  requirements: TrainingRequirement[],
  records: TrainingRecordInput[],
  courseId = "X",
) {
  return computeTrainingStatus(p, requirements, records, TODAY).find((s) => s.courseId === courseId);
}

describe("fechas", () => {
  it("suma días y calcula diferencias", () => {
    expect(addDays("2026-10-21", 30)).toBe("2026-11-20");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-10-21", "2026-11-20")).toBe(30);
    expect(diffDays("2026-10-21", "2026-10-20")).toBe(-1);
  });

  it("suma meses con ajuste a fin de mes", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("toma el día calendario de la zona del cliente, no el de UTC", () => {
    // 02:30 UTC es la noche anterior en Buenos Aires (UTC-3).
    expect(dateInZone(new Date("2026-10-21T02:30:00.000Z"), "America/Argentina/Buenos_Aires")).toBe("2026-10-20");
    expect(dateInZone(new Date("2026-10-21T12:00:00.000Z"), "America/Argentina/Buenos_Aires")).toBe("2026-10-21");
  });
});

describe("computeValidUntil", () => {
  it("fin de mes: 31 de enero + 1 mes = 28 de febrero (caso 21)", () => {
    expect(computeValidUntil("2026-01-31", 1)).toBe("2026-02-28");
  });
  it("año bisiesto", () => {
    expect(computeValidUntil("2024-01-31", 1)).toBe("2024-02-29");
    expect(computeValidUntil("2024-02-29", 12)).toBe("2025-02-28");
  });
  it("12 meses mantienen el día (caso 3)", () => {
    expect(computeValidUntil("2026-08-19", 12)).toBe("2027-08-19");
  });
  it("sin vigencia no vence (caso 11)", () => {
    expect(computeValidUntil("2019-05-01", null)).toBeNull();
  });
});

describe("resolveRequirements", () => {
  it("junta los requisitos de puesto, de cada tarea asignada y de todo el personal", () => {
    const p = person({ tasks: [{ jobTaskId: "t1", assignedAt: "2026-01-01" }] });
    const resolved = resolveRequirements(
      p,
      [
        req({ courseId: "porPuesto" }),
        taskReq("t1", { courseId: "porTarea" }),
        taskReq("t2", { courseId: "otraTarea" }),
        req({ courseId: "otroPuesto", positionId: "posB" }),
        allReq({ courseId: "todos" }),
      ],
      TODAY,
    );
    expect(resolved.map((r) => r.courseId).sort()).toEqual(["porPuesto", "porTarea", "todos"]);
  });

  it("una persona inactiva no tiene requisitos (caso 20)", () => {
    expect(resolveRequirements(person({ active: false }), [req()], TODAY)).toEqual([]);
  });

  it("ignora un requisito que todavía no rige", () => {
    expect(resolveRequirements(person(), [req({ effectiveFrom: "2026-10-22" })], TODAY)).toEqual([]);
  });

  it("el plazo de gracia cuenta desde el más tardío entre ingreso, asignación y vigencia del requisito", () => {
    const resolved = resolveRequirements(
      person({ hiredAt: "2026-01-01", positionSince: "2026-03-01" }),
      [req({ effectiveFrom: "2026-02-01", graceDays: 10 })],
      TODAY,
    );
    expect(resolved[0].graceEnd).toBe("2026-03-11");
  });

  it("para una tarea usa la fecha en que se asignó esa tarea", () => {
    const p = person({ tasks: [{ jobTaskId: "t1", assignedAt: "2026-09-01" }] });
    const [r] = resolveRequirements(p, [taskReq("t1", { graceDays: 15 })], TODAY);
    expect(r.graceEnd).toBe("2026-09-16");
  });

  it("si no se conoce ninguna fecha, cuenta desde la vigencia del requisito", () => {
    const [r] = resolveRequirements(person({ hiredAt: null }), [req({ effectiveFrom: "2026-06-01", graceDays: 5 })], TODAY);
    expect(r.graceEnd).toBe("2026-06-06");
  });

  it("varias fuentes del mismo curso: obligatorio si alguna lo es, gana el plazo más estricto", () => {
    const p = person({ tasks: [{ jobTaskId: "t1", assignedAt: "2020-02-01" }] });
    const [r] = resolveRequirements(
      p,
      [req({ graceDays: 30, effectiveFrom: "2026-10-01" }), taskReq("t1", { graceDays: 0, effectiveFrom: "2026-10-01" })],
      TODAY,
    );
    expect(r.mandatory).toBe(true);
    expect(r.graceEnd).toBe("2026-10-01");
  });

  it("un requisito recomendado no aporta plazo de gracia", () => {
    const [r] = resolveRequirements(person(), [req({ mandatory: false })], TODAY);
    expect(r.mandatory).toBe(false);
    expect(r.graceEnd).toBeNull();
  });
});

describe("computeTrainingStatus — casos del SPEC", () => {
  it("1. dentro de la gracia: el último día todavía es 'en plazo'", () => {
    const s = statusOf(person({ positionSince: "2026-09-21" }), [req()], []);
    expect(s?.status).toBe("in_grace");
  });

  it("2. gracia vencida: falta", () => {
    expect(statusOf(person({ positionSince: "2026-09-20" }), [req()], [])?.status).toBe("missing");
  });

  it("3. vigente", () => {
    const s = statusOf(person(), [req()], [rec({ completedAt: "2026-08-19", validUntil: "2027-08-19" })]);
    expect(s?.status).toBe("valid");
    expect(s?.validUntil).toBe("2027-08-19");
  });

  it("4. por vencer en el límite (hoy + 30)", () => {
    const s = statusOf(person(), [req()], [rec({ validUntil: "2026-11-20" })]);
    expect(s?.status).toBe("expiring");
    expect(s?.daysToExpiry).toBe(30);
  });

  it("5. hoy + 31 todavía es vigente", () => {
    expect(statusOf(person(), [req()], [rec({ validUntil: "2026-11-21" })])?.status).toBe("valid");
  });

  it("6. vence hoy: sigue vigente todo el día (por vencer)", () => {
    const s = statusOf(person(), [req()], [rec({ validUntil: "2026-10-21" })]);
    expect(s?.status).toBe("expiring");
    expect(s?.daysToExpiry).toBe(0);
  });

  it("7. venció ayer: vencida, sin gracia de renovación", () => {
    expect(statusOf(person({ positionSince: "2026-10-20" }), [req()], [rec({ validUntil: "2026-10-20" })])?.status).toBe("expired");
  });

  it("8. reprobado dentro del plazo: en plazo con detalle 'failed'", () => {
    const s = statusOf(person({ positionSince: "2026-10-01" }), [req()], [rec({ result: "failed", completedAt: "2026-10-05" })]);
    expect(s?.status).toBe("in_grace");
    expect(s?.detail).toBe("failed");
  });

  it("9. reprobado fuera de plazo: falta con detalle 'failed'", () => {
    const s = statusOf(person({ positionSince: "2026-06-01" }), [req()], [rec({ result: "failed", completedAt: "2026-06-10" })]);
    expect(s?.status).toBe("missing");
    expect(s?.detail).toBe("failed");
  });

  it("10. un fallo posterior no invalida un aprobado vigente", () => {
    const s = statusOf(
      person(),
      [req()],
      [rec({ completedAt: "2026-03-01", validUntil: "2027-03-01" }), rec({ completedAt: "2026-09-01", result: "failed" })],
    );
    expect(s?.status).toBe("valid");
  });

  it("11. curso que no vence: vigente, sin vencimiento", () => {
    const s = statusOf(person(), [req()], [rec({ completedAt: "2019-05-01", validUntil: null })]);
    expect(s?.status).toBe("valid");
    expect(s?.validUntil).toBeNull();
    expect(s?.daysToExpiry).toBeNull();
  });

  it("12. cambio de puesto: lo del puesto anterior queda intacto y vuelve al regresar", () => {
    const requirements = [req({ courseId: "X", positionId: "posA" }), req({ courseId: "Y", positionId: "posB" })];
    const records = [rec({ courseId: "X", validUntil: "2027-06-01" })];
    const enB = person({ positionId: "posB", positionSince: "2026-10-16" });
    const statuses = computeTrainingStatus(enB, requirements, records, TODAY);
    expect(statuses.find((s) => s.courseId === "X")?.status).toBe("not_required");
    expect(statuses.find((s) => s.courseId === "Y")?.status).toBe("in_grace");
    // Volver a A: X vuelve a estar vigente sin recargar nada.
    const deVuelta = computeTrainingStatus(person({ positionId: "posA" }), requirements, records, TODAY);
    expect(deVuelta.find((s) => s.courseId === "X")?.status).toBe("valid");
  });

  it("13. dos fuentes: gana la más estricta (tarea crítica sin gracia)", () => {
    const p = person({ positionSince: "2026-10-10", tasks: [{ jobTaskId: "t1", assignedAt: "2026-10-10" }] });
    const s = statusOf(p, [req({ graceDays: 30 }), taskReq("t1", { graceDays: 0 })], []);
    expect(s?.status).toBe("missing");
    expect(s?.mandatory).toBe(true);
  });

  it("14. obligatorio por puesto y recomendado por tarea: obligatorio", () => {
    const p = person({ tasks: [{ jobTaskId: "t1", assignedAt: "2026-01-01" }] });
    expect(statusOf(p, [req(), taskReq("t1", { mandatory: false })], [])?.mandatory).toBe(true);
  });

  it("15. solo recomendado y sin registro: falta, pero no es obligatorio", () => {
    const s = statusOf(person(), [req({ mandatory: false })], []);
    expect(s?.status).toBe("missing");
    expect(s?.mandatory).toBe(false);
  });

  it("16. un registro con fecha futura se ignora", () => {
    const s = statusOf(person({ positionSince: "2026-01-01" }), [req()], [rec({ completedAt: "2026-10-25", validUntil: "2027-10-25" })]);
    expect(s?.status).toBe("missing");
  });

  it("17. un registro anulado se ignora", () => {
    const s = statusOf(person({ positionSince: "2026-01-01" }), [req()], [rec({ validUntil: "2027-10-25", voided: true })]);
    expect(s?.status).toBe("missing");
  });

  it("18. registros desordenados: se usa el de mayor vencimiento", () => {
    const s = statusOf(
      person(),
      [req()],
      [rec({ completedAt: "2026-05-01", validUntil: "2027-06-30" }), rec({ completedAt: "2026-06-01", validUntil: "2026-12-01" })],
    );
    expect(s?.validUntil).toBe("2027-06-30");
    expect(s?.status).toBe("valid");
  });

  it("19. requisito nuevo para el personal existente: gracia desde su vigencia, no 'falta' de golpe", () => {
    const s = statusOf(person({ hiredAt: "2020-03-01" }), [req({ effectiveFrom: TODAY })], []);
    expect(s?.status).toBe("in_grace");
    const mañana = computeTrainingStatus(person({ hiredAt: "2020-03-01" }), [req({ effectiveFrom: TODAY })], [], addDays(TODAY, 31));
    expect(mañana[0].status).toBe("missing");
  });

  it("20. persona dada de baja: sin filas, sus registros se conservan", () => {
    const p = person({ active: false });
    expect(computeTrainingStatus(p, [req()], [rec({ validUntil: "2027-01-01" })], TODAY)).toEqual([
      expect.objectContaining({ courseId: "X", status: "not_required" }),
    ]);
  });

  it("22. aprobado antes de que se exigiera: vigente de inmediato", () => {
    const s = statusOf(person(), [req({ effectiveFrom: TODAY })], [rec({ completedAt: "2026-07-21", validUntil: "2027-07-21" })]);
    expect(s?.status).toBe("valid");
  });

  it("curso con registros pero sin requisito: 'no se exige'", () => {
    const s = statusOf(person(), [], [rec({ validUntil: "2027-01-01" })]);
    expect(s?.status).toBe("not_required");
    expect(s?.mandatory).toBe(false);
  });

  it("la eficacia es la del mejor registro", () => {
    const s = statusOf(person(), [req()], [rec({ validUntil: "2027-01-01", effectiveness: "not_effective" })]);
    expect(s?.effectiveness).toBe("not_effective");
    expect(statusOf(person(), [req()], [rec({ validUntil: "2027-01-01" })])?.effectiveness).toBe("n/a");
    expect(statusOf(person(), [req()], [rec({ validUntil: "2027-01-01", effectiveness: "pending" })])?.effectiveness).toBe("pending");
  });

  it("31. un contratista se calcula igual que una persona propia", () => {
    // El cálculo no distingue el empleador: los mismos datos dan el mismo resultado.
    const base = computeTrainingStatus(person(), [req()], [rec({ validUntil: "2026-11-01" })], TODAY);
    const contratista = computeTrainingStatus(person({ id: "contratista" }), [req()], [rec({ validUntil: "2026-11-01" })], TODAY);
    expect(contratista).toEqual(base);
  });
});

describe("isQualifiedForTask", () => {
  // Altura exige A y B; Izaje exige B y C.
  const requirements = [
    taskReq("altura", { courseId: "A" }),
    taskReq("altura", { courseId: "B" }),
    taskReq("izaje", { courseId: "B" }),
    taskReq("izaje", { courseId: "C" }),
  ];
  const holder = person({
    tasks: [
      { jobTaskId: "altura", assignedAt: "2020-01-01" },
      { jobTaskId: "izaje", assignedAt: "2020-01-01" },
    ],
  });
  const vigente = (courseId: string) => rec({ courseId, validUntil: "2027-06-01" });
  const vencido = (courseId: string) => rec({ courseId, validUntil: "2026-10-01" });

  it("23. dos tareas críticas con un curso compartido: si cae B, caen las dos", () => {
    const records = [vigente("A"), vencido("B"), vigente("C")];
    const altura = isQualifiedForTask(holder, "altura", requirements, records, TODAY);
    const izaje = isQualifiedForTask(holder, "izaje", requirements, records, TODAY);
    expect(altura.qualified).toBe(false);
    expect(altura.blockers).toEqual([{ courseId: "B", reason: "expired" }]);
    expect(izaje.qualified).toBe(false);
    expect(izaje.blockers).toEqual([{ courseId: "B", reason: "expired" }]);
    // Al renovar B, ambas sí.
    const renovado = [vigente("A"), vigente("B"), vigente("C")];
    expect(isQualifiedForTask(holder, "altura", requirements, renovado, TODAY).qualified).toBe(true);
    expect(isQualifiedForTask(holder, "izaje", requirements, renovado, TODAY).qualified).toBe(true);
  });

  it("24. si solo cae A, Altura no pero Izaje sí", () => {
    const records = [vencido("A"), vigente("B"), vigente("C")];
    const altura = isQualifiedForTask(holder, "altura", requirements, records, TODAY);
    expect(altura.qualified).toBe(false);
    expect(altura.blockers).toEqual([{ courseId: "A", reason: "expired" }]);
    expect(isQualifiedForTask(holder, "izaje", requirements, records, TODAY).qualified).toBe(true);
  });

  it("25. 'en plazo' no habilita una tarea crítica", () => {
    const enPlazo = [taskReq("altura", { courseId: "A", graceDays: 30, effectiveFrom: TODAY })];
    const r = isQualifiedForTask(holder, "altura", enPlazo, [], TODAY);
    expect(r.qualified).toBe(false);
    expect(r.blockers).toEqual([{ courseId: "A", reason: "in_grace" }]);
  });

  it("falta el curso: motivo 'missing'", () => {
    const r = isQualifiedForTask(holder, "altura", requirements, [vigente("A")], TODAY);
    expect(r.blockers).toEqual([{ courseId: "B", reason: "missing" }]);
  });

  it("26. por vencer sigue habilitado y se informa cuántos días quedan", () => {
    const records = [rec({ courseId: "A", validUntil: "2026-11-05" }), vigente("B")];
    const r = isQualifiedForTask(holder, "altura", requirements, records, TODAY);
    expect(r.qualified).toBe(true);
    expect(r.expiring).toEqual([{ courseId: "A", daysToExpiry: 15 }]);
  });

  it("27. un 'no eficaz' deja de habilitar hasta que haya un nuevo aprobado", () => {
    const noEficaz = [vigente("A"), { ...vigente("B"), effectiveness: "not_effective" as const }];
    const r = isQualifiedForTask(holder, "altura", requirements, noEficaz, TODAY);
    expect(r.qualified).toBe(false);
    expect(r.blockers).toEqual([{ courseId: "B", reason: "ineffective" }]);
    const nuevo = [...noEficaz, rec({ courseId: "B", completedAt: "2026-10-10", validUntil: "2027-10-10" })];
    expect(isQualifiedForTask(holder, "altura", requirements, nuevo, TODAY).qualified).toBe(true);
  });

  it("28. eficacia pendiente sin evaluar no bloquea", () => {
    const records = [vigente("A"), { ...vigente("B"), effectiveness: "pending" as const }];
    expect(isQualifiedForTask(holder, "altura", requirements, records, TODAY).qualified).toBe(true);
  });

  it("29. tarea sin requisitos obligatorios: habilitado, marcada 'sin requisitos'", () => {
    const soloRecomendado = [taskReq("altura", { courseId: "A", mandatory: false })];
    expect(isQualifiedForTask(holder, "altura", soloRecomendado, [], TODAY)).toEqual({
      qualified: true,
      hasRequirements: false,
      assigned: true,
      blockers: [],
      expiring: [],
    });
    expect(isQualifiedForTask(holder, "inexistente", requirements, [], TODAY).hasRequirements).toBe(false);
  });

  it("30. persona sin la tarea asignada: se calcula igual, con assigned = false", () => {
    const sinTarea = person();
    const r = isQualifiedForTask(sinTarea, "altura", requirements, [vigente("A"), vigente("B")], TODAY);
    expect(r.assigned).toBe(false);
    expect(r.qualified).toBe(true);
    expect(isQualifiedForTask(sinTarea, "altura", requirements, [], TODAY).qualified).toBe(false);
    expect(isQualifiedForTask(holder, "altura", requirements, [vigente("A"), vigente("B")], TODAY).assigned).toBe(true);
  });

  it("un curso exigido a la vez por el puesto y por la tarea usa el plazo más estricto", () => {
    const both = [req({ courseId: "A", graceDays: 30, effectiveFrom: TODAY }), taskReq("altura", { courseId: "A", graceDays: 0, effectiveFrom: TODAY })];
    const mañana = addDays(TODAY, 1);
    const r = isQualifiedForTask(holder, "altura", both, [], mañana);
    expect(r.blockers).toEqual([{ courseId: "A", reason: "missing" }]);
  });
});

describe("summarizeCompliance", () => {
  const s = (status: string, mandatory = true) => ({ status: status as never, mandatory });

  it("32. 10 obligatorios: 6 vigentes, 1 por vencer, 1 vencido, 1 falta, 1 en plazo = 70 %", () => {
    const statuses = [
      ...Array.from({ length: 6 }, () => s("valid")),
      s("expiring"),
      s("expired"),
      s("missing"),
      s("in_grace"),
    ];
    expect(summarizeCompliance(statuses)).toEqual({
      percent: 70,
      valid: 6,
      expiring: 1,
      expired: 1,
      missing: 1,
      inGrace: 1,
      total: 10,
    });
  });

  it("ignora lo recomendado y lo que no se exige", () => {
    const r = summarizeCompliance([s("valid"), s("missing", false), s("not_required", false), s("expired", false)]);
    expect(r.percent).toBe(100);
    expect(r.total).toBe(1);
  });

  it("sin obligatorios no hay porcentaje", () => {
    expect(summarizeCompliance([]).percent).toBeNull();
    expect(summarizeCompliance([s("missing", false)]).percent).toBeNull();
  });
});
