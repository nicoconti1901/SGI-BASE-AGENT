import { describe, expect, it } from "vitest";
import { validateCourseInput } from "@/domain/training/courses";
import {
  cellKey,
  defaultGraceDays,
  diffMatrix,
  matrixWarnings,
  type MatrixCell,
} from "@/domain/training/matrix";
import { SUGGESTED_COURSES, findSuggested } from "@/domain/training/suggested-catalog";
import { MODULE_CATALOG } from "@/domain/modules/catalog";

const valid = { name: "Trabajo en altura" };

describe("validateCourseInput", () => {
  it("completa los valores por defecto del SPEC", () => {
    const r = validateCourseInput(valid);
    expect(r).toMatchObject({
      ok: true,
      value: {
        name: "Trabajo en altura",
        category: "other",
        modality: "in_person",
        validityMonths: null,
        reminderDays: 30,
        requiresEffectiveness: false,
        effectivenessDays: 90,
        standards: [],
      },
    });
  });

  it("exige un nombre de al menos 2 caracteres y lo limpia", () => {
    expect(validateCourseInput({ name: " " })).toEqual({ ok: false, error: "El nombre debe tener al menos 2 caracteres" });
    expect(validateCourseInput({ name: "  Primeros   auxilios " })).toMatchObject({ value: { name: "Primeros auxilios" } });
  });

  it("vigencia 1–120 meses o vacía (no vence)", () => {
    expect(validateCourseInput({ ...valid, validityMonths: 0 }).ok).toBe(false);
    expect(validateCourseInput({ ...valid, validityMonths: 121 }).ok).toBe(false);
    expect(validateCourseInput({ ...valid, validityMonths: 1.5 }).ok).toBe(false);
    expect(validateCourseInput({ ...valid, validityMonths: 120 }).ok).toBe(true);
    expect(validateCourseInput({ ...valid, validityMonths: null })).toMatchObject({ value: { validityMonths: null } });
  });

  it("aviso previo 15–90 días y plazo de eficacia 30–180", () => {
    expect(validateCourseInput({ ...valid, reminderDays: 14 }).ok).toBe(false);
    expect(validateCourseInput({ ...valid, reminderDays: 91 }).ok).toBe(false);
    expect(validateCourseInput({ ...valid, effectivenessDays: 29 }).ok).toBe(false);
    expect(validateCourseInput({ ...valid, effectivenessDays: 181 }).ok).toBe(false);
    expect(validateCourseInput({ ...valid, reminderDays: 90, effectivenessDays: 180 }).ok).toBe(true);
  });

  it("las horas, si se cargan, son mayores que cero", () => {
    expect(validateCourseInput({ ...valid, defaultHours: 0 }).ok).toBe(false);
    expect(validateCourseInput({ ...valid, defaultHours: 1.5 })).toMatchObject({ value: { defaultHours: 1.5 } });
  });
});

describe("plazo de gracia sugerido", () => {
  it("30 días por defecto; 0 para inducción y para tareas críticas", () => {
    expect(defaultGraceDays({ category: "safety", targetKind: "position", taskCritical: false })).toBe(30);
    expect(defaultGraceDays({ category: "induction", targetKind: "all", taskCritical: false })).toBe(0);
    expect(defaultGraceDays({ category: "safety", targetKind: "task", taskCritical: true })).toBe(0);
    expect(defaultGraceDays({ category: "safety", targetKind: "task", taskCritical: false })).toBe(30);
  });
});

describe("diffMatrix", () => {
  const saved = new Map<string, MatrixCell>([
    [cellKey("position", "p1", "c1"), { state: "mandatory", graceDays: 30 }],
    [cellKey("all", null, "c2"), { state: "recommended", graceDays: 30 }],
  ]);

  it("solo devuelve lo que cambió", () => {
    const draft = new Map<string, MatrixCell>([
      [cellKey("position", "p1", "c1"), { state: "mandatory", graceDays: 30 }], // igual
      [cellKey("position", "p1", "c3"), { state: "mandatory", graceDays: 15 }], // alta
      [cellKey("all", null, "c2"), { state: "none", graceDays: 30 }], // baja
    ]);
    expect(diffMatrix(saved, draft)).toEqual([
      { targetKind: "position", targetId: "p1", courseId: "c3", state: "mandatory", graceDays: 15 },
      { targetKind: "all", targetId: null, courseId: "c2", state: "none", graceDays: 30 },
    ]);
  });

  it("un cambio de plazo o de obligatoriedad cuenta como cambio", () => {
    const draft = new Map<string, MatrixCell>([
      [cellKey("position", "p1", "c1"), { state: "mandatory", graceDays: 10 }],
      [cellKey("all", null, "c2"), { state: "mandatory", graceDays: 30 }],
    ]);
    expect(diffMatrix(saved, draft)).toHaveLength(2);
  });

  it("dejar en blanco una celda que ya estaba en blanco no es un cambio", () => {
    const draft = new Map<string, MatrixCell>([[cellKey("task", "t1", "c1"), { state: "none", graceDays: 0 }]]);
    expect(diffMatrix(saved, draft)).toEqual([]);
  });
});

describe("matrixWarnings", () => {
  const courses = [
    { id: "c1", name: "Altura", category: "safety" as const },
    { id: "c2", name: "Inducción", category: "induction" as const },
  ];
  const tasks = [
    { id: "t1", name: "Trabajo en altura", critical: true },
    { id: "t2", name: "Archivo", critical: false },
  ];

  it("avisa de una tarea crítica sin cursos obligatorios", () => {
    const w = matrixWarnings({ tasks, courses, cells: new Map() });
    expect(w).toEqual([{ kind: "critical_task_without_courses", targetId: "t1", message: expect.stringContaining("Trabajo en altura") }]);
  });

  it("un curso solo recomendado no alcanza para una tarea crítica", () => {
    const cells = new Map<string, MatrixCell>([[cellKey("task", "t1", "c1"), { state: "recommended", graceDays: 0 }]]);
    expect(matrixWarnings({ tasks, courses, cells }).map((x) => x.kind)).toEqual(["critical_task_without_courses"]);
  });

  it("avisa si una tarea crítica tiene plazo de gracia: 'en plazo' no habilita", () => {
    const cells = new Map<string, MatrixCell>([[cellKey("task", "t1", "c1"), { state: "mandatory", graceDays: 30 }]]);
    const w = matrixWarnings({ tasks, courses, cells });
    expect(w.map((x) => x.kind)).toEqual(["critical_task_grace"]);
  });

  it("avisa si la inducción tiene más de 15 días de plazo", () => {
    const cells = new Map<string, MatrixCell>([
      [cellKey("task", "t1", "c1"), { state: "mandatory", graceDays: 0 }],
      [cellKey("all", null, "c2"), { state: "mandatory", graceDays: 30 }],
    ]);
    const w = matrixWarnings({ tasks, courses, cells });
    expect(w.map((x) => x.kind)).toEqual(["induction_grace"]);
    cells.set(cellKey("all", null, "c2"), { state: "mandatory", graceDays: 15 });
    expect(matrixWarnings({ tasks, courses, cells })).toEqual([]);
  });
});

describe("catálogo sugerido", () => {
  it("claves únicas y vigencias dentro de los rangos permitidos", () => {
    const keys = SUGGESTED_COURSES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of SUGGESTED_COURSES) {
      const result = validateCourseInput({ ...c.course });
      expect(result.ok, c.key).toBe(true);
    }
  });

  it("cada plantilla lleva su etiqueta de confianza y el curso de tarea crítica queda 'a validar'", () => {
    for (const c of SUGGESTED_COURSES) expect(["verified", "topic", "practice", "to_validate"]).toContain(c.confidence);
    expect(findSuggested("altura")?.confidence).toBe("to_validate");
    expect(findSuggested("inexistente")).toBeUndefined();
  });

  it("incluye los cursos típicos del RESEARCH (inducción, toma de conciencia, evacuación, altura…)", () => {
    const names = SUGGESTED_COURSES.map((c) => c.course.name.toLowerCase()).join("|");
    for (const word of ["inducción", "toma de conciencia", "evacuación", "altura", "espacios confinados", "primeros auxilios"]) {
      expect(names).toContain(word);
    }
  });
});

describe("módulo en el catálogo", () => {
  it("Capacitaciones está disponible, apagado por defecto y declara 7.2, 7.3 y 45001 §5.4", () => {
    const training = MODULE_CATALOG.find((m) => m.key === "training")!;
    expect(training.status).toBe("available");
    expect(training.defaultEnabled).toBe(false);
    const clauses = training.clauses.map((c) => `${c.standard}:${c.clause}`);
    expect(clauses).toEqual(expect.arrayContaining(["ISO9001:7.2", "ISO14001:7.3", "ISO45001:7.2", "ISO45001:7.3", "ISO45001:5.4"]));
  });
});
