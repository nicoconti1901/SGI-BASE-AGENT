import { RESULT_LABELS, type InspectionResult } from "./types";

/** Tope de filas de una exportación: más que eso se afina con los filtros. */
export const MAX_EXPORT_ROWS = 20_000;

export type InspectionCsvRow = {
  inspectedAt: string;
  templateName: string;
  assetCode: string | null;
  assetDescription: string | null;
  siteName: string;
  sector: string | null;
  inspectorName: string;
  status: "draft" | "closed";
  result: InspectionResult | null;
  scorePct: number | null;
  conformCount: number | null;
  applicableCount: number | null;
  nonconformCount: number | null;
  closedAt: string | null;
  hasAction: boolean;
  hasFinding: boolean;
};

const SEP = ";";

/** Texto de celda seguro: entre comillas si hace falta y sin que una planilla lo tome por fórmula. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const HEADERS = [
  "Fecha",
  "Inspección",
  "Activo",
  "Descripción del activo",
  "Sede",
  "Sector",
  "Inspector",
  "Estado",
  "Resultado",
  "Puntaje %",
  "Conformes",
  "Aplicables",
  "No conformes",
  "Firmada",
  "Con acción de seguimiento",
  "Con hallazgo",
] as const;

const dmy = (iso: string) => iso.split("-").reverse().join("/");

export function inspectionCsvLine(row: InspectionCsvRow): string {
  return [
    dmy(row.inspectedAt),
    row.templateName,
    row.assetCode,
    row.assetDescription,
    row.siteName,
    row.sector,
    row.inspectorName,
    row.status === "closed" ? "Cerrada" : "Borrador",
    row.result ? RESULT_LABELS[row.result] : "",
    row.scorePct === null ? "" : String(row.scorePct).replace(".", ","),
    row.conformCount,
    row.applicableCount,
    row.nonconformCount,
    row.closedAt,
    row.hasAction ? "Sí" : "No",
    row.hasFinding ? "Sí" : "No",
  ]
    .map(csvCell)
    .join(SEP);
}

/** CSV para Excel es-AR: UTF-8 con BOM y «;» como separador. */
export function inspectionsToCsv(rows: readonly InspectionCsvRow[]): string {
  return `﻿${[HEADERS.join(SEP), ...rows.map(inspectionCsvLine)].join("\r\n")}\r\n`;
}
