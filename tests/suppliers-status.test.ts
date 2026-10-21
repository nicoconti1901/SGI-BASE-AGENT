import { describe, expect, it } from "vitest";
import { addDays, addMonthsClamped, buenosAiresToday, daysBetween, isoDay } from "@/domain/suppliers/dates";
import { nextEvaluationDue } from "@/domain/suppliers/schedule";
import {
  computeAttentionAt,
  deriveSupplierStatus,
  describeAttention,
  documentStatus,
  isEnabled,
  supplierSemaphore,
} from "@/domain/suppliers/status";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("fechas", () => {
  it("suma meses de calendario con tope al último día del mes", () => {
    expect(isoDay(addMonthsClamped(d("2026-01-31"), 6))).toBe("2026-07-31");
    expect(isoDay(addMonthsClamped(d("2026-08-31"), 6))).toBe("2027-02-28");
    expect(isoDay(addMonthsClamped(d("2024-02-29"), 12))).toBe("2025-02-28");
    expect(isoDay(addMonthsClamped(d("2026-10-21"), 24))).toBe("2028-10-21");
    expect(isoDay(addMonthsClamped(d("2026-11-30"), 3))).toBe("2027-02-28");
  });

  it("el «hoy» es el día de calendario de Buenos Aires, no el de UTC", () => {
    // 02:00 UTC del 22 = 23:00 del 21 en Buenos Aires
    expect(isoDay(buenosAiresToday(new Date("2026-10-22T02:00:00Z")))).toBe("2026-10-21");
    expect(isoDay(buenosAiresToday(new Date("2026-10-22T12:00:00Z")))).toBe("2026-10-22");
  });

  it("addDays y daysBetween", () => {
    expect(isoDay(addDays(d("2026-10-21"), 10))).toBe("2026-10-31");
    expect(daysBetween(d("2026-10-21"), d("2026-11-02"))).toBe(12);
    expect(daysBetween(d("2026-10-21"), d("2026-10-18"))).toBe(-3);
  });
});

describe("nextEvaluationDue", () => {
  const cases: [string, "critical" | "standard" | "low", "approved" | "conditional" | "not_approved", string | null][] = [
    ["2026-10-21", "critical", "approved", "2027-10-21"],
    ["2026-10-21", "standard", "approved", "2028-10-21"],
    ["2026-10-21", "critical", "conditional", "2027-04-21"],
    ["2026-10-21", "standard", "conditional", "2027-04-21"],
    ["2026-10-21", "low", "approved", null],
    ["2026-10-21", "critical", "not_approved", null],
    ["2026-10-21", "standard", "not_approved", null],
    ["2026-10-21", "low", "not_approved", null],
    ["2026-01-31", "critical", "conditional", "2026-07-31"],
    ["2026-08-31", "standard", "conditional", "2027-02-28"],
    ["2024-02-29", "critical", "approved", "2025-02-28"],
  ];
  it.each(cases)("%s · %s · %s → %s", (last, crit, result, expected) => {
    const next = nextEvaluationDue(d(last), crit, result);
    expect(next ? isoDay(next) : null).toBe(expected);
  });

  it("configurable por empresa: crítico cada 6 meses", () => {
    expect(isoDay(nextEvaluationDue(d("2026-10-21"), "critical", "approved", { critical: 6 })!)).toBe("2027-04-21");
  });

  it("un condicional de bajo impacto igual se revisa a los 6 meses", () => {
    expect(isoDay(nextEvaluationDue(d("2026-10-21"), "low", "conditional")!)).toBe("2027-04-21");
  });

  it("si la empresa apaga la periodicidad de una criticidad (null), no hay próxima", () => {
    expect(nextEvaluationDue(d("2026-10-21"), "standard", "approved", { standard: null })).toBeNull();
  });
});

describe("deriveSupplierStatus", () => {
  it("tabla del SPEC", () => {
    expect(deriveSupplierStatus(d("2026-01-01"), { result: "approved" })).toBe("inactive");
    expect(deriveSupplierStatus(null, null)).toBe("potential");
    expect(deriveSupplierStatus(null, { result: "approved" })).toBe("approved");
    expect(deriveSupplierStatus(null, { result: "conditional" })).toBe("conditional");
    expect(deriveSupplierStatus(null, { result: "not_approved" })).toBe("not_approved");
  });
});

describe("documentStatus", () => {
  const today = d("2026-10-21");
  it("tabla del SPEC", () => {
    expect(documentStatus(null, today, 30)).toBe("valid");
    expect(documentStatus(d("2026-10-20"), today, 30)).toBe("expired");
    expect(documentStatus(d("2026-10-21"), today, 30)).toBe("expiring"); // el día del vencimiento todavía es válido
    expect(documentStatus(d("2026-11-20"), today, 30)).toBe("expiring");
    expect(documentStatus(d("2026-11-21"), today, 30)).toBe("valid");
  });
});

describe("supplierSemaphore", () => {
  const now = d("2026-10-21");
  const plus = (days: number) => addDays(now, days);

  it("tabla del SPEC", () => {
    expect(supplierSemaphore("potential", null, 0, now)).toBe("gray");
    expect(supplierSemaphore("inactive", plus(-5), 0, now)).toBe("gray");
    expect(supplierSemaphore("not_approved", null, 0, now)).toBe("red");
    expect(supplierSemaphore("approved", plus(-1), 0, now)).toBe("red");
    expect(supplierSemaphore("approved", now, 0, now)).toBe("amber");
    expect(supplierSemaphore("approved", plus(10), 0, now)).toBe("amber");
    expect(supplierSemaphore("approved", plus(45), 0, now)).toBe("green");
    expect(supplierSemaphore("approved", null, 0, now)).toBe("green");
    expect(supplierSemaphore("approved", null, 1, now)).toBe("amber");
    expect(supplierSemaphore("conditional", plus(200), 0, now)).toBe("amber");
  });

  it("la ventana es inclusiva: a 30 días es ámbar, a 31 verde", () => {
    expect(supplierSemaphore("approved", plus(30), 0, now)).toBe("amber");
    expect(supplierSemaphore("approved", plus(31), 0, now)).toBe("green");
    expect(supplierSemaphore("approved", plus(31), 0, now, 45)).toBe("amber");
  });

  it("un condicional vencido es rojo", () => {
    expect(supplierSemaphore("conditional", plus(-2), 0, now)).toBe("red");
  });
});

describe("isEnabled", () => {
  const now = d("2026-10-21");
  it("habilitado = aprobado o condicional, sin documento bloqueante faltante ni vencido", () => {
    expect(isEnabled("approved", 0, null, now)).toBe(true);
    expect(isEnabled("conditional", 0, d("2026-10-21"), now)).toBe(true);
    expect(isEnabled("approved", 0, d("2026-10-20"), now)).toBe(false); // ART vencida
    expect(isEnabled("approved", 1, null, now)).toBe(false); // nunca se cargó
    expect(isEnabled("not_approved", 0, null, now)).toBe(false);
    expect(isEnabled("potential", 0, null, now)).toBe(false);
    expect(isEnabled("inactive", 0, null, now)).toBe(false);
  });

  it("contratista con ART vencida: no habilitado aunque tenga 95 puntos", () => {
    // El puntaje no entra en la decisión: es un concepto separado.
    expect(isEnabled("approved", 0, d("2026-09-30"), now)).toBe(false);
  });
});

describe("computeAttentionAt", () => {
  const today = d("2026-10-21");
  it("es el menor entre la reevaluación y el documento bloqueante que vence", () => {
    expect(isoDay(computeAttentionAt({ status: "approved", nextEvaluationDueAt: d("2027-01-10"), blockingDocExpiresAt: d("2026-12-01"), missingBlockingDocs: 0, today })!)).toBe("2026-12-01");
    expect(isoDay(computeAttentionAt({ status: "approved", nextEvaluationDueAt: d("2026-11-10"), blockingDocExpiresAt: d("2026-12-01"), missingBlockingDocs: 0, today })!)).toBe("2026-11-10");
  });
  it("un documento bloqueante faltante queda ya vencido (el día anterior a hoy)", () => {
    expect(isoDay(computeAttentionAt({ status: "approved", nextEvaluationDueAt: null, blockingDocExpiresAt: null, missingBlockingDocs: 1, today })!)).toBe("2026-10-20");
  });
  it("sin nada pendiente es nulo; potencial, de baja y no aprobado no tienen", () => {
    expect(computeAttentionAt({ status: "approved", nextEvaluationDueAt: null, blockingDocExpiresAt: null, missingBlockingDocs: 0, today })).toBeNull();
    for (const status of ["potential", "inactive", "not_approved"] as const) {
      expect(computeAttentionAt({ status, nextEvaluationDueAt: d("2026-11-10"), blockingDocExpiresAt: null, missingBlockingDocs: 1, today })).toBeNull();
    }
  });
});

describe("describeAttention", () => {
  const today = d("2026-10-21");
  const base = { status: "approved" as const, nextEvaluationDueAt: null, blockingDocExpiresAt: null, missingBlockingDocs: 0, missingRequiredDocs: 0, today };
  it("textos para la lista", () => {
    expect(describeAttention({ ...base, nextEvaluationDueAt: d("2026-11-02") })).toBe("Reevaluar en 12 días");
    expect(describeAttention({ ...base, nextEvaluationDueAt: d("2026-10-21") })).toBe("Reevaluar hoy");
    expect(describeAttention({ ...base, nextEvaluationDueAt: d("2026-10-18") })).toBe("Reevaluación vencida hace 3 días");
    expect(describeAttention({ ...base, blockingDocExpiresAt: d("2026-10-18") })).toBe("Documentación vencida hace 3 días");
    expect(describeAttention({ ...base, blockingDocExpiresAt: d("2026-10-25") })).toBe("Documentación vence en 4 días");
    expect(describeAttention({ ...base, missingBlockingDocs: 2 })).toBe("Falta documentación obligatoria");
    expect(describeAttention({ ...base, missingRequiredDocs: 1 })).toBe("Falta documentación");
    expect(describeAttention(base)).toBe("");
    expect(describeAttention({ ...base, status: "potential" })).toBe("Todavía sin evaluar");
    expect(describeAttention({ ...base, status: "not_approved" })).toBe("No aprobado: se reevalúa a pedido");
    expect(describeAttention({ ...base, status: "inactive" })).toBe("");
  });
});
