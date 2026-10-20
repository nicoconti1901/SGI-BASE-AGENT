// PreToolUse (Bash|PowerShell): pide confirmación al usuario antes de comandos que
// descartan trabajo o reescriben historia. No bloquea: el usuario decide en el prompt.
import { readFileSync } from "node:fs";

const RULES = [
  [/\bgit\s+checkout\s+(?:\S+\s+)*--(?:\s|$)/, "git checkout -- descarta cambios del working tree"],
  [/\bgit\s+checkout\s+(?:-f|--force|\.)(?:\s|$)/, "git checkout forzado o sobre '.' descarta cambios"],
  [/\bgit\s+restore\b(?![^;&|]*--staged(?![^;&|]*--worktree))/, "git restore descarta cambios del working tree"],
  [/\bgit\s+reset\b[^;&|]*--(?:hard|merge|keep)\b/, "git reset --hard descarta cambios"],
  [/\bgit\s+clean\b[^;&|]*\s-[a-zA-Z]*f/, "git clean -f borra archivos sin trackear"],
  [/\bgit\s+push\b[^;&|]*(?:--force\b|--force-with-lease\b|\s-f\b|\s\+\S)/, "git push forzado reescribe historia remota"],
  [/\bgit\s+branch\b[^;&|]*\s-D\b/, "git branch -D borra una rama aunque no esté mergeada"],
  [/\bgit\s+stash\s+(?:drop|clear)\b/, "git stash drop/clear pierde cambios guardados"],
  [/\bgit\s+commit\b[^;&|]*--amend\b/, "git commit --amend reescribe el último commit"],
  [/\bprisma\s+migrate\s+reset\b/, "prisma migrate reset borra la base de datos"],
  [/\bprisma\s+db\s+push\b[^;&|]*--(?:force-reset|accept-data-loss)\b/, "prisma db push con pérdida de datos"],
];

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const command = String(input?.tool_input?.command ?? "");
const hits = RULES.filter(([pattern]) => pattern.test(command)).map(([, reason]) => reason);
if (hits.length === 0) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: `Comando destructivo: ${hits.join("; ")}. Confirmá solo si lo pediste explícitamente.`,
    },
  }),
);
