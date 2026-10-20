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
const cwd = input.cwd || process.cwd();

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

let status;
try {
  status = git("status --porcelain=v1 --untracked-files=all");
} catch {
  process.exit(0);
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
  check("tsc", "npx tsc --noEmit"),
  lintFiles.length ? check("eslint", `npx eslint ${lintFiles.join(" ")}`) : { name: "eslint", ok: true, out: "" },
  check("vitest", "npx vitest run"),
]);
const failed = results.filter((r) => !r.ok);

if (failed.length === 0) {
  writeFileSync(stateFile, JSON.stringify({ green: fingerprint }));
  process.exit(0);
}

const tail = (text, lines) => text.trim().split("\n").slice(-lines).join("\n");
const dbDown = failed.some((r) => /P1001|Can't reach database server|ECONNREFUSED.*5432/.test(r.out));
if (dbDown) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: "Verificación incompleta: Postgres no responde (npm run db:up). No se pudieron correr los tests de integración.",
    }),
  );
  process.exit(0);
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
