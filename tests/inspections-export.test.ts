import { describe, expect, it } from "vitest";
import { csvCell, inspectionsToCsv, type InspectionCsvRow } from "@/domain/inspections/export";

const row: InspectionCsvRow = {
  inspectedAt: "2026-10-22",
  templateName: "Control de extintores",
  assetCode: "EXT-001",
  assetDescription: "Pasillo; planta baja",
  siteName: "Base",
  sector: null,
  inspectorName: "Inés",
  status: "closed",
  result: "unfit",
  scorePct: 92.3,
  conformCount: 12,
  applicableCount: 13,
  nonconformCount: 1,
  closedAt: "22/10/2026 10:15",
  hasAction: true,
  hasFinding: false,
};

describe("exportación de inspecciones a CSV", () => {
  it("usa BOM, «;», fecha dd/mm/aaaa y coma decimal", () => {
    const csv = inspectionsToCsv([row]);
    expect(csv.startsWith("﻿Fecha;Inspección;")).toBe(true);
    const line = csv.split("\r\n")[1];
    expect(line).toContain("22/10/2026;Control de extintores;EXT-001;");
    expect(line).toContain(";No apto;92,3;12;13;1;");
    expect(line.endsWith(";Sí;No")).toBe(true);
  });

  it("entrecomilla los textos con «;» y neutraliza las fórmulas", () => {
    expect(inspectionsToCsv([row])).toContain('"Pasillo; planta baja"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('dice "hola"')).toBe('"dice ""hola"""');
    expect(csvCell(null)).toBe("");
  });

  it("un borrador no tiene resultado ni puntaje", () => {
    const line = inspectionsToCsv([{ ...row, status: "draft", result: null, scorePct: null, conformCount: null, applicableCount: null, nonconformCount: null, closedAt: null, hasAction: false }]).split("\r\n")[1];
    expect(line).toContain(";Borrador;;;;;;;No;No");
  });
});
