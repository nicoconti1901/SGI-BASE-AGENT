import { csvCell } from "@/domain/inspections/export";
import { formatDateEs } from "@/domain/inspections/dates";
import { magnitudeLabel } from "./types";
import { STATUS_LABELS, type InstrumentStatus } from "./status";

export type InstrumentCsvRow = {
  code: string;
  description: string;
  magnitude: string;
  site: string;
  responsible: string | null;
  status: InstrumentStatus;
  usable: boolean;
  reason: string | null;
  nextDueAt: string | null;
};

const SEP = ";";
const HEADERS = ["Código", "Equipo", "Magnitud", "Sede", "Responsable", "Estado", "¿Se puede usar?", "Motivo", "Próximo vencimiento"] as const;

export function instrumentCsvLine(row: InstrumentCsvRow): string {
  return [
    row.code,
    row.description,
    magnitudeLabel(row.magnitude),
    row.site,
    row.responsible,
    STATUS_LABELS[row.status],
    row.usable ? "Sí" : "No",
    row.reason,
    row.nextDueAt ? formatDateEs(row.nextDueAt) : "",
  ]
    .map(csvCell)
    .join(SEP);
}

/** CSV para Excel es-AR: UTF-8 con BOM y «;» como separador. */
export function instrumentsToCsv(rows: readonly InstrumentCsvRow[]): string {
  return `﻿${[HEADERS.join(SEP), ...rows.map(instrumentCsvLine)].join("\r\n")}\r\n`;
}
