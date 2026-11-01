// Valida la codificación documental de un cliente: códigos únicos y con el patrón acordado,
// archivos existentes, entregables registrados y referencias a códigos que existen.
// Uso: node scripts/clientes/validar-codigos.mjs clientes/<slug>
// Lo usa también el hook PostToolUse validar-codigos-cliente.mjs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, parse, relative } from "node:path";
import { pathToFileURL } from "node:url";

const DONE_STATES = ["para revision", "aprobado", "cargado"];

const plain = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const codeKey = (code) => code.toUpperCase().replace(/[\s._-]+/g, "");
const splitRow = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());

function readTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().startsWith("|") && plain(l).includes("codigo"));
  if (start === -1) return null;
  const header = splitRow(lines[start]).map(plain);
  const col = (name) => header.findIndex((h) => h.startsWith(name));
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].trim().startsWith("|"); i++) {
    const cells = splitRow(lines[i]);
    const get = (name) => (col(name) === -1 ? "" : (cells[col(name)] ?? "").replace(/^[-—]$/, ""));
    rows.push({
      line: i + 1,
      code: get("codigo").replace(/`/g, ""),
      verdict: plain(get("dictamen")),
      state: plain(get("estado")),
      files: get("archivo")
        .split(/<br>|,/)
        .map((f) => f.replace(/`/g, "").trim())
        .filter(Boolean),
    });
  }
  return rows;
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : e.name.startsWith("~$") ? [] : [join(dir, e.name)],
  );
}

export function validarCliente(clientDir) {
  const listPath = join(clientDir, "trabajo", "listado-maestro.md");
  const fichaPath = join(clientDir, "trabajo", "ficha.md");
  if (!existsSync(listPath)) return ["Falta trabajo/listado-maestro.md: registrá el código antes de crear el entregable."];
  const rows = readTable(readFileSync(listPath, "utf8"));
  if (!rows) return ["listado-maestro.md no tiene una tabla con columna «Código»."];

  const ficha = existsSync(fichaPath) ? readFileSync(fichaPath, "utf8") : "";
  const patternSrc = ficha.match(/^\s*-?\s*patron-codigo:\s*`([^`]+)`/m)?.[1];
  let pattern = null;
  try {
    pattern = patternSrc ? new RegExp(patternSrc) : null;
  } catch {
    return [`patron-codigo de ficha.md no es una regex válida: ${patternSrc}`];
  }

  const problems = [];
  const seen = new Map();
  for (const row of rows) {
    if (!row.code) {
      if (pattern && row.verdict !== "descartar") problems.push(`L${row.line}: fila sin código.`);
    } else {
      if (!pattern) problems.push(`L${row.line}: «${row.code}» tiene código pero ficha.md no define patron-codigo (codificación sin decidir).`);
      else if (!pattern.test(row.code)) problems.push(`L${row.line}: «${row.code}» no respeta patron-codigo ${patternSrc}.`);
      const key = codeKey(row.code);
      if (seen.has(key)) problems.push(`L${row.line}: código «${row.code}» duplicado (ya está en L${seen.get(key)}).`);
      else seen.set(key, row.line);
    }
    if (DONE_STATES.includes(row.state)) {
      if (row.files.length === 0 && row.verdict !== "modulo") problems.push(`L${row.line}: «${row.code}» está ${row.state} pero no tiene archivo.`);
      for (const f of row.files) if (!existsSync(join(clientDir, f))) problems.push(`L${row.line}: no existe el archivo ${f}.`);
    }
  }

  const registered = new Set(rows.flatMap((r) => r.files.map((f) => plain(parse(f).name))));
  const deliverables = listFiles(join(clientDir, "entregables"));
  for (const file of deliverables) {
    if (!registered.has(plain(parse(file).name)))
      problems.push(`Entregable sin fila en el listado maestro: ${relative(clientDir, file).replace(/\\/g, "/")}.`);
  }

  if (pattern) {
    const body = patternSrc.replace(/^\^|\$$/g, "").replace(/\$?\|\^?/g, "|");
    const finder = new RegExp(`(?<![A-Z0-9])(?:${body})(?![0-9])`, "g");
    for (const file of deliverables.filter((f) => f.endsWith(".md"))) {
      const missing = new Set([...readFileSync(file, "utf8").matchAll(finder)].map((m) => m[0]).filter((c) => !seen.has(codeKey(c))));
      for (const code of missing) problems.push(`${relative(clientDir, file).replace(/\\/g, "/")}: cita «${code}», que no está en el listado.`);
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Uso: node scripts/clientes/validar-codigos.mjs clientes/<slug>");
    process.exit(2);
  }
  const problems = validarCliente(dir);
  console.log(problems.length ? problems.map((p) => `- ${p}`).join("\n") : "Codificación OK.");
  process.exit(problems.length ? 1 : 0);
}
