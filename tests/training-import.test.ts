import { describe, expect, it } from "vitest";
import { parseTrainingCsv } from "@/domain/training/import";
import { planTrainingImport } from "@/domain/training/import";
import type { ExistingTrainingRecord, TrainingImportContext } from "@/domain/training/import";

const TODAY = "2026-10-21";

const ctx: TrainingImportContext = {
  people: [
    { id: "p1", employeeCode: "100" },
    { id: "p2", employeeCode: "200" },
  ],
  courses: [
    { id: "c-altura", name: "Trabajo en altura", code: "ALT", validityMonths: 12 },
    { id: "c-induccion", name: "Inducción de seguridad", code: null, validityMonths: null },
  ],
};

const CSV = [
  "legajo,curso,fecha,resultado,nota,vence,proveedor,certificado",
  "100,Trabajo en altura,2026-08-19,aprobado,85,,Instituto Sur,C-123",
  "200,ALT,19/08/2026,no aprobado,40,,,",
].join("\n");

describe("parseTrainingCsv", () => {
  it("lee las columnas del SPEC, con fechas ISO o DD/MM/AAAA", () => {
    const { rows, errors } = parseTrainingCsv(CSV, { today: TODAY });
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        employeeCode: "100",
        courseRef: "Trabajo en altura",
        completedAt: "2026-08-19",
        result: "passed",
        score: 85,
        validUntil: null,
        providerName: "Instituto Sur",
        certificateNumber: "C-123",
      },
      {
        line: 3,
        employeeCode: "200",
        courseRef: "ALT",
        completedAt: "2026-08-19",
        result: "failed",
        score: 40,
        validUntil: null,
        providerName: null,
        certificateNumber: null,
      },
    ]);
  });

  it("acepta punto y coma (Excel es-AR) y encabezados con tildes o mayúsculas", () => {
    const csv = "Legajo;Curso;Fecha;Resultado\n100;Trabajo en altura;2026-08-19;Aprobó";
    const { rows, errors } = parseTrainingCsv(csv, { today: TODAY });
    expect(errors).toEqual([]);
    expect(rows[0].result).toBe("passed");
  });

  it("informa cada error con su número de línea y sigue con las demás", () => {
    const csv = [
      "legajo,curso,fecha,resultado,nota,vence",
      ",Trabajo en altura,2026-08-19,aprobado,,",
      "100,,2026-08-19,aprobado,,",
      "100,Trabajo en altura,31/02/2026,aprobado,,",
      "100,Trabajo en altura,2026-08-19,quizás,,",
      "100,Trabajo en altura,2026-08-19,aprobado,150,",
      "100,Trabajo en altura,2027-01-01,aprobado,,",
      "100,Trabajo en altura,2026-08-19,aprobado,,2026-01-01",
      "100,Trabajo en altura,2026-08-20,aprobado,70,",
    ].join("\n");
    const { rows, errors } = parseTrainingCsv(csv, { today: TODAY });
    expect(errors.map((e) => [e.line, e.field])).toEqual([
      [2, "legajo"],
      [3, "curso"],
      [4, "fecha"],
      [5, "resultado"],
      [6, "nota"],
      [7, "fecha"],
      [8, "vence"],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].line).toBe(9);
  });

  it("rechaza un archivo sin las columnas obligatorias", () => {
    const { rows, errors } = parseTrainingCsv("legajo,curso\n100,Trabajo en altura", { today: TODAY });
    expect(rows).toEqual([]);
    expect(errors[0]).toMatchObject({ line: 1, field: "encabezado" });
    expect(errors[0].message).toContain("fecha");
  });

  it("señala la fila repetida dentro del mismo archivo", () => {
    const csv = [
      "legajo,curso,fecha,resultado",
      "100,Trabajo en altura,2026-08-19,aprobado",
      "100,trabajo en altura,2026-08-19,aprobado",
    ].join("\n");
    const { rows, errors } = parseTrainingCsv(csv, { today: TODAY });
    expect(rows).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 3, field: "fila" });
    expect(errors[0].message).toContain("línea 2");
  });

  it("un archivo vacío es un error", () => {
    expect(parseTrainingCsv("", { today: TODAY }).errors[0].field).toBe("archivo");
  });
});

describe("planTrainingImport", () => {
  const rows = parseTrainingCsv(CSV, { today: TODAY }).rows;

  it("33. filas nuevas se crean, con el vencimiento calculado desde la vigencia del curso", () => {
    const plan = planTrainingImport([], rows, ctx);
    expect(plan.counts).toEqual({ create: 2, update: 0, unchanged: 0, error: 0 });
    const [first, second] = plan.items;
    expect(first).toMatchObject({ action: "create", personId: "p1", courseId: "c-altura", validUntil: "2027-08-19", validUntilSource: "computed" });
    // Un reprobado no tiene vencimiento.
    expect(second).toMatchObject({ action: "create", personId: "p2", courseId: "c-altura", validUntil: null });
  });

  it("33. la misma fila otra vez queda sin cambios (idempotente)", () => {
    const existing: ExistingTrainingRecord[] = [
      { personId: "p1", courseId: "c-altura", completedAt: "2026-08-19", result: "passed", score: 85, validUntil: "2027-08-19", validUntilSource: "computed", providerName: "Instituto Sur", certificateNumber: "C-123" },
      { personId: "p2", courseId: "c-altura", completedAt: "2026-08-19", result: "failed", score: 40, validUntil: null, validUntilSource: "computed", providerName: null, certificateNumber: null },
    ];
    const plan = planTrainingImport(existing, rows, ctx);
    expect(plan.counts).toEqual({ create: 0, update: 0, unchanged: 2, error: 0 });
  });

  it("33. con otra nota o con otro vencimiento es una actualización", () => {
    const existing: ExistingTrainingRecord[] = [
      { personId: "p1", courseId: "c-altura", completedAt: "2026-08-19", result: "passed", score: 70, validUntil: "2027-08-19", validUntilSource: "computed", providerName: "Instituto Sur", certificateNumber: "C-123" },
    ];
    expect(planTrainingImport(existing, rows.slice(0, 1), ctx).items[0].action).toBe("update");

    const conVence = parseTrainingCsv(
      "legajo,curso,fecha,resultado,nota,vence\n100,Trabajo en altura,2026-08-19,aprobado,85,2027-02-01",
      { today: TODAY },
    ).rows;
    const same: ExistingTrainingRecord[] = [{ ...existing[0], score: 85, providerName: null, certificateNumber: null }];
    const plan = planTrainingImport(same, conVence, ctx);
    expect(plan.items[0]).toMatchObject({ action: "update", validUntil: "2027-02-01", validUntilSource: "certificate" });
  });

  it("si el registro ya tiene el vencimiento del certificado y el CSV no trae 'vence', lo conserva", () => {
    const existing: ExistingTrainingRecord[] = [
      { personId: "p1", courseId: "c-altura", completedAt: "2026-08-19", result: "passed", score: 85, validUntil: "2027-02-01", validUntilSource: "certificate", providerName: "Instituto Sur", certificateNumber: "C-123" },
    ];
    expect(planTrainingImport(existing, rows.slice(0, 1), ctx).items[0].action).toBe("unchanged");
  });

  it("33. un curso inexistente da error con su fila y el motivo; no se crea en silencio", () => {
    const bad = parseTrainingCsv("legajo,curso,fecha,resultado\n100,Curso fantasma,2026-08-19,aprobado", { today: TODAY }).rows;
    const plan = planTrainingImport([], bad, ctx);
    expect(plan.counts.error).toBe(1);
    expect(plan.items[0]).toMatchObject({ action: "error", line: 2 });
    expect(plan.items[0].message).toContain("Curso fantasma");
  });

  it("un legajo inexistente da error", () => {
    const bad = parseTrainingCsv("legajo,curso,fecha,resultado\n999,Trabajo en altura,2026-08-19,aprobado", { today: TODAY }).rows;
    const plan = planTrainingImport([], bad, ctx);
    expect(plan.items[0].action).toBe("error");
    expect(plan.items[0].message).toContain("999");
  });

  it("encuentra el curso por código y sin distinguir tildes ni mayúsculas", () => {
    const r = parseTrainingCsv(
      "legajo,curso,fecha,resultado\n100,alt,2026-08-19,aprobado\n200,INDUCCION DE SEGURIDAD,2026-08-19,aprobado",
      { today: TODAY },
    ).rows;
    const plan = planTrainingImport([], r, ctx);
    expect(plan.items.map((i) => i.courseId)).toEqual(["c-altura", "c-induccion"]);
    // Sin vigencia, no vence.
    expect(plan.items[1].validUntil).toBeNull();
  });
});
