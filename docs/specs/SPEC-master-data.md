# Spec: `master-data` — Sedes, personas, puestos y tareas (Task 14)

Estado: **aprobado por el PO** (2026-10-01), con las decisiones de abajo. Base común de las Tasks 15–20.

## Objective

Dar a cada empresa (tenant) un padrón propio de **dónde** (Sede), **quién** (Persona) y **qué hace** (Puesto, Tarea), para que inspecciones, accidentabilidad, seguridad vial, proveedores y capacitaciones se apoyen en los mismos datos.

### Success criteria
- Alta, edición y baja de sedes, puestos, tareas y personas, siempre acotadas al tenant.
- Importar 500 personas por CSV en una operación; reimportar actualiza, no duplica.
- Una persona dada de baja no aparece en los selectores, pero conserva su historial.
- Dos tenants nunca ven los datos del otro.

## Decisiones a confirmar (defaults propuestos)

| # | Decisión | Default |
|---|---|---|
| 1 | Persona vs Usuario | Persona ≠ Usuario. `userId` opcional y único por tenant. Un operario puede no tener usuario. |
| 2 | Vínculos de una persona | 1 puesto principal, 1 sede base, **N sedes adicionales** (el personal rota), N tareas. Empresa: propia o contratista. |
| 3 | Datos personales | Solo legajo, nombre, DNI (opcional, **visible para todos los roles**) y fecha de ingreso. **Sin datos de salud.** |
| 4 | Baja | Lógica: estado `inactive` + fecha. Nunca se borra si tiene registros asociados. |
| 5 | Baja de sede/puesto/tarea con dependientes activos | Se bloquea y se informa cuáles son. |
| 6 | Módulos existentes | No se migran a Sede. `Finding.location` sigue siendo texto. |
| 7 | Nombre del modelo de tarea | `JobTask` (evita chocar con "tarea" del plan). |
| 8 | Proveedor de la persona contratista | `supplierId` opcional; queda nulo hasta la Task 19 (campo texto `contractorName` mientras tanto). |

## Domain model (conceptual)

- **Site**: `tenantId`, nombre (único por tenant), tipo (`office` / `base` / `worksite` / `field` / `camp` / `plant`), dirección?, `active`.
- **JobPosition**: `tenantId`, nombre (único por tenant), `active`.
- **JobTask**: `tenantId`, nombre (único por tenant), `critical` (trabajo en altura, izaje, conducción, espacio confinado…), `active`.
- **Person**: `tenantId`, `employeeCode` (legajo, único por tenant), nombre, `documentId` (DNI)?, `userId`?, `employer` (`own` / `contractor`), `contractorName`?, `siteId` (sede base), `positionId`, `hiredAt`, `status` (`active` / `inactive`), `inactiveAt`?.
- **PersonSite**: `personId` × `siteId` (única), `tenantId`. Sedes adicionales donde rota; "personas de una sede" = base **o** adicional.
- **PersonJobTask**: `personId` × `jobTaskId` (única), `tenantId` para aislar.
- Índices por `tenantId`; todas las lecturas pasan por los helpers tenant-scoped existentes.

Reglas puras (en `src/domain/masterdata/`):
- `validatePersonRow(row)` y `parseRoster(csv)` → filas válidas + errores por fila (número de fila, campo, motivo).
- `planRosterImport(existing, rows)` → `create` / `update` / `unchanged` por legajo.
- `canDeactivate(entity, dependents)` → bloquea con la lista de dependientes.

## Permisos

| Rol | Sedes/puestos/tareas | Personas |
|---|---|---|
| `tenant_admin` | alta, edición, baja | alta, edición, baja, importación |
| `process_owner` | lectura | lectura + asignar tareas |
| `contributor` | lectura | lectura |
| `viewer` | lectura | lectura |

El DNI es visible para todos los roles del tenant. Cada alta, edición, baja e importación deja registro de auditoría (quién, cuándo, qué).

## UX

- `/t/[slug]/master-data` con pestañas: Sedes · Puestos · Tareas · Personas.
- Listas con búsqueda y filtro por sede/estado; formularios cortos; baja con confirmación y motivo.
- **Importación CSV**: subir → vista previa (válidas / con error / sin cambios) → confirmar. Columnas: `legajo, nombre, dni, sede, sedes_adicionales, puesto, empresa, contratista, ingreso, tareas`. Sedes, puestos y tareas se vinculan por nombre; varios valores en una celda (`sedes_adicionales`, `tareas`) van separados por `|`. Si un nombre no existe, la vista previa lo lista como **"se creará"** y se crea solo al confirmar (nunca en silencio). Solo `tenant_admin` puede confirmar creaciones.
- `SitePicker` y `PersonPicker` reutilizables: búsqueda por nombre o legajo, filtro por sede, solo activos.
- Copy según identidad SGI (skill `sgi-frontend-identity`): qué es, qué hacer, sin jerga.

## Acceptance tests (ejemplos)

- Legajo duplicado en el mismo tenant → error; mismo legajo en otro tenant → permitido.
- Reimportar el mismo CSV → 0 creadas, N sin cambios; cambiar el puesto de una fila → 1 actualizada.
- CSV con 500 filas y 3 inválidas → vista previa con 497 válidas y 3 errores con su número de fila.
- Dar de baja una sede con personas activas → bloqueado con el listado.
- Persona inactiva: no figura en `PersonPicker`, sí en su ficha histórica.
- Persona con sede base A y adicional B aparece al filtrar por A y por B.
- CSV con una sede inexistente → la vista previa la marca "se creará"; sin confirmar, no se crea.
- Tenant A no puede leer ni modificar sedes ni personas del tenant B.

## Fuera de alcance

Datos de salud, aptitud médica, nómina/sueldos, sincronización con sistemas de RR.HH., migración de `Finding.location`, alta de usuarios desde la persona (se hace en `/users`).

## Plan vertical (Task 14)

1. 14.1 Prisma + dominio + tests (unicidad, CSV, baja con dependientes, aislamiento).
2. 14.2 UI de sedes, puestos y tareas.
3. 14.3 Personas + importación CSV.
4. 14.4 Pickers + política de permisos + e2e + README.

## Decisiones del PO (2026-10-01)

1. El personal puede rotar entre sedes → sede base + sedes adicionales.
2. El DNI no se oculta.
3. El CSV puede crear sedes y puestos faltantes (con confirmación en la vista previa).

## Aprobación

- [x] Aprobado por el PO (2026-10-01)
