# Implementation Plan: SGI Base (ISO 9001 / 14001 / 45001)

## Overview

Scaffold a multi-tenant Next.js SaaS and deliver vertical slices in capability-map order: catalog → tenant → auth → gap (superuser) → documents → due-date automation engine → operations core → client portal UI. Each slice leaves a working, testable system. Automation *catalog items* beyond the due-date engine are deferred to a later automation-spec doc; MVP ships the engine + offer/activation model.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monolith modular | Next.js App Router, domain in `src/domain` | One deployable MVP; clear boundaries for later extract |
| Tenancy | `tenantId` on all business rows + middleware check | Simple, auditable isolation |
| Auth | Better Auth + roles `platform_superuser` \| `tenant_admin` \| `process_owner` \| `contributor` \| `viewer` | Matches SPEC actors; open question #1 closed with defaults |
| Catalog | Seeded ISO requirement rows (not hard-coded UI) | Versionable; supports greenfield templates by size/activity |
| Files | S3-compatible only | Ephemeral host FS (Vercel/Render) |
| Jobs / integraciones | **n8n** (self-hosted) solo como orquestador: dispara `scanDueReminders` vía endpoint autenticado (secreto compartido, idempotente) y ejecuta ofertas de tipo *integración* (Slack/Teams/WhatsApp, Sheets, email externo). La lógica de dominio (vencimientos, tenant scope, auditoría) queda en la app; n8n nunca escribe en la DB directo. Si una automatización es solo interna y simple, se resuelve nativa (cron del host) sin n8n | Evita construir scheduler + conectores propios; mantiene invariantes en el dominio |
| UI | Design tokens + shadcn primitives, custom shell | Modern non-generic look per SPEC |
| Language MVP | Spanish only | Open question #2 default |
| Brand MVP | Temporary “SGI Base” identity | Open question #5 default |
| Hosting | Vercel + Neon (default) | Open question #3 default; swap later if needed |

## Dependency Graph

```
Scaffold (Next/Prisma/Vitest/Playwright)
    │
    ├── ims-catalog (seed + domain + admin read)
    │       │
    │       ├── tenant-provisioning (create tenant + essential template)
    │       │       │
    │       │       └── identity-access (platform + tenant users)
    │       │               │
    │       │               ├── assessment-gap (superuser load)
    │       │               │       │
    │       │               │       └── document-control (keep/replace/create + storage)
    │       │               │               │
    │       │               │               ├── automation-offers (due engine + offers)
    │       │               │               │
    │       │               │               └── operations-core (NC, risks, audits, KPIs)
    │       │               │                       │
    │       │               │                       └── client-portal (modern shell + dashboards)
    │       │               │
    │       └───────────────┴── (catalog used by template + gap + automations)
```

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| ISO catalog too large for MVP seed | Seed **essential** clauses only; mark rest `available_for_scale` |
| Better Auth multi-tenant friction | Spike in Task 2; fallback Auth.js if blocked |
| Scope creep on automations | Engine only until automation-spec approved |
| Cross-tenant bugs | Integration tests with two tenants; middleware deny-by-default |
| Design looks generic | Design tokens + motion shell early (Task 3 / portal checkpoint) |

## Parallelism

- After Task 1–2: catalog seed content can proceed while auth UI is polished.
- Document storage adapter can be stubbed (local disk **forbidden** in prod; use MinIO/R2 mock in tests).
- Operations-core entities are parallelizable once document-control + auth exist (separate tasks, same phase).

## Phases

### Phase 0 — Foundation
Scaffold, CI scripts, design tokens, Prisma baseline.

### Phase 1 — Catalog + Tenant + Auth
Greenfield path: create tenant with essential template and log in as tenant admin / superuser.

### Phase 2 — Gap + Documents
Superuser loads assessment; documents keep/replace/create with files in object storage.

### Phase 3 — Automation engine + Operations
Due dates, reminders, offer activation; NC, risks, audits, indicators.

### Phase 4 — Client portal polish + E2E
Modern shell, dashboards, Playwright happy paths, deploy checklist.

## Task List (index)

See `tasks/todo.md` for full acceptance criteria. Ordered:

1. Scaffold Next.js + tooling  
2. Prisma multi-tenant baseline + Better Auth spike  
3. Design system tokens + app shell skeleton  
4. `ims-catalog` domain + seed + platform read UI  
5. `tenant-provisioning` create tenant + essential template  
6. `identity-access` invite tenant users + roles  
7. Checkpoint A  
8. `assessment-gap` superuser backoffice  
9. `document-control` + S3 upload  
10. Checkpoint B  
11. `automation-offers` due engine + notifications  
12. `operations-core` NC + actions  
13. `operations-core` risks + audits + indicators  
14. Checkpoint C  
15. `client-portal` dashboards + nav  
16. E2E Playwright critical paths  
17. Checkpoint D — human review / ship readiness  

## Open Questions (defaults applied)

| # | Topic | Default until changed |
|---|---|---|
| 1 | Roles | `platform_superuser`, `tenant_admin`, `process_owner`, `contributor`, `viewer` |
| 2 | Language | ES only |
| 3 | Hosting | Vercel + Neon |
| 4 | Automation list | Engine only; catalog items later |
| 5 | Brand | Temporary “SGI Base” |

## Approval

Plan ready for human review before `/build`.

---

## Addendum: Task 11 — Riesgos y oportunidades (Nivel 2) — 2026-09-26

SPEC aprobado: `SPEC-risks-opportunities.md`. Implementado como slices verticales:

1. Domain + Prisma (`Risk`, `Opportunity`, assessments versionados, `Action`/`ActionLink`/`ActionAttachment`)
2. Action compartida con DueItem (`operational_action`); completar ≠ efectividad
3. UI Explorar contexto + detalle canvas riesgo/oportunidad
4. Assessments + decisiones de respuesta/persecución
5. Workspace 4 capas en `/t/[slug]/risks`; nav `/portal/risks`
6. Señales stale / review triggers en dominio

Fuera de alcance: FMEA, heat map home, migrar FindingMeasure → Action, 45001, auditorías/indicadores.
