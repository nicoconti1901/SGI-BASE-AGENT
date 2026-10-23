import { describe, expect, it } from "vitest";
import { COMPLIANCE_CSV_PREFIX, complianceCsvLine, csvCell } from "@/domain/training/export";

describe("exportación del cumplimiento a CSV", () => {
  it("empieza con BOM y encabezado separado por «;»", () => {
    expect(COMPLIANCE_CSV_PREFIX).toBe("﻿Legajo;Persona;Sede;Puesto;Curso;Carácter;Estado;Vence\r\n");
  });

  it("una fila por persona y curso, con estado en español y fecha dd/mm/aaaa", () => {
    const line = complianceCsvLine({ employeeCode: "L1", personName: "Ana Pérez", siteName: "Base", positionName: "Operario", courseName: "Trabajo en altura", mandatory: true, status: "expiring", validUntil: "2026-11-20" });
    expect(line).toBe("L1;Ana Pérez;Base;Operario;Trabajo en altura;Obligatorio;Por vencer;20/11/2026");
  });

  it("lo recomendado sin vencimiento deja la fecha vacía", () => {
    const line = complianceCsvLine({ employeeCode: "L2", personName: "Beto", siteName: "Norte", positionName: "Chofer", courseName: "Manejo defensivo", mandatory: false, status: "missing", validUntil: null });
    expect(line.endsWith(";Recomendado;Falta;")).toBe(true);
  });

  it("entrecomilla los textos con «;» y neutraliza las fórmulas", () => {
    expect(csvCell("Altura; nivel 2")).toBe('"Altura; nivel 2"');
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell(null)).toBe("");
  });
});
