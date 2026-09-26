# SGI Base

Plataforma web multi-tenant para operar un **Sistema de Gestión Integrada** alineado a **ISO 9001**, **ISO 14001** e **ISO 45001**.

El objetivo no es “otro checklist de normas”: es entregar a cada empresa una URL lista, con su gap ya cargado, documentos respetados o reemplazados según corresponda, y automatizaciones de seguimientos, indicadores y vencimientos.

---

## Qué problema resuelve

Muchas organizaciones necesitan (o ya tienen) un SGI, pero el día a día se rompe en Excel, carpetas compartidas y recordatorios manuales. **SGI Base** cubre dos caminos desde el mismo producto:

| Situación | Enfoque |
|---|---|
| **Empresa con SGI existente** | Se respetan procedimientos y registros que cumplen; lo no conforme se marca y se ofrece la solución del sistema. |
| **Empresa sin SGI** | Se genera una base esencial según **tamaño** y **actividad**, escalable hasta el catálogo completo de requisitos. |

En el MVP, el **superusuario de plataforma** (equipo de desarrollo / implementación) analiza el SGI del cliente fuera de línea, carga el gap y la documentación, provisiona el tenant y entrega la URL operativa. Los usuarios del cliente operan el sistema con roles (admin del tenant, responsables de proceso, lectores, etc.).

---

## Alcance del MVP

- Provisionamiento multi-tenant y URL lista para el cliente.
- Catálogo de requisitos ISO 9001 / 14001 / 45001 con plantillas por tamaño y actividad.
- Carga de evaluación / gap por superusuario.
- Control documental (conservar, marcar no conforme, reemplazar o crear).
- Motor de **vencimientos y recordatorios** + modelo de ofertas/activación de automatizaciones.
- Operaciones core: no conformidades / acciones, riesgos, auditorías internas e indicadores (mínimo usable).
- Portal de cliente con UI moderna, usable en desktop y tablet, y accesible en flujos críticos (WCAG 2.1 AA).

Detalle de producto, criterios de éxito y stack: ver [`SPEC.md`](./SPEC.md).  
Mapa de módulos y orden de construcción: ver [`CAPABILITY-MAP.md`](./CAPABILITY-MAP.md).  
Plan de implementación: ver [`tasks/plan.md`](./tasks/plan.md).

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| App | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + componentes propios (primitives estilo shadcn/ui) |
| Auth | **Better Auth** (email/password) |
| Base de datos | **PostgreSQL + Prisma** |
| Jobs / vencimientos | Inngest (o cron + cola) — pendiente |
| Archivos | Almacenamiento S3-compatible (MinIO local / R2 / S3) — docs controlados + adjuntos de hallazgos |
| Email | Stub + envío real configurable |
| Hosting | Vercel + Postgres gestionado (Neon / Render) |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Calidad | ESLint + Prettier |

---

## Estado actual del repositorio

Completado y **profundizado** el módulo de **Hallazgos** (`SPEC-findings.md`):

### Hallazgos — lo que ya opera

| Pieza | Qué hace |
|---|---|
| **Entrada unificada** | Siempre se crea un **Hallazgo** (NC, observación, incidente u oportunidad). |
| **Laboratorio 5 Porqués** | Análisis interactivo: hecho comprobado (no el título), checklist de investigación, **ramas** causales, orientación por nivel y material de apoyo con ejemplos industriales. |
| **Causa raíz** | Obligatoria para publicar; visible en la ficha; puede haber una raíz por rama. |
| **Medidas** | Correctivas / preventivas con responsable (usuario del tenant), vencimiento → DueItem, y **evidencia de archivo obligatoria** para cerrar. |
| **Documentación del hallazgo** | Adjuntos operativos (fotos, PDF, registros) en object storage; **no** son documentos controlados del SGI. |
| **Bandeja de seguimiento** | Tabla con filtros (texto, tipo, estado), columnas esenciales, **estado del hallazgo** y **estado de cada medida** en color. Alta vía botón → `/findings/new`. |

Rutas: `/t/[slug]/findings` (bandeja), `/findings/new` (alta), `/findings/[id]` (ficha), `/findings/[id]/edit` (borrador). Las rutas `/operations` redirigen acá.

### Pendiente inmediato (hallazgos)

- **Task 10d** — Dar **lógica real** a los estados del hallazgo (`draft` → `published` → `in_progress` → `closed` / `cancelled`): transiciones, quién puede cerrar/anular, y cierre del hallazgo solo cuando las medidas estén cerradas.

### Siguiente módulo de producto

**Task 11** — Riesgos, auditorías e indicadores (con la misma profundidad que hallazgos; la entrevista de Riesgos sigue pendiente).

---

## Hallazgos en la práctica (guía rápida)

1. En la bandeja, usá **Crear hallazgo** (tipo + título preliminar).
2. Completá el borrador: datos del hecho, **laboratorio 5 Porqués** (hecho verificable → ramas → confirmar causa raíz), medidas, notificados.
3. Adjuntá documentación del hecho si hace falta (fotos / registros).
4. **Publicá** → se crean DueItems y notificaciones.
5. En la ficha, cerrá cada medida **adjuntando evidencia**; el seguimiento en bandeja muestra el estado de esas medidas.

Tipos de archivo admitidos: PDF, PNG/JPEG, Word, texto · máx. 15 MB (`serverActions.bodySizeLimit` = 16 MB en `next.config.ts`).

Detalle de producto del módulo: [`SPEC-findings.md`](./SPEC-findings.md).

---

## Requisitos previos

- Node.js 20+ (recomendado LTS actual)
- npm
- Git
- **Docker Desktop** (para Postgres local vía `docker compose`)

---

## Cómo empezar (desarrollo local)

### 1. Clonar e instalar

```bash
git clone https://github.com/nicoconti1901/SGI-BASE-AGENT.git
cd SGI-BASE-AGENT
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

En `.env` ya hay valores de desarrollo seguros para local. **Cambiá** `BETTER_AUTH_SECRET` y la contraseña del seed antes de cualquier entorno compartido.

### 3. Base de datos

```bash
npm run db:up          # levanta Postgres 16 + MinIO (S3) en Docker
npm run db:migrate     # aplica migraciones (primera vez: crea el schema)
npm run db:seed        # crea el superusuario
```

Para object storage real en local, copiá las variables `S3_*` de `.env.example` a `.env` (MinIO en `localhost:9000`, consola en `:9001`). Sin esas variables, los archivos viven en memoria del proceso (útil para tests; se pierden al reiniciar).

Credenciales por defecto del seed (solo local):

| Campo | Valor |
|---|---|
| Email | `admin@sgi.local` |
| Contraseña | `CambiarYa!123` |

### 4. App

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) → **Iniciar sesión** → deberías llegar a `/platform` como `platform_superuser`.

---

### Scripts útiles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servir el build |
| `npm test` | Tests Vitest (incluye aislamiento de tenants si hay `DATABASE_URL`) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run test:e2e` | Playwright |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run db:up` / `db:down` | Docker Compose Postgres |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Seed del superusuario |
| `npm run db:studio` | Prisma Studio |

---

## Autenticación y multi-tenant (Task 2)

### Roles

Los valores técnicos en base de datos siguen en inglés; en la UI se muestran nombres profesionales en español:

| Código (DB) | Nombre en UI | Ámbito | Uso |
|---|---|---|---|
| `platform_superuser` | Administrador de plataforma | Plataforma | Implementador: ve tenants, carga gaps, provisiona |
| `tenant_admin` | Administrador de la organización | Tenant | Gestiona usuarios, roles y configuración del SGI |
| `process_owner` | Responsable de proceso | Tenant | Lidera procesos y puede eliminar registros operativos |
| `contributor` | Colaborador | Tenant | Carga y actualiza información del sistema de gestión |
| `viewer` | Consulta | Tenant | Solo lectura |

Las etiquetas viven en `src/domain/identity/authz.ts` (`TENANT_ROLE_LABELS`, `PLATFORM_ROLE_LABEL`).

El aislamiento es **deny-by-default**: las queries de negocio pasan por helpers en `src/domain/tenancy` y `src/lib/tenant-queries.ts`. Un usuario de tenant A no puede leer recursos de tenant B. El superusuario puede operar sobre un tenant **explícito**, no “todo mezclado”.

### Archivos clave

- `prisma/schema.prisma` — modelos y migraciones
- `src/lib/auth.ts` — Better Auth + Prisma adapter
- `src/lib/db.ts` — cliente Prisma
- `src/app/login/page.tsx` — inicio de sesión
- `src/app/platform/page.tsx` — panel post-login

---

## Estructura del proyecto (resumen)

```text
├── SPEC.md                 # Spec de producto / MVP (aprobada)
├── CAPABILITY-MAP.md       # Módulos y orden de build
├── tasks/                  # plan.md + todo.md
├── docker-compose.yml      # Postgres local
├── prisma/                 # Schema, migraciones y seed
├── src/
│   ├── app/                # Next.js App Router (login, platform, api/auth)
│   ├── domain/             # Lógica de dominio (tenancy, …)
│   └── lib/                # auth, db, session, tenant-queries
├── tests/                  # Vitest
├── e2e/                    # Playwright
└── .cursor/                # Skills, commands y agents del flujo de trabajo
```

---

## Módulos (orden de construcción)

1. `ims-catalog` — catálogo de requisitos ISO  
2. `tenant-provisioning` — alta de empresa y plantilla inicial  
3. `identity-access` — usuarios, roles y sesiones  
4. `assessment-gap` — carga de gap por superusuario ✅  
5. `document-control` — procedimientos, registros y versiones ✅  
6. `automation-offers` — motor de vencimientos + ofertas ✅  
7. `operations-core` — hallazgos unificados ✅ (profundización en curso: estados Task 10d); luego riesgos, auditorías, indicadores  
8. `client-portal` — UI para operar el SGI configurado  

---

## Specs de módulo

- [`SPEC.md`](./SPEC.md) — producto / MVP  
- [`SPEC-findings.md`](./SPEC-findings.md) — hallazgos, 5 Porqués, medidas, adjuntos, bandeja  

## Contribución y flujo con el agente

El trabajo se organiza por slices verticales: especificar → planear → implementar → probar → revisar → documentar → ship.

En Cursor, los comandos bajo `.cursor/commands/` y las skills bajo `.cursor/skills/` guían ese flujo. No inventar arquitectura: alinear siempre con `SPEC.md` y el capability map.

### Git (convención del equipo)

1. Crear una rama con nombre claro (`feat/...`, `fix/...`, `docs/...`).
2. Commits enfocados en el *por qué*, mensajes en español cuando el cambio es de producto/equipo.
3. Push de la rama.
4. Merge a `main` cuando el slice esté verificado (tests + build).

```text
feat: ...
fix: ...
docs: ...
chore: ...
```

---

## Seguridad

- No commitear `.env` ni secretos.
- Usá `.env.example` como plantilla.
- Rotá `BETTER_AUTH_SECRET` y la contraseña del seed fuera de tu máquina.
- El filesystem del hosting es efímero: los archivos de clientes irán a object storage (tarea posterior), no al disco del servidor.

---

## Licencia y uso

Repositorio privado / de producto. Uso interno del proyecto SGI Base salvo acuerdo explícito en contrario.

---

## Enlaces

- Repositorio: [github.com/nicoconti1901/SGI-BASE-AGENT](https://github.com/nicoconti1901/SGI-BASE-AGENT)
- Spec: [`SPEC.md`](./SPEC.md)
- Hallazgos: [`SPEC-findings.md`](./SPEC-findings.md)
- Capability map: [`CAPABILITY-MAP.md`](./CAPABILITY-MAP.md)
- Plan: [`tasks/plan.md`](./tasks/plan.md)
- Tareas: [`tasks/todo.md`](./tasks/todo.md)
