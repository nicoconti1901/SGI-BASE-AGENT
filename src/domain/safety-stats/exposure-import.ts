/**
 * Exposición mensual (horas trabajadas y dotación) por sede y grupo: importación por CSV y avisos de carga
 * (SPEC-accident-stats.md, slice 17.3). Funciones puras: no leen la base ni el reloj.
 * Columnas del CSV: sede, mes, empresa, horas, dotacion. Reimportar el mismo archivo no cambia nada.
 */
import { cleanName, normalizeKey, parseCsv, parseDateCell } from "@/domain/masterdata/roster";
import { validateExposure } from "./validation";
import type { EmployerKind, IsoDay, MonthKey } from "./types";

export const EXPOSURE_IMPORT_MAX_ROWS = 2000;
/** Meses hacia atrás (contando el actual) que se controlan para el aviso de carga. */
export const EXPOSURE_TRACKED_MONTHS = 3;

const pad = (n: number) => String(n).padStart(2, "0");

/** Corre un mes "AAAA-MM" hacia adelante o atrás. */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** La exposición de un mes se carga hasta el día `dueDay` del mes siguiente (D17). */
export function exposureDueDay(month: MonthKey, dueDay: number): IsoDay {
  return `${shiftMonth(month, 1)}-${pad(dueDay)}`;
}

/** Los meses con aviso de carga: el actual y los dos anteriores, del más viejo al más nuevo. */
export function exposureMonthsToTrack(today: IsoDay): MonthKey[] {
  const current = today.slice(0, 7);
  return Array.from({ length: EXPOSURE_TRACKED_MONTHS }, (_, i) => shiftMonth(current, i - (EXPOSURE_TRACKED_MONTHS - 1)));
}

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «2026-03» → «marzo 2026». */
export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1] ?? month} ${y}`;
}

export type ExposureImportRow = {
  /** Número de línea en el archivo (el encabezado es la 1). */
  line: number;
  siteRef: string;
  month: MonthKey;
  employerKind: EmployerKind;
  hours: number;
  headcountAvg: number;
  warnings: string[];
};

export type ExposureImportRowError = { line: number; field: string; message: string };

export const EXPOSURE_IMPORT_REQUIRED_HEADERS = ["sede", "mes", "empresa", "horas", "dotacion"] as const;

const OWN = new Set(["propio", "propia", "propios", "propias", "personal propio", "own"]);
const CONTRACTOR = new Set(["contratista", "contratistas", "personal contratista", "contratado", "contractor"]);

function parseEmployer(value: string): EmployerKind | null {
  const key = normalizeKey(value);
  if (OWN.has(key)) return "own";
  if (CONTRACTOR.has(key)) return "contractor";
  return null;
}

function parseMonthCell(value: string): MonthKey | null {
  const v = value.trim();
  const iso = /^(\d{4})-(\d{1,2})$/.exec(v);
  const latam = /^(\d{1,2})\/(\d{4})$/.exec(v);
  let y: number;
  let m: number;
  if (iso) [y, m] = [Number(iso[1]), Number(iso[2])];
  else if (latam) [m, y] = [Number(latam[1]), Number(latam[2])];
  else {
    const day = parseDateCell(v);
    return day ? day.slice(0, 7) : null;
  }
  return m >= 1 && m <= 12 ? `${y}-${pad(m)}` : null;
}

function parseHours(value: string): number | null {
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v);
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) return Number(v.replace(/\./g, ""));
  return null;
}

function parseHeadcount(value: string): number | null {
  const v = value.trim().replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(v) ? Number(v) : null;
}

/** Valida el CSV completo: devuelve las filas válidas y los errores con su número de línea. */
export function parseExposureCsv(
  text: string,
  opts: { currentMonth: MonthKey },
): { rows: ExposureImportRow[]; errors: ExposureImportRowError[] } {
  const table = parseCsv(text);
  if (table.length === 0 || (table.length === 1 && table[0].every((c) => c.trim() === ""))) {
    return { rows: [], errors: [{ line: 1, field: "archivo", message: "El archivo está vacío" }] };
  }
  const present = new Set(table[0].map((h) => normalizeKey(h)));
  const missing = EXPOSURE_IMPORT_REQUIRED_HEADERS.filter((h) => !present.has(h));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, field: "encabezado", message: `Faltan las columnas: ${missing.join(", ")}` }] };
  }
  if (table.length - 1 > EXPOSURE_IMPORT_MAX_ROWS) {
    return {
      rows: [],
      errors: [{ line: 1, field: "archivo", message: `El archivo tiene más de ${EXPOSURE_IMPORT_MAX_ROWS} filas: dividilo en partes` }],
    };
  }
  const col = (name: string) => table[0].findIndex((h) => normalizeKey(h) === name);
  const idx = { site: col("sede"), month: col("mes"), employer: col("empresa"), hours: col("horas"), headcount: col("dotacion") };

  const rows: ExposureImportRow[] = [];
  const errors: ExposureImportRowError[] = [];
  const seen = new Map<string, number>();

  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const cells = table[i];
    if (cells.every((c) => c.trim() === "")) continue;
    const cell = (j: number) => (cells[j] ?? "").trim();
    const before = errors.length;
    const fail = (field: string, message: string) => errors.push({ line, field, message });

    const siteRef = cleanName(cell(idx.site));
    if (!siteRef) fail("sede", "La sede es obligatoria");

    const month = parseMonthCell(cell(idx.month));
    if (!month) fail("mes", "Mes inválido: usá AAAA-MM o MM/AAAA");
    else if (month > opts.currentMonth) fail("mes", "No se puede cargar la exposición de un mes futuro");

    const employerKind = parseEmployer(cell(idx.employer));
    if (!employerKind) fail("empresa", "Usá «propio» o «contratista»");

    const hours = parseHours(cell(idx.hours));
    if (hours === null) fail("horas", "Las horas son un número entero, 0 o más");

    const headcountAvg = parseHeadcount(cell(idx.headcount));
    if (headcountAvg === null) fail("dotacion", "La dotación es un número, 0 o más (hasta 2 decimales)");

    if (errors.length > before || !month || !employerKind || hours === null || headcountAvg === null) continue;

    const check = validateExposure({ hours, headcountAvg });
    if (check.errors.hours || check.errors.headcountAvg) {
      if (check.errors.hours) fail("horas", check.errors.hours);
      if (check.errors.headcountAvg) fail("dotacion", check.errors.headcountAvg);
      continue;
    }

    const key = [normalizeKey(siteRef), month, employerKind].join("|");
    const first = seen.get(key);
    if (first !== undefined) {
      fail("fila", `Fila repetida en el archivo (esa sede, mes y grupo ya figuran en la línea ${first})`);
      continue;
    }
    seen.set(key, line);
    rows.push({ line, siteRef, month, employerKind, hours, headcountAvg, warnings: check.warnings });
  }
  return { rows, errors };
}

// ─── Plan de importación ───────────────────────────────────────────────────

export type ExistingExposure = { siteId: string; month: MonthKey; employerKind: EmployerKind; hours: number; headcountAvg: number };

export type ExposureImportAction = "create" | "update" | "unchanged" | "error";

export type ExposureImportItem = {
  line: number;
  action: ExposureImportAction;
  siteId?: string;
  row?: ExposureImportRow;
  /** Valores actuales, si se actualiza. */
  previous?: { hours: number; headcountAvg: number };
  message?: string;
};

export type ExposureImportPlan = {
  items: ExposureImportItem[];
  counts: Record<ExposureImportAction, number>;
};

/**
 * Compara el archivo con lo cargado: crea, actualiza o deja igual. Una sede que no existe es un error por
 * fila (no se crea en silencio). `existing` debe cubrir las sedes y meses del archivo.
 */
export function planExposureImport(
  existing: readonly ExistingExposure[],
  sites: readonly { id: string; name: string }[],
  rows: readonly ExposureImportRow[],
): ExposureImportPlan {
  const siteByName = new Map(sites.map((s) => [normalizeKey(s.name), s.id]));
  const current = new Map(existing.map((e) => [`${e.siteId}|${e.month}|${e.employerKind}`, e]));
  const items: ExposureImportItem[] = rows.map((row) => {
    const siteId = siteByName.get(normalizeKey(row.siteRef));
    if (!siteId) {
      return { line: row.line, action: "error", row, message: `No existe la sede «${row.siteRef}». Las sedes no se crean desde acá: creala en Datos maestros.` };
    }
    const found = current.get(`${siteId}|${row.month}|${row.employerKind}`);
    if (!found) return { line: row.line, action: "create", siteId, row };
    if (found.hours === row.hours && found.headcountAvg === row.headcountAvg) return { line: row.line, action: "unchanged", siteId, row };
    return { line: row.line, action: "update", siteId, row, previous: { hours: found.hours, headcountAvg: found.headcountAvg } };
  });
  const counts: ExposureImportPlan["counts"] = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const item of items) counts[item.action] += 1;
  return { items, counts };
}
