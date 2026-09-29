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

Each kind of task has exactly one owner. Never run two skills/agents that cover the same aspect on the same work, and never re-run a review/audit on unchanged code in the same session — reuse its result.

**Auto-dispatch:** On every user request, match intent to the table below and take that owner yourself (slash command, skill, or single allowed subagent). Do not ask the user which agent to use unless two rows truly apply and the choice changes the outcome. Prefer the slash command when one exists. Subagents: spawn only when the table says so or the user names that agent; max one per aspect; subagents never spawn others. Otherwise work inline.

| Task | Owner |
|---|---|
| Feature spec / plan / implement | `/spec` → `/plan` → `/build` |
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
| Frontend look, feel, UX copy (project identity) | sgi-frontend-identity — overrides generic UI skills on visuals/language; frontend-ui-engineering only for mechanics (a11y, state) |
| React/Next.js code perf (waterfalls, bundle, re-renders) | vercel-react-best-practices |
| Component API design (props, compound components) | vercel-composition-patterns (build with frontend-ui-engineering) |
| Better Auth / sessions / plugins / email-password | better-auth-best-practices. Tenant scope & permissions → auth-and-authorization |
| Observability | observability-by-default |
| Simplify code | built-in `/simplify` |
| ISO 9001 risks/opportunities | riesgos-oportunidades |
| Branch + commits + README + push + merge | `/publicar-cambios` |

### Intent → owner (examples)
| User says (examples) | Take |
|---|---|
| "spec / plan / implementá X / feature Y" | `/spec` or `/plan` or `/build` as appropriate |
| "revisá el PR / code review" | `/review`; spawn `code-reviewer` only if diff > ~300 lines |
| "security / IDOR / tenant isolation" | `security-reviewer` (or security axis inside `/review` if already reviewing) |
| "migración / schema / Prisma" | `/review-migration` + data-modeling-discipline; `schema-reviewer` if asked |
| "tests / TDD / Prove-It / coverage" | `/test` |
| "está roto en prod / 500s / incidente" | `incident-investigator` |
| "qué puede fallar / failure modes" | `incident-thinker` |
| "webperf / LCP / Core Web Vitals" | `/webperf` |
| "auth / Better Auth / login / password reset" | better-auth-best-practices (+ auth-and-authorization for tenant/permissions) |
| "UI / copy / look & feel SGI" | sgi-frontend-identity |
| "publicá / commit / push / merge" | `/publicar-cambios` |
| "riesgos / oportunidades / ISO 9001 6.1" | riesgos-oportunidades |

## Model routing (no Auto)

Do **not** rely on Auto model selection. Prefer an explicit model. Default the main session to **Sonnet**. Escalate to **Opus** only when a wrong design is expensive. Use **Haiku** only for mechanical, easy-to-verify work.

| Work | Model | Notes |
|---|---|---|
| Spec, plan, domain design, hard architecture | Opus (plan) → Sonnet (code) | Use `opusplan` if the harness offers it |
| Auth multi-tenant / permissions / Better Auth design | Opus | Main session; then Sonnet for routine wiring |
| Dangerous prod migrations / lock-risk schema | Opus if prod data at risk; else Sonnet | `/review-migration`, `schema-reviewer` |
| `/build`, TDD, normal features, bugfix with known locus | Sonnet | Default for almost all coding |
| `/review`, `/ship`, most subagents | Sonnet | All agents in `.claude/agents` are pinned to `model: sonnet` |
| Dedicated security pass on auth/payments/secrets | Sonnet; Opus if still unsure after one pass | `security-reviewer` |
| Live prod incident (subtle, multi-layer) | Sonnet first; Opus if stuck | `incident-investigator` |
| `/webperf`, UI identity, Vercel rule lookups | Sonnet | Load 1–3 rule files only |
| `/publicar-cambios`, renames, changelog, "dónde está X" | Haiku | Switch session to Haiku for that task if available |

**Subagent models:** keep pinned in each agent's frontmatter (`model: sonnet`). Do not spawn Opus subagents by default — escalate the main session instead when the table says Opus.

**Quality rule:** better routing + skills beats a more expensive model. If Sonnet fails once with full relevant context, then switch that task to Opus.

## Archived Claude skills (token savings)

Moved out of `.claude/skills` (recover from `C:\Proyectos\_archivo-claude-SGI-Base-Agente\skills-archivadas`): `email-and-password-best-practices` (merged into better-auth), `idea-refine`, `interview-me`, `constraint-driven-development`. `/constraints` command archived with them. Full pre-change backup: `C:\Proyectos\_archivo-claude-SGI-Base-Agente\backup-2026-09-29`.
