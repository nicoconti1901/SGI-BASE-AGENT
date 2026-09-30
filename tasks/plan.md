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

### Phase 5 — Operación SST, proveedores y competencia (addendum 2026-09-30)
Datos maestros (sedes, personas, puestos, tareas) → inspecciones → calibraciones → accidentabilidad → seguridad vial; evaluación de proveedores y capacitaciones en paralelo. Ver *Addendum: Fase 5*.

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

Fase 5 (numeración de `tasks/todo.md`): 14 datos maestros · 15 inspecciones · 16 equipos de medición y calibraciones · 17 accidentabilidad · 18 seguridad vial · 19 evaluación de proveedores · 20 capacitaciones · Checkpoint E.

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

---

## Addendum: Fase 5 — Operación SST, proveedores y competencia — 2026-09-30

Pedido del PO: inspecciones (lista y registro) de extintores, zona de obradores, equipos de medición (con calibraciones), equipos y vehículos pesados, vehículos livianos, auditoría de seguridad en campo, y arneses y cabos de vida; estadísticas de accidentabilidad, con una estadística de seguridad vial propia y separada; evaluación de proveedores (ISO 9001 §8.4); seguimiento de capacitaciones con matriz por puesto y tarea, y seguimiento por persona y por sede.

Hoy faltan en el modelo las nociones de **sede**, **persona** (distinta del usuario), **puesto**, **tarea**, **activo** y **proveedor**. Por eso la fase arranca con los datos maestros. El detalle de cada tarea está en `tasks/todo.md` (Tasks 14–20).

### Decisiones de arquitectura

| Decisión | Elección | Motivo |
|---|---|---|
| Datos maestros | `Site`, `Person`, `JobPosition` y `JobTask`, propios de cada tenant. Persona ≠ Usuario (vínculo opcional) | Inspecciones, accidentes y capacitaciones necesitan saber quién y dónde sin exigir que esa persona tenga login |
| Inspecciones | Un solo motor: plantilla con versiones + inspección que guarda la versión que usó + reglas puras para el resultado. Los tipos son datos precargados, no código aparte | Hoy son 6 tipos y mañana pueden ser más sin armar un módulo nuevo |
| Activos | Un `Asset` común con los atributos propios de cada tipo (JSON validado con zod en el dominio) + `AssetDueDate` para los vencimientos documentales | Evita 6 tablas casi iguales; la validación queda en el dominio |
| Calibración | Ciclo propio sobre los activos de medición; no es una inspección | §7.1.5 exige trazabilidad, una regla de decisión y evaluar el impacto cuando el equipo está fuera de tolerancia |
| Accidentes | `IncidentRecord` 1:1 con un `Finding` de tipo incidente | Reutiliza los 5 Porqués, las medidas y la verificación de eficacia (10b–10d) |
| Índices | Se calculan al consultar, a partir de los eventos y de la exposición (HHT, dotación, km). Nunca se cargan a mano; si falta la exposición, se muestra "sin datos" | Una sola fuente de verdad, auditable |
| Seguridad vial | Módulo y tablero separados; `RoadEventDetail` + km por vehículo y por mes (desde el odómetro de las inspecciones o a mano) | Pedido del PO: estadística propia |
| Proveedores | Criterios ponderados y con versiones; el resultado y la próxima evaluación se calculan | §8.4.1: criterios de evaluación, seguimiento y reevaluación |
| Capacitaciones | El estado sale de la matriz (puesto + tareas) y de los registros. `isQualifiedForTask` es una función pura que reutilizan inspecciones y seguridad vial | Seguimiento por persona y sede sin marcar nada a mano |
| Vencimientos | Todo vencimiento nuevo usa el `DueItem` existente, con avisos agrupados por sede o persona. Sin n8n nuevo | Evita armar otro programador de tareas y el exceso de avisos |
| Datos sensibles | Salud (accidentes) y DNI, visibles solo con permiso de SST; el resto ve totales sin nombres | Datos sensibles según la Ley 25.326 |

### Grafo de dependencias

```
Task 14 datos maestros (sedes, personas, puestos, tareas)
   │
   ├── Task 15 inspecciones (motor + activos + 6 tipos)
   │      │
   │      ├── Task 16 equipos de medición + calibraciones
   │      │
   │      └── (vehículos + odómetro) ──┐
   │                                   │
   ├── Task 17 accidentabilidad (Finding incidente + HHT)
   │      │                            │
   │      └── Task 18 seguridad vial ◄─┘
   │
   ├── Task 19 evaluación de proveedores (+ Action de la Task 11)
   │
   └── Task 20 capacitaciones (matriz por puesto y tarea)
             ┊
             └┈┈ habilitaciones → 15.9, 15.11, 18.4 (cruce opcional)
```

### Paralelismo

- Después de la 14, las Tasks 15, 19 y 20 no dependen entre sí.
- Dentro de la 15, primero va el motor con extintores; cada tipo siguiente es un paso independiente.
- La 16 necesita solo 15.1–15.2 (el registro de activos).
- La 18 espera a la 17 y a 15.9 / 15.10.

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Inspecciones que terminan como 6 módulos distintos | Un solo motor; un tipo nuevo = una plantilla + el esquema de sus atributos |
| Volumen de `DueItem` (3 vencimientos por extintor; personas × cursos) | Avisos agrupados por sede o persona; índice `[tenantId, status, dueAt]` existente; probar con datos de ejemplo de 1.000 activos y 500 personas |
| Índices incorrectos o no comparables | Conjunto de datos de referencia calculado a mano en los tests; definiciones en el SPEC; "sin datos" cuando falta la exposición |
| Datos de salud expuestos | Permiso de SST explícito; tests de autorización por rol; totales sin nombres |
| Cambios de normativa local (IRAM, SRT) | Frecuencias, umbrales y cargos configurables; nada fijo en el código |
| Carga en campo sin señal | Pantallas para celular + borrador guardable; el modo sin conexión queda para otra fase |
| El alcance crece (GPS, ART online, e-learning, permisos de trabajo, entrega de EPP) | Fuera de alcance en esta fase; se evalúa después (n8n si es una integración) |

### Preguntas abiertas (defaults aplicados hasta que el PO decida)

| # | Tema | Default |
|---|---|---|
| 6 | Persona y usuario | La persona no necesita login; vínculo opcional con un usuario |
| 7 | Plantillas de inspección | Precargadas, editables por tenant y con versiones |
| 8 | NC en una inspección | Crítica → hallazgo borrador; no crítica → corrección simple, que se puede escalar |
| 9 | Frecuencias | Extintor: control mensual, carga anual, PH cada 5 años. Obrador: semanal. Pesados y livianos: antes del uso + mensual. Arneses: cada 6 meses. Calibración: cada 12 meses. Todas configurables |
| 10 | Índices de accidentabilidad | IF, IG, II e ID (SRT); LTIF y TRIR opcionales; un fatal suma un cargo de 6.000 días al IG |
| 11 | In itinere y accidentes viales en la jornada | In itinere: solo en la estadística vial, fuera de los índices laborales. Vial con lesión durante la jornada: cuenta en ambas |
| 12 | Contratistas en las estadísticas | Incluidos, con filtro propio / contratista / total |
| 13 | Proveedores | Criterios de 1 a 5, ponderados; aprobado ≥ 80, condicional 60–79, no aprobado < 60; reevaluación cada 6 meses (críticos) o 12 (no críticos) |
| 14 | Capacitaciones | Por vencer: 30 días o menos; plazo de gracia de 30 días; eficacia a los 90 días, solo si el curso lo pide |
| 15 | Carga sin conexión | No en esta fase |

### Fuera de alcance (Fase 5)

- Integración con monitoreo satelital o GPS.
- Denuncias en línea a la ART / SRT.
- Plataforma de e-learning.
- Permisos de trabajo como módulo propio.
- Entrega de EPP.
- Carga sin conexión.
- Etiquetas con código QR (opcional dentro de la 16 si el PO lo pide).
