import { cleanName, normalizeKey, parseCsv } from "@/domain/masterdata/roster";
import { CUIT_ERROR_MESSAGES, isValidCuit } from "./cuit";
import type { SupplierCriticalityValue, SupplierTypeValue } from "./types";

export const MAX_IMPORT_ROWS = 2000;

export type SupplierCsvRow = {
  line: number;
  legalName: string;
  tradeName: string | null;
  taxId: string | null;
  type: SupplierTypeValue;
  category: string | null;
  criticality: SupplierCriticalityValue;
  criticalityReason: string | null;
  ownerEmail: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
};

export type SupplierCsvError = { line: number; field: string; message: string };

const HEADER_ALIASES: Record<string, string> = {
  razon_social: "legalName",
  "razon social": "legalName",
  proveedor: "legalName",
  nombre: "legalName",
  nombre_fantasia: "tradeName",
  "nombre fantasia": "tradeName",
  cuit: "taxId",
  tipo: "type",
  rubro: "category",
  criticidad: "criticality",
  motivo_criticidad: "criticalityReason",
  "motivo criticidad": "criticalityReason",
  motivo: "criticalityReason",
  responsable: "ownerEmail",
  contacto: "contactName",
  email: "contactEmail",
  mail: "contactEmail",
  telefono: "contactPhone",
  notas: "notes",
  observaciones: "notes",
};

const TYPE_VALUES: Record<string, SupplierTypeValue> = {
  producto: "product",
  product: "product",
  servicio: "service",
  service: "service",
  contratista: "contractor",
  contractor: "contractor",
};

const CRITICALITY_VALUES: Record<string, SupplierCriticalityValue> = {
  critico: "critical",
  critical: "critical",
  estandar: "standard",
  standard: "standard",
  "bajo impacto": "low",
  bajo_impacto: "low",
  bajo: "low",
  low: "low",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida el CSV completo: devuelve las filas válidas y los errores con su número de línea. */
export function parseSupplierCsv(text: string): { rows: SupplierCsvRow[]; errors: SupplierCsvError[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: [{ line: 1, field: "archivo", message: "El archivo está vacío" }] };

  const headerKeys = table[0].map((h) => HEADER_ALIASES[normalizeKey(h)] ?? null);
  const missing = (["legalName", "type"] as const).filter((k) => !headerKeys.includes(k));
  if (missing.length > 0) {
    const names = { legalName: "razon_social", type: "tipo" } as const;
    return {
      rows: [],
      errors: [{ line: 1, field: "encabezado", message: `Faltan las columnas: ${missing.map((m) => names[m]).join(", ")}` }],
    };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [{ line: 1, field: "archivo", message: `El archivo tiene más de ${MAX_IMPORT_ROWS} filas: dividilo en partes` }],
    };
  }

  const rows: SupplierCsvRow[] = [];
  const errors: SupplierCsvError[] = [];
  const seenTax = new Map<string, number>();
  const seenName = new Map<string, number>();

  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const cells: Record<string, string> = {};
    headerKeys.forEach((key, idx) => {
      if (key) cells[key] = (table[i][idx] ?? "").trim();
    });
    const before = errors.length;
    const fail = (field: string, message: string) => errors.push({ line, field, message });

    const legalName = cleanName(cells.legalName ?? "");
    if (legalName.length < 2) fail("razon_social", "La razón social es obligatoria");

    let taxId: string | null = null;
    if (cells.taxId) {
      const check = isValidCuit(cells.taxId);
      if (check.valid) taxId = check.value;
      else fail("cuit", CUIT_ERROR_MESSAGES[check.reason]);
    }

    const type = TYPE_VALUES[normalizeKey(cells.type ?? "")];
    if (!type) fail("tipo", "Usá «producto», «servicio» o «contratista»");

    const critKey = normalizeKey(cells.criticality ?? "");
    const criticality = critKey === "" ? "standard" : CRITICALITY_VALUES[critKey];
    if (!criticality) fail("criticidad", "Usá «crítico», «estándar» o «bajo impacto»");

    const criticalityReason = cleanName(cells.criticalityReason ?? "") || null;
    if ((criticality === "critical" || criticality === "low") && !criticalityReason) {
      fail("motivo_criticidad", "Falta el motivo: es obligatorio para proveedores críticos y de bajo impacto");
    }

    const contactEmail = cells.contactEmail?.trim() || null;
    if (contactEmail && !EMAIL.test(contactEmail)) fail("email", "El email no es válido");
    const ownerEmail = cells.ownerEmail?.trim().toLowerCase() || null;
    if (ownerEmail && !EMAIL.test(ownerEmail)) fail("responsable", "El responsable se indica con su email de usuario");

    if (errors.length === before) {
      const nameKey = normalizeKey(legalName);
      if (taxId && seenTax.has(taxId)) fail("cuit", `CUIT repetido en el archivo (ya figura en la línea ${seenTax.get(taxId)})`);
      else if (!taxId && seenName.has(nameKey)) fail("razon_social", `Proveedor repetido en el archivo (ya figura en la línea ${seenName.get(nameKey)})`);
      else {
        if (taxId) seenTax.set(taxId, line);
        else seenName.set(nameKey, line);
      }
    }
    if (errors.length > before || !type || !criticality) continue;

    rows.push({
      line,
      legalName,
      tradeName: cleanName(cells.tradeName ?? "") || null,
      taxId,
      type,
      category: cleanName(cells.category ?? "") || null,
      criticality,
      criticalityReason,
      ownerEmail,
      contactName: cleanName(cells.contactName ?? "") || null,
      contactEmail,
      contactPhone: cleanName(cells.contactPhone ?? "") || null,
      notes: cells.notes?.trim() || null,
    });
  }
  return { rows, errors };
}

export type ExistingSupplierKey = { taxId: string | null; legalName: string };
export type SupplierImportAction = "create" | "exists";
export type SupplierImportPlan = {
  items: { row: SupplierCsvRow; action: SupplierImportAction }[];
  counts: Record<SupplierImportAction, number>;
};

/**
 * Reimportar no duplica: se reconoce por CUIT, o por razón social si la fila no trae CUIT.
 * Lo que ya existe no se toca. Nada se aprueba al importar: todo entra como «sin evaluar».
 */
export function planSupplierImport(rows: readonly SupplierCsvRow[], existing: readonly ExistingSupplierKey[]): SupplierImportPlan {
  const taxIds = new Set(existing.map((e) => e.taxId).filter((t): t is string => Boolean(t)));
  const names = new Set(existing.map((e) => normalizeKey(e.legalName)));
  const items = rows.map((row) => ({
    row,
    action: (row.taxId ? taxIds.has(row.taxId) : names.has(normalizeKey(row.legalName))) ? ("exists" as const) : ("create" as const),
  }));
  return {
    items,
    counts: {
      create: items.filter((i) => i.action === "create").length,
      exists: items.filter((i) => i.action === "exists").length,
    },
  };
}

export const SUPPLIER_CSV_TEMPLATE = [
  "razon_social,cuit,tipo,rubro,criticidad,motivo_criticidad,responsable,contacto,email,telefono,notas",
  "Montajes del Sur SA,30-50001091-2,contratista,Montaje industrial,crítico,Trabaja en altura dentro de la planta,,Luis Gómez,luis@montajes.example,299 555 0101,",
  "Ferretería Central,,producto,Ferretería,bajo impacto,Compra ocasional de insumos menores,,,,,",
  "Laboratorio Andes SRL,20-12345678-6,servicio,Ensayos,estándar,,,,,,",
].join("\n");
