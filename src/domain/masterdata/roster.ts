import type {
  EmployerValue,
  MasterDataEntity,
  RosterPersonSnapshot,
  RosterRow,
  RosterRowError,
} from "./types";
import { MASTER_DATA_ENTITY_LABELS } from "./types";
import { isValidDocumentId } from "./rules";

/** Clave de comparación: sin tildes, sin mayúsculas y sin espacios repetidos. */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Parser CSV mínimo: comillas dobles, delimitador `,` o `;` (Excel es-AR), BOM y CRLF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const HEADER_ALIASES: Record<string, string> = {
  legajo: "employeeCode",
  nombre: "name",
  dni: "documentId",
  sede: "site",
  sedes_adicionales: "extraSites",
  "sedes adicionales": "extraSites",
  puesto: "position",
  empresa: "employer",
  contratista: "contractorName",
  ingreso: "hiredAt",
  tareas: "tasks",
};

export const ROSTER_REQUIRED_HEADERS = ["legajo", "nombre", "sede", "puesto"] as const;

/** Varios valores en una celda van separados por `|`. */
function splitMulti(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split("|")) {
    const name = cleanName(part);
    if (!name || seen.has(normalizeKey(name))) continue;
    seen.add(normalizeKey(name));
    out.push(name);
  }
  return out;
}

/** Acepta YYYY-MM-DD o DD/MM/YYYY. Devuelve YYYY-MM-DD o null si es inválida. */
export function parseDateCell(value: string): string | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const latam = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (latam) [d, m, y] = [Number(latam[1]), Number(latam[2]), Number(latam[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseEmployer(value: string): EmployerValue | null {
  const key = normalizeKey(value);
  if (key === "" || key === "propia" || key === "propio" || key === "own") return "own";
  if (key === "contratista" || key === "contractor") return "contractor";
  return null;
}

export type ParsedRoster = {
  rows: RosterRow[];
  errors: RosterRowError[];
};

/** Valida el CSV completo: devuelve las filas válidas y los errores con su número de línea. */
export function parseRoster(text: string): ParsedRoster {
  const table = parseCsv(text);
  const errors: RosterRowError[] = [];
  if (table.length === 0) {
    return { rows: [], errors: [{ line: 1, field: "archivo", message: "El archivo está vacío" }] };
  }

  const headerKeys = table[0].map((h) => HEADER_ALIASES[normalizeKey(h)] ?? null);
  const missing = ROSTER_REQUIRED_HEADERS.filter((h) => !table[0].some((c) => normalizeKey(c) === h));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, field: "encabezado", message: `Faltan las columnas: ${missing.join(", ")}` }],
    };
  }

  const rows: RosterRow[] = [];
  const seenCodes = new Map<string, number>();
  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const cells: Record<string, string> = {};
    headerKeys.forEach((key, idx) => {
      if (key) cells[key] = (table[i][idx] ?? "").trim();
    });
    const fail = (field: string, message: string) => errors.push({ line, field, message });
    const before = errors.length;

    const employeeCode = cleanName(cells.employeeCode ?? "");
    const name = cleanName(cells.name ?? "");
    const siteName = cleanName(cells.site ?? "");
    const positionName = cleanName(cells.position ?? "");
    if (!employeeCode) fail("legajo", "El legajo es obligatorio");
    if (!name) fail("nombre", "El nombre es obligatorio");
    if (!siteName) fail("sede", "La sede es obligatoria");
    if (!positionName) fail("puesto", "El puesto es obligatorio");

    if (employeeCode) {
      const key = normalizeKey(employeeCode);
      const first = seenCodes.get(key);
      if (first !== undefined) fail("legajo", `Legajo repetido en el archivo (ya figura en la línea ${first})`);
      else seenCodes.set(key, line);
    }

    if (!isValidDocumentId(cells.documentId)) fail("dni", "El DNI debe tener entre 7 y 9 dígitos");

    const employer = parseEmployer(cells.employer ?? "");
    if (!employer) fail("empresa", "Usá «propia» o «contratista»");

    let hiredAt: string | null = null;
    if (cells.hiredAt) {
      hiredAt = parseDateCell(cells.hiredAt);
      if (!hiredAt) fail("ingreso", "Fecha inválida: usá AAAA-MM-DD o DD/MM/AAAA");
    }

    const extraSiteNames = splitMulti(cells.extraSites ?? "").filter(
      (s) => normalizeKey(s) !== normalizeKey(siteName),
    );

    if (errors.length > before || !employer) continue;
    rows.push({
      line,
      employeeCode,
      name,
      documentId: cells.documentId ? cells.documentId.replace(/[.\s]/g, "") : null,
      employer,
      contractorName: employer === "contractor" ? cleanName(cells.contractorName ?? "") || null : null,
      siteName,
      extraSiteNames,
      positionName,
      hiredAt,
      taskNames: splitMulti(cells.tasks ?? ""),
    });
  }
  return { rows, errors };
}

export type RosterAction = "create" | "update" | "unchanged" | "blocked";

export type RosterPlanItem = {
  row: RosterRow;
  action: RosterAction;
  /** Campos que cambian (solo en `update`). */
  changes: string[];
  /** Motivo (solo en `blocked`). */
  reason?: string;
};

export type RosterPlan = {
  items: RosterPlanItem[];
  /** Nombres que no existen en el catálogo y se crearían al confirmar. */
  toCreate: Record<MasterDataEntity, string[]>;
  counts: Record<RosterAction, number>;
};

function sameSet(a: string[], b: string[]): boolean {
  const left = new Set(a.map(normalizeKey));
  const right = new Set(b.map(normalizeKey));
  return left.size === right.size && [...left].every((k) => right.has(k));
}

function diffFields(existing: RosterPersonSnapshot, row: RosterRow): string[] {
  const changes: string[] = [];
  if (existing.name !== row.name) changes.push("nombre");
  if ((existing.documentId ?? null) !== (row.documentId ?? null)) changes.push("dni");
  if (existing.employer !== row.employer) changes.push("empresa");
  if ((existing.contractorName ?? null) !== (row.contractorName ?? null)) changes.push("contratista");
  if (normalizeKey(existing.siteName) !== normalizeKey(row.siteName)) changes.push("sede");
  if (!sameSet(existing.extraSiteNames, row.extraSiteNames)) changes.push("sedes adicionales");
  if (normalizeKey(existing.positionName) !== normalizeKey(row.positionName)) changes.push("puesto");
  // Una celda de ingreso vacía no borra una fecha ya cargada.
  if (row.hiredAt !== null && existing.hiredAt !== row.hiredAt) changes.push("ingreso");
  if (!sameSet(existing.taskNames, row.taskNames)) changes.push("tareas");
  return changes;
}

/**
 * Compara el CSV con la nómina actual, por legajo: reimportar actualiza, no duplica.
 * Una persona dada de baja no se reactiva por importación (se bloquea la fila).
 * Los nombres de sede, puesto o tarea que no existen se listan en `toCreate`.
 */
export function planRosterImport(
  existing: RosterPersonSnapshot[],
  catalog: Record<MasterDataEntity, string[]>,
  rows: RosterRow[],
): RosterPlan {
  const byCode = new Map(existing.map((p) => [normalizeKey(p.employeeCode), p]));
  const known: Record<MasterDataEntity, Set<string>> = {
    site: new Set(catalog.site.map(normalizeKey)),
    position: new Set(catalog.position.map(normalizeKey)),
    task: new Set(catalog.task.map(normalizeKey)),
  };
  const toCreate: Record<MasterDataEntity, string[]> = { site: [], position: [], task: [] };
  const queue = (entity: MasterDataEntity, name: string) => {
    const key = normalizeKey(name);
    if (known[entity].has(key)) return;
    known[entity].add(key);
    toCreate[entity].push(name);
  };

  const counts: Record<RosterAction, number> = { create: 0, update: 0, unchanged: 0, blocked: 0 };
  const items: RosterPlanItem[] = rows.map((row) => {
    const current = byCode.get(normalizeKey(row.employeeCode));
    let item: RosterPlanItem;
    if (!current) {
      item = { row, action: "create", changes: [] };
    } else if (!current.active) {
      item = {
        row,
        action: "blocked",
        changes: [],
        reason: "La persona está dada de baja: reactivala desde su ficha antes de importar",
      };
    } else {
      const changes = diffFields(current, row);
      item = { row, action: changes.length ? "update" : "unchanged", changes };
    }
    counts[item.action]++;
    if (item.action !== "blocked") {
      queue("site", row.siteName);
      row.extraSiteNames.forEach((n) => queue("site", n));
      queue("position", row.positionName);
      row.taskNames.forEach((n) => queue("task", n));
    }
    return item;
  });

  return { items, toCreate, counts };
}

export function describeToCreate(toCreate: RosterPlan["toCreate"]): string[] {
  return (Object.keys(toCreate) as MasterDataEntity[])
    .filter((e) => toCreate[e].length > 0)
    .map((e) => `${toCreate[e].length} ${MASTER_DATA_ENTITY_LABELS[e]}(s) nueva(s): ${toCreate[e].join(", ")}`);
}
