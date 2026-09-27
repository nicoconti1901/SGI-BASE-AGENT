import { describe, expect, it } from "vitest";
import {
  assertCanTransitionAudit,
  assertValidItemResult,
  auditCode,
  canTransitionAudit,
  closeReadinessIssues,
  computeCoverage,
  executionReadinessIssues,
  findingFromItemResult,
  impartialityConflicts,
  planReadinessIssues,
  reportDueAt,
  startReadinessIssues,
  type AuditPlanInput,
} from "@/domain/audits/lifecycle";
import {
  canExecuteAudit,
  checklistItemsForRequirement,
  compareClauses,
} from "@/domain/audits/checklist";

const readyPlan: AuditPlanInput = {
  objective: "Verificar que despacho cumple los requisitos del cliente",
  scope: "Proceso de despacho, planta 1, último trimestre",
  standards: ["ISO9001"],
  plannedStart: new Date("2026-10-01"),
  plannedEnd: new Date("2026-10-02"),
  team: [{ userId: "u-lead", role: "lead" }],
  auditeeUserIds: ["u-despacho"],
  checklistCount: 3,
  impartialityException: null,
};

describe("audit lifecycle", () => {
  it("follows plan → prepare → execute → report → close", () => {
    expect(canTransitionAudit("planned", "prepared")).toBe(true);
    expect(canTransitionAudit("prepared", "in_progress")).toBe(true);
    expect(canTransitionAudit("in_progress", "reporting")).toBe(true);
    expect(canTransitionAudit("reporting", "closed")).toBe(true);
  });

  it("blocks skipping steps and reopening closed audits", () => {
    expect(canTransitionAudit("planned", "in_progress")).toBe(false);
    expect(() => assertCanTransitionAudit("closed", "in_progress")).toThrow(
      /Cerrada/,
    );
    expect(canTransitionAudit("cancelled", "planned")).toBe(false);
  });
});

describe("plan readiness (9001:2026 §9.2.2)", () => {
  it("accepts a complete plan", () => {
    expect(planReadinessIssues(readyPlan)).toEqual([]);
  });

  it("requires an objective", () => {
    expect(planReadinessIssues({ ...readyPlan, objective: "  " })).toContain(
      "Definí el objetivo de la auditoría",
    );
  });

  it("requires standards, a lead auditor, checklist and coherent dates", () => {
    const issues = planReadinessIssues({
      ...readyPlan,
      standards: [],
      team: [{ userId: "u-1", role: "auditor" }],
      checklistCount: 0,
      plannedEnd: new Date("2026-09-30"),
    });
    expect(issues).toHaveLength(4);
  });
});

describe("impartiality", () => {
  it("detects an auditor who is also audited", () => {
    expect(impartialityConflicts(["a", "b"], ["b", null, "c"])).toEqual(["b"]);
  });

  it("blocks unless the exception is justified", () => {
    const conflicted = { ...readyPlan, auditeeUserIds: ["u-lead"] };
    expect(planReadinessIssues(conflicted)).toHaveLength(1);
    expect(
      planReadinessIssues({
        ...conflicted,
        impartialityException: "Única persona formada en la empresa",
      }),
    ).toEqual([]);
  });
});

describe("checklist results", () => {
  it("requires evidence for findings but not for conformity", () => {
    expect(() =>
      assertValidItemResult({ result: "nc_minor", evidence: "" }),
    ).toThrow(/evidencia/);
    expect(() =>
      assertValidItemResult({ result: "conforming", evidence: null }),
    ).not.toThrow();
  });

  it("maps results to finding type and severity", () => {
    expect(findingFromItemResult("nc_major")).toEqual({
      type: "nonconformity",
      severity: "major",
    });
    expect(findingFromItemResult("improvement")).toEqual({
      type: "opportunity",
      severity: null,
    });
    expect(findingFromItemResult("conforming")).toBeNull();
  });

  it("is ready for report only when complete and findings exist", () => {
    expect(
      executionReadinessIssues([
        { result: "pending", findingId: null },
        { result: "nc_minor", findingId: null },
      ]),
    ).toEqual(["Queda 1 ítem sin resultado", "Falta generar 1 hallazgo"]);
    expect(
      executionReadinessIssues([
        { result: "conforming", findingId: null },
        { result: "observation", findingId: "f1" },
      ]),
    ).toEqual([]);
  });

  it("needs a conclusion to close", () => {
    expect(closeReadinessIssues({ conclusion: " " })).toHaveLength(1);
    expect(closeReadinessIssues({ conclusion: "El proceso es eficaz" })).toEqual([]);
  });
});

describe("helpers", () => {
  it("formats audit codes and report due dates", () => {
    expect(auditCode(2026, 3)).toBe("AI-2026-03");
    expect(reportDueAt(new Date("2026-10-02T00:00:00Z")).toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
  });

  it("computes coverage from closed audits only", () => {
    const rows = computeCoverage(
      [
        { id: "r1", standard: "ISO9001" },
        { id: "r2", standard: "ISO9001" },
        { id: "r3", standard: "ISO45001" },
      ],
      [
        { tenantRequirementId: "r1", result: "conforming", auditClosed: true },
        { tenantRequirementId: "r2", result: "nc_minor", auditClosed: false },
        { tenantRequirementId: "r3", result: "not_applicable", auditClosed: true },
      ],
    );
    expect(rows).toEqual([
      { standard: "ISO9001", total: 2, covered: 1 },
      { standard: "ISO45001", total: 1, covered: 0 },
    ]);
  });
});

describe("checklist builder", () => {
  it("splits ISO 9001 §6.1 into risks and opportunities lines", () => {
    const items = checklistItemsForRequirement({
      tenantRequirementId: "tr1",
      standard: "ISO9001",
      clauseCode: "6.1",
      title: "Acciones para abordar riesgos y oportunidades",
    });
    expect(items).toHaveLength(2);
    expect(items[0].question).toMatch(/6\.1\.2/);
    expect(items[1].question).toMatch(/6\.1\.3/);
  });

  it("keeps one line per requirement otherwise", () => {
    expect(
      checklistItemsForRequirement({
        tenantRequirementId: "tr2",
        standard: "ISO14001",
        clauseCode: "6.1.2",
        title: "Aspectos ambientales",
      }),
    ).toEqual([{ tenantRequirementId: "tr2", question: "6.1.2 · Aspectos ambientales" }]);
  });

  it("orders clauses naturally", () => {
    expect(["10.2", "4.10", "4.9", "6.1.2"].sort(compareClauses)).toEqual([
      "4.9",
      "4.10",
      "6.1.2",
      "10.2",
    ]);
  });

  it("lets the audit team, admins and superusers execute", () => {
    const base = { isTeamMember: false, isCompanyAdmin: false, isPlatformSuperuser: false };
    expect(canExecuteAudit(base)).toBe(false);
    expect(canExecuteAudit({ ...base, isTeamMember: true })).toBe(true);
    expect(canExecuteAudit({ ...base, isCompanyAdmin: true })).toBe(true);
  });
});

describe("start gate", () => {
  it("asks for a reason only when starting early", () => {
    const plannedStart = new Date("2026-10-10T00:00:00Z");
    expect(startReadinessIssues({ plannedStart, now: new Date("2026-10-10T15:00:00Z"), reason: null })).toEqual([]);
    expect(startReadinessIssues({ plannedStart, now: new Date("2026-10-01T15:00:00Z"), reason: "" })).toHaveLength(1);
    expect(startReadinessIssues({ plannedStart, now: new Date("2026-10-01T15:00:00Z"), reason: "Viaje del auditado" })).toEqual([]);
  });
});
