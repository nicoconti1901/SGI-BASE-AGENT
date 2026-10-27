import { describe, expect, it } from "vitest";
import { assetStatusAfter } from "@/domain/inspections/asset-status";
import { planFollowUp } from "@/domain/inspections/consequences";
import {
  auditContext,
  fieldAuditSummary,
  monthLabel,
  monthRange,
  normalizeSpecialTasks,
  programCompliance,
  shiftMonth,
} from "@/domain/inspections/field-audit";
import { applicableItems, deriveInspectionResult } from "@/domain/inspections/result";
import { nextInspectionDue } from "@/domain/inspections/schedule";
import { getDefaultTemplate } from "@/domain/inspections/templates";
import { validateTemplate } from "@/domain/inspections/templates/validate";
import type { EvalAnswer, EvalItem, TemplateItemDef } from "@/domain/inspections/types";

const t = getDefaultTemplate("field_audit")!;

const scoring = (items: TemplateItemDef[]) => items.filter((i) => i.kind === "check");
const codes = (specialTasks: string[]) => applicableItems(t.items, { context: auditContext(specialTasks) }).map((i) => i.code);

function evalItems(items: TemplateItemDef[]): EvalItem[] {
  return items.map((it, i) => ({ id: `i${i}`, criticality: it.criticality, kind: it.kind, naAllowed: it.naAllowed, required: it.required }));
}
function answers(items: TemplateItemDef[], overrides: Record<string, EvalAnswer["value"]> = {}): EvalAnswer[] {
  return items.map((it, i) => ({ itemId: `i${i}`, value: it.kind === "check" ? (overrides[it.code] ?? "conform") : undefined }));
}

describe("T7 auditoría de seguridad en campo: plantilla", () => {
  it("es una actividad sin activo ni calendario propio; no libera nada y escala a hallazgo con una crítica", () => {
    expect(t).toMatchObject({
      scope: "activity",
      assetTypeKey: null,
      intervalUnit: null,
      intervalValue: null,
      findingOnCritical: true,
      canReinstate: false,
      retireOnUnfit: false,
      maxApplicableItems: 25,
    });
  });

  it("se valida sola, con los tres contextos posibles", () => {
    const worst = { height: true, confined_space: true, lifting: true };
    expect(validateTemplate(t, [{}, worst])).toEqual([]);
    expect(t.items.some((i) => i.autoSource)).toBe(false);
  });

  it("sin tareas especiales aplican 10 controles; con las tres, 16 (menos de 25)", () => {
    expect(scoring(applicableItems(t.items, { context: auditContext([]) }))).toHaveLength(10);
    expect(scoring(applicableItems(t.items, { context: auditContext(["height", "confined_space", "lifting"]) }))).toHaveLength(16);
  });

  it("cada tarea especial suma solo sus ítems", () => {
    const base = codes([]);
    expect(codes(["height"]).filter((c) => !base.includes(c))).toEqual(["height_harness", "height_anchor"]);
    expect(codes(["confined_space"]).filter((c) => !base.includes(c))).toEqual(["confined_gases", "confined_rescue"]);
    expect(codes(["lifting"]).filter((c) => !base.includes(c))).toEqual(["lifting_plan", "lifting_zone"]);
    expect(base.some((c) => /^(height|confined|lifting)_/.test(c))).toBe(false);
  });

  it("las observaciones son texto libre: no puntúan ni bloquean el cierre vacías", () => {
    const notes = t.items.filter((i) => i.kind === "text");
    expect(notes.map((i) => i.code)).toEqual(["notes_unsafe", "notes_positive"]);
    for (const n of notes) expect(n.required).toBe(false);
    const items = applicableItems(t.items, { context: auditContext([]) });
    const derived = deriveInspectionResult(evalItems(items), answers(items));
    expect(derived.complete).toBe(true);
    expect(derived.applicable).toBe(10);
    expect(derived.result).toBe("fit");
  });

  it("los críticos comunes son PTS, EPP, personal capacitado y bloqueo de energías", () => {
    const base = applicableItems(t.items, { context: auditContext([]) });
    expect(base.filter((i) => i.criticality === "critical").map((i) => i.code)).toEqual(["docs_pts", "people_ppe", "people_trained", "cond_lockout"]);
  });

  it("un permiso de trabajo ausente deja la auditoría no apta; una charla sin registrar, apta con observaciones", () => {
    const items = applicableItems(t.items, { context: auditContext([]) });
    expect(deriveInspectionResult(evalItems(items), answers(items, { docs_pts: "nonconform" })).result).toBe("unfit");
    expect(deriveInspectionResult(evalItems(items), answers(items, { docs_talk: "nonconform" })).result).toBe("fit_with_observations");
  });

  it("el bloqueo de energías admite «No aplica»", () => {
    const items = applicableItems(t.items, { context: auditContext([]) });
    const lockout = t.items.find((i) => i.code === "cond_lockout")!;
    expect(lockout.naAllowed).toBe(true);
    expect(deriveInspectionResult(evalItems(items), answers(items, { cond_lockout: "na" })).result).toBe("fit");
  });

  it("la foto es obligatoria en crítico y mayor y opcional en menor", () => {
    for (const i of scoring(t.items)) expect(i.photoOnNc).toBe(i.criticality !== "minor");
  });

  it("no tiene próxima fecha ni cambia el estado de ningún activo", () => {
    expect(nextInspectionDue({ inspectedAt: "2026-10-26", result: "unfit", interval: null, reinspectionDays: 7, retireOnUnfit: false, assetRetired: false }).dueAt).toBeNull();
    const policy = { retireOnUnfit: t.retireOnUnfit, canReinstate: t.canReinstate };
    expect(assetStatusAfter({ current: "in_service", result: "fit", policy, canRelease: true, origin: "close" }).change).toBeNull();
  });

  it("una crítica crea la acción y el hallazgo", () => {
    const plan = planFollowUp({
      subjectLabel: "Auditoría de campo · Obra Norte",
      nonconforming: [{ code: "docs_pts", text: "Permiso de trabajo seguro (PTS) firmado y vigente", criticality: "critical", comment: "Sin permiso" }],
      statusChange: null,
      typeKey: null,
      findingOnCritical: t.findingOnCritical,
    });
    expect(plan.action).toBeTruthy();
    expect(plan.finding).toBeTruthy();
  });
});

describe("tareas especiales y resumen", () => {
  it("normaliza: descarta lo desconocido y lo repetido, y respeta el orden del catálogo", () => {
    expect(normalizeSpecialTasks(["lifting", "height", "lifting", "otra", ""])).toEqual(["height", "lifting"]);
    expect(auditContext(["confined_space"])).toEqual({ height: false, confined_space: true, lifting: false });
  });

  it("resume el contexto en una línea, solo con lo que se cargó", () => {
    expect(fieldAuditSummary({ specialTasks: [] })).toBe("Auditoría de seguridad en campo");
    expect(
      fieldAuditSummary({ jobTask: { name: "Soldadura" }, contractorName: "Montajes SA", supervisor: { name: "Ana Gómez" }, specialTasks: ["lifting", "height"] }),
    ).toBe("Tarea: Soldadura · Contratista: Montajes SA · Supervisor: Ana Gómez · Tareas especiales: Trabajo en altura, Izaje");
  });
});

describe("cumplimiento del programa por sede", () => {
  it("sin meta no se mide", () => {
    expect(programCompliance(3, null)).toEqual({ done: 3, target: null, missing: 0, pct: null, status: "no_target" });
    expect(programCompliance(3, 0).status).toBe("no_target");
    expect(programCompliance(0, undefined).status).toBe("no_target");
  });

  it("2 de 4 es 50 % y faltan 2; 4 de 4 es 100 % y cumplida", () => {
    expect(programCompliance(2, 4)).toEqual({ done: 2, target: 4, missing: 2, pct: 50, status: "pending" });
    expect(programCompliance(4, 4)).toEqual({ done: 4, target: 4, missing: 0, pct: 100, status: "met" });
  });

  it("hacer de más no pasa de 100 % (no compensa a otra sede)", () => {
    expect(programCompliance(7, 4)).toMatchObject({ pct: 100, missing: 0, status: "met" });
  });

  it("redondea a un decimal", () => {
    expect(programCompliance(1, 3).pct).toBe(33.3);
    expect(programCompliance(2, 3).pct).toBe(66.7);
    expect(programCompliance(0, 5)).toMatchObject({ pct: 0, missing: 5, status: "pending" });
  });
});

describe("meses", () => {
  it("el rango de un mes es [primer día, primer día del siguiente)", () => {
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-11-01" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-03-01" });
  });

  it("rechaza un mes mal formado", () => {
    expect(() => monthRange("2026-13")).toThrow();
    expect(() => monthRange("26-10")).toThrow();
    expect(() => monthRange("2026-10-01")).toThrow();
  });

  it("navega entre meses y los nombra en español", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthLabel("2026-10")).toBe("octubre de 2026");
  });
});
