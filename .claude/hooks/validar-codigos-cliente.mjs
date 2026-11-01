// PostToolUse (Write|Edit|MultiEdit): al tocar el listado maestro o un entregable de un cliente,
// valida la codificación (scripts/clientes/validar-codigos.mjs) y le devuelve los problemas al agente.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const projectDir = (process.env.CLAUDE_PROJECT_DIR ?? input?.cwd ?? process.cwd()).replace(/\\/g, "/").replace(/\/$/, "");
let path = String(input?.tool_input?.file_path ?? "").replace(/\\/g, "/");
if (path.toLowerCase().startsWith(`${projectDir.toLowerCase()}/`)) path = path.slice(projectDir.length + 1);

const match = path.match(/^clientes\/([^/]+)\/(?:trabajo\/listado-maestro\.md|entregables\/.+)$/i);
if (!match) process.exit(0);

const { validarCliente } = await import(pathToFileURL(join(projectDir, "scripts/clientes/validar-codigos.mjs")).href);
const problems = validarCliente(join(projectDir, "clientes", match[1]));
if (problems.length === 0) process.exit(0);

const shown = problems.slice(0, 15).map((p) => `- ${p}`);
if (problems.length > 15) shown.push(`- … y ${problems.length - 15} más (node scripts/clientes/validar-codigos.mjs clientes/${match[1]})`);
process.stdout.write(
  JSON.stringify({ decision: "block", reason: `Codificación de ${match[1]} con problemas:\n${shown.join("\n")}` }),
);
