import { describe, expect, it } from "vitest";
import { computeSupplierSummary, type SummaryInput } from "@/domain/suppliers/summary";
import { isoDay } from "@/domain/suppliers/dates";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = d("2026-10-21");

const TYPES = [
  { id: "art", required: true, blocksEnablement: true },
  { id: "f931", required: true, blocksEnablement: true },
  { id: "cuit", required: true, blocksEnablement: false },
  { id: "rc", required: false, blocksEnablement: false },
];

const base: SummaryInput = {
  supplier: { criticality: "critical", inactiveAt: null },
  last: null,
  docTypes: TYPES,
  currentDocs: [],
  config: {},
  today,
};

const day = (x: Date | null) => (x ? isoDay(x) : null);

describe("computeSupplierSummary", () => {
  it("proveedor nuevo: sin evaluar, faltan todos los documentos obligatorios", () => {
    const s = computeSupplierSummary(base);
    expect(s).toMatchObject({
      status: "potential",
      lastEvaluationId: null,
      lastScore: null,
      nextEvaluationDueAt: null,
      attentionAt: null,
      missingRequiredDocs: 3,
      missingBlockingDocs: 2,
    });
  });

  it("aprobado crítico con documentación al día: próxima reevaluación a 12 meses", () => {
    const s = computeSupplierSummary({
      ...base,
      last: { id: "e1", result: "approved", evaluatedAt: d("2026-10-01"), totalScore: 92 },
      currentDocs: [
        { typeId: "art", expiresAt: d("2027-03-01") },
        { typeId: "f931", expiresAt: d("2026-11-15") },
        { typeId: "cuit", expiresAt: null },
      ],
    });
    expect(s).toMatchObject({ status: "approved", lastEvaluationId: "e1", lastScore: 92, missingRequiredDocs: 0, missingBlockingDocs: 0 });
    expect(day(s.nextEvaluationDueAt)).toBe("2027-10-01");
    expect(day(s.blockingDocExpiresAt)).toBe("2026-11-15"); // el bloqueante que vence primero
    expect(day(s.attentionAt)).toBe("2026-11-15");
  });

  it("ART vencida: el vencimiento queda en el pasado → atención ya vencida", () => {
    const s = computeSupplierSummary({
      ...base,
      last: { id: "e1", result: "approved", evaluatedAt: d("2026-10-01"), totalScore: 95 },
      currentDocs: [
        { typeId: "art", expiresAt: d("2026-10-10") },
        { typeId: "f931", expiresAt: null },
        { typeId: "cuit", expiresAt: null },
      ],
    });
    expect(day(s.blockingDocExpiresAt)).toBe("2026-10-10");
    expect(day(s.attentionAt)).toBe("2026-10-10");
    expect(s.missingBlockingDocs).toBe(0);
  });

  it("documento bloqueante que nunca se cargó: atención ya vencida (ayer)", () => {
    const s = computeSupplierSummary({
      ...base,
      last: { id: "e1", result: "approved", evaluatedAt: d("2026-10-01"), totalScore: 95 },
      currentDocs: [{ typeId: "art", expiresAt: null }, { typeId: "cuit", expiresAt: null }],
    });
    expect(s.missingBlockingDocs).toBe(1);
    expect(day(s.attentionAt)).toBe("2026-10-20");
  });

  it("un obligatorio no bloqueante vencido cuenta como faltante, pero no bloquea", () => {
    const s = computeSupplierSummary({
      ...base,
      last: { id: "e1", result: "approved", evaluatedAt: d("2026-10-01"), totalScore: 95 },
      currentDocs: [
        { typeId: "art", expiresAt: null },
        { typeId: "f931", expiresAt: null },
        { typeId: "cuit", expiresAt: d("2026-10-20") },
      ],
    });
    expect(s.missingRequiredDocs).toBe(1);
    expect(s.missingBlockingDocs).toBe(0);
    expect(s.attentionAt).not.toBeNull(); // la reevaluación
  });

  it("no aprobado: sin próxima reevaluación ni atención; de baja: queda de baja", () => {
    const notApproved = computeSupplierSummary({ ...base, last: { id: "e", result: "not_approved", evaluatedAt: d("2026-10-01"), totalScore: 40 } });
    expect(notApproved).toMatchObject({ status: "not_approved", nextEvaluationDueAt: null, attentionAt: null });
    const inactive = computeSupplierSummary({
      ...base,
      supplier: { criticality: "critical", inactiveAt: d("2026-10-05") },
      last: { id: "e", result: "approved", evaluatedAt: d("2026-10-01"), totalScore: 90 },
    });
    expect(inactive).toMatchObject({ status: "inactive", attentionAt: null });
  });

  it("cambiar la criticidad recalcula la próxima reevaluación", () => {
    const last = { id: "e1", result: "approved" as const, evaluatedAt: d("2026-10-01"), totalScore: 90 };
    expect(day(computeSupplierSummary({ ...base, last, supplier: { criticality: "standard", inactiveAt: null } }).nextEvaluationDueAt)).toBe("2028-10-01");
    expect(computeSupplierSummary({ ...base, last, supplier: { criticality: "low", inactiveAt: null } }).nextEvaluationDueAt).toBeNull();
  });

  it("la periodicidad de la empresa manda", () => {
    const last = { id: "e1", result: "approved" as const, evaluatedAt: d("2026-10-01"), totalScore: 90 };
    expect(day(computeSupplierSummary({ ...base, last, config: { critical: 6 } }).nextEvaluationDueAt)).toBe("2027-04-01");
  });

  it("es idempotente: recalcular con los mismos datos da lo mismo", () => {
    const input: SummaryInput = {
      ...base,
      last: { id: "e1", result: "conditional", evaluatedAt: d("2026-10-01"), totalScore: 70 },
      currentDocs: [{ typeId: "art", expiresAt: d("2027-01-01") }],
    };
    expect(computeSupplierSummary(input)).toEqual(computeSupplierSummary(input));
  });
});
