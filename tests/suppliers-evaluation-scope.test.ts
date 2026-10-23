import { describe, expect, it } from "vitest";
import {
  criteriaForEvaluation,
  describeResult,
  looksUnevidenced,
  lowScoresWithoutComment,
} from "@/domain/suppliers/evaluation";
import { DEFAULT_CRITERIA } from "@/domain/suppliers/templates";

type C = { name: string; phase: "selection" | "performance" | "both"; basic: boolean; excluding: boolean };
const c = (name: string, phase: C["phase"], extra: Partial<C> = {}): C => ({ name, phase, basic: false, excluding: false, ...extra });

const CRITERIA: C[] = [
  c("calidad", "performance", { excluding: true }),
  c("plazos", "performance", { basic: true }),
  c("comercial", "selection"),
  c("documentación", "both", { basic: true }),
  c("ambiente", "both"),
];

const names = (list: C[]) => list.map((x) => x.name);

describe("criteriaForEvaluation", () => {
  it("la inicial pregunta selección y ambas, y siempre los excluyentes", () => {
    expect(names(criteriaForEvaluation(CRITERIA, "initial", "full"))).toEqual(["calidad", "comercial", "documentación", "ambiente"]);
  });

  it("la periódica y la de evento preguntan desempeño y ambas", () => {
    for (const kind of ["periodic", "event"] as const) {
      expect(names(criteriaForEvaluation(CRITERIA, kind, "full"))).toEqual(["calidad", "plazos", "documentación", "ambiente"]);
    }
  });

  it("la simplificada se limita a los básicos y los excluyentes", () => {
    expect(names(criteriaForEvaluation(CRITERIA, "initial", "simplified"))).toEqual(["calidad", "documentación"]);
    expect(names(criteriaForEvaluation(CRITERIA, "periodic", "simplified"))).toEqual(["calidad", "plazos", "documentación"]);
  });

  it("la aceptación con motivo no lleva criterios", () => {
    expect(criteriaForEvaluation(CRITERIA, "initial", "declared")).toEqual([]);
  });

  it("las plantillas sugeridas siempre dejan algo para evaluar en cualquier modo y tipo", () => {
    for (const type of ["product", "service", "contractor"] as const) {
      for (const kind of ["initial", "periodic", "event"] as const) {
        for (const mode of ["full", "simplified"] as const) {
          expect(criteriaForEvaluation(DEFAULT_CRITERIA[type], kind, mode).length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("notas bajas y evidencia", () => {
  it("una nota de 1 o 2 sin comentario se marca; un 3 o un N/A no", () => {
    const items = [
      { score: 1, comment: "" },
      { score: 2, comment: "  " },
      { score: 2, comment: "demoras" },
      { score: 3, comment: "" },
      { score: null, comment: "" },
    ];
    expect(lowScoresWithoutComment(items)).toEqual([0, 1]);
  });

  it("avisa cuando todas las notas son iguales y no hay ningún comentario", () => {
    const same = [4, 4, 4].map((score) => ({ score, comment: "" }));
    expect(looksUnevidenced(same, "")).toBe(true);
    expect(looksUnevidenced(same, "visita a planta")).toBe(false);
    expect(looksUnevidenced([{ score: 4, comment: "ok" }, { score: 4, comment: "" }, { score: 4, comment: "" }], "")).toBe(false);
    expect(looksUnevidenced([{ score: 4, comment: "" }, { score: 5, comment: "" }, { score: 4, comment: "" }], "")).toBe(false);
    expect(looksUnevidenced([{ score: 4, comment: "" }, { score: 4, comment: "" }], "")).toBe(false);
  });
});

describe("describeResult", () => {
  it("explica la razón del resultado", () => {
    expect(describeResult("approved", "score", [])).toBe("Aprobado por puntaje");
    expect(describeResult("not_approved", "excluding_criterion", [{ name: "Seguridad", score: 1 }])).toBe(
      "No aprobado: Seguridad en 1 (criterio excluyente)",
    );
    expect(describeResult("conditional", "excluding_criterion", [{ name: "D", score: 2 }])).toBe("Con condiciones: D en 2 (criterio excluyente)");
    expect(describeResult("approved", "declared", [])).toBe("Aprobado: aceptación con motivo");
  });
});
