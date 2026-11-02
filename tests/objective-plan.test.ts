import { describe, expect, it } from "vitest";
import { hasStructuredPlan, parsePlanSteps, planStepIssues } from "@/domain/indicators/plan";

describe("objective plan", () => {
  it("reads rows from JSON, dropping empty rows and junk", () => {
    const raw = JSON.stringify([
      { what: " Relevar reclamos ", ownerUserId: "u1", dueDate: "2027-03-15" },
      { what: "", ownerUserId: "", dueDate: "" },
      "basura",
    ]);
    expect(parsePlanSteps(raw)).toEqual([{ what: "Relevar reclamos", ownerUserId: "u1", dueDate: "2027-03-15" }]);
    expect(parsePlanSteps("no es json")).toEqual([]);
    expect(parsePlanSteps(null)).toEqual([]);
  });

  it("asks for what, who and when on each action, numbered as the user sees them", () => {
    expect(
      planStepIssues([
        { what: "Relevar reclamos", ownerUserId: "u1", dueDate: "2027-03-15" },
        { what: "Capacitar", ownerUserId: "", dueDate: "15/03" },
      ]),
    ).toEqual(["Acción 2: elegí un responsable", "Acción 2: indicá la fecha límite"]);
  });

  it("knows when there is a structured plan to show", () => {
    expect(hasStructuredPlan({ steps: [], resources: "", evaluation: "" })).toBe(false);
    expect(hasStructuredPlan({ steps: [], resources: "Presupuesto", evaluation: "" })).toBe(true);
  });
});
