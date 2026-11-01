// PreToolUse (Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell): protege la documentación de clientes.
// - clientes/<slug>/origen/ es el original del cliente: solo lectura (se niega escribirlo con Write/Edit).
// - El repo es público: se niega `git add -f` sobre clientes/ (está en .gitignore).
// - Comandos de shell que borran, mueven o escriben dentro de origen/ piden confirmación.
import { readFileSync } from "node:fs";

const ORIGEN = /(?:^|[\\/"'\s])clientes[\\/][^\\/"'\s]+[\\/]origen(?:[\\/]|["'\s]|$)/i;
const SHELL_WRITE =
  /\b(?:rm|del|erase|rmdir|rd|mv|move|ren|rename|cp|copy|tee|Remove-Item|Move-Item|Rename-Item|Copy-Item|Set-Content|Add-Content|Out-File|Clear-Content|New-Item)\b|\bsed\s+-i|>/i;

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const decide = (permissionDecision, permissionDecisionReason) => {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason } }),
  );
  process.exit(0);
};

const tool = input?.tool_name ?? "";
const params = input?.tool_input ?? {};

if (tool === "Bash" || tool === "PowerShell") {
  const command = String(params.command ?? "");
  if (/\bgit\s+add\b[^;&|]*(?:\s-f\b|--force\b|\s-[a-zA-Z]*f)/.test(command) && /clientes/i.test(command))
    decide("deny", "clientes/ es confidencial y el repo es público: no se versiona (ni con git add -f).");
  if (ORIGEN.test(command) && SHELL_WRITE.test(command))
    decide("ask", "El comando toca clientes/<slug>/origen/ (documentación original del cliente, solo lectura). Confirmá solo si lo pediste.");
  process.exit(0);
}

const path = String(params.file_path ?? params.notebook_path ?? "");
if (ORIGEN.test(` ${path}`))
  decide("deny", "clientes/<slug>/origen/ es la documentación original del cliente y es de solo lectura. Escribí en trabajo/ o entregables/.");
