import { describe, expect, it } from "vitest";
import {
  assertCanApplyFindingAction,
  canApplyFindingAction,
  defaultVerificationDueAt,
  deriveStatusFromMeasures,
  needsNewCorrectiveMeasure,
  pendingSteps,
  reasonIssues,
  requiresEffectivenessVerification,
  verificationIssues,
  type MeasureSnapshot,
} from "@/domain/findings/lifecycle";

const t0 = new Date("2026-10-01T00:00:00Z");
const m = (status: MeasureSnapshot["status"], kind: MeasureSnapshot["kind"] = "corrective", createdAt = t0): MeasureSnapshot => ({
  status,
  kind,
  createdAt,
});

describe("derived status from measures", () => {
  it("stays published until a measure starts", () => {
    expect(
      deriveStatusFromMeasures({ status: "published", type: "nonconformity", reworkSince: null, measures: [m("open")] }),
    ).toBe("published");
    expect(
      deriveStatusFromMeasures({ status: "published", type: "nonconformity", reworkSince: null, measures: [m("in_progress"), m("open")] }),
    ).toBe("in_progress");
  });

  it("sends NC and incidents to verification when all measures are closed", () => {
    for (const type of ["nonconformity", "incident"] as const) {
      expect(
        deriveStatusFromMeasures({ status: "in_progress", type, reworkSince: null, measures: [m("closed"), m("closed")] }),
      ).toBe("verification");
    }
  });

  it("closes observations and opportunities directly (P1)", () => {
    for (const type of ["observation", "opportunity"] as const) {
      expect(
        deriveStatusFromMeasures({ status: "in_progress", type, reworkSince: null, measures: [m("closed", "preventive")] }),
      ).toBe("closed");
    }
  });

  it("does not touch drafts, verification, closed or cancelled findings", () => {
    for (const status of ["draft", "verification", "closed", "cancelled"] as const) {
      expect(
        deriveStatusFromMeasures({ status, type: "nonconformity", reworkSince: null, measures: [m("closed")] }),
      ).toBe(status);
    }
  });

  it("after rework, requires a new corrective measure before verifying again", () => {
    const reworkSince = new Date("2026-11-01T00:00:00Z");
    const old = [m("closed", "corrective", t0)];
    expect(needsNewCorrectiveMeasure({ reworkSince, measures: old })).toBe(true);
    expect(
      deriveStatusFromMeasures({ status: "in_progress", type: "nonconformity", reworkSince, measures: old }),
    ).toBe("in_progress");

    const withNew = [...old, m("closed", "corrective", new Date("2026-11-02T00:00:00Z"))];
    expect(
      deriveStatusFromMeasures({ status: "in_progress", type: "nonconformity", reworkSince, measures: withNew }),
    ).toBe("verification");
  });
});

describe("explicit actions", () => {
  it("verifies only in verification, reopens only closed, cancels anything open", () => {
    expect(canApplyFindingAction("verify", "verification")).toBe(true);
    expect(canApplyFindingAction("verify", "in_progress")).toBe(false);
    expect(canApplyFindingAction("reopen", "closed")).toBe(true);
    expect(canApplyFindingAction("cancel", "draft")).toBe(true);
    expect(() => assertCanApplyFindingAction("cancel", "closed")).toThrow(/anular.*Cerrado/);
  });

  it("requires reasons to cancel and reopen", () => {
    expect(reasonIssues(" ", "cancel")).toHaveLength(1);
    expect(reasonIssues("Duplicado de otro hallazgo", "cancel")).toEqual([]);
    expect(reasonIssues(null, "reopen")[0]).toMatch(/reapertura/);
  });
});

describe("effectiveness verification gate", () => {
  const base = {
    status: "verification" as const,
    result: "effective" as const,
    evidence: "Se revisaron 20 despachos de noviembre sin errores",
    verifierUserId: "admin",
    measureOwnerIds: ["owner"],
    independenceException: null,
    verificationDueAt: new Date("2026-11-01T00:00:00Z"),
    now: new Date("2026-11-05T00:00:00Z"),
    earlyReason: null,
  };

  it("accepts a complete, independent, on-time verification", () => {
    expect(verificationIssues(base)).toEqual([]);
  });

  it("requires result and evidence", () => {
    expect(verificationIssues({ ...base, result: null, evidence: "" })).toHaveLength(2);
  });

  it("blocks the sole owner of all measures unless justified (P3)", () => {
    const self = { ...base, verifierUserId: "owner" };
    expect(verificationIssues(self)).toHaveLength(1);
    expect(verificationIssues({ ...self, independenceException: "Única persona del área" })).toEqual([]);
  });

  it("asks for a reason to verify before the scheduled date (P2)", () => {
    const early = { ...base, now: new Date("2026-10-20T00:00:00Z") };
    expect(verificationIssues(early)).toHaveLength(1);
    expect(verificationIssues({ ...early, earlyReason: "Proceso con ciclo semanal" })).toEqual([]);
  });

  it("schedules verification 30 days later", () => {
    expect(defaultVerificationDueAt(t0).toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });

  it("only NC and incidents require verification", () => {
    expect(requiresEffectivenessVerification("nonconformity")).toBe(true);
    expect(requiresEffectivenessVerification("observation")).toBe(false);
  });
});

describe("pending steps", () => {
  it("explains what is missing in plain language", () => {
    const steps = pendingSteps({
      status: "in_progress",
      type: "nonconformity",
      reworkSince: null,
      measures: [
        { ...m("open"), dueAt: new Date("2026-10-05T00:00:00Z") },
        { ...m("closed"), dueAt: null },
      ],
      verificationDueAt: null,
      now: new Date("2026-10-10T00:00:00Z"),
    });
    expect(steps).toEqual([
      "Falta cerrar 1 medida (1 vencida), con evidencia",
      "Después: verificar la eficacia de las acciones",
    ]);
  });
});
