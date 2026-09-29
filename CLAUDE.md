@AGENTS.md

## Token Efficiency

Optimize every task for minimum token/context/tool consumption.

- Do not repeat information already available.
- Do not reread files unless necessary.
- Prefer targeted searches over broad exploration.
- Do not invoke tools when the answer can be obtained reliably without them.
- Prefer one efficient operation over multiple equivalent operations.
- Do not spawn subagents for simple tasks.
- Keep responses concise unless detail is required.
- Avoid unnecessary explanations, progress narration, and repeated summaries.
- Reuse information already obtained during the current task.
- Before every tool call, determine whether it materially improves the result.
- Before spawning a subagent, determine whether direct execution is cheaper and sufficient.
- Preserve correctness, validation, and required testing; never sacrifice them merely to save tokens.

### Subagent / skill returns
When spawning a subagent or invoking a review/audit skill, require (and expect) findings-only returns: bullets, no essays, omit empty sections, ~800 words max unless the user asked for depth. Do not ask the subagent to narrate steps.

### Heavy skills (load selectively)
Never load entire `vercel-react-best-practices/rules/*` or `vercel-composition-patterns/rules/*` into context. Read the Quick Reference in that skill's SKILL.md first, then open only the 1–3 rule files that match the change. Same idea for any skill with a `references/` or `rules/` folder: open the matching file, not the whole tree.

## Routing (one owner per task)

Each kind of task has exactly one owner. Never run two skills/agents that cover the same aspect on the same work, and never re-run a review/audit on unchanged code in the same session â€” reuse its result.

| Task | Owner |
|---|---|
| Feature spec / plan / implement | `/spec` â†’ `/plan` â†’ `/build` |
| Design backend component | `/design` (think-before-coding, main session) |
| Tests / bug proof | `/test` (test-driven-development) |
| Debugging (local or prod) | debugging-and-error-recovery; `incident-investigator` only for live prod incidents |
| Code review | `/review` (main session); `code-reviewer` subagent only for diffs > ~300 lines |
| Security | security-and-hardening (covered inside `/review`); `security-reviewer` only for a dedicated auth/tenant/secrets pass |
| Pre-launch | `/ship` (single reviewer, no fan-out) |
| DB schema / migrations | data-modeling-discipline, `/review-migration`; `schema-reviewer` only if asked |
| Queries / N+1 | query-discipline, `/hunt-n-plus-one`, `/explain-this-query` |
| Web performance | `/webperf` (`web-performance-auditor`) |
| Backend perf/scaling | performance-optimization |
| Frontend look, feel, UX copy (project identity) | sgi-frontend-identity â€” overrides generic UI skills on visuals/language; frontend-ui-engineering only for mechanics (a11y, state) |
| React/Next.js code perf (waterfalls, bundle, re-renders) | vercel-react-best-practices |
| Component API design (props, compound components) | vercel-composition-patterns (build with frontend-ui-engineering) |
| Better Auth config / sessions / plugins / email-password | better-auth-best-practices (includes email/password). Tenant scope & permission design stays in auth-and-authorization |
| Observability | observability-by-default |
| Simplify code | built-in `/simplify` |
| ISO 9001 risks/opportunities | riesgos-oportunidades |
| Branch + commits + README + push + merge | `/publicar-cambios` |

Subagents: spawn only when the user asks or the table says so; max one per aspect; subagents never spawn others. Otherwise work inline.

## Archived Claude skills (token savings)

Moved out of .claude/skills (recover from `C:\Proyectos\_archivo-claude-SGI-Base-Agente\skills-archivadas`): `email-and-password-best-practices` (merged into better-auth), `idea-refine`, `interview-me`, `constraint-driven-development`. `/constraints` command archived with them. Full pre-change backup: `C:\Proyectos\_archivo-claude-SGI-Base-Agente\backup-2026-09-29`.
