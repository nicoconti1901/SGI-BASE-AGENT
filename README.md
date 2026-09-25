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
| Auth | Better Auth (o Auth.js si el setup no cierra) |
| Base de datos | PostgreSQL + Prisma |
| Jobs / vencimientos | Inngest (o cron + cola) |
| Archivos | Almacenamiento S3-compatible (R2 / S3) |
| Email | SMTP/API (Resend u equivalente) |
| Hosting | Vercel + Postgres gestionado (Neon / Render) |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Calidad | ESLint + Prettier |

---

## Estado actual del repositorio

Este repo es la **base del agente y del producto**: scaffold Next.js, especificación aprobada, capability map, plan de tareas y skills/comandos de Cursor para trabajar con disciplina (spec → plan → build → test → review → ship).

Todavía no está el dominio de negocio completo; la construcción sigue el orden del capability map.

---

## Requisitos previos

- Node.js 20+ (recomendado LTS actual)
- npm (incluido con Node)
- Git

Para base de datos y storage en etapas posteriores: PostgreSQL y un bucket S3-compatible.

---

## Cómo empezar

```bash
git clone https://github.com/nicoconti1901/SGI-BASE-AGENT.git
cd SGI-BASE-AGENT
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

### Scripts útiles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servir el build |
| `npm test` | Tests unitarios / integración (Vitest) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run test:e2e` | Tests end-to-end (Playwright) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (escritura) |
| `npm run format:check` | Prettier (solo verificación) |

Cuando exista el schema Prisma:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma studio
```

---

## Estructura del proyecto (resumen)

```text
├── SPEC.md                 # Spec de producto / MVP (aprobada)
├── CAPABILITY-MAP.md       # Módulos y orden de build
├── tasks/                  # plan.md + todo.md
├── prisma/                 # Schema y migraciones (próximas)
├── src/
│   ├── app/                # Next.js App Router
│   ├── domain/             # Lógica de dominio
│   └── lib/                # Utilidades compartidas
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

### Commits

Mensajes en formato convencional, en español o inglés según el hábito del equipo, priorizando el *por qué*:

```text
feat: ...
fix: ...
docs: ...
chore: ...
```

Ramas cortas (`feature/...`, `fix/...`, `docs/...`, `chore/...`), merge a la rama principal cuando el slice esté verificado.

---

## Licencia y uso

Repositorio privado / de producto. Uso interno del proyecto SGI Base salvo acuerdo explícito en contrario.

---

## Enlaces

- Repositorio: [github.com/nicoconti1901/SGI-BASE-AGENT](https://github.com/nicoconti1901/SGI-BASE-AGENT)
- Spec: [`SPEC.md`](./SPEC.md)
- Capability map: [`CAPABILITY-MAP.md`](./CAPABILITY-MAP.md)
- Plan: [`tasks/plan.md`](./tasks/plan.md)
