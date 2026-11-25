# Spec: `due-dates` — Vencimientos y avisos (reemplaza «Automatizaciones»)

**Estado:** APROBADO por el PO el 2026-11-25 (decisiones D1–D11, mapa V0–V8)
**Reemplaza:** pantallas de Task 9 (`automation-offers`)
**Fuera de alcance:** envío real de mail, WhatsApp, reglas automáticas configurables («cuando pasa X, hacer Y»), vista calendario, exportar CSV, preferencias por usuario, adjuntos en vencimientos propios

---

## 1. Objetivo

Que cualquier persona de la empresa entre y sepa en 10 segundos **qué vence, quién lo resuelve y dónde se resuelve**, y que el sistema le avise sin que nadie configure nada.

| Usuario | Necesidad |
|---|---|
| Responsable de un ítem | Ver lo suyo, ir directo a resolverlo, pedirle a la agenda más plazo dejando el motivo |
| Administrador de la empresa | Ver todo, asignar lo que no tiene responsable, saber qué está trabado, ajustar los avisos |
| Consulta / colaborador | Ver el estado de la empresa |
| Superusuario | Confirmar que el control diario corrió y qué falló |

### Problemas que resuelve (verificados en el código)

| # | Problema | Dónde |
|---|---|---|
| P1 | La pantalla muestra el motor («ofertas», «scan», «slug», «email stub», JSON) y el cliente no puede hacer nada | `t/[slug]/automations`, `platform/automations` |
| P2 | Una empresa nueva no recibe avisos: la activación es manual y el alta no la hace | `setOfferActivation` |
| P3 | Cualquier integrante lee las notificaciones personales de todos, con la causa raíz de los hallazgos | `listTenantNotifications` |
| P4 | No hay bandeja: `readAt` no se usa y no hay acceso desde el encabezado | `InAppNotification` |
| P5 | Vencimientos de inspecciones, equipos, capacitaciones, proveedores, seguridad vial y exposición sin etiqueta ni enlace | `DUE_ROUTES` en `domain/dashboard/summary.ts` |
| P6 | Riesgos y oportunidades (`nextReviewAt`) y licencias de conducir figuran en el hub como vencimientos, pero ninguno crea `DueItem` | `risks.ts`, `opportunities.ts`, `road-drivers.ts` |
| P7 | Lo que vence hoy aparece «Vencido» desde las 21 h del día anterior: hay fechas guardadas a medianoche UTC y otras a fin del día de Argentina | `findings/actions.ts`, `risks/actions.ts` vs. `endOfDayInstant` |
| P8 | Volver a guardar un registro sin cambiar la fecha reinicia el aviso y lo duplica | `upsertOpenDueItemForEntity`, `syncOpenDueItem` |
| P9 | Si el scan se corta después del claim y antes de crear las notificaciones, ese aviso se pierde | `scanDueReminders` |
| P10 | Módulo y oferta son dos interruptores: apagar el módulo deja «Ver todos» en 404 y los avisos siguen | `catalog.ts`, `TenantOfferActivation` |
| P11 | `npm run job:due-scan` no concilia capacitaciones, exposición ni km | `scripts/due-scan.ts` |
| P12 | El mail no sale, pero el simulador escribe direcciones de correo en el log | `mail.ts` |

## 2. Decisiones del PO (2026-11-25)

| # | Tema | Decisión |
|---|---|---|
| D1 | Propósito | «Vencimientos y avisos»: agenda del SGI. Sin reglas configurables |
| D2 | Canal | Solo campanita en la app. El mail queda para otra etapa y la interfaz no lo menciona |
| D3 | Control | Avisos encendidos desde el alta con valores sugeridos; el administrador ajusta por módulo |
| D4 | Vencidos | Recordatorio semanal al responsable; a los 7 días se destaca al administrador |
| D5 | Visibilidad | Todos los integrantes ven todos los vencimientos de la empresa. Las notificaciones son personales |
| D6 | Acciones | Ir a resolver, asignar responsable, reprogramar con motivo. No se resuelve desde la lista |
| D7 | Qué se reprograma | Solo planificación: medidas y verificación de hallazgos, acciones y vencimientos propios |
| D8 | Quién reprograma | Administrador, responsable de proceso y el responsable del ítem (el administrador recibe aviso con el motivo) |
| D9 | Propios | El cliente carga vencimientos propios, con repetición |
| D10 | Aviso al administrador | Un resumen diario. El responsable recibe uno por ítem. Reemplaza, para el administrador, la decisión 1 de `SPEC-fase5-fundacion` |
| D11 | Disparo | Programador externo contra el endpoint autenticado que ya existe. Preferencia: el cron del hosting, que **todavía no está definido**; se elige en la puesta en producción |

### Precisiones confirmadas (2026-11-25)

- S1. **D5 respeta reglas ya firmadas:** no se ven vencimientos de módulos inactivos; el nombre del conductor no se muestra a quien no tiene `manage_road_safety` ni al superusuario (AR-13 y SPEC-road-safety); el superusuario sigue sin ver fichas de salud (D13 de SPEC-accident-stats).
- S2. La anticipación por módulo aplica solo donde el registro no tiene una propia (plantillas de inspección, tipos de activo, equipos, documentos de proveedor y cursos conservan la suya).
- S3. Asignar responsable desde la agenda es solo del administrador y solo en ítems cuyo módulo no define responsable (auditorías, vigencia de documentos, verificación, km). En los demás, «Ir a resolver» lleva a la ficha donde se define.
- S4. Sin hosting definido, nada del código depende de un proveedor. `n8n/` se conserva como una de las opciones. Mientras no haya programador, el control se corre desde la plataforma o con `npm run job:due-scan`.
- S5. No hay clientes en producción; el PO confirmó el 2026-11-25 eliminar `automation_offer` y `tenant_offer_activation` en V4.
- S6. Cargar vencimientos propios: administrador y responsable de proceso. Resolverlos: además, su responsable.

## 3. Mapa de capacidades y orden

| Id | Qué entrega | Depende de |
|---|---|---|
| `V0-privacidad` | Arreglo inmediato de P3 | — |
| `V1-fundacion` | Registro único de tipos, día calendario, fin de duplicados (P5, P7, P8, P11) | — |
| `V2-agenda` | Pantalla Vencimientos, renombre, redirecciones (P1, P10) | V1 |
| `V3-campanita` | Bandeja personal (P4) | V0 |
| `V4-motor` | Encendido por defecto, insistencia, resumen del administrador, cron, pantalla de plataforma (P2, P9, P12) | V1, V3 |
| `V5-acciones` | Asignar y reprogramar con historial | V2, V3 |
| `V6-propios` | Vencimientos propios con repetición | V2 |
| `V7-ajustes` | Pestaña «Avisos» por módulo | V4 |
| `V8-cobertura` | Riesgos, oportunidades y licencias generan vencimiento; hubs de Capacitaciones y Proveedores muestran los suyos (P6) | V1 |

Orden: `V0` → `V1` → `V2` y `V3` → `V4` → `V5`, `V6`, `V7` y `V8`. V0 y V1 van en serie porque tocan modelos compartidos; desde V2 se puede trabajar con hasta 2 sesiones. Un PR por fila.

## 4. Experiencia

**Nombre:** «Vencimientos». **Ruta:** `/t/[slug]/due`. `/t/[slug]/automations` y `/portal/automations` redirigen. Es la primera entrada de la sección Cumplimiento, siempre activa (`alwaysOn`), y el destino de «Ver todos» del inicio.

```
VENCIMIENTOS                                        [+ Nuevo vencimiento]
[ Los míos (7) ]  [ De la empresa (56) ]  [ Avisos ]      ← Avisos: solo admin
Módulo ▾   Sede ▾   Responsable ▾

Vencidos (3)
 ● Calibración de B-02       Equipos      venció hace 9 días   Ana     Ir a resolver →
 ● Informe de auditoría 04   Auditorías   venció hace 2 días   Sin responsable  Asignar · Ir →
Próximos 7 días (4)
 ◐ Seguro AB123CD            Inspecciones  en 3 días           Ana     Ir a resolver →
Próximos 30 días (11) ▾
Más adelante (38) ▾
```

- Cada fila: título, módulo, sede si tiene, fecha en palabras con la fecha exacta, responsable, «Reprogramado N veces» si corresponde, y acciones según permiso.
- «Los míos» es la pestaña inicial. El administrador sin ítems propios entra en «De la empresa».
- Más de 7 días vencido: marca «Trabado».
- Vacíos: «No tenés vencimientos pendientes.» / «La empresa está al día.»
- Filtros en la URL. Paginado por grupo en la base (25 filas); los conteos salen de la base.
- **Campanita** en el encabezado, con la cantidad sin leer. Lleva a `/t/[slug]/notifications`: lista personal, «Marcar todo como leído»; abrir un aviso lo marca y lleva al registro. Sin sondeo: se actualiza al navegar.
- **Plataforma** (`/platform/reminders`, «Avisos»): último control (hora, empresas, avisos, errores en palabras), alerta si pasaron más de 26 h, botón «Controlar ahora» por empresa o todas. Se eliminan el catálogo de ofertas, la activación por empresa y la carga manual.

**Palabras prohibidas en pantalla:** automatización, oferta, scan, run, slug, tenant, stub, entidad, ítem, e-mail o mail.

## 5. Reglas

### Responsable efectivo
`assignedUserId` (agenda) → `ownerUserId` (módulo) → responsable por defecto del módulo (V7) → sin responsable. Solo cuenta si sigue siendo miembro de la empresa.

### Día calendario
`DueItem.dueOn` y `remindOn` (`@db.Date`, día de Argentina) se calculan en una sola función a partir de `dueAt`: medianoche UTC exacta es fecha sin hora y usa su día UTC; cualquier otro instante usa el día en `America/Argentina/Buenos_Aires`.
Vencido ⇔ `dueOn < hoy`. Por vencer ⇔ `remindOn ≤ hoy ≤ dueOn`. Lo usan agenda, panel, hubs y motor. `dueAt` no cambia, para no romper la comparación de los módulos que concilian.

### Avisos al responsable
1. Uno al entrar en «por vencer» y uno al vencer.
2. Si sigue vencido, uno cada 7 días.
3. Cambiar título, sede o responsable no reinicia el aviso. Cambiar `dueOn` o la anticipación, sí. Un nuevo responsable recibe su primer aviso en el siguiente control.
   Excepción (aprobada el 2026-11-25): en Capacitaciones, cambiar el responsable de avisos del módulo no vuelve a avisar, porque enviaría de golpe un aviso por persona (alta silenciosa de `SPEC-training`).
4. Claim y notificación van en la misma transacción por empresa; si una empresa falla, las demás siguen y queda registrado.

### Resumen del administrador
Una notificación por día y administrador, solo si hay algo: vencidos sin resolver, trabados y sin responsable, con enlace a la lista filtrada. Al crear la de hoy se marca leída la anterior: nunca hay dos sin leer. `dedupeKey = admin-summary:<tenantId>:<día>`, única por usuario.

### Reprogramar
- Tipos: `finding_measure`, `finding_verification`, `operational_action`, `custom`.
- Permiso: administrador, responsable de proceso y responsable efectivo. Consulta, nunca. Se valida en el servidor con `tenantId` de la sesión.
- Motivo de 10 a 500 caracteres; fecha nueva ≥ hoy y distinta de la actual; registro de origen abierto (mismas condiciones que su módulo).
- Cambia la fecha en el **registro de origen** mediante una función de su módulo; el `DueItem` se actualiza por la sincronización existente. Todo en una transacción con `DueItemReschedule`.
- Si lo hace el responsable, cada administrador recibe un aviso con fecha anterior, nueva y motivo.

### Propios
Título, notas, fecha, responsable, sede opcional, anticipación (7 por defecto) y repetición (no, mensual, trimestral, semestral, anual). Resolver pide una nota opcional, guarda quién y cuándo, y crea la siguiente ocurrencia desde la fecha **programada**. Fin de mes: 31/01 mensual → 28/02 → 31/03 (se conserva el día original). Se pueden editar y anular con motivo.

## 6. Datos (migraciones aditivas; eliminación al final)

| Cambio | Slice |
|---|---|
| `DueItem.dueOn`, `remindOn` (con backfill) + índices `[tenantId, status, dueOn]`, `[status, remindOn]` | V1 |
| `InAppNotification.kind`, `href`, `dedupeKey` + único `[userId, dedupeKey]` e índice `[userId, tenantId, readAt]`. Las que no tienen `userId` dejan de mostrarse | V3 |
| Eliminar `automation_offer`, `tenant_offer_activation` y activaciones del módulo `automations`. `AutomationRun` se conserva | V4 |
| Eliminar los índices sobre `remindAt`, que ya nadie lee | V4 |
| `DueItem.assignedUserId`; `DueItemReschedule` (tenantId, dueItemId, fromDueOn, toDueOn, reason, actorUserId, createdAt) | V5 |
| `CustomDueDate` (tenantId, title, notes, dueOn, anchorDay, recurrence, ownerUserId, siteId, leadDays, status, completedAt, completedByUserId, completionNote, previousId) + único `[tenantId, previousId]` para no duplicar la siguiente | V6 |
| `TenantReminderSetting` (tenantId, moduleKey, enabled, leadDays?, defaultOwnerUserId?) + único `[tenantId, moduleKey]`. Sin fila valen los sugeridos | V7 |

La migración de `dueOn`/`remindOn` agrega columnas obligatorias y una restricción: no es compatible con el código anterior y se despliega con la aplicación y el control diario detenidos.

## 7. Estructura

```
src/domain/due/registry.ts       tipo → módulo, etiqueta, destino, reprogramable, asignable (única fuente)
src/domain/due/day.ts            dueDay, remindDay, clasificación
src/domain/due/reminders.ts      qué aviso corresponde hoy (puro)
src/domain/due/recurrence.ts     próxima ocurrencia
src/lib/due-items.ts             consultas de agenda, asignar, reprogramar
src/lib/custom-due-dates.ts      vencimientos propios
src/lib/notifications.ts         bandeja personal
src/lib/due-scan.ts              control diario
src/app/(tenant)/t/[slug]/due/   agenda, nuevo, avisos
src/app/(tenant)/t/[slug]/notifications/
src/app/(platform)/platform/reminders/
src/app/api/automation/scan/     POST autenticado (sin cambios); programar diario 07:00 de Argentina
```

`DUE_ROUTES` y los `dueTypes` de `hub.ts` se derivan del registro.

**Estilo:** dominio puro y tipado; el tipo `DueEntityType` es la unión de claves del registro, así crear un vencimiento sin registrarlo no compila:

```ts
export const DUE_REGISTRY = {
  finding_measure: {
    module: "findings",
    label: "Medida de hallazgo",
    path: (_id, parent) => (parent.findingId ? `findings/${parent.findingId}` : "findings"),
    reschedulable: true,
    assignable: false,
  },
  // …
} as const satisfies Record<string, DueTypeDefinition>;

export type DueEntityType = keyof typeof DUE_REGISTRY;
```

Interfaz con `sgi-frontend-identity` (PageFrame, RecordList, StatusChip, EmptyState, Field).

## 8. Comandos

```
npm run wt:setup -- due-v1        # worktree con su base
npm run db:migrate
npm run dev -- -p $PORT
npx tsc --noEmit && npm run lint
npm test
npm run test:e2e
npm run job:due-scan -- <empresa>
```

## 9. Pruebas

| Nivel | Qué |
|---|---|
| Unit | `dueDay` (medianoche UTC, 23:59:59-03, cambio de año), clasificación, avisos 1–3, recurrencia con fin de mes y bisiesto, permisos de reprogramar |
| Unit | Todo tipo del registro tiene módulo existente, etiqueta y destino |
| Integración | Control repetido y concurrente sin duplicar; falla de una empresa no frena a otra; corte entre claim y notificación no pierde avisos; aislamiento entre empresas en agenda, bandeja, asignar y reprogramar; usuario de otra empresa no puede ser asignado |
| Integración | Reprogramar actualiza origen, `DueItem` e historial, o nada |
| E2E | Responsable: campanita → aviso → registro. Administrador: asigna uno sin responsable. Responsable reprograma y el administrador lo ve. Propio mensual: resolver crea el siguiente |
| Rendimiento | Agenda con 5.000 vencimientos: consultas acotadas, sin N+1, menos de 300 ms en la base local |

Pruebas existentes de digest y scan: se adaptan, no se eliminan sin aprobación.

## 10. Criterios de éxito

- [ ] V0: un integrante no ve ninguna notificación dirigida a otra persona, ni en pantalla ni por URL.
- [ ] V1: todo vencimiento muestra módulo y «Ir a resolver» con destino válido; algo que vence hoy no figura vencido en todo el día; guardar dos veces sin cambiar la fecha no genera un segundo aviso.
- [ ] V2: ninguna palabra prohibida en pantalla; los enlaces viejos redirigen; un módulo inactivo no aparece en la lista, los filtros ni los conteos.
- [ ] V3: leer un aviso baja el contador; nadie puede leer ni marcar avisos ajenos.
- [ ] V4: una empresa recién creada recibe avisos sin configuración; dos controles el mismo día no duplican; sin `AUTOMATION_WEBHOOK_SECRET` responde 503 y con uno inválido 401; más de 26 h sin control se ve en la plataforma; no se escriben correos en el log.
- [ ] V5: reprogramar una calibración es imposible también llamando a la acción directamente; toda reprogramación queda con autor, fechas y motivo.
- [ ] V6: resolver dos veces a la vez crea una sola ocurrencia siguiente.
- [ ] V7: apagar los avisos de un módulo no oculta sus vencimientos.
- [ ] V8: fijar la próxima revisión de un riesgo crea su vencimiento y cerrarlo lo cierra; un colaborador no ve el nombre del conductor.
- [ ] Prueba de comprensión: alguien que nunca usó la sección dice para qué sirve y resuelve un vencimiento sin ayuda.

## 11. Límites

- **Siempre:** `tenantId` de la sesión en cada consulta; permiso en el servidor; la fecha vive en el registro de origen; textos en español claro; suite completa antes del PR.
- **Preguntar antes:** sumar tipos reprogramables; cualquier proveedor de mail; dependencias nuevas.
- **Nunca:** cerrar un registro desde la agenda; reprogramar vigencias, calibraciones, seguros, capacitaciones o plazos de terceros; mostrar notificaciones ajenas; crear avisos para módulos inactivos.

## 12. Pendientes

- Hosting y programador del control diario (D11): antes de la puesta en producción.
