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
   **Only exception: the Hub layer** (see "Hub" below) — glow, rings, metal rims and circuit traces
   live only inside `HubStage`, never on content pages.
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
- `DashboardStrip` / `DueRail` remain for module pages that need a sticky KPI strip; the tenant home no longer uses them (see Hub).

## Shell and navigation (progressive entry)

- No sidebar. `AppShell` = persona bar (h-1) + one header: hex mark + tenant, **trail** `Inicio › Módulo › Pantalla`
  (`ShellTrail`, `nav aria-label="Ruta"`, computed by `crumbsFor` in `domain/modules/hub.ts`), persona chip,
  name, "Puede editar / Solo lectura", theme, sign out. Platform keeps horizontal tabs (`navItems`, `nav "Principal"`).
- Tenant navigation is progressive: **Inicio** (`/t/[slug]`, modules grouped by area, `nav "Principal"`, one
  `role="group"` per area) → **module hub** (`/t/[slug]/m/[path]`, its screens) → **screen** (existing pages).
  A module with only one visible screen opens directly (no hub). Read-only users don't get `write` screens.
- Screens per module, their hints, icons and the `dueTypes` that feed the module's small dashboard live in
  `MODULE_HUB` (`src/domain/modules/hub.ts`). A new screen = one entry there; `tests/modules-hub.test.ts`
  fails if it points to a page that doesn't exist. Screen names never repeat the module name
  ("Registro de riesgos", not "Riesgos y oportunidades").

## Hub (the one expressive layer)

- `HubStage` (`components/hub/HubStage.tsx`): the same high-contrast cobalt console in **both** themes
  (`--color-hub-*`: stage, panel, row, row-hover, ink, ink-muted, line, focus, glow), dot grid, orbit rings and
  circuit traces (decorative SVG, `aria-hidden`). Nothing on the stage moves by itself (no looping animation, WCAG 2.2.2).
  One per page: it hosts the SVG gradients the hexagons use.
- **Home = `AreaGrid`** (`components/hub/AreaGrid.tsx`, styles `.sgi-area*` / `.sgi-guide*` in `globals.css`), accessibility first:
  one panel per area (`role="group"`, h2 + tagline, number chip, 3px top band in `--color-area-<section>`), a **list**
  of module links (icon, label 14px sentence case, mono detail, chevron; min 52px tall; focus = 3px `--color-hub-focus`)
  and a small decorative **orbit guide** (`aria-hidden`, `orbitPoints` in `orbit.ts`) whose dot lights up when its row
  has hover or focus. Narrow panels drop the orbit and keep the list. The grid never leaves an area alone at full
  width: with five areas the third (Operación SST) is the tall column (`"a b c" / "d e c"` desktop, `"a b" / "c d" / "c e"`
  tablet); with three, the third spans the row only on tablet. Tab order always follows the catalog.
- Area colors (`--color-area-compliance|improvement|sst|people|admin`) are for grouping only, never for state, and
  always come with the area number and name.
- Module hubs (`/t/[slug]/m/[module]`) keep `HexTile` (flat-top glass hexagon, metal rim, `HubIcon`, uppercase label,
  mono detail; focus = rim lit in `--color-hub-glow`, hover lift `motion-safe`) on `HexBus` (tiles joined by the
  green/blue cable). `HubSteps`: "01 Elegí el módulo → 02 Elegí qué hacer".
- Text on the stage uses `--color-hub-ink` / `--color-hub-ink-muted`; semantic state colors never go on the stage.
- Small dashboard = `TelemetryPanel` (`components/hub/Telemetry.tsx`) on normal theme surfaces, labelled "Solo referencia":
  `TelemetryCounts`, `ComplianceBar`, `DueMiniList` (max 3 items). It informs; the work happens inside modules.

## Forms

- **Estilo de formularios: pasos guiados (decisión del PO, 2026-11-02, alternativa B).** Un alta de varias secciones usa `GuidedSteps` (`components/ui/GuidedSteps.tsx`): riel lateral con `01 · AHORA / COMPLETO / DESPUÉS`, el paso actual en tarjeta con anillo de acento, los completos como resumen con «Editar», los siguientes atenuados y punteados. Un paso = una pregunta («¿Qué querés lograr?»). Todos los pasos viven en el mismo `<form>`; `validate` por paso dice por qué no se puede seguir. Las fichas de detalle usan `StageSection` (completo = resumen + «Editar», lo que falta resaltado). Un formulario de 2 o 3 campos no necesita pasos.
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
