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
| Jobs / vencimientos | n8n programa `POST /api/automation/scan` (autenticado con `AUTOMATION_WEBHOOK_SECRET`); workflow en [`n8n/`](./n8n/README.md). En local también `npm run job:due-scan` |
| Archivos | Almacenamiento S3-compatible (MinIO local / R2 / S3) — docs controlados + adjuntos de hallazgos |
| Email | Stub + envío real configurable |
| Hosting | Vercel + Postgres gestionado (Neon / Render) |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Calidad | ESLint + Prettier |

---

## Estado actual del repositorio

### Hallazgos — operativo (con profundización pendiente)

| Pieza | Qué hace |
|---|---|
| **Entrada unificada** | Siempre se crea un **Hallazgo** (NC, observación, incidente u oportunidad de mejora). |
| **Laboratorio 5 Porqués** | Hecho comprobado, checklist, **ramas** causales y material de apoyo industrial. |
| **Medidas** | Owner del tenant, vencimiento → DueItem, **evidencia de archivo** para cerrar. |
| **Bandeja** | Filtros, estado del hallazgo y de cada medida. |

Rutas: `/t/[slug]/findings`. Spec: [`SPEC-findings.md`](./SPEC-findings.md).

**Ciclo de vida (Task 10d):** Publicado → En curso (al iniciar o cerrar una medida) → En verificación (al cerrar la última; solo NC e incidentes) → Cerrado (con eficacia verificada). Una verificación no eficaz o una reapertura vuelve a En curso y exige una nueva medida correctiva. Anular y reabrir: solo el administrador, con motivo. Cada cambio queda en el historial. Spec: [`SPEC-findings-lifecycle.md`](./SPEC-findings-lifecycle.md).

### Riesgos y oportunidades — Nivel 2 Controlado ✅

Módulo nuevo alineado a **ISO 9001:2026 §6.1** (riesgo ≠ oportunidad; no ERM genérico ni heat map como home). Spec: [`SPEC-risks-opportunities.md`](./SPEC-risks-opportunities.md). Research: [`RESEARCH-risks-opportunities.md`](./RESEARCH-risks-opportunities.md).

| Pieza | Qué hace |
|---|---|
| **Explorar contexto** | Entrada principal: partís de una fuente (proceso, proveedor, hallazgo, cambio…) y decidís si nace riesgo, oportunidad, ambos o ninguno. |
| **Riesgo** | Canvas causa → evento → efecto + controles existentes; lifecycle propio. |
| **Oportunidad** | Hipótesis condición → circunstancia → beneficio; **no** es “riesgo positivo”. |
| **Evaluación** | Default **cualitativo** (Bajo/Medio/Alto/Crítico); P×I disponible; cada assessment es una **versión nueva** (no se sobrescribe). |
| **Decisión** | Respuesta del riesgo / persecución de la oportunidad, con racional y responsable. |
| **Acción compartida** | Modelo único (`Action`) vinculable a riesgo y/o oportunidad (y opcionalmente hallazgo). Completar ≠ efectividad; evidencia obligatoria para completar; DueItem al vencer. |
| **Workspace** | Discovery · Decisions · Execution · Learning — la matriz no es la pantalla principal. |

Rutas: `/t/[slug]/risks` (workspace), `/risks/explore` (descubrimiento), `/risks/[id]` y `/risks/opportunities/[id]` (fichas). Nav del portal: **Riesgos y oportunidades**.

### Auditorías internas integradas ✅ (Task 11b)

Ciclo de auditoría interna para **ISO 9001:2026, ISO 14001:2015 e ISO 45001:2018 §9.2**, con ISO 19011 como guía. Una misma auditoría puede cubrir varias normas. Spec: [`SPEC-audits.md`](./SPEC-audits.md). Research: [`RESEARCH-audits.md`](./RESEARCH-audits.md).

| Pieza | Qué hace | Estado |
|---|---|---|
| **Programa anual** | Auditorías planificadas por empresa, con justificación de frecuencia y vencimientos (`DueItem`). | ✅ |
| **Plan de auditoría** | Objetivo, alcance y criterios obligatorios antes de iniciar; equipo auditor con control de imparcialidad. | ✅ |
| **Lista de verificación** | Generada desde el catálogo de requisitos de la empresa, más preguntas propias; resultado y evidencia (adjuntos) por ítem. | ✅ |
| **Hallazgos** | NC mayor, NC menor, observación u oportunidad de mejora: cada uno crea un **Hallazgo** vinculado a la auditoría, visible desde su ficha. | ✅ |
| **Informe y cierre** | Conclusión respecto del objetivo, fortalezas y resumen de resultados; marca de comunicación a trabajadores si incluye ISO 45001; cerrar emite el informe. | ✅ |
| **Cobertura** | Por norma, requisitos revisados en auditorías cerradas del año. | ✅ |
| **Guía** | Guía breve de auditoría interna (objetivo, evidencia, clasificación, imparcialidad, informe). | ✅ |

Rutas: `/t/[slug]/audits` (programa y listado), `/audits/new` (planificación), `/audits/[id]` (ejecución e informe), `/audits/guia` (guía). La evidencia se descarga por `/api/audits/evidence/[id]/download`, con control de acceso por empresa.

### Qué sigue

- **Task 11c** — indicadores.  
- **Task 11d** — auditorías externas: alta, informe PDF adjunto y hallazgos manuales listos (11d.1–11d.2); falta la extracción automática con revisión humana (11d.3, ver `SPEC-external-audits.md`).  
- **Task 12+** — portal cliente / dashboards / E2E.

---

## Riesgos y oportunidades en la práctica (guía rápida)

1. En el portal, abrí **Riesgos y oportunidades** (o `/t/[slug]/risks`).
2. Usá **Explorar contexto**: describí la fuente (ej. “Proveedor único de acero”) y marcá si creás riesgo, oportunidad o ambos.
3. En la ficha del riesgo, completá el canvas, registrá una evaluación cualitativa y la decisión de respuesta.
4. Agregá **acciones** con responsable y vencimiento; adjuntá evidencia para completarlas; después registrá **efectividad** (distinto de “completada”).
5. Volvé al workspace: las cuatro capas muestran qué falta descubrir, decidir, ejecutar o aprender (incluye señales *stale*).

El alta directa de riesgo queda como **atajo secundario**; el flujo pensado para auditoría y uso diario es explorar la fuente primero.

---

## Hallazgos en la práctica (guía rápida)

1. En la bandeja, usá **Crear hallazgo** (tipo + título preliminar).
2. Completá el borrador: datos del hecho, **laboratorio 5 Porqués** (hecho verificable → ramas → confirmar causa raíz), medidas, notificados.
3. Adjuntá documentación del hecho si hace falta (fotos / registros).
4. **Publicá** → se crean DueItems y notificaciones.
5. En la ficha, cada responsable **inicia** su medida y la cierra **adjuntando evidencia**.
6. Al cerrar la última medida, una NC o un incidente pasa a **En verificación**: pasado el plazo (30 días por defecto, editable) el administrador o un responsable de proceso que no haya ejecutado todas las medidas registra si las acciones fueron **eficaces**. Observaciones y oportunidades de mejora se cierran al cerrar sus medidas.

Tipos de archivo admitidos (hallazgos y acciones): PDF, PNG/JPEG, Word, texto · máx. 15 MB (`serverActions.bodySizeLimit` = 16 MB en `next.config.ts`).

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
npm run db:seed:demo   # integrantes de prueba en la empresa "tisico" (clave Tisico123!)
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

Abrí [http://localhost:3000](http://localhost:3000). En desarrollo, el home muestra **Acceso rápido** con un clic para el superusuario, el administrador de cada empresa y cada integrante. Cada uno cae directo en su lugar: el superusuario en `/platform`, el resto en `/t/<empresa>`.

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
| `npm run db:seed:demo` | Integrantes de prueba de Tisico (idempotente) |
| `npm run db:recalc-findings` | Recalcula el estado de los hallazgos existentes según sus medidas (`-- --dry-run` para solo mostrar cambios) |
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
- `src/domain/identity/persona.ts` — superusuario / administrador de empresa / integrante, capacidades visibles y destino post-login
- `src/app/(platform)/layout.tsx` y `src/app/(tenant)/t/[slug]/layout.tsx` — guardas de acceso y shell con la identidad visible
- `/portal` — entrada única: lleva a cada usuario a su espacio (no hay que "activar" nada)

### Quién ve qué

| Persona | Entra a | Color del shell |
|---|---|---|
| Superusuario | `/platform` y cualquier empresa | Ámbar |
| Administrador de la empresa | `/t/<empresa>`; gestiona usuarios | Verde azulado |
| Integrante | `/t/<empresa>`; edita o solo lectura según rol | Azul acero |

La cabecera muestra siempre la persona, el rol, si puede editar y **Cerrar sesión**.

---

## Estructura del proyecto (resumen)

```text
├── SPEC.md                 # Spec de producto / MVP (aprobada)
├── SPEC-findings.md        # Hallazgos
├── SPEC-risks-opportunities.md
├── RESEARCH-risks-opportunities.md
├── CAPABILITY-MAP.md       # Módulos y orden de build
├── tasks/                  # plan.md + todo.md
├── docker-compose.yml      # Postgres + MinIO local
├── prisma/                 # Schema, migraciones y seed
├── src/
│   ├── app/                # App Router (portal, tenants, APIs)
│   ├── domain/             # findings, risks, opportunities, actions, …
│   └── lib/                # auth, db, persistence helpers
├── tests/                  # Vitest
├── e2e/                    # Playwright
└── .cursor/                # Skills, commands y agents
```

---

## Módulos (orden de construcción)

1. `ims-catalog` — catálogo de requisitos ISO  
2. `tenant-provisioning` — alta de empresa y plantilla inicial  
3. `identity-access` — usuarios, roles y sesiones  
4. `assessment-gap` — carga de gap por superusuario ✅  
5. `document-control` — procedimientos, registros y versiones ✅  
6. `automation-offers` — motor de vencimientos + ofertas ✅  
7. `operations-core` — hallazgos unificados ✅ · **riesgos y oportunidades Nivel 2** ✅ · auditorías internas (Task 11b, en curso) · luego indicadores (Task 11c)  
8. `client-portal` — UI para operar el SGI configurado  

---

## Specs de módulo

- [`SPEC.md`](./SPEC.md) — producto / MVP  
- [`SPEC-findings.md`](./SPEC-findings.md) — hallazgos, 5 Porqués, medidas, adjuntos, bandeja  
- [`SPEC-risks-opportunities.md`](./SPEC-risks-opportunities.md) — riesgos y oportunidades ISO 9001:2026  
- [`RESEARCH-risks-opportunities.md`](./RESEARCH-risks-opportunities.md) — ledger de investigación normativa  
- [`SPEC-audits.md`](./SPEC-audits.md) — auditorías internas integradas 9001 / 14001 / 45001  
- [`RESEARCH-audits.md`](./RESEARCH-audits.md) — investigación normativa de auditorías (ISO 19011)  

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
- Riesgos y oportunidades: [`SPEC-risks-opportunities.md`](./SPEC-risks-opportunities.md)
- Capability map: [`CAPABILITY-MAP.md`](./CAPABILITY-MAP.md)
- Plan: [`tasks/plan.md`](./tasks/plan.md)
- Tareas: [`tasks/todo.md`](./tasks/todo.md)
