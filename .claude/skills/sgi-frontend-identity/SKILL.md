---
name: sgi-frontend-identity
description: SGI Base's own visual and UX identity ("precision ledger"). Use BEFORE creating or changing any page, component, form, layout, empty state or UI copy in this project, and when reviewing UI. It overrides generic UI advice (frontend-ui-engineering, vercel-composition-patterns, design:*) on look, feel and language; those skills still apply for mechanics (a11y, state, component APIs).
---

# SGI Base — frontend identity

The product is a management system for ISO 9001 / 14001 / 45001. The UI must feel like an
**audit ledger / consola de control**: trustworthy, precise, calm, industrial.
Two themes share one structure (`<html data-theme="light|dark">`, toggle in the shell header):
**Light A** "Sala de control diurna" (cobalt accent) and **Dark A** "OLED noche" (cyan accent). Never like a generic SaaS template.

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
3. **One dominant accent per theme** (`--color-accent*`: cobalt in Light A, cyan in Dark A). One primary
   action per view uses it (`Button` primary); secondary is outline/text. Text on solid fills
   (accent, success, persona) uses `--color-on-solid`, never `text-white`. Semantic colors
   (`danger`, `warning`, `success`, `info`, `pending` + `-soft`/`-line`) only for state, never decoration.
   Every container and control keeps a visible border in both themes.
4. **Persona is always visible.** Superuser = amber, admin = accent (cobalt/cyan), member = teal
   (`--color-persona-*`, rails `--color-*-rail`). Use `PERSONA_THEME` from
   `components/shell/nav-config.ts`; don't hardcode persona colors in pages.
   Read-only users must see "Solo lectura" and never get enabled edit controls.
5. **Language is Spanish (rioplatense-neutral), domain-precise.** Use ISO vocabulary
   (hallazgo, acción, eficacia, cláusula, evidencia) consistently. Buttons say the action
   ("Registrar riesgo"), not "Enviar"/"OK".

## Typography

- Display (`--font-display`): Instrument Sans (light) / Sora (dark). Page `h1`, section `h2`, metric values.
- Sans (`--font-sans`, Geist): all body/UI.
- Mono (`--font-mono`, Geist Mono): eyebrows, labels, codes, IDs, clause numbers, dates, chips.
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
- Status chips: `<StatusChip status="ok|warning|danger|pending|overdue|info">`: soft fill + border + icon + mono uppercase label; pending is dashed, overdue is solid. Legacy `tone`/`className` still work.
- Tenant home leads with the horizontal `DashboardStrip` (KPIs + compliance bar + `DueRail` of `DueCard`s); sticky and compacts on scroll at ≥1024px.

## Forms

- Use the shared `Field` pattern (label → control → hint in `text-xs ink-muted`).
- Inputs: use `INPUT_CLASS` (border `line-strong` always visible, `field-fill`, focus = accent border + ring, `aria-invalid` = danger). Never borderless.
- Contextual help lives in an accent-soft callout (`bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]`), phrased as the question the user should ask themselves.
- Placeholders are real examples from the domain ("Ej.: …"), not "Escribí aquí".
- Server Action errors render inline next to the form, in `danger` on `danger-soft`.

## Shape, depth, motion

- Radius restrained: `--radius-sm` chips, `--radius-md` controls/cards, `--radius-lg` max.
- Depth by lines first (`canvas` → `surface` → `surface-raised`, `surface-sunken` for fields/table heads); `--shadow-card`/`--shadow-hover` are subtle extras, `--shadow-soft` only for overlays.
- Motion only for feedback: 100/150/220/300ms (`--duration-instant|fast|med|slow`) with `--ease-out`; transform/opacity/color only; guard lifts with `motion-safe:`; `prefers-reduced-motion` is handled in `globals.css`.

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
