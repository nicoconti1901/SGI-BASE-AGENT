import { describe, expect, it } from "vitest";
import { canImplement, implementationLockMessage, remainingStageLabels } from "@/domain/risks/ownership";
import { canRunObjective } from "@/domain/indicators/ownership";

const base = { ownerUserId: "owner", actorUserId: "other", isPlatformSuperuser: false };

describe("who implements a risk or opportunity", () => {
  it("lets any writer move it until a response is assigned", () => {
    for (const status of ["identified", "analyzing", "evaluated"]) {
      expect(canImplement("risk", { ...base, status })).toBe(true);
    }
    expect(canImplement("opportunity", { ...base, status: "discovered" })).toBe(true);
  });

  it("restricts it to the assigned person once it is being implemented", () => {
    expect(canImplement("risk", { ...base, status: "implementing" })).toBe(false);
    expect(canImplement("risk", { ...base, status: "implementing", actorUserId: "owner" })).toBe(true);
    expect(canImplement("opportunity", { ...base, status: "pursuing" })).toBe(false);
    expect(canImplement("opportunity", { ...base, status: "decision" })).toBe(false);
  });

  it("lets the superuser and the owner of a specific action through", () => {
    expect(canImplement("risk", { ...base, status: "implementing", isPlatformSuperuser: true })).toBe(true);
    expect(canImplement("risk", { ...base, status: "implementing", actionOwnerUserId: "other" })).toBe(true);
  });

  it("has nobody to wait for when there is no owner yet", () => {
    expect(canImplement("risk", { ...base, status: "implementing", ownerUserId: null })).toBe(true);
  });

  it("names who carries it and lists what is still missing", () => {
    expect(implementationLockMessage("risk", "Laura")).toMatch(/Laura lleva el riesgo/);
    expect(remainingStageLabels([{ label: "A", state: "done" }, { label: "B", state: "current" }, { label: "C", state: "todo" }])).toEqual(["B", "C"]);
  });
});

describe("who runs an objective", () => {
  const o = { ownerUserId: "owner", actorUserId: "other", canWrite: true, isPlatformSuperuser: false };
  it("is the owner or the superuser, not whoever created it for someone else", () => {
    expect(canRunObjective(o)).toBe(false);
    expect(canRunObjective({ ...o, actorUserId: "owner" })).toBe(true);
    expect(canRunObjective({ ...o, isPlatformSuperuser: true })).toBe(true);
    expect(canRunObjective({ ...o, actorUserId: "owner", canWrite: false })).toBe(false);
  });
});
