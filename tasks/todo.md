# Task List: SGI Base MVP

Source of truth: `SPEC.md` + `CAPABILITY-MAP.md` + `tasks/plan.md`.  
Mark tasks `[x]` only after acceptance criteria and verification pass.

---

## Task 1: Scaffold Next.js app + tooling

**Description:** Initialize the Next.js (App Router) + TypeScript project with ESLint, Prettier, Vitest, Playwright scripts, and folder layout from SPEC.

**Acceptance criteria:**
- [x] `npm run dev`, `npm run build`, `npm test`, `npm run lint` work
- [x] Directories `src/app`, `src/domain`, `src/lib`, `tests`, `e2e`, `prisma` exist

**Verification:**
- [x] `npm run build` succeeds
- [x] `npm test` runs (even if zero tests yet)

**Dependencies:** None  
**Files likely touched:** `package.json`, `tsconfig.json`, `src/app/layout.tsx`, config files  
**Estimated scope:** M

---

## Task 2: Prisma multi-tenant baseline + auth

**Description:** Add PostgreSQL/Prisma models for `Tenant`, `User`, membership/roles; integrate Better Auth (or document Auth.js fallback); seed one platform superuser via env.

**Acceptance criteria:**
- [x] Migrations apply cleanly
- [x] Superuser can sign in
- [x] Queries are tenant-scoped helpers (deny cross-tenant by default)

**Verification:**
- [x] Unit/integration test: two tenants cannot read each other’s rows
- [x] Manual: login as superuser

**Dependencies:** Task 1  
**Files likely touched:** `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/db.ts`, `tests/...`  
**Estimated scope:** M

---

## Task 3: Design tokens + shell skeleton

**Description:** Define CSS variables, typography, and a modern app shell (platform + tenant layouts) without purple-generic defaults.

**Acceptance criteria:**
- [x] Tokens in `src/styles/`
- [x] Empty platform layout and tenant layout render with distinctive visual identity
- [x] Critical landmarks accessible (nav, main)

**Verification:**
- [x] Manual visual check desktop + tablet width
- [x] Build succeeds

**Dependencies:** Task 1  
**Files likely touched:** `src/styles/`, `src/app/(platform)/layout.tsx`, `src/app/(tenant)/layout.tsx`, shell components  
**Estimated scope:** M

---

## Task 4: ims-catalog — domain, seed, platform read UI

**Description:** Model ISO requirements (9001/14001/45001), essential vs scalable flags, seed essential set; platform UI to browse catalog.

**Acceptance criteria:**
- [x] Seed loads essential requirements for three standards
- [x] Domain helpers for lookup by standard/clause
- [x] Superuser can list/filter catalog

**Verification:**
- [x] Unit tests for seed invariants (no duplicate clause keys)
- [x] Manual: catalog page shows seeded rows

**Dependencies:** Task 2, Task 3  
**Files likely touched:** `src/domain/ims/`, `prisma/`, `src/app/(platform)/catalog/`, `tests/`  
**Estimated scope:** M

---

## Task 5: tenant-provisioning — create tenant + essential template

**Description:** Superuser creates tenant (name, slug/URL, size, activity); system applies essential requirement template from catalog.

**Acceptance criteria:**
- [x] Tenant created with unique slug
- [x] Essential requirements assigned based on size + activity rules (documented defaults)
- [x] Tenant reachable at configured path/subdomain strategy (path-based MVP OK)

**Verification:**
- [x] Integration test: create tenant → template rows exist
- [x] Manual: create tenant from platform UI

**Dependencies:** Task 4  
**Files likely touched:** `src/domain/tenant/`, `src/app/(platform)/tenants/`, `prisma/`  
**Estimated scope:** M

---

## Task 6: identity-access — tenant users + roles

**Description:** Tenant admin / superuser can invite users; assign roles; users sign in scoped to tenant.

**Acceptance criteria:**
- [x] Invite + role assignment works for the five roles
- [x] Middleware/session includes `tenantId` + role
- [x] Viewer cannot mutate; contributor can limited writes (policy documented)

**Verification:**
- [x] Authz unit tests per role
- [x] Manual: invite user, login, see correct nav

**Dependencies:** Task 5  
**Files likely touched:** `src/lib/authz.ts`, `src/app/(tenant)/users/`, tests  
**Estimated scope:** M

---

## Checkpoint A: After Tasks 1–6

- [x] All tests pass
- [x] Build succeeds
- [x] Flow: superuser login → create tenant → invite user → tenant login
- [x] Human review before Phase 2 (continuar con Task 7 a pedido)

---

## Task 7: assessment-gap — superuser backoffice

**Description:** Superuser loads per-requirement status (missing/partial/compliant/N/A) and notes for a tenant; decide keep/replace/create hints.

**Acceptance criteria:**
- [x] Gap form per tenant requirement
- [x] Bulk save; audit of who changed what
- [x] Domain function `decideDocumentFate` used

**Verification:**
- [x] Unit tests for fate rules
- [x] Manual: load gap for a tenant

**Dependencies:** Checkpoint A  
**Files likely touched:** `src/domain/assessment/`, `src/app/(platform)/tenants/[id]/gap/`, tests  
**Estimated scope:** M

---

## Task 8: document-control — docs + object storage

**Description:** Attach documents to requirements with versioning and validity; keep compliant client docs; upload to S3-compatible storage.

**Acceptance criteria:**
- [x] Upload/download via storage adapter
- [x] Version history; current version pointer
- [x] Cannot overwrite `keep` docs without explicit superuser action

**Verification:**
- [x] Integration test with storage mock
- [x] Manual: upload PDF, link to requirement

**Dependencies:** Task 7  
**Files likely touched:** `src/lib/storage.ts`, `src/domain/documents/`, `src/app/(tenant)/documents/`, platform document tools  
**Estimated scope:** M

---

## Checkpoint B: After Tasks 7–8

- [x] Tests pass; build succeeds
- [x] Flow: gap loaded → document keep/replace/create works
- [x] Human review before automation/ops (continuar con Task 9 a pedido)

---

## Task 9: automation-offers — due engine + notifications

**Description:** Model due items (generic), offer catalog stub, activation per tenant; scheduled scan + email/in-app reminder for upcoming/overdue items. No undeclared automations.

**Acceptance criteria:**
- [x] Create due item linked to entity (doc, indicator, action, etc.)
- [x] Job scans and emits reminders
- [x] Offer can be activated/deactivated per tenant
- [x] Audit log of automation runs

**Verification:**
- [x] Unit tests for due calculation / reminder windows
- [x] Manual or job-dev: trigger scan, see notification

**Dependencies:** Checkpoint B  
**Files likely touched:** `src/domain/automation/`, `src/lib/jobs/`, email adapter, UI offers page  
**Estimated scope:** M

---

## Task 10: operations-core — NC + corrective actions

**Description:** Create/list nonconformities and corrective actions with owners and due dates (feeds due engine).

**Acceptance criteria:**
- [x] CRUD NC + actions scoped to tenant
- [x] Status workflow minimal (open → in_progress → closed)
- [x] Due dates create due items when present

**Verification:**
- [x] Domain + API tests
- [x] Manual: create NC with action due date

**Dependencies:** Task 9 (or Task 8 if due items created eagerly; prefer Task 9)  
**Files likely touched:** `src/domain/operations/nc.ts`, tenant NC routes, tests  
**Estimated scope:** M

---

## Task 10b: findings — dominio + persistencia + publish

**Description:** Implementar `SPEC-findings.md`: Finding tipado, 5 Porqués con causa raíz obligatoria, medidas con owner usuario, notificados, DueItems al publicar. Refactor/reemplazo del modelo NC de Task 10.

**Acceptance criteria:**
- [x] Dominio: tipos, gates de publicación, 5 Whys (confirm root cause)
- [x] Schema Prisma Finding + WhyStep/RCA + Measure + NotificationRecipient
- [x] `publishFinding` crea DueItems y notifica solo a notificados + owners
- [x] Migración desde Nonconformity o drop en entornos solo-dev documentado

**Verification:**
- [x] Unit tests gates + 5 Whys
- [x] Integration: publish → due + notifications

**Dependencies:** Task 10, Task 9  
**Files:** `src/domain/findings/`, `src/lib/findings.ts`, prisma  
**Estimated scope:** L

---

## Task 10c: findings — UI laboratorio + bandeja

**Description:** FiveWhysLab interactivo, wizard de alta, bandeja y detalle con causa raíz destacada. Reemplaza UI `/operations` NC.

**Acceptance criteria:**
- [x] Laboratorio paso a paso + cadena visual + confirmar causa raíz
- [x] Alta: datos → causa → medidas (user+due) → notificados → publicar
- [x] Detalle muestra ★ causa raíz; listado filtrable por tipo

**Verification:**
- [x] Manual: publicar hallazgo NC con 5 Porqués y ver ficha
- [x] Viewer no publica

**Dependencies:** Task 10b  
**Files:** `src/app/(tenant)/t/[slug]/findings/`, FiveWhysLab component  
**Estimated scope:** L

---

## Task 10d: findings — lógica de estados del hallazgo

**Description:** Ciclo de vida real del hallazgo según §10.2 (9001/14001/45001) y la guía ISO/TC 176 APG: estados derivados de las medidas, **verificación de eficacia** antes de cerrar NC e incidentes, anulación y reapertura con motivo, e historial. Research: `RESEARCH-findings-lifecycle.md`. SPEC: `SPEC-findings-lifecycle.md` (aprobado PO 2026-09-27).

**Decisiones PO (2026-09-27):** verificación obligatoria para NC e incidente · plazo 30 días editable (antes, con motivo) · verifica admin o responsable de proceso independiente (excepción justificada) · anula y reabre solo el admin.

**Sub-tareas (plan vertical):**
- [x] 10d.1 Dominio + Prisma + tests (estado `verification`, transiciones, gates, independencia, historial)
- [x] 10d.2 Persistencia: medidas iniciar/cerrar con derivación de estado, verificación, anular, reabrir, DueItem, recálculo de existentes
- [x] 10d.3 UI: ficha con pasos, "qué falta", verificación, historial, acciones por rol; bandeja con filtro "En verificación"
- [ ] 10d.4 e2e + README

**Dependencies:** Task 10c (bandeja + adjuntos + cierre de medidas)  
**Files:** `src/domain/findings/`, `src/lib/findings.ts`, UI detalle/bandeja  
**Estimated scope:** L

---

## Task 11: operations-core — riesgos y oportunidades (ISO 9001:2026)

**Description:** Módulo de **riesgos** y **oportunidades** del SGC según ISO 9001:2026 (6.1.1–6.1.3), con objetos semánticos separados, acciones/efectividad, revisión y evidencia. **No** es un registro genérico ni matriz obligatoria. Investigación: `RESEARCH-risks-opportunities.md`. SPEC: `SPEC-risks-opportunities.md` (Nivel 2 aprobado PO 2026-09-26).

**Acceptance criteria:**
- [x] Informe de investigación + SPEC Nivel 2 aprobado
- [x] Risk ≠ Opportunity; lifecycles; assessments versionados; review/stale
- [x] MVP: Explorar contexto → canvas → assessment → decisión → Action compartida → efectividad
- [x] DueItem en acciones; enlace opcional a hallazgos (sin auto-conversión)
- [x] Workspace Discovery · Decisions · Execution · Learning; nav tenant

**Sub-tareas (plan vertical):**
- [x] 11.1 Prisma + domain Risk/Opportunity + tests
- [x] 11.2 Action compartida + DueItem + evidencia + efectividad
- [x] 11.3 Wizard Explorar contexto + canvases + rutas/nav
- [x] 11.4 Assessments versionados + decisiones
- [x] 11.5 Workspace 4 capas + ejecución acciones
- [x] 11.6 Revisión/stale + escenario canónico + checkpoint

**Verification:**
- [x] `tests/risks-opportunities.test.ts` (dominio + filtros)
- [x] `npm test` + `npm run build` verdes
- [x] Migración `20260926200000_add_risks_opportunities_actions`

**Dependencies:** Task 10 findings; skill riesgos-oportunidades  
**Files:** `src/domain/risks/`, `src/domain/opportunities/`, `src/domain/actions/`, `src/lib/risks.ts`, `src/lib/opportunities.ts`, `src/lib/actions.ts`, `src/app/(tenant)/t/[slug]/risks/**`  
**Estimated scope:** L

---

## Task 11b: operations-core — auditorías internas integradas (9001/14001/45001)

**Description:** Ciclo completo de auditoría interna: programa anual → plan (objetivo, alcance, criterios) → lista de verificación desde el catálogo del tenant → hallazgos que crean `Finding` → informe → cierre, con cobertura del programa. Research: `RESEARCH-audits.md`. SPEC: `SPEC-audits.md` (aprobado PO 2026-09-27).

**Decisiones PO (2026-09-27):** auditorías antes que indicadores · integrada 9001/14001/45001 · ciclo completo · SPEC antes de construir.

**Sub-tareas (plan vertical):**
- [x] 11b.1 Dominio + Prisma + tests (lifecycle, gates, imparcialidad, mapeo a Finding, cobertura)
- [x] 11b.2 Programa anual + planificación + DueItems
- [x] 11b.3 Checklist desde catálogo + ejecución con evidencia/adjuntos
- [x] 11b.4 Hallazgos automáticos → Finding + vínculo inverso
- [x] 11b.5 Informe + cierre + cobertura + guía + nav + e2e

**Dependencies:** Task 10c (findings), Task 9 (storage), Task 8 (DueItem)
**Estimated scope:** L

---

## Task 11d (pendiente, pedido PO 2026-09-27): auditorías externas con carga de informe

**Description:** Sección de **auditorías externas** (certificación / 3.ª parte, clientes / 2.ª parte). Se adjunta el **informe del auditor externo** (PDF) y el sistema **extrae los hallazgos automáticamente** (NC mayor/menor, observaciones, oportunidades de mejora, con cláusula y evidencia) para registrarlos como `Finding` vinculados a la auditoría externa.

**Notas para el SPEC (a definir antes de construir):**
- Extracción: parseo del PDF + extracción asistida (LLM) con **revisión humana obligatoria** antes de crear los hallazgos (el usuario confirma/edita cada uno); nunca crear en silencio.
- Datos de la auditoría externa: organismo, tipo (certificación inicial, seguimiento, recertificación, cliente), normas, fechas, auditor, resultado/recomendación.
- Plazos típicos del organismo para responder NC (p. ej. 30/90 días) → `DueItem`.
- Reutilizar: `Finding` (con origen auditoría externa), storage para el informe, cobertura del programa (opcional).
- Riesgos: calidad de extracción según formato de cada organismo; datos sensibles del informe; costo por documento.

**Dependencies:** Task 11b (auditorías internas, vínculo Finding ↔ auditoría)
**Estimated scope:** L (requiere research + SPEC)

---

## Task 11c (luego): indicadores

## Checkpoint C: After Tasks 9–11

- [x] Tests pass; build succeeds (post Task 11 risks/opportunities)
- [ ] Due reminders work for at least docs/actions/indicators
- [ ] Human review before portal polish

---

## Task 12: client-portal — navigation + dashboards

**Description:** Modern tenant home: requirement compliance summary, upcoming due items, shortcuts to docs/ops; polish platform nav.

**Acceptance criteria:**
- [ ] Dashboard shows compliance counts + due list
- [ ] Nav covers documents, NC, risks, audits, indicators, automations
- [ ] Visual polish matches design tokens (non-generic)

**Verification:**
- [ ] Manual UI review
- [ ] Basic a11y check (keyboard to main nav)

**Dependencies:** Checkpoint C  
**Files likely touched:** `src/app/(tenant)/page.tsx`, dashboard components  
**Estimated scope:** M

---

## Task 13: E2E critical paths

**Description:** Playwright covers: superuser login → create tenant → load gap → upload doc → create NC with due → see due on dashboard (tenant user).

**Acceptance criteria:**
- [ ] E2E suite green in CI/local
- [ ] Uses test DB / isolated tenant slugs

**Verification:**
- [ ] `npm run test:e2e` passes

**Dependencies:** Task 12  
**Files likely touched:** `e2e/*.spec.ts`  
**Estimated scope:** M

---

## Checkpoint D: Ship readiness

- [ ] All prior checkpoints green
- [ ] `SPEC.md` success criteria reviewed against demos
- [ ] Env sample documented (`.env.example`) without secrets
- [ ] Human approval to deploy / start client onboarding

---

## Notes for `/build`

- Implement **one task at a time**; stop at checkpoints for human review.
- Prefer TDD on `src/domain/**`.
- Do not invent automation behaviors beyond Task 9 engine until an automation-spec is approved.
- Automatizaciones: priorizar **n8n** solo cuando aporte (schedule externo o integración con terceros). n8n llama endpoints autenticados e idempotentes de la app (`scanDueReminders`, futuras ofertas de integración); nunca accede a la DB ni duplica reglas de dominio. Si basta con lógica nativa, no se usa n8n.

## Task N8N-1: trigger de vencimientos desde n8n

**Description:** Exponer `POST /api/automation/scan` protegido por `AUTOMATION_WEBHOOK_SECRET` que ejecuta `scanDueReminders`; workflow n8n exportado en `n8n/` con Schedule Trigger diario → HTTP Request.

**Acceptance criteria:**
- [x] Sin secreto válido → 401; con secreto → corre scan y registra `AutomationRun`
- [x] Reintentos de n8n no duplican notificaciones (idempotencia por día/ítem)
- [x] Workflow JSON versionado + variables documentadas en `.env.example`

**Verification:** test de integración del endpoint (401 / 200 / doble llamada sin duplicados).
