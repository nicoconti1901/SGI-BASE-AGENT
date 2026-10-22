import { describe, expect, it } from "vitest";
import { followUpDueDate, highestCriticality, planFollowUp, statusSteps, type NonconformingItem } from "@/domain/inspections/consequences";

const item = (criticality: NonconformingItem["criticality"], text = "Presión fuera de rango", comment: string | null = null): NonconformingItem => ({ code: text, text, criticality, comment });

describe("plazos propuestos", () => {
  it("crítica 48 h, mayor 7 días, menor 30 días", () => {
    expect(followUpDueDate("2026-10-22", "critical")).toBe("2026-10-24");
    expect(followUpDueDate("2026-10-22", "major")).toBe("2026-10-29");
    expect(followUpDueDate("2026-10-22", "minor")).toBe("2026-11-21");
  });

  it("la más grave manda", () => {
    expect(highestCriticality([item("minor"), item("critical"), item("major")])).toBe("critical");
    expect(highestCriticality([item("minor"), item("major")])).toBe("major");
    expect(highestCriticality([])).toBeNull();
  });
});

describe("pasos por cambio de estado del activo", () => {
  it("fuera de servicio: retirar y señalizar; el extintor se repone", () => {
    const change = { from: "in_service", to: "out_of_service", reasonCode: "inspection_unfit" } as const;
    expect(statusSteps(change, "extinguisher")).toHaveLength(2);
    expect(statusSteps(change, "light_vehicle")).toHaveLength(1);
  });

  it("baja definitiva: destruir y adjuntar foto", () => {
    const change = { from: "in_service", to: "retired", reasonCode: "inspection_unfit_retired" } as const;
    expect(statusSteps(change, "harness")[0]).toMatch(/destruir/);
  });

  it("sin cambio o reactivación: ningún paso", () => {
    expect(statusSteps(null, null)).toEqual([]);
    expect(statusSteps({ from: "out_of_service", to: "in_service", reasonCode: "reinstated" }, null)).toEqual([]);
  });
});

describe("planFollowUp", () => {
  const base = { subjectLabel: "Extintor EXT-001", statusChange: null, typeKey: "extinguisher" };

  it("sin no conformidades no crea nada", () => {
    expect(planFollowUp({ ...base, nonconforming: [], findingOnCritical: true })).toEqual({ action: null, finding: null });
  });

  it("una NC menor crea solo la acción", () => {
    const plan = planFollowUp({ ...base, nonconforming: [item("minor", "Tarjeta ilegible")], findingOnCritical: true });
    expect(plan.action?.criticality).toBe("minor");
    expect(plan.action?.description).toContain("Tarjeta ilegible");
    expect(plan.finding).toBeNull();
  });

  it("una NC crítica con la plantilla que lo pide crea acción y hallazgo borrador", () => {
    const plan = planFollowUp({ ...base, nonconforming: [item("critical", "Sin precinto", "Falta el pasador"), item("minor")], findingOnCritical: true });
    expect(plan.action?.criticality).toBe("critical");
    expect(plan.finding?.severity).toBe("Crítica");
    expect(plan.finding?.description).toContain("Falta el pasador");
    expect(plan.finding?.description).not.toContain("Presión fuera de rango");
  });

  it("una NC crítica con la plantilla que no lo pide (extintores) crea solo la acción", () => {
    const plan = planFollowUp({ ...base, nonconforming: [item("critical")], findingOnCritical: false });
    expect(plan.action).not.toBeNull();
    expect(plan.finding).toBeNull();
  });

  it("la acción suma los pasos del cambio de estado", () => {
    const plan = planFollowUp({
      ...base,
      nonconforming: [item("critical")],
      statusChange: { from: "in_service", to: "out_of_service", reasonCode: "inspection_unfit" },
      findingOnCritical: false,
    });
    expect(plan.action?.description).toContain("Retirar y señalizar");
    expect(plan.action?.description).toContain("Reponer el extintor");
  });
});
