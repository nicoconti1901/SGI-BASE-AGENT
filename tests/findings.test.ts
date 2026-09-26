import { describe, expect, it } from "vitest";
import {
  addWhyBranch,
  canConfirmRootCause,
  confirmRootCause,
  createInitialWhyStep,
  detectWhyAnswerWarnings,
  listBranchIds,
  markStepAsRoot,
  nextWhyQuestion,
  normalizeWhySteps,
  syncFirstWhyQuestion,
  appendWhyStep,
} from "@/domain/findings/five-whys";
import {
  guideForWhyLevel,
  INDUSTRIAL_CASE_STUDIES,
  INVESTIGATION_CHECKLIST,
  PROBLEM_STATEMENT_EXAMPLES,
  SUPPORT_METHOD_STEPS,
} from "@/domain/findings/why-guidance";
import {
  assertCanPublishFinding,
  getPublishBlockers,
} from "@/domain/findings/publish";
import type { FindingDraft } from "@/domain/findings/types";
import {
  FINDING_STATUS_TONE,
  nearestOpenMeasureDueAt,
} from "@/domain/findings/types";
import { buildFindingsWhere } from "@/lib/findings";

describe("five whys lab", () => {
  it("starts without requiring a title-based statement", () => {
    const first = createInitialWhyStep();
    expect(first.question).toContain("punto de partida");
    expect(first.branchId).toBeTruthy();
    expect(first.id).toBeTruthy();
  });

  it("syncs level 1 question from the factual starting point", () => {
    const steps = syncFirstWhyQuestion(
      [createInitialWhyStep()],
      "El lote L-22 falló dureza en control final",
    );
    expect(steps[0]?.question).toContain("lote L-22");
  });

  it("builds system-oriented questions from previous answers", () => {
    expect(nextWhyQuestion("Falta control en línea", 2)).toContain(
      "sistema / proceso",
    );
    expect(nextWhyQuestion("Falta control en línea", 2)).toContain(
      "Falta control",
    );
  });

  it("provides guidance, checklist and industrial cases", () => {
    expect(PROBLEM_STATEMENT_EXAMPLES.length).toBeGreaterThanOrEqual(4);
    expect(INVESTIGATION_CHECKLIST.length).toBeGreaterThanOrEqual(8);
    expect(SUPPORT_METHOD_STEPS).toHaveLength(10);
    expect(INDUSTRIAL_CASE_STUDIES).toHaveLength(3);
    expect(guideForWhyLevel(1).title).toMatch(/inmediata/i);
    expect(guideForWhyLevel(5).title).toMatch(/raíz/i);
  });

  it("supports parallel causal branches", () => {
    let steps = [createInitialWhyStep("Atrapamiento en prensa")];
    steps = [
      {
        ...steps[0]!,
        answer: "Introdujo la mano en zona peligrosa con energía disponible",
      },
    ];
    steps = addWhyBranch(steps, "B — Aislamiento", "Atrapamiento en prensa");
    expect(listBranchIds(steps)).toHaveLength(2);
    steps = appendWhyStep(steps, steps[0]!.branchId);
    expect(stepsOfDepth(steps, steps[0]!.branchId)).toBe(2);
  });

  it("flags blame and vague answers", () => {
    expect(detectWhyAnswerWarnings("porque Juan no prestó atención")).toContain(
      "blame",
    );
    expect(detectWhyAnswerWarnings("fue negligente")).toContain("blame");
    expect(detectWhyAnswerWarnings("mala suerte")).toContain("vague");
    expect(detectWhyAnswerWarnings("hay que capacitar al personal")).toContain(
      "solution",
    );
  });

  it("requires min depth and explicit root mark; allows one root per branch", () => {
    const branchA = createInitialWhyStep("Defecto en lote");
    const steps = [
      {
        ...branchA,
        answer: "Tolerancia fuera de rango en inspección",
      },
      {
        id: "s2",
        order: 2,
        branchId: branchA.branchId,
        branchLabel: branchA.branchLabel,
        question: "¿Por qué?",
        answer: "Instrumento sin verificación vigente",
        isRootCause: false,
      },
      {
        id: "s3",
        order: 3,
        branchId: branchA.branchId,
        branchLabel: branchA.branchLabel,
        question: "¿Por qué?",
        answer: "No hay procedimiento de verificación del instrumento",
        isRootCause: true,
      },
    ];
    expect(canConfirmRootCause(steps.slice(0, 2))).toBe(false);
    expect(canConfirmRootCause(steps)).toBe(true);

    const confirmed = confirmRootCause(
      steps,
      "user-1",
      "El 12/09 se rechazaron 3 unidades del lote L-22 por dureza fuera de especificación",
      { investigationChecklist: ["task", "sequence", "equipment"] },
    );
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.problemStatement).toContain("lote L-22");
    expect(confirmed.rootCause).toContain("procedimiento");
    expect(confirmed.investigationChecklist).toHaveLength(3);
  });

  it("normalizes legacy flat steps without branch metadata", () => {
    const legacy = normalizeWhySteps([
      {
        id: "",
        order: 1,
        branchId: "",
        branchLabel: "",
        question: "¿Por qué?",
        answer: "a",
        isRootCause: false,
      },
    ]);
    expect(legacy[0]?.branchId).toBeTruthy();
    expect(legacy[0]?.id).toBeTruthy();
  });

  it("marks root only within its branch", () => {
    let steps = [createInitialWhyStep("Hecho")];
    steps = [
      { ...steps[0]!, answer: "Causa inmediata A suficientemente larga" },
    ];
    steps = addWhyBranch(steps, "B — Otra", "Hecho");
    const branchB = listBranchIds(steps)[1]!;
    steps = steps.map((s) =>
      s.branchId === branchB
        ? { ...s, answer: "Causa inmediata B suficientemente larga" }
        : s,
    );
    // deepen A to 3
    const aId = listBranchIds(steps)[0]!;
    steps = appendWhyStep(steps, aId);
    steps = steps.map((s) =>
      s.branchId === aId && s.order === 2
        ? { ...s, answer: "Nivel 2 rama A suficientemente" }
        : s,
    );
    steps = appendWhyStep(steps, aId);
    steps = steps.map((s) =>
      s.branchId === aId && s.order === 3
        ? { ...s, answer: "Nivel 3 raíz A suficientemente" }
        : s,
    );
    const rootA = steps.find((s) => s.branchId === aId && s.order === 3)!;
    steps = markStepAsRoot(steps, rootA.id);
    expect(steps.filter((s) => s.isRootCause)).toHaveLength(1);
  });
});

function stepsOfDepth(
  steps: ReturnType<typeof createInitialWhyStep>[],
  branchId: string,
) {
  return steps.filter((s) => s.branchId === branchId).length;
}

describe("publish finding gates", () => {
  const base: FindingDraft = {
    type: "nonconformity",
    title: "NC de ejemplo",
    description: "Descripción del hecho",
    detectedAt: new Date("2026-09-20"),
    source: "auditoría",
    rca: {
      method: "five_whys",
      problemStatement:
        "El 12/09 se rechazaron 3 unidades del lote L-22 por dureza fuera de especificación",
      steps: [
        {
          id: "1",
          order: 1,
          branchId: "b1",
          branchLabel: "A — Principal",
          question: "¿Por qué?",
          answer: "Paso 1 suficiente largo",
          isRootCause: false,
        },
        {
          id: "2",
          order: 2,
          branchId: "b1",
          branchLabel: "A — Principal",
          question: "¿Por qué?",
          answer: "Paso 2 suficiente largo",
          isRootCause: false,
        },
        {
          id: "3",
          order: 3,
          branchId: "b1",
          branchLabel: "A — Principal",
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

describe("findings tray filters", () => {
  it("excludes cancelled by default and filters by type/q", () => {
    expect(buildFindingsWhere("t1").status).toEqual({ not: "cancelled" });
    expect(buildFindingsWhere("t1", { status: "all" }).status).toBeUndefined();
    expect(buildFindingsWhere("t1", { status: "draft" }).status).toBe("draft");
    expect(buildFindingsWhere("t1", { type: "incident" }).type).toBe("incident");
    expect(buildFindingsWhere("t1", { q: "prensa" }).OR).toBeTruthy();
  });

  it("computes nearest open measure due and has status tones", () => {
    const due = nearestOpenMeasureDueAt([
      { dueAt: new Date("2026-10-10"), status: "open" },
      { dueAt: new Date("2026-10-01"), status: "in_progress" },
      { dueAt: new Date("2026-09-01"), status: "closed" },
    ]);
    expect(due?.toISOString().startsWith("2026-10-01")).toBe(true);
    expect(FINDING_STATUS_TONE.in_progress.fg).toContain("warning");
    expect(FINDING_STATUS_TONE.closed.fg).toContain("success");
  });
});

describe("measure close evidence gate", () => {
  it("requires at least one evidence file to close", async () => {
    const { assertCanCloseMeasureWithEvidence } = await import(
      "@/domain/findings/attachments"
    );
    expect(() => assertCanCloseMeasureWithEvidence(0)).toThrow(/evidencia/i);
    expect(() => assertCanCloseMeasureWithEvidence(1)).not.toThrow();
  });
});
