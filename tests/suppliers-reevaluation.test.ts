import { describe, expect, it } from "vitest";
import { eventReevaluationReasons, initialEvaluationDue } from "@/domain/suppliers/schedule";
import { isoDay } from "@/domain/suppliers/dates";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const day = (x: Date | null) => (x ? isoDay(x) : null);

describe("initialEvaluationDue", () => {
  const base = { status: "potential", criticality: "critical", createdDay: d("2026-10-21"), initialEvalDays: 30 } as const;

  it("crítico y estándar sin evaluar: alta + 30 días", () => {
    expect(day(initialEvaluationDue(base))).toBe("2026-11-20");
    expect(day(initialEvaluationDue({ ...base, criticality: "standard" }))).toBe("2026-11-20");
  });

  it("respeta los días configurados por la empresa", () => {
    expect(day(initialEvaluationDue({ ...base, initialEvalDays: 10 }))).toBe("2026-10-31");
    expect(day(initialEvaluationDue({ ...base, initialEvalDays: 0 }))).toBe("2026-10-21");
  });

  it("bajo impacto no espera una evaluación inicial", () => {
    expect(initialEvaluationDue({ ...base, criticality: "low" })).toBeNull();
  });

  it("solo mientras está sin evaluar", () => {
    for (const status of ["approved", "conditional", "not_approved", "inactive"] as const) {
      expect(initialEvaluationDue({ ...base, status })).toBeNull();
    }
  });
});

describe("eventReevaluationReasons", () => {
  const none = { openFindingsSinceLast: 0, planClosed: false, blockingDocsIssue: false };

  it("sin señales no hay motivos", () => {
    expect(eventReevaluationReasons(none)).toEqual([]);
  });

  it("singular y plural en los hallazgos abiertos", () => {
    expect(eventReevaluationReasons({ ...none, openFindingsSinceLast: 1 })).toEqual(["Hay un hallazgo abierto desde la última evaluación."]);
    expect(eventReevaluationReasons({ ...none, openFindingsSinceLast: 3 })[0]).toContain("3 hallazgos abiertos");
  });

  it("junta todos los motivos en orden", () => {
    const reasons = eventReevaluationReasons({ openFindingsSinceLast: 2, planClosed: true, blockingDocsIssue: true });
    expect(reasons).toHaveLength(3);
    expect(reasons[1]).toContain("plan de mejora");
    expect(reasons[2]).toContain("documentación");
  });
});
