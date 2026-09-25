# Spec: SGI Base — Plataforma de Sistema de Gestión Integrada (ISO 9001 / 14001 / 45001)

## Objective

Construir una plataforma web multi-tenant para que empresas operen un **Sistema de Gestión Integrada** alineado a **ISO 9001, ISO 14001 e ISO 45001**.

### Quiénes usan el producto

| Actor | Rol |
|---|---|
| **Superusuario (desarrollador)** | Analiza el SGI del cliente fuera de línea, carga el gap y la documentación existente, provisiona el tenant y entrega la URL ya adecuada. Acceso a panel de plataforma (todos los tenants). |
| **Usuarios del cliente** | Varios usuarios por empresa; visualizan y gestionan el SGI según roles (admin del tenant, responsables de proceso, lectores, etc.). |

### Qué resuelve (MVP = P0 + P1 + P2)

1. **Empresas con SGI existente:** respetar registros/procedimientos que cumplan requisitos; donde no cumplan, el sistema aporta la solución (docs, flujos, automatizaciones).
2. **Empresas sin SGI:** crear base inicial esencial según **tamaño** y **actividad**, escalable hasta cubrir el catálogo completo de requisitos.
3. **Automatización (nativa + integraciones):** todo lo que implique **seguimientos, indicadores y cualquier ítem con vencimiento**; el detalle de cada automatización se especifica en fases posteriores y el sistema solo ejecuta lo especificado ahí.
4. **Entrega:** el cliente recibe una URL lista; no hace el diagnóstico completo solo en la app en el MVP (el gap lo carga el superusuario).

### Success criteria (producto)

- [ ] Superusuario puede crear un tenant, cargar evaluación/gap y documentación existente, y dejar una URL operativa.
- [ ] Tenant sin SGI previo recibe plantilla esencial (tamaño + actividad) y puede escalar requisitos.
- [ ] Documentos válidos del cliente se conservan; los no conformes se marcan y se ofrecen reemplazos del sistema.
- [ ] Multi-usuario por tenant con roles; superusuario de plataforma separado.
- [ ] Automatizaciones de seguimiento / indicadores / vencimientos: modelo de “oferta + activación” (nativo e integraciones), con al menos el motor de vencimientos y recordatorios en MVP.
- [ ] UI moderna, no genérica; accesible (WCAG 2.1 AA en flujos críticos) y usable en desktop + tablet.
- [ ] Operaciones core: no conformidades/acciones, riesgos, auditorías internas, indicadores (mínimo usable).

---

## Tech Stack

Elegido por madurez de mercado, DX, UI moderna y despliegue SaaS multi-tenant.

| Capa | Elección | Motivo |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | Estándar de mercado para SaaS web; SSR/RSC; ecosistema maduro |
| UI | **Tailwind CSS + componentes propios** (base shadcn/ui solo como primitives) | Diseño distintivo y moderno sin look “template AI”; tokens de marca propios |
| Auth | **Better Auth** (o Auth.js si Better Auth no cierra en setup) | Sesiones seguras, roles, multi-tenant |
| DB | **PostgreSQL + Prisma** | Relacional fuerte para catálogo ISO, docs, vencimientos |
| Jobs / vencimientos | **Inngest** (o cron + cola si se prefiere menos SaaS) | Recordatorios, seguimientos, indicadores periódicos |
| Storage | **S3-compatible** (R2 / S3) | PDFs y adjuntos de procedimientos/registros |
| Email | Proveedor SMTP/API (Resend u equivalente) | Notificaciones de vencimiento |
| Hosting | **Vercel** (app) + **Neon/Postgres gestionado** (o Render Postgres) | Deploy predecible; filesystem efímero → no persistir archivos locales |
| Tests | **Vitest** (unit/integration) + **Playwright** (e2e) | Pirámide 80/15/5 |
| Lint/format | **ESLint + Prettier** | Consistencia |

> Detalle de versiones exactas se fija en el scaffold (`package.json`) en la primera tarea de implementación.

---

## Commands

```text
Dev:     npm run dev
Build:   npm run build
Start:   npm run start
Test:    npm test
Test cov: npm test -- --coverage
E2E:     npm run test:e2e
Lint:    npm run lint
Format:  npm run format
DB gen:  npx prisma generate
DB mig:  npx prisma migrate dev
DB studio: npx prisma studio
```

---

## Project Structure

```text
├── CAPABILITY-MAP.md          # Índice de módulos (aprobado)
├── SPEC.md                    # Este documento (producto / MVP)
├── SPEC-<module-id>.md        # Specs por módulo (cuando se abran)
├── docs/                      # ADRs, guías ISO internas, onboarding
├── tasks/                     # plan.md + todo.md (post-/plan)
├── prisma/
│   └── schema.prisma
├── public/
├── src/
│   ├── app/                   # Next.js App Router (rutas portal + admin)
│   │   ├── (platform)/        # Superusuario: tenants, gap, provisioning
│   │   ├── (tenant)/          # Portal del cliente
│   │   └── api/
│   ├── components/            # UI por dominio (colocalizada)
│   ├── domain/                # Lógica de negocio pura (IMS, gap, vencimientos)
│   ├── lib/                   # auth, db, storage, mail, jobs
│   └── styles/                # tokens de diseño (no purple-default)
├── tests/                     # unit + integration
└── e2e/                       # Playwright
```

---

## Code Style

- TypeScript estricto; sin `any` nuevo.
- Nombres: `kebab-case` archivos; `PascalCase` componentes; `camelCase` funciones.
- Dominio en `src/domain` sin imports de UI.
- Validación de inputs en boundaries (Zod u equivalente).
- Un ejemplo de estilo esperado:

```ts
// src/domain/ims/requirement.ts
export type IsoStandard = "ISO9001" | "ISO14001" | "ISO45001";

export type RequirementStatus =
  | "not_applicable"
  | "missing"
  | "partial"
  | "compliant"
  | "automated";

export function decideDocumentFate(input: {
  meetsRequirement: boolean;
  hasClientDocument: boolean;
}): "keep" | "replace" | "create" {
  if (input.hasClientDocument && input.meetsRequirement) return "keep";
  if (input.hasClientDocument && !input.meetsRequirement) return "replace";
  return "create";
}
```

UI: composición de componentes; tokens CSS (`--color-bg`, `--color-accent`, tipografía expresiva); evitar estética genérica (purple-on-white, cards vacías sin jerarquía).

---

## Testing Strategy

| Nivel | Dónde | Qué |
|---|---|---|
| Unit (~80%) | `tests/` / `*.test.ts` junto a domain | Catálogo, gap rules, vencimientos, roles |
| Integration (~15%) | `tests/integration` | API + Prisma (DB de test) |
| E2E (~5%) | `e2e/` | Login, provisioning happy path, crear NC, ver vencimiento |

- Cobertura: umbral inicial en dominio crítico (`domain/`, authz) ≥ 80%; no exigir 100% de UI.
- Regla: no merge sin tests verdes del módulo tocado.
- Evidencia de cumplimiento ISO **no se inventa** en tests ni en runtime.

---

## Boundaries

### Always

- Multi-tenant isolation: un usuario de tenant A no ve datos de tenant B.
- Respetar documentos del cliente marcados como **compliant** (no sobrescribir sin acción explícita del superusuario).
- Validar inputs en API; autorización por rol en cada mutación.
- Automatizaciones: solo las definidas en specs de automatización posteriores; registrar qué se automatizó y cuándo.
- Tests antes de commit en módulos de dominio.
- Archivos de cliente en object storage, nunca solo en disco local del servidor.

### Ask first

- Cambios de schema Prisma / migraciones productivas.
- Añadir dependencias pesadas o nuevos proveedores (auth, jobs, email, storage).
- Ampliar alcance ISO más allá del catálogo acordado para el sprint.
- Activar una automatización nueva no listada en el backlog de automatizaciones.
- Cambiar modelo de roles o permisos.

### Never

- Inventar evidencia de cumplimiento o marcar requisito como conforme sin dato cargado.
- Borrar procedimientos/registros del cliente sin confirmación explícita (superusuario o admin tenant según política).
- Commit de secretos, `.env` con claves, o credenciales.
- Cross-tenant data leakage “por conveniencia”.
- Ejecutar automatizaciones no especificadas “porque parecen útiles”.

---

## Module scope (MVP)

Detalle fino por módulo se abrirá en `SPEC-<module-id>.md`. Resumen de contrato:

| Module | MVP debe incluir |
|---|---|
| `ims-catalog` | Requisitos clave de las 3 normas + tags de integración; versionado del catálogo |
| `tenant-provisioning` | Alta empresa; tamaño; actividad; plantilla esencial; URL/slug |
| `identity-access` | Superusuario plataforma; usuarios tenant; roles básicos; login/sesión |
| `assessment-gap` | Formulario/backoffice para que el superusuario cargue gap y docs existentes |
| `document-control` | CRUD docs, versión, vigencia, vínculo a requisito; keep/replace/create |
| `automation-offers` | Catálogo de ofertas (nativo + integración); motor de **due dates / seguimientos / indicadores**; activación por tenant |
| `operations-core` | NC + acciones correctivas; riesgos; auditorías internas; indicadores |
| `client-portal` | Shell UI moderno; navegación SGI; dashboards de vencimientos y estado de requisitos |

---

## Open Questions

1. **Roles exactos del tenant** — ¿alcanza con `tenant_admin` / `process_owner` / `contributor` / `viewer`, o hay roles ISO formales (Representante de la dirección, etc.) desde el día 1?
2. **Idioma** — ¿solo español, o UI bilingüe ES/EN en MVP?
3. **Hosting definitivo** — ¿Vercel+Neon OK, o el cliente exige on-prem / Render / VPS?
4. **Primera lista concreta de automatizaciones** — se definirá en un doc posterior; hasta entonces solo el **motor** (vencimientos + notificaciones + hooks de oferta).
5. **Marca visual** — ¿nombre comercial, logo y paleta, o inventamos identidad temporal “SGI Base”?

---

## Approval gate

Este SPEC + `CAPABILITY-MAP.md` deben ser **aprobados explícitamente** antes de `/plan` o código de aplicación.

**Estado:** Approved by product owner (2026-09-25).
