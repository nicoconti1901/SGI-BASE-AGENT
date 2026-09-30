---
name: sgi-frontend-identity
description: SGI Base's own visual and UX identity ("precision ledger"). Use BEFORE creating or changing any page, component, form, layout, empty state or UI copy in this project, and when reviewing UI. It overrides generic UI advice (frontend-ui-engineering, vercel-composition-patterns, design:*) on look, feel and language; those skills still apply for mechanics (a11y, state, component APIs).
---

# SGI Base — frontend identity

The product is a management system for ISO 9001 / 14001 / 45001. The UI must feel like an
**audit ledger**: trustworthy, precise, calm, industrial. Never like a generic SaaS template.

Source of truth: `src/styles/tokens.css` (tokens), `src/app/globals.css` (Tailwind bridge),
`src/app/layout.tsx` (fonts), `src/components/shell/*` (shell + persona theme).
If this file and those disagree, the code wins — then update this file.

Shared UI primitives in `src/components/ui/*`: P0 (PageFrame, PageHeader, StatTile/StatGrid, StatusChip, Field, EmptyState) and P1 (SectionBlock, EntityList/EntityRow, HintCallout, FormError). Prefer these over ad-hoc markup when adding or migrating pages.


## Hard rules

1. **Only defined tokens.** Colors, spacing, radius, shadow and motion come from `tokens.css`
   via `var(--…)`. Before using a token, confirm it exists there. Never invent one
   (e.g. `--color-border` does NOT exist → use `--color-line` / `--color-line-strong`).
   No raw hex, no Tailwind palette colors (`gray-*`, `blue-*`, `bg-white`…).
   Guarded by "only references design tokens that exist" in `tests/design-tokens.test.ts`.
2. **Banned looks:** purple/violet SaaS accents, cream + terracotta editorial, glassmorphism,
   gradients as decoration, pill-shaped everything, emoji as icons, oversized hero sections.
   `tests/design-tokens.test.ts` guards part of this — keep it green and extend it when adding tokens.
3. **Accent is teal industrial** (`--color-accent*`). One primary action per view uses it;
   everything else is secondary (outline/text). Semantic colors (`danger`, `success`,
   `warning` + their `-soft`) only for state, never decoration.
4. **Persona is always visible.** Superuser = amber, admin = teal, member = blue
   (`--color-persona-*`, rails `--color-*-rail`). Use `PERSONA_THEME` from
   `components/shell/nav-config.ts`; don't hardcode persona colors in pages.
   Read-only users must see "Solo lectura" and never get enabled edit controls.
5. **Language is Spanish (rioplatense-neutral), domain-precise.** Use ISO vocabulary
   (hallazgo, acción, eficacia, cláusula, evidencia) consistently. Buttons say the action
   ("Registrar riesgo"), not "Enviar"/"OK".

## Typography

- Display (`--font-display`, Fraunces): page `h1` (`text-3xl tracking-tight`) and section `h2` (`text-xl`). Nothing else.
- Sans (`--font-sans`, Source Sans 3): all body/UI.
- Mono (`--font-mono`, IBM Plex Mono): codes, IDs, clause numbers, dates in tables.
- Numbers in metrics/tables: `tabular-nums`.

## Page anatomy (tenant/platform content)

```
<div class="mx-auto flex max-w-5xl flex-col gap-8">
  header:  eyebrow (norm · clause, text-sm ink-muted) → h1 display → one-line purpose
           → actions (1 primary accent, rest secondary)
  metrics: grid of stat tiles (border line, value text-2xl tabular-nums, label text-xs muted)
  sections: border-t line + pt-6, h2 display, "what it is" + "Qué hacer:" guidance line
  lists:   divide-y bordered list; row = TYPE (xs uppercase tracking-wide muted) + title + meta + status chip
</div>
```

- Every page shows the ISO anchor in the eyebrow (e.g. `ISO 9001 · §6.1`).
- Guidance over emptiness: empty states explain what the thing is and the next step,
  in the ink-muted tone, with a link/action — never just "No hay datos".
- Status chips: `rounded px-2 py-0.5 text-xs font-semibold` on the matching `-soft` bg + solid ink.

## Forms

- Use the shared `Field` pattern (label → control → hint in `text-xs ink-muted`).
- Inputs: `rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm`.
- Contextual help lives in an accent-soft callout (`bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]`), phrased as the question the user should ask themselves.
- Placeholders are real examples from the domain ("Ej.: …"), not "Escribí aquí".
- Server Action errors render inline next to the form, in `danger` on `danger-soft`.

## Shape, depth, motion

- Radius restrained: `--radius-sm` chips, `--radius-md` controls/cards, `--radius-lg` max.
- Depth by lines and surfaces (`canvas` → `surface` → `surface-raised`), `--shadow-soft` only for raised overlays.
- Motion only for feedback, `--duration-fast`/`--duration-med` with `--ease-out`; respect `prefers-reduced-motion`.

## Accessibility (non-negotiable)

Landmarks (`aside`/`nav`/`header`/`main#contenido-principal` with `aria-label`s as in `AppShell`),
visible focus (accent outline from `globals.css`), labels on every control, color never the only
signal (chips carry text), contrast AA against the surface they sit on.

## Before finishing UI work

- [ ] Every `var(--…)` used exists in `tokens.css`
- [ ] No raw hex / Tailwind palette colors / banned looks
- [ ] Eyebrow with ISO anchor, one primary action, guidance-style empty states
- [ ] Persona + read-only state respected
- [ ] Spanish domain copy, action-verb buttons
