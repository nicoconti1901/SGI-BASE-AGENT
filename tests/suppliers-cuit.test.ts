import { describe, expect, it } from "vitest";
import { cuitCheckDigit, formatCuit, isValidCuit, normalizeCuit } from "@/domain/suppliers/cuit";

describe("isValidCuit (módulo 11, pesos 5-4-3-2-7-6-5-4-3-2)", () => {
  it("tabla del SPEC", () => {
    expect(isValidCuit("20-12345678-6")).toEqual({ valid: true, value: "20123456786" });
    expect(isValidCuit("20-12345678-5")).toMatchObject({ valid: false, reason: "check_digit" });
    expect(isValidCuit("2012345678")).toMatchObject({ valid: false, reason: "length" });
    expect(isValidCuit("20-1234567A-6")).toMatchObject({ valid: false, reason: "format" });
    expect(isValidCuit("")).toMatchObject({ valid: false, reason: "empty" });
  });

  it("acepta guiones, puntos y espacios al ingreso", () => {
    expect(isValidCuit(" 20 12345678 6 ")).toEqual({ valid: true, value: "20123456786" });
    expect(isValidCuit("20.12345678.6")).toEqual({ valid: true, value: "20123456786" });
    expect(isValidCuit("20123456786")).toEqual({ valid: true, value: "20123456786" });
  });

  // Vectores contrastados con implementaciones abiertas independientes (gema cuitar, paquete PHP
  // cuit-cuil-validator y la guía de lookuptax): el ARCA no publica el algoritmo en un documento
  // que se haya podido consultar.
  it("vectores publicados por otras implementaciones", () => {
    expect(isValidCuit("20228518310").valid).toBe(true); // suma 154 = múltiplo de 11 → dígito 0
    expect(isValidCuit("33-69345023-9").valid).toBe(true);
    expect(isValidCuit("33-69345023-8").valid).toBe(false);
    expect(isValidCuit("30-50001091-2").valid).toBe(true);
  });

  it("dígito verificador 0 cuando el resto da 0 (11 − 0 = 11)", () => {
    expect(cuitCheckDigit("2022851831")).toBe(0);
    expect(cuitCheckDigit("3050001013")).toBe(0);
    expect(isValidCuit("30-50001013-0").valid).toBe(true);
  });

  it("si el cálculo da 10 no hay dígito posible con ese prefijo: inválido", () => {
    expect(cuitCheckDigit("2000000001")).toBeNull();
    for (const d of "0123456789") expect(isValidCuit(`2000000001${d}`).valid).toBe(false);
  });

  it("normalizeCuit y formatCuit", () => {
    expect(normalizeCuit("20-12345678-6")).toBe("20123456786");
    expect(normalizeCuit("abc")).toBeNull();
    expect(formatCuit("20123456786")).toBe("20-12345678-6");
    expect(formatCuit(null)).toBe("");
  });
});
