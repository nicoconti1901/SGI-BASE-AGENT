import { describe, expect, it } from "vitest";
import {
  describeTrainingCounts,
  evaluationNeedsResolution,
  nextEffectivenessDue,
  planDueItemSync,
  validateEvaluation,
  type ExistingTrainingDueItem,
  type PersonDueSummary,
} from "@/domain/training/followup";

const summary = (over: Partial<PersonDueSummary> = {}): PersonDueSummary => ({
  personId: "p1",
  name: "Juan Pérez",
  siteId: "s1",
  nextDueAt: "2026-11-10",
  expired: 0,
  missing: 0,
  inGrace: 0,
  expiring: 1,
  leadDays: 30,
  ...over,
});

const existing = (over: Partial<ExistingTrainingDueItem> = {}): ExistingTrainingDueItem => ({
  title: "Juan Pérez: 1 por vencer",
  dueAt: "2026-11-10",
  leadDays: 30,
  ownerUserId: "u1",
  siteId: "s1",
  ...over,
});

describe("describeTrainingCounts", () => {
  it("arma el título con los conteos, de lo más grave a lo más leve", () => {
    expect(describeTrainingCounts(summary({ expired: 1, expiring: 2 }))).toBe("Juan Pérez: 1 vencida, 2 por vencer");
    expect(describeTrainingCounts(summary({ expired: 2, missing: 1, inGrace: 3, expiring: 0 }))).toBe(
      "Juan Pérez: 2 vencidas, 1 faltante, 3 en plazo",
    );
  });

  it("sin nada que contar, informa el próximo vencimiento", () => {
    expect(describeTrainingCounts(summary({ expiring: 0, nextDueAt: "2027-03-05" }))).toBe(
      "Juan Pérez: capacitaciones al día hasta el 05/03/2027",
    );
  });
});

describe("planDueItemSync", () => {
  const owner = "u1";

  it("crea el aviso si la persona tiene un vencimiento y no hay aviso abierto", () => {
    const plan = planDueItemSync(summary(), null, owner);
    expect(plan).toEqual({
      action: "create",
      title: "Juan Pérez: 1 por vencer",
      dueAt: "2026-11-10",
      leadDays: 30,
      ownerUserId: owner,
      siteId: "s1",
    });
  });

  it("no hace nada si el aviso ya refleja la situación (idempotente)", () => {
    expect(planDueItemSync(summary(), existing(), owner)).toEqual({ action: "noop" });
  });

  it("actualiza si cambió la fecha, los conteos, el responsable o la sede", () => {
    expect(planDueItemSync(summary({ nextDueAt: "2026-12-01" }), existing(), owner).action).toBe("update");
    expect(planDueItemSync(summary({ expired: 1 }), existing(), owner).action).toBe("update");
    expect(planDueItemSync(summary(), existing({ ownerUserId: "otro" }), owner).action).toBe("update");
    expect(planDueItemSync(summary(), existing({ siteId: null }), owner).action).toBe("update");
    expect(planDueItemSync(summary({ leadDays: 15 }), existing(), owner).action).toBe("update");
  });

  it("cierra el aviso si no queda nada pendiente", () => {
    const plan = planDueItemSync(summary({ nextDueAt: null, expiring: 0 }), existing(), owner);
    expect(plan).toEqual({ action: "close" });
  });

  it("sin nada pendiente y sin aviso abierto, no hace nada", () => {
    expect(planDueItemSync(summary({ nextDueAt: null, expiring: 0 }), null, owner)).toEqual({ action: "noop" });
  });

  it("sin responsable de capacitaciones, el aviso queda sin dueño (va a los administradores)", () => {
    const plan = planDueItemSync(summary(), null, null);
    expect(plan).toMatchObject({ action: "create", ownerUserId: null });
  });
});

describe("validateEvaluation", () => {
  const ok = { status: "effective", method: "observation", note: "" } as const;

  it("acepta una evaluación completa", () => {
    expect(validateEvaluation(ok)).toEqual([]);
  });

  it("exige el método", () => {
    expect(validateEvaluation({ ...ok, method: null })).toContain("Elegí cómo se evaluó la eficacia");
  });

  it("no eficaz y parcialmente eficaz exigen una nota", () => {
    expect(validateEvaluation({ ...ok, status: "not_effective", note: "  " })).toContain(
      "Contá qué se observó para decidir que no fue eficaz",
    );
    expect(validateEvaluation({ ...ok, status: "partially_effective", note: "" })).toHaveLength(1);
    expect(validateEvaluation({ ...ok, status: "not_effective", note: "No aplican el procedimiento" })).toEqual([]);
  });
});

describe("evaluationNeedsResolution", () => {
  it("solo un 'no eficaz' obliga a crear una acción o reprogramar", () => {
    expect(evaluationNeedsResolution(["effective", "partially_effective"])).toBe(false);
    expect(evaluationNeedsResolution(["effective", "not_effective"])).toBe(true);
    expect(evaluationNeedsResolution([])).toBe(false);
  });
});

describe("nextEffectivenessDue", () => {
  it("es la fecha más próxima entre lo pendiente", () => {
    expect(nextEffectivenessDue(["2026-12-01", "2026-11-15", "2027-01-10"])).toBe("2026-11-15");
  });

  it("sin pendientes no hay fecha", () => {
    expect(nextEffectivenessDue([])).toBeNull();
  });
});
