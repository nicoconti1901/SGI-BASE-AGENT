/**
 * Importación del histórico de capacitaciones por CSV (SPEC-training, decisión 9).
 * Columnas: legajo, curso, fecha, resultado, nota, vence, proveedor, certificado.
 * Reimportar el mismo archivo actualiza o deja igual: nunca duplica.
 */
import { cleanName, normalizeKey, parseCsv, parseDateCell } from "@/domain/masterdata/roster";
import type { IsoDate } from "./dates";
import { computeValidUntil } from "./rules";
import type { TrainingResultValue } from "./types";

export type TrainingImportRow = {
  /** Número de línea en el archivo (el encabezado es la 1). */
  line: number;
  employeeCode: string;
  /** Nombre o código del curso, tal como vino. */
  courseRef: string;
  completedAt: IsoDate;
  result: TrainingResultValue;
  score: number | null;
  /** Vencimiento que trae el certificado; `null` = calcularlo con la vigencia del curso. */
  validUntil: IsoDate | null;
  providerName: string | null;
  certificateNumber: string | null;
};

export type TrainingImportRowError = { line: number; field: string; message: string };

export const TRAINING_IMPORT_REQUIRED_HEADERS = ["legajo", "curso", "fecha", "resultado"] as const;
export const TRAINING_IMPORT_MAX_ROWS = 5000;

const HEADER_ALIASES: Record<string, string> = {
  legajo: "employeeCode",
  curso: "course",
  fecha: "completedAt",
  resultado: "result",
  nota: "score",
  vence: "validUntil",
  vencimiento: "validUntil",
  proveedor: "providerName",
  certificado: "certificateNumber",
};

const PASSED = new Set(["aprobado", "aprobada", "aprobo", "ok", "passed", "approved", "si"]);
const FAILED = new Set(["no aprobado", "no aprobada", "no aprobo", "reprobado", "reprobada", "reprobo", "desaprobado", "desaprobo", "failed", "no"]);

function parseResult(value: string): TrainingResultValue | null {
  const key = normalizeKey(value);
  if (PASSED.has(key)) return "passed";
  if (FAILED.has(key)) return "failed";
  return null;
}

function parseScore(value: string): number | null | "invalid" {
  const v = value.trim().replace(",", ".");
  if (v === "") return null;
  if (!/^\d{1,3}(\.\d+)?$/.test(v)) return "invalid";
  const n = Math.round(Number(v));
  return n >= 0 && n <= 100 ? n : "invalid";
}

/** Valida el CSV completo: devuelve las filas válidas y los errores con su número de línea. */
export function parseTrainingCsv(
  text: string,
  opts: { today: IsoDate },
): { rows: TrainingImportRow[]; errors: TrainingImportRowError[] } {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], errors: [{ line: 1, field: "archivo", message: "El archivo está vacío" }] };
  }
  const headerKeys = table[0].map((h) => HEADER_ALIASES[normalizeKey(h)] ?? null);
  const present = new Set(table[0].map((h) => normalizeKey(h)));
  const missing = TRAINING_IMPORT_REQUIRED_HEADERS.filter((h) => !present.has(h));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, field: "encabezado", message: `Faltan las columnas: ${missing.join(", ")}` }],
    };
  }
  if (table.length - 1 > TRAINING_IMPORT_MAX_ROWS) {
    return {
      rows: [],
      errors: [{ line: 1, field: "archivo", message: `El archivo tiene más de ${TRAINING_IMPORT_MAX_ROWS} filas: dividilo en partes` }],
    };
  }

  const rows: TrainingImportRow[] = [];
  const errors: TrainingImportRowError[] = [];
  const seen = new Map<string, number>();

  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const cells: Record<string, string> = {};
    headerKeys.forEach((key, idx) => {
      if (key) cells[key] = (table[i][idx] ?? "").trim();
    });
    const fail = (field: string, message: string) => errors.push({ line, field, message });
    const before = errors.length;

    const employeeCode = cleanName(cells.employeeCode ?? "");
    const courseRef = cleanName(cells.course ?? "");
    if (!employeeCode) fail("legajo", "El legajo es obligatorio");
    else if (!courseRef) fail("curso", "El curso es obligatorio");

    let completedAt: IsoDate | null = null;
    if (!cells.completedAt) fail("fecha", "La fecha es obligatoria");
    else {
      completedAt = parseDateCell(cells.completedAt);
      if (!completedAt) fail("fecha", "Fecha inválida: usá AAAA-MM-DD o DD/MM/AAAA");
      else if (completedAt > opts.today) {
        fail("fecha", "La capacitación no puede tener una fecha futura");
        completedAt = null;
      }
    }

    const result = parseResult(cells.result ?? "");
    if (!result && errors.length === before) fail("resultado", "Usá «aprobado» o «no aprobado»");

    const score = parseScore(cells.score ?? "");
    if (score === "invalid" && errors.length === before) fail("nota", "La nota es un número entre 0 y 100");

    let validUntil: IsoDate | null = null;
    if (cells.validUntil && errors.length === before) {
      validUntil = parseDateCell(cells.validUntil);
      if (!validUntil) fail("vence", "Fecha de vencimiento inválida: usá AAAA-MM-DD o DD/MM/AAAA");
      else if (completedAt && validUntil < completedAt) fail("vence", "El vencimiento no puede ser anterior a la fecha de la capacitación");
    }

    if (errors.length > before || !completedAt || !result || score === "invalid") continue;

    const key = [normalizeKey(employeeCode), normalizeKey(courseRef), completedAt, result].join("|");
    const first = seen.get(key);
    if (first !== undefined) {
      fail("fila", `Fila repetida en el archivo (ya figura en la línea ${first})`);
      continue;
    }
    seen.set(key, line);

    rows.push({
      line,
      employeeCode,
      courseRef,
      completedAt,
      result,
      score,
      validUntil: result === "passed" ? validUntil : null,
      providerName: cleanName(cells.providerName ?? "") || null,
      certificateNumber: cleanName(cells.certificateNumber ?? "") || null,
    });
  }
  return { rows, errors };
}

// ─── Plan de importación ───────────────────────────────────────────────────

export type TrainingImportContext = {
  people: { id: string; employeeCode: string }[];
  courses: { id: string; name: string; code: string | null; validityMonths: number | null }[];
};

/** Registro ya cargado (no anulado), para comparar contra el archivo. */
export type ExistingTrainingRecord = {
  personId: string;
  courseId: string;
  completedAt: IsoDate;
  result: TrainingResultValue;
  score: number | null;
  validUntil: IsoDate | null;
  validUntilSource: "computed" | "certificate";
  providerName: string | null;
  certificateNumber: string | null;
};

export type TrainingImportAction = "create" | "update" | "unchanged" | "error";

export type TrainingImportItem = {
  line: number;
  action: TrainingImportAction;
  row: TrainingImportRow;
  personId?: string;
  courseId?: string;
  validUntil?: IsoDate | null;
  validUntilSource?: "computed" | "certificate";
  message?: string;
};

export type TrainingImportPlan = {
  items: TrainingImportItem[];
  counts: Record<TrainingImportAction, number>;
};

const recordKey = (personId: string, courseId: string, completedAt: IsoDate, result: TrainingResultValue) =>
  `${personId}|${courseId}|${completedAt}|${result}`;

/** Decide qué hacer con cada fila: crear, actualizar, dejar igual o informar el error. No toca la base. */
export function planTrainingImport(
  existing: readonly ExistingTrainingRecord[],
  rows: readonly TrainingImportRow[],
  ctx: TrainingImportContext,
): TrainingImportPlan {
  const personByCode = new Map(ctx.people.map((p) => [normalizeKey(p.employeeCode), p.id]));
  const courseByRef = new Map<string, TrainingImportContext["courses"][number]>();
  for (const c of ctx.courses) {
    courseByRef.set(normalizeKey(c.name), c);
    if (c.code) courseByRef.set(normalizeKey(c.code), c);
  }
  const existingByKey = new Map(existing.map((e) => [recordKey(e.personId, e.courseId, e.completedAt, e.result), e]));

  const items: TrainingImportItem[] = rows.map((row) => {
    const personId = personByCode.get(normalizeKey(row.employeeCode));
    if (!personId) {
      return { line: row.line, action: "error", row, message: `No hay una persona con el legajo ${row.employeeCode}` };
    }
    const course = courseByRef.get(normalizeKey(row.courseRef));
    if (!course) {
      return { line: row.line, action: "error", row, message: `No existe el curso «${row.courseRef}»: crealo antes de importar` };
    }

    const found = existingByKey.get(recordKey(personId, course.id, row.completedAt, row.result));
    let validUntil: IsoDate | null;
    let validUntilSource: "computed" | "certificate";
    if (row.result === "failed") {
      validUntil = null;
      validUntilSource = "computed";
    } else if (row.validUntil) {
      validUntil = row.validUntil;
      validUntilSource = "certificate";
    } else if (found?.validUntilSource === "certificate") {
      validUntil = found.validUntil;
      validUntilSource = "certificate";
    } else {
      validUntil = computeValidUntil(row.completedAt, course.validityMonths);
      validUntilSource = "computed";
    }

    const base = { line: row.line, row, personId, courseId: course.id, validUntil, validUntilSource };
    if (!found) return { ...base, action: "create" };
    const same =
      found.score === row.score &&
      found.validUntil === validUntil &&
      found.validUntilSource === validUntilSource &&
      found.providerName === row.providerName &&
      found.certificateNumber === row.certificateNumber;
    return { ...base, action: same ? "unchanged" : "update" };
  });

  const counts = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const item of items) counts[item.action]++;
  return { items, counts };
}
