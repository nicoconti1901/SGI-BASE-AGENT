import { formatCuit } from "./cuit";
import { isoDay } from "./dates";
import { isEnabled } from "./status";
import {
  SUPPLIER_CRITICALITY_LABELS,
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_TYPE_LABELS,
  type SupplierCriticalityValue,
  type SupplierStatusValue,
  type SupplierTypeValue,
} from "./types";

export type ApprovedListSupplier = {
  id: string;
  legalName: string;
  taxId: string | null;
  type: SupplierTypeValue;
  category: string | null;
  criticality: SupplierCriticalityValue;
  status: SupplierStatusValue;
  lastScore: number | null;
  nextEvaluationDueAt: Date | null;
  missingBlockingDocs: number;
  blockingDocExpiresAt: Date | null;
};

export type ApprovedList = {
  generatedAt: Date;
  entries: ApprovedListSupplier[];
  /** Aprobados que no figuran por documentación vencida o faltante. */
  excludedForDocs: number;
};

const byName = (a: { legalName: string }, b: { legalName: string }) =>
  a.legalName.localeCompare(b.legalName, "es", { sensitivity: "base" });

/** Solo los aprobados (no los «con condiciones», decisión del PO 2026-10-29) y habilitados, por razón social; los que quedan afuera por documentación se cuentan aparte. */
export function buildApprovedList(suppliers: readonly ApprovedListSupplier[], now: Date): ApprovedList {
  const candidates = suppliers.filter((s) => s.status === "approved");
  const enabled = candidates.filter((s) => isEnabled(s.status, s.missingBlockingDocs, s.blockingDocExpiresAt, now));
  return {
    generatedAt: now,
    entries: enabled.sort(byName),
    excludedForDocs: candidates.length - enabled.length,
  };
}

const SEP = ";";

/** Texto de celda seguro: entre comillas si hace falta y sin que una planilla lo tome por fórmula. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const dmy = (date: Date) => isoDay(date).split("-").reverse().join("/");

const BA_DATETIME = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatDateTimeAr(date: Date): string {
  return BA_DATETIME.format(date).replace(",", "");
}

/** CSV para Excel es-AR: UTF-8 con BOM y «;» como separador. */
export function approvedListToCsv(
  list: ApprovedList,
  meta: { tenantName: string; generatedBy: string; generatedAt: Date },
): string {
  const row = (cells: (string | number | null)[]) => cells.map(csvCell).join(SEP);
  const lines = [
    row([`Lista de aprobados - ${meta.tenantName}`]),
    row([`Generada el ${formatDateTimeAr(meta.generatedAt)} por ${meta.generatedBy}`]),
    "",
    row(["Razón social", "CUIT", "Tipo", "Rubro", "Criticidad", "Estado", "Próxima reevaluación"]),
    ...list.entries.map((e) =>
      row([
        e.legalName,
        formatCuit(e.taxId),
        SUPPLIER_TYPE_LABELS[e.type],
        e.category,
        SUPPLIER_CRITICALITY_LABELS[e.criticality],
        SUPPLIER_STATUS_LABELS[e.status],
        e.nextEvaluationDueAt ? dmy(e.nextEvaluationDueAt) : "",
      ]),
    ),
    "",
    row([`${list.excludedForDocs} no figuran por documentación vencida o faltante`]),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
