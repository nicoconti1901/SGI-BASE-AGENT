import { describe, expect, it } from "vitest";
import {
  canConfirmRootCause,
  confirmRootCause,
  createInitialWhyStep,
  detectWhyAnswerWarnings,
  nextWhyQuestion,
} from "@/domain/findings/five-whys";
import {
  assertCanPublishFinding,
  getPublishBlockers,
} from "@/domain/findings/publish";
import type { FindingDraft } from "@/domain/findings/types";

describe("five whys lab", () => {
  it("builds chained questions from previous answers", () => {
    const first = createInitialWhyStep("Se entregó producto fuera de especificación");
    expect(first.question).toContain("fuera de especificación");
    expect(nextWhyQuestion("Falta control en línea")).toContain("Falta control");
  });

  it("flags blame and vague answers", () => {
    expect(detectWhyAnswerWarnings("porque Juan no prestó atención")).toContain(
      "blame",
    );
    expect(detectWhyAnswerWarnings("mala suerte")).toContain("vague");
    expect(detectWhyAnswerWarnings("hay que capacitar al personal")).toContain(
      "solution",
    );
  });

  it("requires min depth and explicit root mark to confirm", () => {
    const steps = [
      {
        ...createInitialWhyStep("Defecto en lote"),
        answer: "Tolerancia fuera de rango en inspección",
      },
      {
        order: 2,
        question: "¿Por qué?",
        answer: "Instrumento sin verificación vigente",
        isRootCause: false,
      },
    ];
    expect(canConfirmRootCause(steps)).toBe(false);

    steps.push({
      order: 3,
      question: "¿Por qué tolerancia mal calibrada?",
      answer: "No hay procedimiento de verificación del instrumento",
      isRootCause: true,
    });
    expect(canConfirmRootCause(steps)).toBe(true);

    const confirmed = confirmRootCause(steps, "user-1");
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.rootCause).toContain("procedimiento");
  });
});

describe("publish finding gates", () => {
  const base: FindingDraft = {
    type: "nonconformity",
    title: "NC de ejemplo",
    description: "Descripción del hecho",
    detectedAt: new Date("2026-09-20"),
    source: "auditoría",
    rca: {
      method: "five_whys",
      problemStatement: "NC de ejemplo",
      steps: [
        {
          order: 1,
          question: "¿Por qué NC de ejemplo?",
          answer: "Paso 1 suficiente largo",
          isRootCause: false,
        },
        {
          order: 2,
          question: "¿Por qué?",
          answer: "Paso 2 suficiente largo",
          isRootCause: false,
        },
        {
          order: 3,
          question: "¿Por qué?",
          answer: "Causa de proceso documentada",
          isRootCause: true,
        },
      ],
      rootCause: "Causa de proceso documentada",
      rootCauseConfirmedAt: new Date(),
      rootCauseConfirmedByUserId: "u1",
      status: "confirmed",
    },
    measures: [
      {
        kind: "corrective",
        title: "Actualizar procedimiento",
        ownerUserId: "u2",
        dueAt: new Date("2026-10-01"),
        linkedRootCause: true,
      },
    ],
    notifyUserIds: ["u3"],
  };

  it("allows a complete draft", () => {
    expect(getPublishBlockers(base)).toEqual([]);
    expect(() => assertCanPublishFinding(base)).not.toThrow();
  });

  it("blocks without confirmed root cause", () => {
    const draft = {
      ...base,
      rca: { ...base.rca, status: "incomplete" as const, rootCause: null },
    };
    expect(getPublishBlockers(draft).some((b) => /causa raíz/i.test(b))).toBe(
      true,
    );
  });

  it("blocks without notify list or linked measure", () => {
    expect(
      getPublishBlockers({ ...base, notifyUserIds: [] }).some((b) =>
        /notific/i.test(b),
      ),
    ).toBe(true);
    expect(
      getPublishBlockers({
        ...base,
        measures: [{ ...base.measures[0]!, linkedRootCause: false }],
      }).some((b) => /causa raíz/i.test(b)),
    ).toBe(true);
  });
});
