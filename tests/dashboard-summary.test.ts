import { describe, expect, it } from "vitest";
import {
  describeDueItem,
  summarizeCompliance,
} from "@/domain/dashboard/summary";

const now = new Date("2026-09-30T12:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe("summarizeCompliance", () => {
  it("sin requisitos devuelve ceros y porcentaje nulo", () => {
    const s = summarizeCompliance([]);
    expect(s).toMatchObject({ total: 0, applicable: 0, conforming: 0, percent: null });
  });

  it("excluye 'No aplica' del denominador y cuenta conforme + automatizado", () => {
    const s = summarizeCompliance([
      "compliant",
      "automated",
      "partial",
      "missing",
      "pending",
      "not_applicable",
    ]);
    expect(s.total).toBe(6);
    expect(s.applicable).toBe(5);
    expect(s.conforming).toBe(2);
    expect(s.percent).toBe(40);
    expect(s.byStatus.partial).toBe(1);
    expect(s.byStatus.not_applicable).toBe(1);
  });

  it("todo 'No aplica' no genera porcentaje", () => {
    expect(summarizeCompliance(["not_applicable"]).percent).toBeNull();
  });
});

describe("describeDueItem", () => {
  const base = { title: "x", entityId: "abc" };

  it("clasifica vencido / próximo / en plazo por días restantes", () => {
    const d = (n: number) =>
      describeDueItem({ ...base, entityType: "risk", dueAt: inDays(n) }, "acme", now, 7);
    expect(d(-2).tone).toBe("overdue");
    expect(d(-2).daysLeft).toBe(-2);
    expect(d(3).tone).toBe("soon");
    expect(d(30).tone).toBe("ok");
  });

  it("resuelve tipo legible y link al detalle cuando la entidad tiene ruta propia", () => {
    const risk = describeDueItem(
      { ...base, entityType: "risk", dueAt: inDays(1) },
      "acme",
      now,
    );
    expect(risk.typeLabel).toBe("Riesgo");
    expect(risk.href).toBe("/t/acme/risks/abc");

    const audit = describeDueItem(
      { ...base, entityType: "audit_report", dueAt: inDays(1) },
      "acme",
      now,
    );
    expect(audit.href).toBe("/t/acme/audits/abc");
  });

  it("cae al listado del módulo cuando el id no tiene ruta propia", () => {
    const ind = describeDueItem(
      { ...base, entityType: "indicator_measurement", dueAt: inDays(1) },
      "acme",
      now,
    );
    expect(ind.href).toBe("/t/acme/indicators");
    const measure = describeDueItem(
      { ...base, entityType: "finding_measure", dueAt: inDays(1) },
      "acme",
      now,
    );
    expect(measure.href).toBe("/t/acme/findings");
  });

  it("arma el detalle de indicador y de medida cuando se conoce el padre", () => {
    const ind = describeDueItem(
      { ...base, entityType: "indicator_measurement", dueAt: inDays(1) },
      "acme",
      now,
      7,
      { objectiveId: "obj1" },
    );
    expect(ind.href).toBe("/t/acme/indicators/obj1/abc");
    const measure = describeDueItem(
      { ...base, entityType: "finding_measure", dueAt: inDays(1) },
      "acme",
      now,
      7,
      { findingId: "f1" },
    );
    expect(measure.href).toBe("/t/acme/findings/f1");
  });

  it("tipo desconocido: etiqueta genérica y sin link", () => {
    const u = describeDueItem(
      { ...base, entityType: "otra_cosa", dueAt: inDays(1) },
      "acme",
      now,
    );
    expect(u.typeLabel).toBe("Vencimiento");
    expect(u.href).toBeNull();
  });
});
