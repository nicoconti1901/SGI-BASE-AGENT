// Stop / SubagentStop: si hay cambios de código sin commitear, corre tsc, eslint (sobre
// los archivos tocados) y vitest. Si algo falla, bloquea el cierre y devuelve el error
// para que el agente lo arregle. Recuerda el último estado verde para no repetir.
import { spawn, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CODE = /\.(ts|tsx|mts|cts|js|mjs|cjs|prisma|css)$/;
const LINTABLE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
const MAX_BLOCKS = 3;

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {}
let cwd = input.cwd || process.cwd();

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const warn = (message) => {
  process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
};

let status;
try {
  // Las rutas de `git status` son relativas a la raíz: los comandos corren desde ahí aunque la sesión esté en una subcarpeta.
  cwd = git("rev-parse --show-toplevel").trim();
  status = git("status --porcelain=v1 --untracked-files=all");
} catch {
  process.exit(0);
}

// wt:setup está creando, migrando o borrando la base: verificar ahora daría fallas falsas y su vitest
// bloquearía el motor de Prisma que el setup regenera. Un lock de más de 30 minutos es de un setup que murió.
const setupLock = path.join(cwd, ".wt-setup.lock");
if (existsSync(setupLock) && Date.now() - statSync(setupLock).mtimeMs < 30 * 60_000) {
  warn("Verificación pospuesta: npm run wt:setup está corriendo en este worktree. Volvé a correr los checks cuando termine.");
}
const changed = status
  .split("\n")
  .filter(Boolean)
  .map((line) => ({ code: line.slice(0, 2), file: line.slice(3).replace(/^.* -> /, "").replace(/^"|"$/g, "") }))
  .filter(({ file }) => CODE.test(file) && !file.startsWith(".claude/"));
if (changed.length === 0) process.exit(0);

const fingerprint = createHash("sha1")
  .update(git("diff HEAD"))
  .update(
    changed
      .filter(({ code }) => code === "??")
      .map(({ file }) => {
        const full = path.join(cwd, file);
        return `${file}:${existsSync(full) ? statSync(full).mtimeMs : "x"}`;
      })
      .join("|"),
  )
  .digest("hex");
const stateFile = path.join(tmpdir(), `sgi-verify-${createHash("sha1").update(cwd).digest("hex").slice(0, 12)}.json`);
let state = {};
try {
  state = JSON.parse(readFileSync(stateFile, "utf8"));
} catch {}
if (state.green === fingerprint) process.exit(0);

function check(name, command) {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ name, ok: code === 0, out }));
  });
}

const lintFiles = changed
  .filter(({ file, code }) => LINTABLE.test(file) && !code.includes("D") && existsSync(path.join(cwd, file)))
  .map(({ file }) => `"${file}"`);
const results = await Promise.all([
  // Los tipos de rutas de Next (LayoutProps, validator) se regeneran: si no, borrar o agregar una ruta da falsos errores.
  check("tsc", "npx next typegen && npx tsc --noEmit"),
  lintFiles.length ? check("eslint", `npx eslint ${lintFiles.join(" ")}`) : { name: "eslint", ok: true, out: "" },
  check("vitest", "npx vitest run"),
]);
const failed = results.filter((r) => !r.ok);

if (failed.length === 0) {
  writeFileSync(stateFile, JSON.stringify({ green: fingerprint }));
  process.exit(0);
}

const tail = (text, lines) => text.trim().split("\n").slice(-lines).join("\n");
const vitestOnly = failed.length === 1 && failed[0].name === "vitest";
if (failed.some((r) => /P1001|Can't reach database server|ECONNREFUSED.*5432/.test(r.out))) {
  warn("Verificación incompleta: Postgres no responde (npm run db:up). No se pudieron correr los tests de integración.");
}
// Base del worktree inexistente o sin migrar: es el entorno, no el código. Si tsc y eslint pasaron, no se bloquea.
if (vitestOnly && /P1003|P2021|Database `[^`]+` does not exist|does not exist in the current database/.test(failed[0].out)) {
  warn("Verificación incompleta: la base del worktree no existe o no está migrada (npm run wt:setup). tsc y eslint pasaron; los tests de integración no se corrieron.");
}

const blocks = state.fingerprint === fingerprint ? (state.blocks ?? 0) + 1 : 1;
writeFileSync(stateFile, JSON.stringify({ ...state, fingerprint, blocks }));
const report = failed.map((r) => `### ${r.name}\n${tail(r.out, 40)}`).join("\n\n");
if (blocks > MAX_BLOCKS) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: `La verificación sigue fallando (${failed.map((r) => r.name).join(", ")}) después de ${MAX_BLOCKS} intentos; se deja terminar para que lo revises.`,
    }),
  );
  process.exit(0);
}
process.stderr.write(
  `Los cambios sin commitear no pasan la verificación. Arreglalo antes de terminar (no desactives reglas ni tests):\n\n${report}\n`,
);
process.exit(2);
