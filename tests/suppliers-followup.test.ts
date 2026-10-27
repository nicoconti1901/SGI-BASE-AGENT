import { describe, expect, it } from "vitest";
import { buildSupplierFindingTitle, scoreTrend, validateCommunication } from "@/domain/suppliers/findings";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = d("2026-10-21");

describe("buildSupplierFindingTitle", () => {
  it("arma «Tipo · Proveedor: primera línea»", () => {
    expect(buildSupplierFindingTitle("delivery", "Transportes Sur SA", "Llegó con 3 días de atraso\nSegunda línea")).toBe(
      "Entrega · Transportes Sur SA: Llegó con 3 días de atraso",
    );
  });

  it("sin descripción deja solo el encabezado y acota los títulos largos", () => {
    expect(buildSupplierFindingTitle("claim", " Sur SA ", "")).toBe("Reclamo · Sur SA");
    const long = buildSupplierFindingTitle("quality", "Sur SA", "x".repeat(300));
    expect(long.length).toBe(138);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("validateCommunication", () => {
  const ok = { kind: "requirements", channel: "email", sentAt: d("2026-10-20"), summary: "Se enviaron los requisitos de seguridad" };

  it("una comunicación completa no tiene errores; hoy es válido", () => {
    expect(validateCommunication(ok, today)).toEqual({});
    expect(validateCommunication({ ...ok, sentAt: today }, today)).toEqual({});
  });

  it("rechaza fecha futura, faltante o inválida", () => {
    expect(validateCommunication({ ...ok, sentAt: d("2026-10-22") }, today).sentAt).toMatch(/futura/);
    expect(validateCommunication({ ...ok, sentAt: null }, today).sentAt).toMatch(/fecha/);
    expect(validateCommunication({ ...ok, sentAt: new Date("nope") }, today).sentAt).toBeDefined();
  });

  it("exige tipo y canal conocidos y un resumen", () => {
    const errors = validateCommunication({ kind: "otro", channel: "paloma", sentAt: today, summary: " a " }, today);
    expect(Object.keys(errors).sort()).toEqual(["channel", "kind", "summary"]);
  });
});

describe("scoreTrend", () => {
  const ev = (iso: string, totalScore: number | null, voided = false) => ({ evaluatedAt: d(iso), totalScore, voided });

  it("ordena del más antiguo al más reciente y calcula la variación", () => {
    const trend = scoreTrend([ev("2027-10-01", 78.5), ev("2026-10-01", 90), ev("2028-10-01", 82)]);
    expect(trend.map((t) => t.score)).toEqual([90, 78.5, 82]);
    expect(trend.map((t) => t.delta)).toEqual([null, -11.5, 3.5]);
  });

  it("dos evaluaciones del mismo día se ordenan por cuándo se cargaron", () => {
    const sameDay = d("2026-10-21");
    const trend = scoreTrend([
      { evaluatedAt: sameDay, createdAt: new Date("2026-10-21T16:00:00Z"), totalScore: 80, voided: false },
      { evaluatedAt: sameDay, createdAt: new Date("2026-10-21T15:00:00Z"), totalScore: 100, voided: false },
    ]);
    expect(trend.map((t) => t.score)).toEqual([100, 80]);
    expect(trend[1].delta).toBe(-20);
  });

  it("no cuenta las anuladas ni las aceptaciones sin puntaje", () => {
    const trend = scoreTrend([ev("2026-01-01", 80), ev("2026-06-01", 50, true), ev("2026-09-01", null), ev("2026-10-01", 85)]);
    expect(trend.map((t) => t.score)).toEqual([80, 85]);
  });

  it("se queda con las últimas N", () => {
    const many = Array.from({ length: 15 }, (_, i) => ev(`2026-${String(i < 9 ? i + 1 : 9).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`, 60 + i));
    const trend = scoreTrend(many, 12);
    expect(trend).toHaveLength(12);
    expect(trend[11].score).toBe(74);
  });

  it("sin datos devuelve una lista vacía", () => {
    expect(scoreTrend([])).toEqual([]);
  });
});
