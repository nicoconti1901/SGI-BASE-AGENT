import { describe, expect, it } from "vitest";
import {
  assertWorkflowTransition,
  canTransitionWorkflow,
  dueTitleForAction,
  isWorkflowStatus,
} from "@/domain/operations/nc";

describe("NC workflow", () => {
  it("allows open → in_progress → closed", () => {
    expect(canTransitionWorkflow("open", "in_progress")).toBe(true);
    expect(canTransitionWorkflow("in_progress", "closed")).toBe(true);
    expect(canTransitionWorkflow("open", "closed")).toBe(true);
  });

  it("allows reopen from closed to open", () => {
    expect(canTransitionWorkflow("closed", "open")).toBe(true);
    expect(canTransitionWorkflow("closed", "in_progress")).toBe(false);
  });

  it("throws on invalid transition", () => {
    expect(() => assertWorkflowTransition("closed", "in_progress")).toThrow(
      /no permitida/,
    );
  });

  it("validates status strings", () => {
    expect(isWorkflowStatus("open")).toBe(true);
    expect(isWorkflowStatus("done")).toBe(false);
  });

  it("builds due titles for corrective actions", () => {
    expect(
      dueTitleForAction({
        actionTitle: "Capacitar equipo",
        ncTitle: "Falta de evidencia",
      }),
    ).toBe("AC: Capacitar equipo (NC: Falta de evidencia)");
  });
});
