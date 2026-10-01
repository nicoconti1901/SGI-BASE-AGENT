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
- [x] 10d.4 e2e + README (verificado en navegador por PO: publicado → en curso → en verificación → cerrado)

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

## Task 11d (hecha, pedido PO 2026-09-27): auditorías externas con carga de informe

**Description:** Sección de **auditorías externas** (certificación / 3.ª parte, clientes / 2.ª parte). Se adjunta el **informe del auditor externo** (PDF) y el sistema **extrae los hallazgos automáticamente** (NC mayor/menor, observaciones, oportunidades de mejora, con cláusula y evidencia) para registrarlos como `Finding` vinculados a la auditoría externa.

**Notas para el SPEC (a definir antes de construir):**
- Extracción: parseo del PDF + extracción asistida (LLM) con **revisión humana obligatoria** antes de crear los hallazgos (el usuario confirma/edita cada uno); nunca crear en silencio.
- Datos de la auditoría externa: organismo, tipo (certificación inicial, seguimiento, recertificación, cliente), normas, fechas, auditor, resultado/recomendación.
- Plazos típicos del organismo para responder NC (p. ej. 30/90 días) → `DueItem`.
- Reutilizar: `Finding` (con origen auditoría externa), storage para el informe, cobertura del programa (opcional).
- Riesgos: calidad de extracción según formato de cada organismo; datos sensibles del informe; costo por documento.

**Decisiones PO (2026-09-29):** extracción con LLM de Anthropic + revisión humana obligatoria · avanzar primero modelo + adjunto, extracción después. SPEC: `SPEC-external-audits.md`.

**Sub-tareas:**
- [x] 11d.1 Modelo (`Audit.kind`, tipo, auditor, resultado, plazo de respuesta → DueItem), sección en `/audits`, fuera de programa/cobertura/indicadores
- [x] 11d.2 Informe PDF adjunto (storage + descarga) y alta manual de hallazgos como borrador con origen auditoría externa
- [x] 11d.3 Extracción asistida (PDF → texto → Claude → propuestas) con revisión humana obligatoria antes de crear `Finding`

**Dependencies:** Task 11b (auditorías internas, vínculo Finding ↔ auditoría)
**Estimated scope:** L

---

## Task 11c (hecha): operations-core — objetivos e indicadores (9001/14001/45001)

**Description:** Objetivos del SGI (§6.2) con indicadores medibles (§9.1): carga manual por período, estado determinista (en meta / alerta / fuera de meta), análisis obligatorio de desvíos con camino a Hallazgos y Riesgos, vencimientos de carga y tablero. Research: `RESEARCH-indicators.md`. SPEC: `SPEC-indicators.md` (aprobado PO 2026-09-27).

**Decisiones PO (2026-09-27):** objetivos con sus indicadores · carga manual por período · desvío = análisis + ofrecer hallazgo/riesgo · integrado 9001/14001/45001.

**Sub-tareas (plan vertical):**
- [x] 11c.1 Dominio + Prisma + tests
- [x] 11c.2 Objetivos e indicadores: alta, edición, permisos, vencimientos (`/indicators`, `/indicators/new`, `/indicators/[id]`; cierre de objetivo; DueItem por indicador)
- [x] 11c.3 Carga por período, correcciones, análisis de desvío, vínculo a Hallazgos y Riesgos (`/indicators/[objetivo]/[indicador]`: tendencia, carga, corrección con registro, Crear hallazgo, Explorar riesgo)
- [x] 11c.4 Tablero con resumen, tendencias y cargas vencidas por norma, guía (`/indicators/guia`), menú, e2e, README

**Dependencies:** Task 10c (findings), Task 11 (riesgos), Task 8 (DueItem)
**Estimated scope:** L

## Checkpoint C: After Tasks 9–11

- [x] Tests pass; build succeeds (post Task 11 risks/opportunities)
- [x] Due reminders work for at least docs/actions/indicators (docs: `validUntil` → `DueItem` `document_validity`, agregado 2026-10-01)
- [ ] Human review before portal polish

---

## Task 12: client-portal — navigation + dashboards

**Description:** Modern tenant home: requirement compliance summary, upcoming due items, shortcuts to docs/ops; polish platform nav.

**Acceptance criteria:**
- [x] Dashboard shows compliance counts + due list
- [x] Nav covers documents, NC (Hallazgos), risks, audits, indicators, automations
- [x] Visual polish matches design tokens (non-generic)

**Verification:**
- [x] Manual UI review
- [x] Basic a11y check (keyboard to main nav) — e2e personas.spec.ts

**Dependencies:** Checkpoint C  
**Files likely touched:** `src/app/(tenant)/page.tsx`, dashboard components  
**Estimated scope:** M

---

## Task 13: E2E critical paths

**Description:** Playwright covers: superuser login → create tenant → load gap → upload doc → create NC with due → see due on dashboard (tenant user).

**Hecho:** `e2e/critical-path.spec.ts` — superusuario crea empresa, carga gap, sube documento, invita usuario; publica NC (hallazgo) con medida correctiva vencida y el usuario ve el vencimiento en su panel y navega al hallazgo. El NC de hoy es un Hallazgo (/operations redirige a /findings).

**Acceptance criteria:**
- [x] E2E suite green in CI/local (18 passed + 2 demos omitidos con --workers=1; selectores de audits.spec y critical-path.spec actualizados tras la migración a ui/*, 2026-10-01)
- [x] Uses test DB / isolated tenant slugs (`e2e-crit-<timestamp>`)

**Verification:**
- [x] `npm run test:e2e` passes

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

# Fase 5 — Operación SST, proveedores y competencia (agregado 2026-09-30)

Decisiones de arquitectura, grafo de dependencias, riesgos y preguntas abiertas: `tasks/plan.md` → *Addendum: Fase 5*.
Cada tarea arranca con research + SPEC aprobado por el PO (mismo patrón que 10d / 11 / 11b / 11c).

**Orden recomendado:** 14 → 15 → 16 → 17 → 18. Las tareas 19 y 20 pueden ir en paralelo apenas esté la 14. Los cruces con la Task 20 (persona habilitada para una tarea) se activan cuando exista; hasta entonces son ítems manuales del checklist.

---

## Task 14: datos maestros — sedes, personas, puestos y tareas

**Description:** Base común que hoy no existe y que necesitan inspecciones, accidentabilidad, seguridad vial, proveedores y capacitaciones: **Sede** (dónde), **Persona** (quién: nómina propia y de contratistas, que no necesariamente usa el sistema), **Puesto** y **Tarea** (qué hace; una tarea puede ser crítica: trabajo en altura, izaje, conducción, espacio confinado…).

**Defaults (confirmar en el SPEC):**
- Persona ≠ Usuario: vínculo opcional `userId` (un inspector es usuario; un operario puede no serlo).
- Cada persona tiene 1 puesto principal, 1 sede principal y N tareas asignadas. Empresa: propia o contratista (`supplierId` opcional cuando exista la Task 19).
- Datos personales mínimos: legajo, nombre y DNI opcional. Acá no van datos de salud.
- Si una persona tiene registros asociados, la baja es lógica (inactiva, con fecha); nunca se borra el historial.
- Los módulos que ya existen (Hallazgos, Riesgos, etc.) no se migran a Sede en esta fase; `Finding.location` sigue siendo texto.
- Modelo `JobTask` (no `Task`) para no chocar con el vocabulario del plan.

**Sub-tareas:**
- [x] 14.0 SPEC `SPEC-master-data.md` aprobado por el PO 2026-10-01 (rotación entre sedes · DNI visible · el CSV puede crear sedes/puestos con confirmación)
- [x] 14.1 (hecho 2026-10-01: migración `add_master_data`, `src/domain/masterdata/`, `src/lib/masterdata.ts`, permisos `manage_master_data` / `assign_job_tasks`, tests `masterdata*.test.ts`) Prisma + dominio: `Site` (nombre, tipo oficina/base/obrador/yacimiento/campamento/planta, dirección, activa), `JobPosition`, `JobTask` (flag `critical`), `Person` (legajo único por tenant, nombre, DNI?, empresa, sede, puesto, fecha de ingreso, estado), `PersonJobTask`; índices por `tenantId`; tests de aislamiento entre tenants y de unicidad
- [x] 14.2 (hecho 2026-10-01: `/t/[slug]/master-data/{sites,positions,tasks}`, menú "Datos maestros", `e2e/master-data.spec.ts`) UI de alta, baja y modificación de sedes, puestos y tareas (`/t/[slug]/master-data/**`); no se puede dar de baja si hay dependientes activos
- [x] 14.3 (hecho 2026-10-01: `/t/[slug]/master-data/people` lista con filtros · alta · ficha con edición/tareas/baja/historial · `people/import` con vista previa y confirmación de lo que se crea; e2e en `master-data.spec.ts`) Personas: alta, edición y baja; asignación de puesto, sede y tareas; **importación CSV de la nómina** con validación por fila, vista previa y reporte de errores; idempotente por legajo (reimportar actualiza, no duplica)
- [x] 14.4 (hecho 2026-10-01: `src/components/pickers/{SitePicker,PersonPicker,picker-actions}`, permisos en `authz.ts`, README) Componentes reutilizables `SitePicker` y `PersonPicker` (búsqueda por nombre o legajo, filtro por sede) + política de permisos (el admin gestiona; process_owner lee y asigna tareas; el resto solo lee; el DNI es visible para todos por decisión del PO)

**Acceptance criteria:**
- [x] Sedes, puestos, tareas y personas con alta, baja y modificación, acotadas al tenant
- [x] Importar 500 personas en una sola operación, sin duplicar al reimportar
- [x] Una persona dada de baja no aparece en los selectores, pero conserva su historial

**Verification:**
- [x] Unit: unicidad del legajo, validación del CSV, baja con dependientes
- [x] Integration: dos tenants no ven las personas ni las sedes del otro
- [x] Manual: importar una nómina de ejemplo y asignar tareas

**Dependencies:** base actual (Tasks 1–11)
**Files likely touched:** `prisma/schema.prisma`, `src/domain/masterdata/`, `src/lib/masterdata.ts`, `src/app/(tenant)/t/[slug]/master-data/**`, pickers en `src/components/`
**Estimated scope:** M

---

## Task 15: inspecciones — motor genérico + lista y registro por tipo

**Description:** Registro y listado de inspecciones de seguridad sobre **activos** (extintores, equipos y vehículos pesados, vehículos livianos, arneses y cabos de vida) y sobre **áreas o actividades** (zona de obradores, auditoría de seguridad en campo). Un solo motor para todos los tipos: plantillas de checklist versionadas por tipo; cada inspección guarda una copia fija de la versión que usó; el resultado se calcula; una NC genera una acción o un hallazgo; el activo no apto queda fuera de servicio; la próxima inspección genera un `DueItem`. Los equipos de medición y sus calibraciones van en la Task 16 (tienen su propio ciclo metrológico), pero reutilizan el registro de activos.

**Defaults (confirmar en el SPEC):**
- Cada tipo trae una plantilla precargada, editable por el tenant. Editarla crea una versión nueva y las inspecciones pasadas conservan la suya.
- Cada ítem tiene sección, texto, criticidad (`critical` | `major` | `minor`) y tipo de respuesta: conforme / no conforme / N/A, numérica o texto. Si es NC, la foto es obligatoria.
- Resultado:
  - algún ítem crítico NC → **No apto** (el activo queda *fuera de servicio* hasta una reinspección apta);
  - solo NC no críticas → **Apto con observaciones**;
  - todo conforme → **Apto**.
  - Puntaje % = conformes / aplicables.
- Una NC crítica crea un hallazgo borrador vinculado (patrón de 11b.4). Una NC no crítica genera una corrección simple con responsable y fecha (`DueItem`), que se puede escalar a hallazgo.
- Una inspección cerrada no se modifica: se corrige con motivo y queda registrada (patrón `MeasurementCorrection`).
- Pantallas adaptadas al celular para cargar en campo; **sin modo sin conexión** en esta fase.
- Frecuencias configurables por tenant y por tipo (defaults abajo).

**Sub-tareas — motor:**
- [ ] 15.0 Research + SPEC `RESEARCH-inspections.md` / `SPEC-inspections.md` (normativa de referencia por tipo, frecuencias, ítems, reglas de resultado) aprobado por el PO
- [ ] 15.1 Dominio + Prisma:
  - `Asset`: tipo, código interno, sede, estado `in_service` / `out_of_service` / `retired`, atributos propios del tipo en JSON validado con zod, persona asignada.
  - `AssetDueDate`: vencimientos documentales por activo (carga, PH, VTV, seguro, certificación…).
  - `InspectionTemplate` + `InspectionTemplateVersion` + ítems.
  - `Inspection`: tipo, versión, activo **o** sede/área, inspector (usuario), fecha, estado `draft` / `closed`, resultado y puntaje. Más `InspectionAnswer`, `InspectionAttachment` e `InspectionCorrection`.
  - Funciones puras `deriveInspectionResult`, `nextInspectionDue` y `assetStatusAfter`, con tests.
- [ ] 15.2 Registro de activos (común a todos los tipos): alta, edición y baja; importación CSV por tipo; ficha con el historial de inspecciones y los vencimientos; filtros por sede, tipo y estado
- [ ] 15.3 Registro de inspección: elegir tipo → activo o área → checklist por secciones (botones grandes para tocar) → fotos a storage → lecturas numéricas (km, horómetro, presión) → guardar borrador → cerrar con la firma del inspector
- [ ] 15.4 Lista de inspecciones: filtros por tipo, sede, activo, inspector, resultado y fechas; contadores rápidos (vencidas, no aptas, fuera de servicio); exportación CSV
- [ ] 15.5 Consecuencias:
  - NC → corrección o hallazgo (`Finding` con origen inspección y vínculo en ambos sentidos).
  - Activo fuera de servicio; solo vuelve a servicio con una reinspección apta.
  - `DueItem` para la próxima inspección y para cada `AssetDueDate`, con notificaciones agrupadas por sede para no saturar.
- [ ] 15.6 Editor de plantillas por tenant (versionado) + guía `/inspections/guia` + menú

**Sub-tareas — tipos** (cada uno define atributos del activo, plantilla precargada, frecuencia, vencimientos y regla de no apto; lista y registro verificados en el navegador):
- [ ] 15.7 **Extintores**
  - Activo: n.° interno, agente (ABC, CO₂, espuma AFFF, HCFC/halotrón, agua, clase K), capacidad en kg, ubicación o sector, n.° de cilindro, empresa recargadora.
  - Vencimientos: **carga (anual)** y **prueba hidráulica (cada 5 años)**.
  - Control **mensual** (IRAM 3517-2): acceso libre y señalización, presión en zona verde o peso del CO₂, precinto y pasador, manguera y boquilla, cilindro sin golpes ni corrosión, tarjeta de control legible, altura de montaje, carga y PH vigentes.
  - No apto: presión, precinto, cilindro dañado, carga o PH vencidos → retiro y reemplazo.
- [ ] 15.8 **Zona de obradores**
  - Inspección de área (sede de tipo obrador o un sector), **semanal**.
  - Orden y limpieza; delimitación y señalización.
  - Instalación eléctrica: tablero con tapa y disyuntor, puesta a tierra, sin empalmes precarios.
  - Extintores presentes y vigentes (se cruza con el registro de 15.7).
  - Sustancias peligrosas: hojas de seguridad (FDS), rotulado, contención secundaria.
  - Residuos (14001): separación por tipo, recipientes identificados. Kit antiderrame.
  - Sanitarios y agua potable, botiquín, plan de emergencia y punto de encuentro, iluminación, cerco y accesos.
- [ ] 15.9 **Equipos / vehículos pesados** (grúa, hidrogrúa, retroexcavadora, pala, camión, autoelevador)
  - Activo: dominio o n.° interno, tipo, marca/modelo/año, propio o de contratista, horómetro u odómetro.
  - Vencimientos: seguro, VTV/RTO si circula, **certificación de izaje**, service.
  - **Control previo al uso, diario** (lo hace el operador) + **inspección mensual** (la hace SST).
  - Ítems: pérdidas y niveles, frenos, dirección, luces y balizas, alarma de retroceso, bocina, cinturón, estructura antivuelco y contra caída de objetos (ROPS/FOPS), espejos, neumáticos u orugas, extintor, calzas.
  - Elementos de izaje: eslingas, grilletes, ganchos con traba, limitador de carga. Documentación a bordo.
  - **Operador habilitado** (se cruza con la Task 20 cuando exista).
- [ ] 15.10 **Vehículos livianos**
  - Activo: dominio, marca/modelo/año, propio, alquilado o de contratista, conductor asignado, km.
  - Vencimientos: VTV/RTO, seguro, service, monitoreo satelital.
  - **Control previo al uso** + **inspección mensual**.
  - Ítems: luces, frenos, neumáticos (profundidad mínima legal) y auxilio con gato y llave, cinturones y apoyacabezas, espejos, parabrisas y limpiaparabrisas, bocina.
  - Kit: matafuego vigente, balizas, botiquín, chaleco. Barra o jaula antivuelco si corresponde.
  - Documentación del vehículo y licencia del conductor.
  - **Lectura del odómetro**, que alimenta los km de la Task 18.
- [ ] 15.11 **Auditoría de seguridad en campo**
  - Sobre un frente de trabajo: sede + tarea + contratista (opcional) + supervisor. Programa con meta de auditorías por sede y por mes.
  - Documentación de la tarea: permiso de trabajo y análisis de trabajo seguro (ATS/AST) firmados y difundidos, charla previa.
  - Personas: EPP adecuado y en uso, personal habilitado para la tarea (se cruza con la Task 20).
  - Condiciones: herramientas inspeccionadas, orden y señalización, bloqueo y etiquetado de energías.
  - Tareas especiales:
    - trabajo en altura: arnés inspeccionado y punto de anclaje;
    - espacio confinado: medición de gases con un equipo calibrado (se cruza con la Task 16);
    - izaje: plan de izaje y rigger.
  - Ambiente (derrames, residuos); actos inseguros y observaciones positivas.
  - Salida: puntaje % y cumplimiento del programa por sede.
- [ ] 15.12 **Arneses y cabos de vida**
  - Activo: tipo (arnés de cuerpo completo, cabo simple o doble con absorbedor, cabo de posicionamiento, retráctil, mosquetón), marca/modelo, serie, norma, **fecha de fabricación**, **vida útil** (la del fabricante; default configurable), persona asignada.
  - Inspección periódica registrada: default **cada 6 meses**, configurable.
  - Ítems: etiqueta legible; cintas sin cortes, quemaduras ni daño químico; costuras; indicador de caída o absorbedor sin activar; hebillas y argollas D; ganchos con traba; sin nudos.
  - No apto → **baja definitiva** (no vuelve a servicio), con evidencia de la destrucción.
  - Absorbedor activado o vida útil vencida → baja automática.
  - `DueItem` para la próxima inspección y para el fin de la vida útil.

**Acceptance criteria:**
- [ ] Los 6 tipos tienen lista y registro funcionando con su plantilla precargada
- [ ] El resultado y el estado del activo salen de reglas puras; no se editan a mano
- [ ] Una NC crítica crea un hallazgo borrador vinculado; un activo no apto queda fuera de servicio
- [ ] La próxima inspección y los vencimientos del activo generan `DueItem` sin duplicar
- [ ] Editar una plantilla no altera las inspecciones pasadas

**Verification:**
- [ ] Unit: `deriveInspectionResult`, `nextInspectionDue`, reglas de baja de arneses, vencimientos de extintores
- [ ] Integration: cerrar una inspección no apta → activo fuera de servicio + Finding + DueItem; aislamiento entre tenants
- [ ] e2e: registrar una inspección de extintor no apta y verla en la lista y en la ficha del activo
- [ ] Manual: carga en ancho de celular (375 px)

**Dependencies:** Task 14; Task 10c (hallazgos); Task 9 (DueItem, storage)
**Files likely touched:** `src/domain/inspections/`, `src/domain/assets/`, `src/lib/inspections.ts`, seed de plantillas, `src/app/(tenant)/t/[slug]/inspections/**`, `src/app/(tenant)/t/[slug]/assets/**`
**Estimated scope:** XL. Se construye por partes: primero el motor (15.0–15.6) junto con extintores (15.7), después un tipo por vez.

---

## Task 16: equipos de medición y calibraciones (ISO 9001 §7.1.5)

**Description:** Control de los equipos de seguimiento y medición (9001 §7.1.5.2; 14001 y 45001 §9.1.1 piden lo mismo para los equipos que miden desempeño):
- registro de equipos;
- **calibración** externa, con trazabilidad;
- **verificación** interna o funcional, a intervalos definidos;
- estado visible y protección contra el uso de un equipo vencido;
- **evaluación de impacto** cuando un equipo aparece fuera de tolerancia.

Aplica a detectores de gases y explosímetros, manómetros, balanzas, termómetros, sonómetros, luxómetros, telurímetros, etc.

**Conceptos para el SPEC:**
- **Calibración:** comparación contra un patrón trazable, hecha por un laboratorio (idealmente acreditado ISO/IEC 17025). Produce un certificado con el error y la incertidumbre (U) de cada punto.
- **Verificación:** confirma que el equipo cumple el criterio de uso; puede hacerse internamente contra un patrón propio.
- **Prueba funcional antes del uso** (bump test, en detectores de gas): chequeo rápido; su registro es opcional.
- **Criterio de aceptación:** lo define el uso, como error máximo permitido (EMP). Regla por defecto: el equipo es apto si |error| + U ≤ EMP en todos los puntos; si no, es no apto. Si el laboratorio solo informa "conforme", se toma ese resultado.
- **Fuera de tolerancia:** obliga a evaluar si siguen siendo válidas las mediciones hechas desde la última calibración apta, y a registrar la acción (un hallazgo si corresponde).

**Sub-tareas:**
- [ ] 16.0 Research + SPEC `SPEC-calibration.md` (magnitudes, intervalos, regla de decisión, estados, etiqueta de estado) aprobado por el PO
- [ ] 16.1 Dominio + Prisma:
  - `Asset` de tipo `measuring_equipment`, con atributos: magnitud, rango, resolución, EMP, uso crítico, si requiere calibración y/o verificación, e intervalos.
  - `CalibrationRecord`: tipo (calibración o verificación), fecha, laboratorio, n.° de certificado, acreditación; puntos con valor nominal, medido, error y U; resultado; certificado en PDF.
  - `ImpactAssessment`.
  - Funciones `calibrationDecision`, `calibrationStatus` (vigente / por vencer / vencida / no apto / en calibración) y `nextCalibrationDue`, con tests.
- [ ] 16.2 Registro y lista de equipos: filtros por sede, magnitud y estado; semáforo; ficha con el historial de calibraciones y los certificados para descargar
- [ ] 16.3 Carga de calibración o verificación: formulario por puntos con cálculo automático de la conformidad; certificado adjunto; envío a calibrar (estado "en calibración", con fecha estimada de regreso)
- [ ] 16.4 Vencidos y fuera de tolerancia:
  - `DueItem` para la próxima calibración o verificación.
  - Un equipo vencido o no apto muestra un estado bloqueante, también en las inspecciones y auditorías de campo que lo usan.
  - Un equipo no apto exige, antes de volver a servicio, una evaluación de impacto: mediciones afectadas desde la última calibración apta, decisión tomada y hallazgo opcional.
- [ ] 16.5 Control previo al uso (bump test) opcional, con una plantilla del motor de la Task 15. Tablero: equipos por estado, vencimientos de los próximos 30 días, cumplimiento del plan de calibración. e2e.

**Acceptance criteria:**
- [ ] Un equipo con la calibración vencida o no apta aparece como "no usar" en la ficha, la lista y los selectores
- [ ] El resultado de una calibración cargada por puntos se calcula; no se tipea
- [ ] Un equipo no apto no vuelve a servicio sin una evaluación de impacto registrada
- [ ] Los certificados quedan guardados en storage y se pueden descargar

**Verification:**
- [ ] Unit: regla de decisión (incluido el caso límite |e| + U = EMP), estados y próxima fecha
- [ ] Integration: calibración no apta → impacto pendiente → hallazgo → vuelta a servicio
- [ ] Manual: cargar el certificado de un detector de gases con 3 puntos

**Dependencies:** Task 15.1–15.2 (registro de activos)
**Files likely touched:** `src/domain/calibration/`, `src/lib/calibration.ts`, `src/app/(tenant)/t/[slug]/instruments/**`
**Estimated scope:** L

---

## Task 17: estadísticas de accidentabilidad (ISO 45001 §9.1, §10.2)

**Description:** Registro estructurado de los accidentes e incidentes laborales y cálculo automático de los índices por período y por sede. Los índices salen de los eventos y de la exposición (horas-hombre trabajadas y dotación); nunca se cargan a mano. Cada evento sigue siendo un **Hallazgo de tipo incidente**, así conserva los 5 Porqués, las medidas y la verificación de eficacia de las Tasks 10b–10d, con una **ficha de accidente** asociada (1:1).

**Defaults (confirmar en el SPEC):**
- Clasificación: casi accidente (sin lesión) · primeros auxilios · accidente sin baja · accidente con baja · fatal · enfermedad profesional. Además: ocurrido durante el trabajo o **in itinere**.
- Índices (criterio de la SRT, Argentina; HHT = horas-hombre trabajadas):
  - IF (frecuencia) = accidentes con baja × 1.000.000 / HHT
  - IG (gravedad) = días perdidos × 1.000 / HHT. Un accidente fatal suma un cargo fijo de días, configurable (por ejemplo 6.000).
  - II (incidencia) = accidentes con baja × 1.000 / dotación promedio
  - ID (duración media) = días perdidos / accidentes con baja
  - Opcionales: LTIF (IOGP) y TRIR (OSHA, × 200.000)
- Los accidentes in itinere se informan aparte y **no** entran en IF, IG ni II. Un accidente vial durante la jornada cuenta como laboral **y además** aparece en la Task 18.
- Personal propio y de contratistas por separado, con una vista del total.
- La ficha tiene datos de salud, que son **datos sensibles**: solo el tenant_admin y los process_owner con permiso de SST ven la persona y la lesión; el resto ve solo totales, sin nombres.

**Sub-tareas:**
- [ ] 17.0 Research + SPEC `RESEARCH-accident-stats.md` / `SPEC-accident-stats.md` (definiciones, índices, clasificación por forma del accidente, agente, naturaleza de la lesión y parte del cuerpo; privacidad) aprobado por el PO
- [ ] 17.1 Dominio + Prisma:
  - `IncidentRecord` 1:1 con `Finding`: clasificación, fecha y hora, sede, persona afectada, propio o contratista, in itinere, vial, forma del accidente, agente material, naturaleza de la lesión, parte del cuerpo, días perdidos, fecha del alta, n.° de denuncia a la ART.
  - `ExposurePeriod`: sede × mes × propio/contratista, con HHT y dotación promedio.
  - Funciones puras de índices y totales, con tests sobre un conjunto de datos de referencia cuyos valores se calculan a mano.
- [ ] 17.2 Registro: el alta de un hallazgo de tipo incidente suma un paso "ficha de accidente"; los días perdidos se actualizan hasta el alta médica (con historial); permisos de datos sensibles
- [ ] 17.3 Carga mensual de la exposición por sede (formulario + importación CSV), con un `DueItem` mensual de carga. Si falta la HHT de un período, el índice se muestra "sin datos", nunca 0.
- [ ] 17.4 Tablero `/safety/stats`:
  - períodos: mes, acumulado del año y últimos 12 meses móviles; por sede y por propio/contratista;
  - IF, IG, II e ID con su tendencia;
  - pirámide de eventos (de casi accidentes a fatales);
  - distribución por forma del accidente, agente, parte del cuerpo, día y hora;
  - días sin accidentes con baja, por sede;
  - comparación opcional contra una meta, vinculando un Indicador de la Task 11c.
- [ ] 17.5 Exportación (CSV + resumen imprimible para la revisión por la dirección), guía, menú, e2e, README

**Acceptance criteria:**
- [ ] Los índices coinciden con el cálculo manual del conjunto de datos de referencia
- [ ] Los accidentes in itinere quedan fuera de los índices laborales y se ven por separado
- [ ] Un período sin HHT no muestra índices
- [ ] El viewer no ve datos personales ni de salud

**Verification:**
- [ ] Unit: cada índice y los casos borde: HHT 0, fatal, accidente que abarca varios meses (default: los días perdidos se imputan al mes del accidente; confirmar en el SPEC)
- [ ] Integration: publicar un incidente con ficha → aparece en el tablero de su sede y mes; aislamiento entre tenants; permisos
- [ ] e2e: registrar un accidente con baja, cargar la HHT, ver el IF del mes

**Dependencies:** Task 14 (sedes, personas); Tasks 10b–10d (hallazgos de tipo incidente)
**Files likely touched:** `src/domain/safety-stats/`, `src/lib/safety-stats.ts`, `src/app/(tenant)/t/[slug]/safety/**`, alta de hallazgo
**Estimated scope:** L

---

## Task 18: seguridad vial — estadística propia y separada

**Description:** Módulo y tablero **propios** de seguridad vial (referencias: ISO 39001 e indicadores del estilo IOGP), separados de la accidentabilidad general. Cubre todos los eventos viales: con o sin lesión, en misión o in itinere, y los que solo dejan daño material. Los índices se calculan sobre los **km recorridos** por la flota. Reutiliza la ficha de accidente (marcada como vial) y el registro de vehículos de la Task 15.

**Sub-tareas:**
- [ ] 18.0 SPEC `SPEC-road-safety.md` aprobado por el PO (tipos de evento, índices, de dónde salen los km, qué cuenta también en la estadística general)
- [ ] 18.1 Dominio + Prisma:
  - `RoadEventDetail` 1:1 con un `IncidentRecord` vial: vehículo, conductor, en misión o in itinere, tipo de evento (choque con otro vehículo o con un objeto fijo, vuelco, despiste, atropello, incidente sin daño), camino (asfalto, ripio, tierra), luz y clima, uso del cinturón, velocidad estimada, daños materiales, lesionados, causa principal.
  - `VehicleKmPeriod`: vehículo × mes, con los km y su origen (`manual` u `odometer`).
  - `SpeedingPeriod`, opcional: excesos de velocidad por vehículo o conductor, cargados a mano. La integración con el monitoreo satelital (vía n8n) queda fuera de alcance.
  - Funciones:
    - eventos viales por millón de km;
    - eventos con lesionados por millón de km;
    - vuelcos por millón de km;
    - eventos por conductor;
    - % de la flota con la inspección al día.
- [ ] 18.2 Registro:
  - evento vial desde el alta de un incidente (un paso más), incluidos los que solo tienen daño material;
  - carga mensual de km por vehículo, precargada con las lecturas de odómetro de 15.9 / 15.10;
  - `DueItem` mensual de carga de km.
- [ ] 18.3 Tablero `/road-safety`, separado del general:
  - índices del mes, acumulado y últimos 12 meses;
  - desgloses por sede, tipo de vehículo, tipo de evento, y en misión frente a in itinere;
  - conductores con eventos repetidos y excesos de velocidad;
  - flota con documentación o inspección vencida;
  - exportación.
- [ ] 18.4 Conductor habilitado (licencia vigente + curso de manejo defensivo vigente, cruzado con la Task 20) en la ficha del vehículo y en el evento; guía, menú, e2e

**Acceptance criteria:**
- [ ] El tablero vial está separado del general y tiene su propia entrada en el menú
- [ ] Los km del mes se calculan con los odómetros cuando hay lecturas; se pueden editar con motivo
- [ ] Un evento con solo daño material cuenta en la estadística vial y no en los índices laborales

**Verification:**
- [ ] Unit: índices viales y km a partir de odómetros (si las lecturas no son crecientes → error)
- [ ] Integration: un evento vial con lesión durante la jornada aparece en ambos tableros; uno in itinere, solo en el vial
- [ ] e2e: registrar un choque, cargar km, ver el índice

**Dependencies:** Task 17 (ficha de accidente); Task 15.9 / 15.10 (vehículos, odómetro); Task 20 opcional (conductor habilitado)
**Files likely touched:** `src/domain/road-safety/`, `src/lib/road-safety.ts`, `src/app/(tenant)/t/[slug]/road-safety/**`
**Estimated scope:** L

---

## Task 19: evaluación de proveedores (ISO 9001 §8.4)

**Description:** Control de los procesos, productos y servicios que provee un tercero. Incluye:
- registro de proveedores y **criterios** de evaluación;
- selección, **seguimiento del desempeño** y **reevaluación** (9001 §8.4.1), guardando los resultados y las acciones;
- comunicación del resultado al proveedor (§8.4.3).

Abarca a los contratistas (45001 §8.1.4.2) y a los proveedores con impacto ambiental (14001 §8.1).

**Defaults (confirmar en el SPEC):**
- Criticidad: **crítico** si afecta la conformidad del producto o servicio, o la seguridad o el ambiente; si no, **no crítico**.
- Criterios configurables por categoría, cada uno con su peso. Ejemplos: calidad del producto o servicio, cumplimiento de plazos, respuesta a reclamos, documentación, y desempeño en SST y ambiente (para contratistas). Cada criterio se califica de 1 a 5 y el puntaje ponderado va de 0 a 100.
- Resultado:
  - ≥ 80: **aprobado**;
  - 60–79: **aprobado condicional** (requiere un plan de mejora);
  - < 60: **no aprobado** (suspendido).
  - Los umbrales son configurables.
- Reevaluación: los críticos cada **6 meses**, los no críticos cada **12 meses**.
- Los criterios tienen versiones; cada evaluación guarda una copia fija de los que usó.

**Sub-tareas:**
- [ ] 19.0 Research + SPEC `SPEC-suppliers.md` aprobado por el PO
- [ ] 19.1 Dominio + Prisma:
  - `Supplier`: razón social, CUIT único por tenant, categoría o rubro, tipo (producto, servicio o contratista), criticidad, sedes a las que atiende, contacto, estado (`potential` / `approved` / `conditional` / `not_approved` / `inactive`).
  - `SupplierCriteriaTemplate` con versiones.
  - `SupplierEvaluation`: inicial o periódica, período, puntaje de cada criterio, total, resultado, evaluador, comentarios.
  - `SupplierDocument` con vencimiento (ART, seguros, habilitaciones).
  - Funciones `scoreEvaluation`, `resultFromScore` y `nextEvaluationDue`, y transiciones de estado, con tests.
- [ ] 19.2 Registro y lista de proveedores con filtros (estado, criticidad, categoría, sede); ficha con el historial de evaluaciones, documentos y hallazgos; **lista de proveedores aprobados** exportable
- [ ] 19.3 Evaluación inicial (selección) y aprobación. Los documentos requeridos según el tipo tienen vencimiento y generan un `DueItem`. Un contratista con la ART o el seguro vencidos aparece como no habilitado.
- [ ] 19.4 Reevaluación periódica:
  - `DueItem` según la criticidad;
  - el formulario trae precargados como evidencia los **hallazgos del período originados en el proveedor**;
  - resultado condicional → plan de mejora con la `Action` compartida (Task 11);
  - no aprobado → suspendido.
- [ ] 19.5 Hallazgo de proveedor (`Finding` con `supplierId`); registro de la comunicación del resultado al proveedor (§8.4.3); tablero (por estado, evaluaciones vencidas, ranking, evolución del puntaje); guía, menú, e2e

**Acceptance criteria:**
- [ ] El puntaje y el resultado se calculan; no se tipean
- [ ] Una reevaluación vencida se ve y se notifica
- [ ] Cambiar los criterios no modifica las evaluaciones pasadas
- [ ] La lista de aprobados se puede exportar

**Verification:**
- [ ] Unit: puntaje ponderado, umbrales, próxima fecha según criticidad
- [ ] Integration: evaluación condicional → Action + DueItem; aislamiento entre tenants
- [ ] e2e: alta de un proveedor crítico → evaluación → aprobado → aparece en la lista de aprobados

**Dependencies:** Task 14 (sedes); Task 10b (hallazgos); Task 11 (Action)
**Files likely touched:** `src/domain/suppliers/`, `src/lib/suppliers.ts`, `src/app/(tenant)/t/[slug]/suppliers/**`
**Estimated scope:** L

---

## Task 20: capacitaciones — matriz por puesto y tarea, seguimiento por persona y sede

**Description:** Competencia y toma de conciencia (9001/14001/45001 §7.2–7.3). El módulo responde:
- qué capacitación necesita cada persona según su **puesto** y sus **tareas**;
- qué hizo y qué tiene vigente o vencido;
- si lo realizado fue **eficaz** (§7.2 c).

El estado se calcula a partir de la matriz y de los registros; nunca se marca a mano.

**Defaults (confirmar en el SPEC):**
- Las capacitaciones que requiere una persona son las de su puesto más las de sus tareas.
- Cada curso tiene una vigencia en meses (o no vence). Cada requisito tiene un plazo de gracia desde el ingreso o la asignación (default 30 días).
- Estados de cada persona en cada curso:
  - **vigente**;
  - **por vencer** (faltan 30 días o menos);
  - **vencida**;
  - **faltante**;
  - **en plazo** (todavía dentro del plazo de gracia);
  - no requerida.
- La eficacia se evalúa solo en los cursos marcados para eso: la hace el supervisor, más tarde (default a los 90 días).
- Si falta o venció un curso obligatorio de una tarea crítica, la persona queda **no habilitada** para esa tarea. Lo usan 15.9, 15.11 y 18.4.

**Sub-tareas:**
- [ ] 20.0 Research + SPEC `SPEC-training.md` aprobado por el PO
- [ ] 20.1 Dominio + Prisma:
  - `Course`: nombre, tema, normas, modalidad, duración en horas, vigencia en meses, si requiere evaluar eficacia, instructor o proveedor.
  - `TrainingRequirement`: puesto **o** tarea × curso, obligatorio o no, días de gracia.
  - `TrainingSession`: curso, fecha, instructor interno o externo, sede, evidencia.
  - `TrainingRecord`: persona × curso, con fecha, resultado (aprobado / no aprobado), nota, vencimiento calculado, evidencia y sesión (opcional).
  - `TrainingEffectiveness`.
  - Funciones puras `computeTrainingStatus(persona, requisitos, registros, hoy)` e `isQualifiedForTask`, con tests.
- [ ] 20.2 Catálogo de cursos + **editor de la matriz**: grillas de puestos × cursos y de tareas × cursos, donde se marca si es obligatorio o recomendado y el plazo
- [ ] 20.3 Registro:
  - sesión con asistentes (selección múltiple por sede o puesto) y resultado de cada asistente;
  - planilla de asistencia o certificado subidos a storage;
  - carga individual de un certificado externo;
  - correcciones con motivo.
- [ ] 20.4 Seguimiento:
  - **matriz de cumplimiento** de personas × cursos con semáforo (filtros por sede, puesto, tarea y estado);
  - **ficha por persona**: cursos requeridos, estado, historial, próximos vencimientos, tareas para las que está habilitada;
  - **tablero por sede**: % de cumplimiento, vencidas, por vencer a 30/60/90 días, faltantes por curso;
  - exportación CSV.
- [ ] 20.5 Vencimientos y eficacia:
  - `DueItem` de vencimiento agrupado (un resumen por sede y por persona, no un aviso por cada celda de la matriz);
  - `DueItem` para la evaluación de eficacia; si no fue eficaz → acción o nueva fecha;
  - plan anual opcional (planificado frente a realizado, por sede).
- [ ] 20.6 Uso de las habilitaciones (`isQualifiedForTask`) en las inspecciones de equipos pesados, la auditoría de campo y el conductor vial; guía, menú, e2e, README

**Acceptance criteria:**
- [ ] Al cambiar el puesto o las tareas de una persona se recalculan sus cursos requeridos, sin tocar su historial
- [ ] La matriz filtrada por sede muestra el % de cumplimiento correcto
- [ ] Una persona con un curso crítico vencido figura como no habilitada para la tarea
- [ ] Los vencimientos se notifican sin duplicar ni saturar

**Verification:**
- [ ] Unit: `computeTrainingStatus` (gracia, vigencia, por vencer, reprobado, cambio de puesto) e `isQualifiedForTask`
- [ ] Integration: una sesión con 10 asistentes → registros + vencimientos; aislamiento entre tenants
- [ ] e2e: definir la matriz, registrar una sesión, ver el semáforo por persona y por sede

**Dependencies:** Task 14 (personas, puestos, tareas, sedes)
**Files likely touched:** `src/domain/training/`, `src/lib/training.ts`, `src/app/(tenant)/t/[slug]/training/**`
**Estimated scope:** L

---

## Checkpoint E: después de las Tasks 14–20

- [ ] Los tests pasan, el build compila y el e2e de cada módulo está verde
- [ ] Flujo completo: importar la nómina → matriz de capacitación → inspección no apta → hallazgo → accidente con índices → evento vial → reevaluación de un proveedor
- [ ] El tablero de accidentabilidad y el vial están separados y sus números son coherentes entre sí
- [ ] Revisión de privacidad (datos de salud, DNI) y de permisos por rol
- [ ] Revisión humana antes de seguir

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
