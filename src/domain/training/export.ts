import { TRAINING_STATUS_LABELS, type TrainingStatus } from "./types";

const SEP = ";";

/** Texto de celda seguro: entre comillas si hace falta y sin que una planilla lo tome por fórmula. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export type ComplianceCsvRow = {
  employeeCode: string;
  personName: string;
  siteName: string;
  positionName: string;
  courseName: string;
  mandatory: boolean;
  status: Exclude<TrainingStatus, "not_required">;
  validUntil: string | null;
};

export const COMPLIANCE_CSV_HEADER = ["Legajo", "Persona", "Sede", "Puesto", "Curso", "Carácter", "Estado", "Vence"].join(SEP);

const dmy = (iso: string) => iso.split("-").reverse().join("/");

export function complianceCsvLine(row: ComplianceCsvRow): string {
  return [
    row.employeeCode,
    row.personName,
    row.siteName,
    row.positionName,
    row.courseName,
    row.mandatory ? "Obligatorio" : "Recomendado",
    TRAINING_STATUS_LABELS[row.status],
    row.validUntil ? dmy(row.validUntil) : "",
  ]
    .map(csvCell)
    .join(SEP);
}

/** Primera parte del archivo: BOM de UTF-8 y encabezado (Excel es-AR usa «;»). */
export const COMPLIANCE_CSV_PREFIX = `﻿${COMPLIANCE_CSV_HEADER}\r\n`;
