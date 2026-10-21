import { cleanName, normalizeKey, parseCsv, parseDateCell } from "@/domain/masterdata/roster";
import type { Ownership } from "../types";
import type { AssetTypeDef } from "./index";
import { normalizeAssetCode, resolveDueDates, type DueInput, type ResolvedDueDate } from "./resolve";

export const MAX_IMPORT_ROWS = 1000;

export type AssetCsvIssue = { line: number; field: string; message: string };

export type AssetCsvRow = {
  line: number;
  code: string;
  description: string;
  siteName: string;
  sector: string | null;
  ownership: Ownership;
  contractorName: string | null;
  /** Legajo de la persona asignada (se resuelve contra datos maestros al aplicar). */
  assignedPersonCode: string | null;
  attributes: Record<string, unknown>;
  dueDates: ResolvedDueDate[];
};

export function assetCsvTemplate(type: AssetTypeDef): string {
  const headers = [
    "codigo",
    "descripcion",
    "sede",
    "sector",
    ...type.csvAttributes.map((c) => c.header),
    ...type.csvDueDates.map((c) => c.header),
    "propiedad",
    "contratista",
    "legajo_asignado",
  ];
  return `${headers.join(",")}\n`;
}

function parseOwnership(raw: string): Ownership | null {
  const k = normalizeKey(raw);
  if (k === "" || k === "propio" || k === "propia" || k === "own") return "own";
  if (k === "alquilado" || k === "alquilada" || k === "rented") return "rented";
  if (k === "contratista" || k === "de contratista" || k === "contractor") return "contractor";
  return null;
}

/**
 * Lee el CSV de activos de un tipo: devuelve las filas válidas y los errores con su número de línea.
 * No consulta la base: que la sede o la persona existan lo resuelve quien aplica la importación.
 */
export function parseAssetCsv(type: AssetTypeDef, text: string): { rows: AssetCsvRow[]; errors: AssetCsvIssue[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: [{ line: 1, field: "archivo", message: "El archivo está vacío" }] };

  const headers = table[0].map((h) => normalizeKey(h));
  const required = requiredKeys(type);
  const requiredHeaders = ["codigo", "descripcion", "sede", ...type.csvAttributes.filter((c) => required.has(c.key)).map((c) => c.header)];
  const missing = requiredHeaders.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, field: "encabezado", message: `Faltan las columnas: ${missing.join(", ")}` }] };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 1, field: "archivo", message: `El archivo tiene más de ${MAX_IMPORT_ROWS} filas: dividilo en partes` }] };
  }

  const cell = (row: string[], header: string) => (row[headers.indexOf(header)] ?? "").trim();
  const rows: AssetCsvRow[] = [];
  const errors: AssetCsvIssue[] = [];
  const seen = new Map<string, number>();

  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const row = table[i];
    const before = errors.length;
    const fail = (field: string, message: string) => errors.push({ line, field, message });

    const code = normalizeAssetCode(cell(row, "codigo"));
    if (!code.ok) fail("codigo", code.message);
    else {
      const first = seen.get(code.code);
      if (first !== undefined) fail("codigo", `Código repetido en el archivo (ya figura en la línea ${first})`);
      else seen.set(code.code, line);
    }
    const description = cleanName(cell(row, "descripcion"));
    if (!description) fail("descripcion", "La descripción es obligatoria");
    const siteName = cleanName(cell(row, "sede"));
    if (!siteName) fail("sede", "La sede es obligatoria");

    const ownership = parseOwnership(cell(row, "propiedad"));
    if (!ownership) fail("propiedad", "Usá «propio», «alquilado» o «contratista»");
    const contractorName = cleanName(cell(row, "contratista")) || null;
    if (ownership === "contractor" && !contractorName) fail("contratista", "Indicá el nombre del contratista");

    const raw: Record<string, unknown> = {};
    for (const col of type.csvAttributes) {
      if (!headers.includes(col.header)) continue;
      const value = cell(row, col.header);
      if (value === "" && !required.has(col.key)) continue; // opcional o con valor por defecto
      const parsed = col.parse(value);
      if (parsed.ok) raw[col.key] = parsed.value;
      else fail(col.header, `${col.label}: ${parsed.message}`);
    }
    const attributes = type.attributesSchema.safeParse(raw);
    if (!attributes.success && errors.length === before) {
      for (const issue of attributes.error.issues) fail(String(issue.path[0] ?? "atributos"), issue.message);
    }

    const dueInputs: DueInput[] = [];
    for (const col of type.csvDueDates) {
      if (!headers.includes(col.header)) continue;
      const value = cell(row, col.header);
      if (!value) continue;
      const iso = parseDateCell(value);
      if (!iso) {
        fail(col.header, `${col.label}: fecha inválida (AAAA-MM-DD o DD/MM/AAAA)`);
        continue;
      }
      let input = dueInputs.find((d) => d.kind === col.kind);
      if (!input) dueInputs.push((input = { kind: col.kind }));
      if (col.mode === "last") input.lastDoneAt = iso;
      else input.dueAt = iso;
    }

    if (errors.length > before || !code.ok || !attributes.success) continue;

    const resolved = resolveDueDates(type, attributes.data, dueInputs);
    for (const issue of resolved.issues) fail(issue.field, issue.message);
    if (errors.length > before) continue;

    rows.push({
      line,
      code: code.code,
      description,
      siteName,
      sector: cleanName(cell(row, "sector")) || null,
      ownership: ownership!,
      contractorName: ownership === "own" ? null : contractorName,
      assignedPersonCode: cleanName(cell(row, "legajo_asignado")) || null,
      attributes: attributes.data,
      dueDates: resolved.dueDates,
    });
  }
  return { rows, errors };
}

function requiredKeys(type: AssetTypeDef): Set<string> {
  // Las claves sin `.optional()` ni `.default()` en el esquema son las obligatorias.
  const probe = type.attributesSchema.safeParse({});
  const missing = probe.success ? [] : probe.error.issues.map((i) => String(i.path[0]));
  return new Set(missing);
}
