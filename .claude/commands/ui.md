---
description: Audit or restyle UI against SGI frontend identity (precision ledger) — findings-only by default; restyle migrates pages to ui/*
argument-hint: "[audit|restyle] ruta/sección"
---

`/ui` owns look, feel, UX copy, restyle, and visual identity for this project. Do **not** spawn a subagent — run in the main session. Prefer this command over ad-hoc identity/UI reviews.

Input: $ARGUMENTS

## Determine the mode

Parse `$ARGUMENTS` for an optional mode and a target (file, directory, route, or section name).

| Mode | When | Behavior |
|---|---|---|
| **audit** (default) | No mode, or `audit …` | Findings-only: score against identity + shared `ui/*`; do **not** rewrite code unless the user asks |
| **restyle** | `restyle …` | Migrate the target to `src/components/ui/*` + tokens/identity; apply mechanics only as needed |

If the target is missing, ask once for a path/route/section. If ambiguous between modes, default to **audit**.

Examples: `/ui src/app/t/[slug]/risks`, `/ui audit portal home`, `/ui restyle src/app/(platform)/catalog`

## Owner skills (selective)

1. **Owner — always load:** `sgi-frontend-identity` (overrides generic UI advice on look, feel, language).
2. **Mechanics — only when needed:** `frontend-ui-engineering` for a11y, state, responsive, component APIs. Do **not** let it override identity tokens, banned looks, or Spanish domain copy.
3. **Do not** load full `vercel-composition-patterns/rules/*` or `vercel-react-best-practices/rules/*` unless the change is specifically about component API or React/Next perf — and then only the 1–3 matching rule files.

Source of truth when skill and code disagree: `src/styles/tokens.css`, `src/app/globals.css`, `src/app/layout.tsx`, `src/components/shell/*` — then update the skill.

## Shared primitives checklist (`src/components/ui/*`)

Prefer these over ad-hoc markup. In **audit**, flag gaps; in **restyle**, migrate to them.

**P0:** `PageFrame`, `PageHeader`, `StatTile`/`StatGrid`, `StatusChip`, `Field`, `EmptyState`  
**P1:** `SectionBlock`, `EntityList`/`EntityRow`, `HintCallout`, `FormError`

Also check shell/persona: `PERSONA_THEME` / rails; read-only users see "Solo lectura" and disabled edit controls.

## Identity checklist (from sgi-frontend-identity)

- [ ] Every `var(--…)` used exists in `tokens.css` (no invented tokens; `--color-line` not `--color-border`)
- [ ] No raw hex / Tailwind palette colors (`gray-*`, `blue-*`, `bg-white`…) / banned looks (purple SaaS, cream+terracotta, glass, decorative gradients, pill-everything, emoji icons, oversized heroes)
- [ ] Accent teal only for the one primary action; semantic colors only for state
- [ ] Eyebrow with ISO anchor; page anatomy (header → metrics → sections → lists) when applicable
- [ ] Guidance-style empty states (what it is + next step), not bare "No hay datos"
- [ ] Persona + read-only respected
- [ ] Spanish (rioplatense-neutral) domain copy; action-verb buttons ("Registrar riesgo", not "Enviar"/"OK")
- [ ] Typography: Display = h1/h2 only; mono for codes/IDs/clauses; `tabular-nums` on metrics
- [ ] a11y: landmarks, visible focus, labels, color not sole signal, AA contrast

## Mode: audit (default)

1. Read the target files (page + colocated components; follow one hop into shared UI if used).
2. Run the identity + `ui/*` checklists. Cite `file:line`.
3. Return **findings-only** in the output format below. Omit empty sections. No essays. Do not rewrite code.
4. If the user then asks to fix, switch to restyle (or implement the listed fixes) in the same session.

## Mode: restyle

1. Run a quick audit pass first (same checklists) so the migration is scoped.
2. Migrate markup to `src/components/ui/*` primitives; wire tokens from `tokens.css` only.
3. Preserve behavior and Server Actions; change presentation/copy/structure to match identity.
4. Pull in `frontend-ui-engineering` only for a11y/state/responsive gaps revealed by the migration.
5. After edits, re-check the identity checklist and summarize what moved to `ui/*` vs what remains ad-hoc (with reason).

## Output format — UI Identity Audit

```markdown
## UI Identity Audit: <target>

**Mode:** audit | restyle
**Scope:** <paths / routes>

### Critical
- [finding + file:line] — identity / a11y / wrong primitive

### Important
- [finding + file:line]

### Suggestions
- [finding + file:line]

### ui/* gaps
- Missing / should use: <PageHeader | Field | EmptyState | …> at <file:line>
- Already correct: <brief list or "none noted">

### Positive
- <what already matches identity>

### Restyle plan (restyle mode only, or if user asks)
1. …
2. …
```

Findings-only rule (audit): bullets, no narration of steps, omit empty severity sections, ~800 words max unless the user asked for depth.

## Hard rules

- **No new agent / subagent** for this command. Main session only.
- **One owner:** identity via `sgi-frontend-identity`; never run a parallel generic UI redesign that fights tokens/copy.
- **Cite file:line.** No theoretical "consider polishing".
- **Restyle does not invent tokens or looks.** If a token is missing, stop and propose adding it to `tokens.css` + the design-tokens test — do not hardcode hex.
- For Core Web Vitals / Lighthouse → `/webperf`. For React waterfalls/bundle → `vercel-react-best-practices`. For component prop APIs → `vercel-composition-patterns` (mechanics with frontend-ui-engineering).