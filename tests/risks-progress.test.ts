import { describe, expect, it } from "vitest";
import { opportunityProgress, riskProgress } from "@/domain/risks/progress";
import { canTransitionRisk } from "@/domain/risks/lifecycle";
import { canTransitionOpportunity } from "@/domain/opportunities/lifecycle";
import { RISK_STATUSES } from "@/domain/risks/types";
import { OPPORTUNITY_STATUSES } from "@/domain/opportunities/types";

const base = { statementComplete: true, assessments: 0, decision: null, actions: [] };

describe("risk progress", () => {
  it("asks whoever registered it to evaluate first and flags an incomplete statement", () => {
    const p = riskProgress({ ...base, status: "identified", statementComplete: false });
    expect(p.nextStep).toBe("Evaluar el nivel del riesgo");
    expect(p.who).toBe("creator");
    expect(p.missing[0]).toMatch(/causa, evento y efecto/);
    expect(p.stages.map((s) => s.state)).toEqual(["current", "todo", "todo", "todo", "todo"]);
  });

  it("requires an action when the response is to mitigate", () => {
    const p = riskProgress({ ...base, status: "response_planned", assessments: 1, decision: "mitigate" });
    expect(p.who).toBe("owner");
    expect(p.advance).toBeNull();
    expect(p.missing).toEqual(["La respuesta elegida necesita al menos una acción."]);
  });

  it("lets an accepted risk move on without actions", () => {
    const p = riskProgress({ ...base, status: "response_planned", assessments: 1, decision: "accept" });
    expect(p.advance).toEqual({ to: "implementing", label: "Iniciar implementación" });
    expect(p.stages.find((s) => s.key === "act")?.state).toBe("done");
  });

  it("waits for open actions and pending effectiveness before advancing", () => {
    const open = [{ status: "open", effectivenessStatus: "pending" }];
    expect(riskProgress({ ...base, status: "implementing", assessments: 1, decision: "mitigate", actions: open }).advance).toBeNull();
    const done = [{ status: "completed", effectivenessStatus: "pending" }];
    expect(riskProgress({ ...base, status: "implementing", assessments: 1, decision: "mitigate", actions: done }).advance?.to).toBe(
      "effectiveness_review",
    );
    expect(riskProgress({ ...base, status: "effectiveness_review", assessments: 1, decision: "mitigate", actions: done }).advance).toBeNull();
  });

  it("only proposes transitions the lifecycle allows", () => {
    for (const status of RISK_STATUSES) {
      for (const actions of [[], [{ status: "completed", effectivenessStatus: "effective" }]]) {
        const p = riskProgress({ ...base, status, assessments: 1, decision: "accept", actions });
        if (p.advance) expect(canTransitionRisk(status, p.advance.to)).toBe(true);
      }
    }
  });
});

describe("opportunity progress", () => {
  it("only proposes transitions the lifecycle allows", () => {
    for (const status of OPPORTUNITY_STATUSES) {
      for (const actions of [[], [{ status: "completed", effectivenessStatus: "effective" }]]) {
        const p = opportunityProgress({ status, statementComplete: true, assessments: 1, decided: true, actions });
        if (p.advance) expect(canTransitionOpportunity(status, p.advance.to)).toBe(true);
      }
    }
  });

  it("asks for actions before implementing a pursued opportunity", () => {
    const p = opportunityProgress({ status: "pursuing", statementComplete: true, assessments: 1, decided: true, actions: [] });
    expect(p.missing).toEqual(["Perseguir la oportunidad necesita al menos una acción."]);
    expect(p.who).toBe("owner");
  });
});
