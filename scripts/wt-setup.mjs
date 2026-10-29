// Prepara un git worktree para que un agente trabaje aislado: base de datos propia,
// .env propio y puerto propio. Uso (desde la raíz del worktree):
//   npm run wt:setup -- [nombre]        crea o reutiliza el entorno
//   npm run wt:setup -- [nombre] --drop borra la base del worktree
// Se escribe en Node sin dependencias porque corre antes de `npm ci`.
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

const args = process.argv.slice(2);
const drop = args.includes("--drop");
const cwd = process.cwd();

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd, encoding: "utf8" }).trim();
}

function run(cmd, { attempts = 1, hint } = {}) {
  for (let attempt = 1; ; attempt++) {
    console.log(`\n> ${cmd}${attempt > 1 ? ` (intento ${attempt} de ${attempts})` : ""}`);
    const result = spawnSync(cmd, { cwd, stdio: "inherit", shell: true });
    if (result.status === 0) return;
    if (attempt >= attempts) {
      console.error(`\nFalló: ${cmd}${hint ? `\n${hint}` : ""}`);
      process.exit(result.status ?? 1);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
  }
}

function parseEnv(text) {
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    entries.push(match ? { key: match[1], value: match[2], line } : { line });
  }
  return entries;
}

function unquote(value) {
  return value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

function getVar(entries, key) {
  const entry = entries.find((e) => e.key === key);
  return entry ? unquote(entry.value) : undefined;
}

function setVar(entries, key, value) {
  const quoted = `"${value}"`;
  const entry = entries.find((e) => e.key === key);
  if (entry) {
    entry.value = quoted;
    entry.line = `${key}=${quoted}`;
  } else {
    entries.push({ key, value: quoted, line: `${key}=${quoted}` });
  }
}

function withDatabase(url, database) {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function pickPort(name) {
  const start = 3100 + (parseInt(createHash("sha1").update(name).digest("hex").slice(0, 6), 16) % 800);
  for (let port = start; port < start + 50; port++) {
    if (await portIsFree(port)) return port;
  }
  throw new Error("No hay un puerto libre entre 3100 y 3950.");
}

const mainRoot = path.dirname(path.resolve(cwd, git("rev-parse --path-format=absolute --git-common-dir")));
const worktreeRoot = path.resolve(git("rev-parse --show-toplevel"));
if (worktreeRoot === mainRoot) {
  console.error("Esto es el repo principal, no un worktree: no se toca su .env ni su base.");
  process.exit(1);
}
if (worktreeRoot !== path.resolve(cwd)) {
  console.error(`Corré el script desde la raíz del worktree: ${worktreeRoot}`);
  process.exit(1);
}

// Mientras exista, el hook verify-on-stop no corre la verificación: su vitest bloquearía el motor de Prisma
// (EPERM en Windows al regenerar) y sus tests chocarían con una base a medio crear o recién borrada.
const lockPath = path.join(worktreeRoot, ".wt-setup.lock");
writeFileSync(lockPath, `${process.pid}\n`);
process.on("exit", () => rmSync(lockPath, { force: true }));

const rawName = args.find((a) => !a.startsWith("--")) ?? path.basename(worktreeRoot);
const name = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
if (!name) {
  console.error("Nombre de worktree inválido.");
  process.exit(1);
}
const database = `sgi_wt_${name}`;

const mainEnvPath = path.join(mainRoot, ".env");
if (!existsSync(mainEnvPath)) {
  console.error(`Falta ${mainEnvPath}: el worktree copia de ahí los secretos.`);
  process.exit(1);
}
const mainEnv = parseEnv(readFileSync(mainEnvPath, "utf8"));
const adminUrl = getVar(mainEnv, "DATABASE_URL");
if (!adminUrl) {
  console.error("El .env principal no tiene DATABASE_URL.");
  process.exit(1);
}
if (new URL(adminUrl).pathname.slice(1) === database) {
  console.error("La base del worktree no puede ser la base principal.");
  process.exit(1);
}

if (!existsSync(path.join(worktreeRoot, "node_modules"))) run("npm ci");
run("npx prisma generate", {
  attempts: 3,
  hint: "Si dice EPERM, otro proceso de este worktree usa el motor de Prisma (vitest, next dev o prisma studio): cerralo y repetí.",
});

const { PrismaClient } = createRequire(path.join(worktreeRoot, "package.json"))("@prisma/client");
const admin = new PrismaClient({ datasourceUrl: adminUrl });
try {
  const rows = await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${database}`;
  if (drop) {
    if (rows.length > 0) {
      await admin.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
      console.log(`Base ${database} eliminada.`);
    } else {
      console.log(`La base ${database} no existe.`);
    }
  } else if (rows.length === 0) {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    console.log(`Base ${database} creada.`);
  } else {
    console.log(`Base ${database} ya existía: se reutiliza.`);
  }
} finally {
  await admin.$disconnect();
}
if (drop) process.exit(0);

const envPath = path.join(worktreeRoot, ".env");
const existing = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : null;
const port = Number(existing && getVar(existing, "PORT")) || (await pickPort(name));
const env = parseEnv(readFileSync(mainEnvPath, "utf8"));
setVar(env, "DATABASE_URL", withDatabase(adminUrl, database));
setVar(env, "PORT", String(port));
setVar(env, "NEXT_PUBLIC_APP_URL", `http://localhost:${port}`);
setVar(env, "BETTER_AUTH_URL", `http://localhost:${port}`);
writeFileSync(envPath, `# Generado por scripts/wt-setup.mjs para el worktree "${name}".\n${env.map((e) => e.line).join("\n")}\n`);

run("npx prisma migrate deploy");
run("npm run db:seed");
run("npm run db:seed:demo");

console.log(`
Worktree listo.
  Base:   ${database}
  Puerto: ${port}  (npm run dev -- -p ${port}; Playwright ya lo toma del .env)
  Borrar la base al terminar: npm run wt:setup -- ${name} --drop`);
