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
| Archivos | Almacenamiento S3-compatible (R2 / S3) — pendiente |
| Email | SMTP/API (Resend u equivalente) — pendiente |
| Hosting | Vercel + Postgres gestionado (Neon / Render) |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Calidad | ESLint + Prettier |

---

## Estado actual del repositorio

Completado hasta **Task 4**:

- Auth multi-tenant (Better Auth + Prisma) y seed de superusuario.
- Design system “precision ledger” + shells `/platform` y `/portal`.
- **Catálogo ISO** (`IsoRequirement`): 27 requisitos seed (esenciales + escalables) con UI filtrable en `/platform/catalog`.

Siguiente: provisionamiento de tenants (Task 5).

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
npm run db:up          # levanta Postgres 16 en el puerto 5432
npm run db:migrate     # aplica migraciones (primera vez: crea el schema)
npm run db:seed        # crea el superusuario
```

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

| Rol | Ámbito | Uso |
|---|---|---|
| `platform_superuser` | Plataforma | Implementador: ve tenants, carga gaps, provisiona |
| `tenant_admin` | Tenant | Administra usuarios y configuración de la empresa |
| `process_owner` | Tenant | Responsable de procesos / requisitos |
| `contributor` | Tenant | Alta y edición limitada |
| `viewer` | Tenant | Solo lectura |

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
4. `assessment-gap` — carga de gap por superusuario  
5. `document-control` — procedimientos, registros y versiones  
6. `automation-offers` — motor de vencimientos + ofertas  
7. `operations-core` — NC, riesgos, auditorías, indicadores  
8. `client-portal` — UI para operar el SGI configurado  

---

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
- Capability map: [`CAPABILITY-MAP.md`](./CAPABILITY-MAP.md)
- Plan: [`tasks/plan.md`](./tasks/plan.md)
- Tareas: [`tasks/todo.md`](./tasks/todo.md)
