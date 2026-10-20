# Spec: base común de la Fase 5

**Estado:** aprobado por el PO el 2026-10-20 (decisiones abajo)
**Objetivo:** dejar resueltos, en serie y en un solo PR, los puntos que comparten todos los módulos de la Fase 5 (Tasks 15–20), para que después se construyan en paralelo sin tocar los mismos modelos ni degradar la performance.

## Decisiones del PO (2026-10-20)

1. **Avisos de vencimientos:** un resumen diario por persona. Cada responsable recibe sus vencimientos; los administradores reciben el resumen de la empresa, agrupado por sede. En la app se siguen viendo de a uno.
2. **Menú:** se agrupa por secciones y el superusuario activa qué módulos usa cada empresa. Cada cliente ve solo lo suyo.
3. **Vista por requisito ISO:** por ahora solo el contrato. Cada módulo declara qué cláusulas cubre; la pantalla por requisito se arma cuando haya módulos de la Fase 5 que la alimenten.
4. **Módulo viejo de NC:** se elimina (código, tests y tablas `nonconformity` y `corrective_action`). No hay datos en ningún entorno.

## Alcance

### 1. Vencimientos: datos para agrupar y contar en la base

`DueItem` suma:
- `remindAt` = `dueAt − leadDays` días, indexado. Es el momento en que pasa a "por vencer"; equivale a `classifyDueWindow` (`upcoming` ⇔ `remindAt ≤ ahora ≤ dueAt`). Se recalcula en cada alta o cambio de `dueAt` o `leadDays`.
- `ownerUserId?`: quién tiene que resolverlo. Hoy se completa en las medidas de hallazgos, las acciones y los indicadores.
- `siteId?` y `personId?`: para agrupar por sede o persona. Los usan los módulos de la Fase 5; hoy quedan vacíos.

Los tres vínculos van con `onDelete: SetNull`. Migración con backfill de `remindAt`.

### 2. Scan de vencimientos con resumen diario

- Consulta solo los vencimientos abiertos con `remindAt ≤ ahora`, sin cargar las membresías por ítem. La oferta activa se resuelve una vez por empresa.
- El claim por ítem no cambia (`lastReminderKind`), así que un reintento no duplica.
- **En la app:** una notificación por vencimiento, para el responsable si lo hay, o para la empresa si no. Ya no se duplica una por administrador.
- **Por mail:** uno por persona y por corrida.
  - El responsable recibe sus vencimientos.
  - Cada `tenant_admin` recibe todos los de la empresa, agrupados por sede ("Sin sede" si no tiene).
  - Si una persona es las dos cosas, recibe un solo mail.

### 3. Panel sin carga completa

`getTenantDashboard` cuenta en la base (vencidos: `dueAt < ahora`; por vencer: `remindAt ≤ ahora ≤ dueAt`) y trae solo los 8 que muestra.

### 4. Origen del hallazgo

`Finding.origin`, un enum `FindingOrigin`:
- valores con origen hoy: `manual`, `internal_audit`, `external_audit`, `indicator`;
- valores reservados para la Fase 5: `inspection`, `incident`, `supplier`.

El valor por defecto es `manual`. Backfill: auditoría interna o externa según `Audit.kind`; `indicator` si `source` empieza con "Indicador ". `source` sigue siendo la etiqueta legible.

Regla para la Fase 5: el vínculo con el registro de origen va **del lado del módulo** (por ejemplo `IncidentRecord.findingId`), así no se editan columnas de `Finding` en paralelo.

### 5. Acciones

Todo seguimiento nuevo de la Fase 5 (la corrección simple de una inspección, el plan de mejora de un proveedor, la acción por una capacitación no eficaz) usa `Action`. No se crean modelos de acción nuevos. Se elimina el módulo viejo de NC; `/operations` sigue redirigiendo a Hallazgos.

### 6. Módulos por empresa y menú agrupado

- **Catálogo en código** (`src/domain/modules/catalog.ts`): clave, nombre, sección, ruta, cláusulas ISO que cubre (el contrato del punto 3) y si viene activo por defecto.
- **Secciones:**
  - Cumplimiento: Documentos, Auditorías.
  - Mejora: Hallazgos, Riesgos y oportunidades, Objetivos.
  - Operación SST: los módulos de la Fase 5.
  - Personas y terceros: Datos maestros y los de la Fase 5.
  - Administración: Automatizaciones, Usuarios.
- **Activación:** modelo `TenantModuleActivation` (empresa × módulo, activo). Sin fila, vale el valor por defecto del catálogo. Los módulos existentes vienen activos y los de la Fase 5 vendrán inactivos. Panel y Usuarios no se pueden desactivar.
- **Efecto de desactivar un módulo:** desaparece del menú, y sus páginas responden 404. No reemplaza los permisos por rol: es un recorte de alcance del cliente, no un control de seguridad.
- **Gestión:** el superusuario activa y desactiva módulos desde la ficha de la empresa en la plataforma.

## Fuera de alcance

- La pantalla de estado por requisito ISO.
- Pasar `Finding.location` a `siteId`.
- Unificar `FindingMeasure` con `Action`.
- Enviar mails reales (sigue el stub).

## Criterios de aceptación

- [ ] El scan no envía más de un mail por persona por corrida, y un reintento no duplica avisos ni notificaciones.
- [ ] El Panel no carga todos los vencimientos abiertos: cuenta en la base y trae 8.
- [ ] Los hallazgos existentes quedan con su origen correcto después de la migración.
- [ ] Una empresa con un módulo desactivado no lo ve en el menú y su URL da 404; al reactivarlo vuelve todo.
- [ ] Las cláusulas que declara cada módulo existen en el catálogo ISO sembrado.
- [ ] No queda código ni tabla del módulo viejo de NC.
- [ ] Lint, tsc, vitest y e2e en verde, también en CI.
