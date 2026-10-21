# Spec: `inspections` — Motor de inspecciones y registro de activos (Task 15)

Estado: **borrador para aprobación del PO** (2026-10-21). Depende de la Task 14 (datos maestros) y de la base común de la Fase 5 (`SPEC-fase5-fundacion.md`). Investigación normativa en `RESEARCH-inspections.md`; las marcas [A] / [B] / [C] de este documento remiten a su sección 0.

## Objective

Que el cliente controle sus equipos y sus áreas de trabajo con **inspecciones simples, ordenadas y con evidencia**, y que de cada inspección salgan solas las consecuencias: el resultado, el estado del activo, el próximo vencimiento y el seguimiento de lo que está mal. Sirve de evidencia para ISO 45001 §8.1 y §9.1.1, ISO 14001 §9.1.1 (y §8.1 en el obrador) e ISO 9001 §7.1.3.

Un solo motor para todos los tipos: **plantilla con versiones + inspección que guarda la versión usada + reglas puras para el resultado**. Los tipos (extintores, obradores, equipos pesados, vehículos livianos, auditoría de campo, arneses) son **datos precargados**, no módulos aparte. Un tipo nuevo es una plantilla más y, si es sobre un activo, el esquema de sus atributos.

### Success criteria

- Un extintor sin novedades se inspecciona desde el celular (375 px) en menos de un minuto, unos 20 toques.
- El resultado de la inspección, el estado del activo y la próxima fecha salen de funciones puras. Ninguno se edita a mano.
- Editar una plantilla no cambia ninguna inspección ya hecha.
- Cerrar dos veces la misma inspección (doble toque, reintento de red) no duplica acciones, hallazgos ni vencimientos.
- Con 1.000 activos, 3.000 programas y 12.000 inspecciones en una empresa, cada listado hace una cantidad **constante** de consultas (no crece con el tamaño de la página) y los contadores se calculan en la base.
- Dos empresas nunca ven los activos ni las inspecciones de la otra.
- Ninguna plantilla precargada supera 25 ítems aplicables (control previo al uso: 15, o 20 con izaje).

## Decisiones a confirmar (defaults propuestos)

| # | Decisión | Default propuesto | Por qué |
|---|---|---|---|
| 1 | Plantillas por tipo | Una plantilla por **tipo de control**, no por tipo de activo: pesados y livianos tienen una de *control previo al uso* (corta, la hace el operador) y una *periódica* (la hace SST). Son 8 plantillas para 6 tipos | Mezclar ambos controles produce checklists largos que nadie lee (RESEARCH §5) |
| 2 | Frecuencia de extintores | Control **mensual** por defecto; la plataforma avisa si se configura más de 3 meses y no lo permite | IRAM 3517-2 §8.2 pide mínimo trimestral; mensual es obligatorio en obras (Dec. 911 art. 90) [A] |
| 3 | "Carga anual" de extintores | Se llama **mantenimiento** (anual; semestral para polvo químico en vehículos). La prueba hidráulica es de 5 años y de 2 años para extintores a base de agua | `todo.md` habla de carga; IRAM habla de mantenimiento, y la recarga es por uso [A] |
| 4 | Extintor con mantenimiento vencido | **Mayor** (observación + acción de envío a mantenimiento). Prueba hidráulica vencida: **crítico** | Botta/IRAM: el mantenimiento vencido se analiza caso por caso; la PH vencida exige retiro inmediato [A, secundaria]. `todo.md` pone ambos como "no apto" |
| 5 | Qué crea una NC | Siempre **una `Action` por inspección** (responsable y plazo). El **hallazgo borrador** solo si la plantilla lo indica: sí en obrador, pesados, livianos y campo; **no** en extintores ni arneses (se puede escalar a mano) | Un precinto faltante por mes en 200 extintores no debe generar 200 hallazgos |
| 6 | Quién libera un activo fuera de servicio | La **reinspección periódica** apta (o apta con observaciones) cerrada por un usuario con rol `process_owner` o superior. El control previo al uso nunca libera | Que el operador no pueda "arreglar" lo que dejó parado SST |
| 7 | Baja por vida útil vencida (arneses) | Se **deriva**, no se muta en silencio: el activo figura "Vida útil vencida: dar de baja", no puede cerrarse una inspección apta sobre él y se pide la baja. No hay un proceso que cambie estados solo | `todo.md` dice "baja automática"; un cambio sin persona es difícil de auditar. Se puede automatizar después |
| 8 | Arneses: baja definitiva | Un arnés o cabo **no apto pasa a "dado de baja"** (no vuelve). La evidencia de destrucción es una foto que se adjunta después (la acción la pide) | Un cabo dañado no se repara [B] |
| 9 | Vida útil de arneses | Dato **por activo** (fecha de fin) que se carga al dar de alta; sugerido: fecha de fabricación + años configurables por empresa (inicial 5, a validar). Manda lo que diga el fabricante | Sin norma argentina verificada [C] |
| 10 | Control previo al uso | **No genera vencimientos** (`DueItem`). La ficha muestra "último control previo: hace N días" | 100 vehículos × diario = 100 vencimientos nuevos por día |
| 11 | Operador sin usuario | La inspección lo registra un usuario (`inspectorUserId`) y puede indicar "realizado por" una **persona** (`performedByPersonId`) | Persona ≠ Usuario: muchos operadores no tienen login |
| 12 | Firma | "Cerrar y firmar" guarda usuario y fecha; no hay firma manuscrita | Evidencia suficiente y simple en celular |
| 13 | Foto en NC | Obligatoria en NC **crítica y mayor**; opcional en menor (editable por ítem en la plantilla) | `todo.md` la pide en toda NC; fotos en 6 NC menores frenan la carga. Si no se puede fotografiar, se explica en el comentario |
| 14 | Fecha de la inspección | La que se elige, no futura y hasta 7 días atrás (carga diferida) | Hay que poder cargar lo hecho ayer sin señal |
| 15 | Importación CSV de activos | Por tipo. La **sede debe existir** (si no, error de fila); no crea sedes. Reimportar actualiza por código. Máximo 1.000 filas | Crear sedes desde un CSV de activos ensucia los datos maestros |
| 16 | Sin "todo conforme" global | Hay "Sección conforme" (para las secciones sin ítems críticos); los críticos se marcan uno por uno | Contra la inspección "de papel" (RESEARCH §5) |
| 17 | Acceso a Activos | Ruta propia `/t/[slug]/assets`; visible si **Inspecciones o Equipos de medición** están activos; el menú muestra solo "Inspecciones" y Activos es una pestaña | La Task 16 reutiliza el registro de activos |
| 18 | Auditoría de campo: programa | Meta mensual de auditorías **por sede y plantilla** (tabla propia, en el paso de esa plantilla) | Cumplimiento del programa por sede |
| 19 | Orden de construcción de los tipos | Extintores → obrador → livianos → arneses → pesados → campo | El obrador prueba el camino sin activo; livianos habilita la Task 18; pesados trae izaje |
| 20 | Validación profesional | Las plantillas se construyen ya, pero **no se activan en producción** hasta que un profesional de HyS revise el anexo (criticidad, frecuencias) | Hay cuestiones sin verificar (RESEARCH §8) |

## Domain model (conceptual)

Todo con `tenantId` y lecturas por los helpers tenant-scoped existentes. Los tipos de activo viven en **código** (`src/domain/inspections/types/*`: clave, etiqueta, esquema zod de atributos, vencimientos que lleva, política); las **plantillas** viven en la **base**, porque el cliente las edita.

### Activos

- **Asset**: `typeKey` (`extinguisher` / `heavy_equipment` / `light_vehicle` / `fall_protection`), `code` (único por tenant, ≤ 30 caracteres, se guarda en mayúsculas), `description`, `siteId` (sede, obligatoria), `sector` (texto libre), `status` (`in_service` / `out_of_service` / `retired`), `statusReason`, `statusChangedAt`, `ownership` (`own` / `rented` / `contractor`) y `contractorName` (igual que `Person`; `supplierId` llega con la Task 19), `assignedPersonId?` (persona, nunca usuario), `attributes` (JSON validado por el esquema zod del tipo; versión del esquema guardada), `retiredAt?`, `retirementReason?`. Índices: `[tenantId, code]` único, `[tenantId, typeKey, status]`, `[tenantId, siteId, status]`. Un activo con inspecciones **no se borra**: se da de baja.
- **AssetDueDate**: vencimientos documentales del activo. `assetId`, `kind` (clave del tipo: `maintenance`, `hydrostatic_test`, `hose_test`, `insurance`, `rto`, `lifting_certification`, `lifting_review`, `service`, `satellite_monitoring`, `service_life_end`), `dueAt` (fecha), `lastDoneAt?`, `reference?` (n.º de certificado o comprobante), `blocking` (si vencido impide el uso; viene del tipo). Único `[assetId, kind]`. Cada uno mantiene **un** `DueItem` abierto (`entityType = asset_due_date`).
- **AssetStatusEvent**: historial de cambios de estado (`assetId`, desde, hasta, `reasonCode`, `inspectionId?`, `byUserId`, fecha, nota). Responde "¿por qué está fuera de servicio y quién lo dijo?".

### Plantillas

- **InspectionTemplate**: `key` (estable: `extinguisher_periodic`, `site_obrador`, `heavy_pre_use`, `heavy_periodic`, `light_pre_use`, `light_periodic`, `field_audit`, `fall_protection_periodic`), `name`, `scope` (`asset` / `area` / `activity`), `assetTypeKey?`, intervalo (`intervalUnit` días o meses, `intervalValue`; nulo = control previo al uso o sin calendario), `leadDays`, `reinspectionDays` (default 7), `findingOnCritical`, `canReinstate`, `retireOnUnfit`, `activeVersionId`, `active`. El tenant edita nombre, intervalo, `findingOnCritical` e ítems; `canReinstate` y `retireOnUnfit` los fija el tipo. Se siembran con las constantes del anexo la primera vez que se activa el módulo (función idempotente `ensureDefaultTemplates`). Único `[tenantId, key]`.
- **InspectionTemplateVersion**: `version` (entero creciente), `createdByUserId`, nota. **Inmutable**: nunca se actualiza ni se borra. Editar crea la versión siguiente. Las inspecciones en borrador conservan la versión con la que empezaron.
- **InspectionTemplateItem**: `versionId`, `code` (estable entre versiones, permite comparar), `section`, `sortOrder`, `text`, `help?`, `criticality` (`critical` / `major` / `minor`), `kind` (`check` conforme / no conforme / N/A; `number` con `unit`, `minValue`, `maxValue`; `text` sin puntaje; `reading` odómetro u horómetro, sin puntaje), `naAllowed`, `photoOnNc`, `required`, `readingKey?` (`odometer_km` / `hours`), `autoSource?` (el valor lo deriva el sistema, p. ej. `{ dueKind: "hydrostatic_test" }`), `appliesWhen?` (condición sobre un atributo del activo o un dato de contexto: `{ source, key, equals | includes }`). Único `[versionId, code]`.

### Inspecciones

- **Inspection**: `templateId`, `versionId`, `assetId?` o `siteId` (siempre se guarda la sede), `sector?`, contexto de auditoría de campo (`jobTaskId?`, `contractorName?`, `supervisorPersonId?`, `specialTasks[]` entre `height` / `confined_space` / `lifting`), `inspectorUserId`, `performedByPersonId?`, `status` (`draft` / `closed`), `startedAt`, `inspectedAt`, `closedAt?`, `result?`, `scorePct?`, contadores `applicableCount` / `conformCount` / `nonconformCount`, `readingKm?` / `readingHours?` (copia de las lecturas al cerrar, para consultas y para la Task 18), `findingId?` (único) y `actionId?` (único): los vínculos van del lado del módulo, sin tocar columnas de `Finding` ni de `Action`. Índices: `[tenantId, status, inspectedAt desc]`, `[tenantId, siteId, inspectedAt desc]`, `[tenantId, assetId, inspectedAt desc]`, `[tenantId, templateId, inspectedAt desc]`, `[tenantId, result, inspectedAt desc]`.
- **InspectionAnswer**: una fila por ítem **aplicable**, creada al abrir el borrador (así "completa" es "ninguna sin responder"). `value?` (`conform` / `nonconform` / `na`), `numberValue?`, `textValue?`, `comment?`, `autoDerived`, `answeredAt`. Único `[inspectionId, itemId]`.
- **InspectionAttachment**: sigue el molde de `FindingAttachment` (`storageKey`, `fileName`, `contentType`, `sizeBytes`, `label`, `uploadedById`). `inspectionId?`, `answerId?`, `assetId?` (al menos uno de `inspectionId` o `assetId`), `kind` (`photo` / `evidence` / `destruction`). Se redimensiona en el cliente a 1.600 px, máximo 5 fotos por respuesta y 40 por inspección.
- **InspectionCorrection**: corrección de una inspección **cerrada** (patrón `MeasurementCorrection`): `inspectionId`, `answerId`, valor anterior y nuevo, `reason` (mínimo 10 caracteres), `byUserId`, fecha. Una inspección cerrada no se edita. Al corregir se recalcula el resultado (ver `assetStatusAfter`, caso de corrección).
- **InspectionPlan** (programa y lectura rápida): una fila por `(plantilla, sujeto)` para las plantillas con intervalo; el sujeto es un activo o una sede (`subjectKey`). Guarda `lastInspectionId`, `lastInspectedAt`, `lastResult`, `nextDueAt`. Único `[templateId, subjectKey]`, índices `[tenantId, nextDueAt]` y `[tenantId, templateId, lastInspectedAt]`. Evita agregaciones sobre la tabla grande de inspecciones: "vencidas", "pendientes de la ronda" y "último resultado" salen de acá. Se crea al dar de alta el activo (por cada plantilla periódica de su tipo) o al programar un obrador en una sede.
- **InspectionTarget** (solo en el paso de auditoría de campo): `templateId`, `siteId`, `monthlyTarget`.

### Seguimientos y vencimientos

- El **seguimiento** de una NC es una `Action` (`Inspection.actionId`): título, descripción con la lista de ítems no conformes, responsable, plazo. Si hay hallazgo, se vincula a la acción con `ActionLink` (`target = finding`, ya existe). No se agrega ningún valor al enum `ActionLinkTarget`.
- El **hallazgo derivado**: `Finding` en borrador, `origin = inspection`, `source` = nombre legible; uno por inspección, con todas las NC críticas en la descripción. `Inspection.findingId` lo apunta.
- Los **vencimientos** son `DueItem` (`ownerUserId`, `siteId`, `personId` ya existen): uno por programa (`entityType = inspection_plan`), uno por `AssetDueDate` y los de las acciones. El responsable es el usuario de la persona asignada, si tiene; si no, queda sin responsable y lo ve el administrador en el resumen de su sede. El resumen diario agrupado por sede ya existe (base común).

### Funciones puras (`src/domain/inspections/`)

#### `deriveInspectionResult(items, answers)`

Entrada: ítems aplicables (criticidad, tipo, `naAllowed`, `required`, límites) y respuestas. Salida: `{ complete, missingItemIds, applicable, conform, nonconform, nonconformByCriticality, scorePct, result }`.

Reglas:
- `check`: cuenta la respuesta. `number`: se deriva (dentro de `[min, max]` es conforme; fuera, no conforme, con la criticidad del ítem). `text` y `reading`: no puntúan (pero si son `required` bloquean el cierre vacíos).
- `na` no entra en "aplicables". Un `autoSource` pisa cualquier respuesta manual.
- `result`: algún crítico NC → `unfit`; si no, algún NC (mayor o menor) → `fit_with_observations`; si no, `fit`.
- `scorePct = conformes / aplicables × 100`, un decimal; es informativo. Ponderar por criticidad queda fuera: ocultaría un crítico en un puntaje alto.
- Incompleta → `result = null`; no se puede cerrar. Sin aplicables → error `no_applicable_items`.

| # | Caso | Resultado |
|---|---|---|
| 1 | 20 conformes | `fit`, 100,0 |
| 2 | 19 conformes + 1 NC menor | `fit_with_observations`, 95,0 |
| 3 | 18 conformes + 1 NC mayor + 1 NC crítica | `unfit`, 90,0 |
| 4 | 10 N/A + 5 conformes + 1 NC crítica | `unfit`, 83,3 (5 de 6) |
| 5 | 2 conformes + 1 NC menor | `fit_with_observations`, 66,7 |
| 6 | Todo N/A | error `no_applicable_items` |
| 7 | Un ítem sin responder | `complete = false`, `result = null` |
| 8 | Presión 14 bar, rango 12–15 | conforme |
| 9 | Presión 16 bar, rango 12–15, ítem crítico | NC crítica → `unfit` |
| 10 | Presión sin cargar, rango definido | incompleta |
| 11 | PH vencida (`autoSource`) y el inspector marca "conforme" | pisa la respuesta: NC crítica → `unfit` |
| 12 | Lectura de odómetro y un texto de observación | no cuentan ni puntúan |
| 13 | N/A en un ítem con `naAllowed = false` | error de entrada |
| 14 | Dos respuestas para el mismo ítem | error de entrada |

Una segunda función pura, `validateInspectionForClose`, informa los bloqueos que no son de resultado: NC crítica o mayor sin foto (cuando `photoOnNc`), NC sin comentario, lectura menor que la anterior sin confirmación, fecha futura o con más de 7 días, activo dado de baja.

#### `nextInspectionDue({ inspectedAt, result, interval, reinspectionDays, retireOnUnfit })`

Fechas de calendario en la zona horaria de la empresa. Salida: `{ dueAt | null, kind: "periodic" | "reinspection" | "none" }`.

| # | Caso | Resultado |
|---|---|---|
| 1 | `fit`, mensual, 2026-03-15 | 2026-04-15, `periodic` |
| 2 | `fit_with_observations`, mensual, 2026-01-31 | 2026-02-28 (se ajusta al fin de mes) |
| 3 | `fit`, 6 meses, 2026-08-31 | 2027-02-28 |
| 4 | Semanal, 2026-10-21 | 2026-10-28 |
| 5 | `unfit`, mensual, 2026-10-21, reinspección 7 días | 2026-10-28, `reinspection` |
| 6 | Reinspección `fit` el 2026-10-27 | 2026-11-27, `periodic` (cuenta desde esa fecha) |
| 7 | Cerrada tarde (después del vencimiento) | `inspectedAt + intervalo`; no se recuperan períodos |
| 8 | Cerrada antes de tiempo | `inspectedAt + intervalo`; el calendario se reinicia |
| 9 | Intervalo nulo (control previo al uso) | `null`, `none` |
| 10 | `unfit` con `retireOnUnfit` (arnés) | `null`, `none`; el programa se cierra |
| 11 | Activo dado de baja | `null`, `none` |

El vencimiento de un `AssetDueDate` y el estado "vigente / por vencer / vencido" usan la misma regla de la base común (`remindAt = dueAt − leadDays`). Una tercera función, `assetCompliance(dueDates, now)`, devuelve `ok`, `expiring` o `blocked` (algún vencimiento con `blocking` vencido); es un dato derivado para mostrar, no un estado guardado.

#### `assetStatusAfter({ current, result, policy, canRelease, origin })`

`policy = { retireOnUnfit, canReinstate }` (de la plantilla); `canRelease` = el usuario tiene rol `process_owner` o superior; `origin` = `close` o `correction`. Salida: `{ status, change: null | { from, to, reasonCode } }`.

| # | Estado actual | Resultado | Política / permiso | Estado nuevo | Motivo |
|---|---|---|---|---|---|
| 1 | `in_service` | `fit` | | `in_service` | sin cambio |
| 2 | `in_service` | `fit_with_observations` | | `in_service` | sin cambio |
| 3 | `in_service` | `unfit` | no retira | `out_of_service` | `inspection_unfit` |
| 4 | `in_service` | `unfit` | `retireOnUnfit` | `retired` | `inspection_unfit_retired` |
| 5 | `out_of_service` | `unfit` | | `out_of_service` | sin cambio (no se duplica el evento) |
| 6 | `out_of_service` | `fit` | `canReinstate` y `canRelease` | `in_service` | `reinstated` |
| 7 | `out_of_service` | `fit_with_observations` | `canReinstate` y `canRelease` | `in_service` | `reinstated` |
| 8 | `out_of_service` | `fit` | `canReinstate` y **no** `canRelease` | `out_of_service` | queda "pendiente de liberación" |
| 9 | `out_of_service` | `fit` | control previo al uso (`!canReinstate`) | `out_of_service` | sin cambio |
| 10 | `in_service` | `unfit` | control previo al uso | `out_of_service` | `inspection_unfit` (el operador puede parar un equipo) |
| 11 | `retired` | cualquiera | | `retired` | terminal; no se crean inspecciones sobre un activo dado de baja |
| 12 | cualquiera | corrección que **empeora** a `unfit`, sobre la última inspección cerrada | | como casos 3 y 4 | `correction_unfit` |
| 13 | cualquiera | corrección que **mejora** el resultado | | sin cambio | liberar exige una reinspección, no una corrección |

### Consecuencias de cerrar una inspección (una transacción)

1. Se cierra con comparación y cambio (`status = draft` → `closed`); si ya estaba cerrada devuelve lo hecho (idempotente).
2. Se calcula el resultado y el puntaje; se guardan las lecturas.
3. Se aplica `assetStatusAfter` y se registra un `AssetStatusEvent`.
4. Se actualiza el `InspectionPlan`, se cierra el `DueItem` abierto y se crea el siguiente según `nextInspectionDue`. La búsqueda "¿hay uno abierto?" se hace con el programa bloqueado, para no duplicar.
5. Si hay NC: se crea la `Action` (responsable y plazo propuestos: crítica 48 h, mayor 7 días, menor 30 días; el inspector puede cambiarlos al cerrar). Si hay NC crítica y la plantilla lo pide: `Finding` borrador (`origin = inspection`) y `ActionLink`.
6. Si el activo salió de servicio, la acción incluye "retirar y señalizar el equipo" (y "reponer", en extintores). En arneses dados de baja, "destruir y adjuntar foto".
7. Registro de auditoría: quién, cuándo y qué cambió.

## Permisos

| Rol | Activos | Inspecciones | Plantillas | Liberar un activo |
|---|---|---|---|---|
| `tenant_admin` | alta, edición, baja, importación | crear, cerrar, corregir | editar | sí |
| `process_owner` | alta, edición, baja | crear, cerrar, corregir (con motivo) | solo lectura | sí |
| `contributor` | lectura | crear y cerrar las propias | solo lectura | no |
| `viewer` | lectura | lectura | sin acceso | no |

Las fotos y los datos de la persona asignada (nombre, legajo) son visibles para quien ve el activo; no se guardan datos de salud, licencias ni DNI en este módulo. Módulo apagado = menú sin la entrada y páginas con 404 (base común). Toda alta, edición, baja, corrección y cambio de estado deja registro de auditoría.

## Qué ve el cliente

Pocas pantallas, pensadas primero para el celular de 375 px. Copy según la identidad SGI: qué es, qué hacer, sin jerga.

1. **Inspecciones** (`/t/[slug]/inspections`): arriba, cuatro contadores (*vencidas*, *no aptas*, *activos fuera de servicio*, *próximas 7 días*) que filtran la lista al tocarlos. Botón grande **Nueva inspección**. Lista paginada de 25 con filtros por tipo, sede, activo, inspector, resultado y fechas, y **Exportar CSV**. Pestañas: Inspecciones · Activos · Plantillas (admin) · Guía.
2. **Nueva inspección** (celular, paso a paso): 1) qué se inspecciona (tipo y activo con búsqueda por código, o sede y sector); 2) el listado por secciones, con tarjetas de ítem y **tres botones grandes** (Conforme · No conforme · N/A), avance "12 de 22" y guardado automático; una NC abre comentario y foto; las lecturas usan teclado numérico; los ítems automáticos aparecen con su fecha de vencimiento y no se pueden pisar; 3) *Revisar y cerrar*: resultado calculado (no editable) con su explicación ("No apto porque 1 ítem crítico no cumple"), responsable y plazo de la acción propuestos, **Cerrar y firmar**. Al cerrar, **Siguiente activo pendiente** de la misma sede (la ronda).
3. **Ficha de la inspección**: resultado, puntaje, respuestas, fotos, hallazgo y acción vinculados, correcciones. **Corregir** (con motivo) para `process_owner` y administradores. Vista imprimible.
4. **Activos** (`/t/[slug]/assets`): lista paginada con búsqueda por código y filtros por tipo, sede y estado, con semáforo de estado y de vencimientos. Alta con formulario por tipo; **Importar CSV** (vista previa de válidas, con error y sin cambios, como en datos maestros).
5. **Ficha del activo**: datos y atributos, estado con motivo y quién lo puso, vencimientos documentales con **Renovar** (nueva fecha y comprobante), "último control previo", historial de inspecciones y botón **Inspeccionar**.
6. **Plantillas** (administrador): lista de las 8 precargadas; al editar se avisa "las inspecciones ya hechas no cambian" y se crea la versión siguiente; ordenar, cambiar criticidad, agregar o quitar ítems (aviso a los 25, tope de 40), **Restaurar la original**, frecuencia.
7. **Guía** (`/inspections/guia`): una página corta: cómo se calcula el resultado, qué significa *no apto*, qué pasa con el activo y qué hacer.

Estados vacíos con una acción clara ("Todavía no hay activos. Importá un CSV o creá el primero").

## Performance

- Listados con paginación por cursor (`inspectedAt`, `id`) de 25 filas; los activos, programas y vencimientos de una página se traen con una consulta por tabla (`IN`), nunca por fila.
- Contadores con `count` y `groupBy` en la base: *vencidas* = programas con `nextDueAt < ahora`; *no aptas* y *fuera de servicio* = cuentas indexadas.
- Los avisos usan el scan existente: un `DueItem` por programa y por vencimiento, y el mail agrupado por sede. **Se debe verificar** que el mail corte la lista a unas 10 líneas por sede con el total ("y 87 más"); si la base común no lo hace, es un ajuste de ese archivo, hecho en un PR aparte.
- Exportación a CSV en tandas por cursor, con tope de 20.000 filas y aviso para afinar los filtros.
- Fotos: reducción en el cliente a 1.600 px y subida directa al almacenamiento existente.
- Datos de ejemplo de prueba: 1.000 activos, 3.000 programas, 12.000 inspecciones, 240.000 respuestas.

## Acceptance tests

Dominio (unit, sin base):
- Las tablas de `deriveInspectionResult`, `nextInspectionDue` y `assetStatusAfter` de arriba, una prueba por fila.
- Esquemas zod de atributos por tipo: aceptan un activo válido y rechazan faltantes (fecha de fabricación del extintor, serie del arnés).
- `appliesWhen` y `autoSource`: un ítem de izaje no aparece en un equipo sin izaje; "PH vigente" sale NC si el vencimiento ya pasó.
- Cada plantilla precargada: tiene ≤ 25 ítems aplicables, códigos únicos, al menos un ítem crítico, y se valida sola.

Integración (con base):
- Cerrar una inspección de extintor con un ítem crítico NC → activo `out_of_service`, `AssetStatusEvent`, una `Action` con responsable y plazo, **sin** hallazgo (extintores), `DueItem` de reinspección en 7 días.
- Cerrar una inspección de vehículo liviano con NC crítica → además un `Finding` borrador con `origin = inspection` y `Inspection.findingId`.
- Cerrar dos veces (o dos pedidos simultáneos) → una sola `Action`, un solo `DueItem` abierto.
- Reinspección apta por un `process_owner` → vuelve a `in_service`; por un `contributor` → queda pendiente de liberación.
- Un arnés no apto → `retired`, sin `DueItem` futuro, con acción de destrucción y foto.
- Editar una plantilla crea la versión 2; la inspección cerrada con la versión 1 muestra los mismos ítems y el mismo resultado; un borrador abierto conserva la versión 1.
- Corrección de una inspección cerrada: queda `InspectionCorrection` con motivo, el resultado se recalcula, una corrección que mejora no libera el activo.
- Renovar un `AssetDueDate` reemplaza su `DueItem` sin duplicar.
- Una lectura de odómetro menor que la anterior exige confirmación.
- No se puede crear una inspección sobre un activo dado de baja.
- Aislamiento: el tenant A no lee, no escribe ni exporta activos, plantillas, inspecciones ni adjuntos del tenant B (incluidos los vínculos a `Finding`/`Action`).
- Roles: `viewer` no crea; `contributor` no libera ni edita plantillas; `process_owner` no edita plantillas.
- Cantidad de consultas del listado de inspecciones y de activos igual con 25 filas que con 5.

e2e (navegador):
- Registrar una inspección de extintor no apta (con foto), verla en la lista, en la ficha del activo y en Hallazgos/Acciones; reinspeccionar y ver el activo volver.
- Importar 20 extintores por CSV con 2 errores; reimportar sin duplicar.
- Módulo desactivado → 404 en `/inspections` y `/assets`.
- Manual en 375 px: cargar una inspección completa con la mano, sin zoom ni scroll horizontal; botones de al menos 48 px.

## Fuera de alcance

Modo sin conexión; lectura de QR o código de barras (la etiqueta con QR por activo se evalúa después); GPS y monitoreo satelital; firma manuscrita; permisos de trabajo como módulo; entrega de EPP; calibración de equipos de medición (Task 16); plantillas nuevas desde cero o tipos de activo nuevos creados por el cliente; puntaje ponderado; umbrales de NC por cantidad; escalamiento automático por reincidencia; PDF generado en servidor; envío real de mails (sigue el stub); datos de salud, licencias o aptitud médica; cruce con capacitaciones (Task 20) y con proveedores (Task 19), salvo dejar el campo de persona y contratista listo.

## Plan vertical (slices verificables)

Cada slice termina con `tsc`, `eslint` y `vitest` en verde. El orden está pensado para que el motor se pruebe de punta a punta con extintores antes de agregar tipos.

**Motor + extintores (15.0–15.7)**
1. **S1 Dominio puro.** Tipos de activo, esquemas zod, `deriveInspectionResult`, `validateInspectionForClose`, `nextInspectionDue`, `assetStatusAfter`, `assetCompliance`, constantes de la plantilla de extintores y validador de plantillas. Solo tests unitarios.
2. **S2 Prisma y registro de activos.** Migración (solo tablas de este módulo), repositorios tenant-scoped, `ensureDefaultTemplates`, `AssetDueDate` + `DueItem`, alta/edición/baja, importación CSV de extintores, ficha del activo. Aislamiento entre tenants.
3. **S3 Registro de la inspección.** Borrador con guardado automático, fotos, lecturas, cierre con firma. Pantalla móvil.
4. **S4 Consecuencias.** `Action`, `Finding` condicional, estado del activo, `InspectionPlan` y `DueItem`, idempotencia, correcciones.
5. **S5 Lista y contadores.** Filtros, contadores en la base, exportación CSV, ficha de la inspección.
6. **S6 Plantillas, guía y activación.** Editor con versiones, `/inspections/guia`, menú. En el catálogo (`src/domain/modules/catalog.ts`) la entrada de Inspecciones pasa a `available` y suma cláusulas (ver abajo). e2e del extintor no apto.

**Un tipo por vez** (cada uno agrega: esquema de atributos, vencimientos, plantilla precargada del anexo, columnas del CSV, e2e y prueba manual en 375 px; son independientes y se pueden paralelizar en worktrees, cada uno con una línea en el registro de tipos)
7. **S7 Zona de obradores** (área sin activo; programa por sede).
8. **S8 Vehículos livianos** (control previo + mensual; odómetro).
9. **S9 Arneses y cabos de vida** (baja definitiva; vida útil).
10. **S10 Equipos y vehículos pesados** (control previo + mensual; izaje).
11. **S11 Auditoría de seguridad en campo** (contexto de tarea; `InspectionTarget`; cumplimiento del programa por sede).

**Cláusulas del catálogo** (verificadas contra el catálogo sembrado): las actuales `ISO45001:8.1`, `ISO45001:9.1.1`, `ISO14001:9.1.1`, más `ISO45001:6.1.2`, `ISO14001:8.1` y `ISO9001:7.1.3`.

**Puerta de producción:** el módulo no se activa en ningún cliente hasta que un profesional de HyS revise el anexo (decisión 20).

## Anexo: plantillas precargadas

Criticidad: **C** crítico, **M** mayor, **m** menor. Respuesta: check = conforme / no conforme / N/A, salvo que se indique. Fuente: [A] confirmado, [B] práctica, [C] a validar (ver `RESEARCH-inspections.md`). Todo lo de este anexo es una **propuesta que debe revisar un profesional de HyS**. Un ítem marcado *auto* lo deriva el sistema.

### Resumen de frecuencias y vencimientos

| Plantilla | Sujeto | Frecuencia | Aviso (días antes) | `DueItem` del calendario | Vencimientos del activo (`AssetDueDate`) |
|---|---|---|---|---|---|
| `extinguisher_periodic` | Extintor | 1 mes (piso normado: 3) | 7 | sí | `maintenance` (1 año; 6 meses si es de polvo en vehículo), `hydrostatic_test` (5 años; 2 si es de agua), `hose_test` (1 año; solo CO₂ o manguera con válvula de control) |
| `site_obrador` | Sede | 7 días | 2 | sí | — |
| `heavy_pre_use` | Equipo pesado | antes de usar | — | no | — |
| `heavy_periodic` | Equipo pesado | 1 mes | 7 | sí | `insurance`, `rto` (si circula), `service`, `lifting_certification` (1 año), `lifting_review` (3 meses, personal especializado; Dec. 351 art. 116) |
| `light_pre_use` | Vehículo liviano | antes de usar | — | no | — |
| `light_periodic` | Vehículo liviano | 1 mes | 7 | sí | `insurance`, `rto`, `service`, `satellite_monitoring` |
| `field_audit` | Frente de trabajo | por meta mensual de la sede | — | no (programa propio) | — |
| `fall_protection_periodic` | Arnés / cabo | 6 meses | 15 | sí | `service_life_end` |

Los vencimientos documentales avisan 30 días antes (15 para `maintenance` y `service`). Los intervalos son configurables por empresa.

### Atributos del activo por tipo

| Tipo | Atributos (obligatorios en negrita) |
|---|---|
| `extinguisher` | **agente** (ABC, BC, CO₂, espuma AFFF, HCFC/halotrón, agua, clase K), **capacidad en kg**, **fecha de fabricación** (IRAM §9.11), n.° de cilindro, empresa recargadora, instalado en (puesto fijo / vehículo), manguera con válvula de control (sí/no) |
| `heavy_equipment` | **tipo** (grúa, hidrogrúa, retroexcavadora, pala, camión, autoelevador), marca, modelo, año, **¿circula por vía pública?**, **¿tiene elementos de izaje?**, horómetro u odómetro inicial, propio / alquilado / contratista |
| `light_vehicle` | **dominio**, marca, modelo, año, propio / alquilado / contratista, persona asignada (conductor), odómetro inicial, ¿tiene barra o jaula antivuelco? |
| `fall_protection` | **tipo** (arnés de cuerpo completo, cabo simple con absorbedor, cabo doble con absorbedor, cabo de posicionamiento, retráctil, mosquetón), marca, modelo, **n.° de serie**, norma de certificación, **fecha de fabricación**, **años de vida útil**, persona asignada |

### T1. `extinguisher_periodic` — Control de extintores (IRAM 3517-2, Dec. 351/79 arts. 184–185)

Política: libera (`canReinstate`); no retira definitivamente; hallazgo solo si se escala. Etiqueta celeste tras el control (no es un ítem: lo recuerda la ayuda del cierre).

| Sección | Ítem | Crit. | Fuente |
|---|---|---|---|
| Ubicación | Está en su puesto, con señalización visible | M | [A] IRAM, Dec. 911 art. 91 |
| Ubicación | Acceso libre y sin obstrucción visual | M | [A] Dec. 911 art. 91 |
| Ubicación | Altura y fijación del soporte o gabinete correctas | m | [A] IRAM |
| Estado | Manómetro en zona verde (no aplica a CO₂) | C | [A] IRAM §8.3.3.2 |
| Estado | Peso de la carga conforme al cilindro (solo CO₂) | C | [A] IRAM |
| Estado | Precinto y pasador de seguridad intactos | C | [A] IRAM §8.3.3.2 |
| Estado | Cilindro sin golpes, corrosión, "panza" ni soldaduras | C | [A] IRAM |
| Estado | Manguera, tobera o difusor completos y sin daño; válvula sin pérdidas | M | [A] IRAM |
| Estado | Ruedas y carro en buen estado (solo sobre ruedas) | m | [A] IRAM |
| Identificación | Instrucciones legibles y de cara al usuario | m | [A] IRAM |
| Identificación | Fecha de fabricación legible | C | [A] IRAM §9.11 |
| Documentación | Mantenimiento vigente (*auto*) | M | [A] IRAM §9.2.1; criticidad: decisión 4 |
| Documentación | Prueba hidráulica vigente (*auto*) | C | [A] IRAM |
| Documentación | Tarjeta o etiqueta de control colocada | m | [A] Dec. 351 art. 184 |
| Adecuación | Agente y potencial adecuados al riesgo del sector | M | [A] IRAM, Dec. 351 Anexo VII |

No apto: precinto faltante, presión fuera de zona verde, cilindro dañado, fecha de fabricación ilegible o prueba hidráulica vencida. Consecuencia: fuera de servicio, acción "retirar, señalizar y reponer con un equipo de la dotación de reserva", reinspección a los 7 días.

### T2. `site_obrador` — Zona de obradores (Dec. 911/96; ISO 45001 §8.1; ISO 14001 §8.1)

Política: área, programada por sede; hallazgo si hay NC crítica. Sin estado de activo.

| Sección | Ítem | Crit. | Fuente |
|---|---|---|---|
| Orden y circulación | Pasillos y accesos despejados | M | [B] |
| Orden y circulación | Materiales apilados de forma estable | M | [B] |
| Orden y circulación | Sin acumulación de residuos | m | [B] |
| Delimitación | Obrador delimitado, con acceso controlado | M | [B] |
| Delimitación | Señalización de seguridad (prohibición, obligación, evacuación) legible | M | [B] |
| Electricidad | Tableros con tapa y sin partes vivas expuestas | C | [B] |
| Electricidad | Disyuntor diferencial presente y probado | C | [B] |
| Electricidad | Puesta a tierra conectada | C | [B] |
| Electricidad | Medición de puesta a tierra vigente (≤ 12 meses) | M | [A] Res. SRT 900/2015 |
| Electricidad | Sin empalmes precarios ni cables expuestos al tránsito | M | [B] |
| Incendio | Extintores presentes, vigentes y señalizados (el sistema muestra cuántos de esa sede están vencidos) | M | [A] Dec. 911 arts. 90–91 |
| Incendio | Medios de escape libres | C | [B] |
| Incendio | Combustibles lejos de fuentes de ignición | M | [B] |
| Sustancias peligrosas | Hojas de seguridad (FDS) disponibles | M | [B] |
| Sustancias peligrosas | Envases rotulados | M | [B] |
| Sustancias peligrosas | Contención secundaria y almacenamiento separado | M | [B] ISO 14001 §8.1 [C] |
| Sustancias peligrosas | Kit antiderrame completo | M | [B] |
| Residuos | Separación por tipo con recipientes identificados | M | [B] [C] |
| Residuos | Sin derrames ni manchas en el suelo | M | [B] [C] |
| Servicios | Sanitarios limpios y habilitados | M | [C] |
| Servicios | Agua potable disponible | M | [C] |
| Servicios | Botiquín completo y vigente | M | [C] |
| Emergencia | Plan de emergencia y punto de encuentro visibles | M | [B] |
| Emergencia | Iluminación suficiente en circulaciones y áreas de trabajo | m | [B] |

### T3. `heavy_pre_use` — Control previo al uso, equipos pesados (lo hace el operador)

Política: no libera; un no apto lo deja fuera de servicio; hallazgo si hay NC crítica; no genera `DueItem`.

| Sección | Ítem | Crit. | Fuente |
|---|---|---|---|
| Seguridad | Frenos de servicio y de estacionamiento funcionan | C | [A] Dec. 351 art. 134 |
| Seguridad | Dirección sin juego anormal | C | [B] |
| Seguridad | Cinturón de seguridad presente y en funcionamiento | C | [A] Dec. 911 art. 257 |
| Seguridad | Protección del operador (estructura antivuelco / contra caída de objetos, visera) sin daño | C | [A] Dec. 911 arts. 261 y 274 |
| Visibilidad | Luces, balizas y bocina funcionan | M | [A] Dec. 351 art. 134 |
| Visibilidad | Alarma de retroceso funciona | M | [B] |
| Visibilidad | Espejos y vidrios en buen estado | M | [B] |
| Mecánica | Sin pérdidas de aceite, combustible o hidráulico | M | [B] |
| Mecánica | Niveles correctos (aceite, refrigerante, hidráulico) | m | [B] |
| Mecánica | Neumáticos u orugas sin cortes ni desgaste anormal | M | [B] |
| Equipamiento | Extintor presente y vigente | M | [A] Dec. 351 art. 134 |
| Equipamiento | Calzas disponibles | m | [A] Dec. 911 art. 259 |
| Documentación | Documentación del equipo a bordo | m | [B] |
| Izaje (solo con elementos de izaje) | Limitador de carga o indicador operativo | C | [A] Dec. 351 art. 116 |
| Izaje (solo con elementos de izaje) | Ganchos con traba; cables y eslingas sin daño | C | [A] Dec. 351 art. 116 |
| Izaje (solo con elementos de izaje) | Tabla de cargas visible | M | [A] Dec. 911 art. 266 |
| Izaje (solo con elementos de izaje) | Estabilizadores apoyados sobre base firme | M | [A] Dec. 911 art. 278 |
| Lectura | Horómetro / odómetro (lectura) | — | [B] |

### T4. `heavy_periodic` — Inspección mensual, equipos pesados (SST)

Política: libera; hallazgo si hay NC crítica.

| Sección | Ítem | Crit. | Fuente |
|---|---|---|---|
| Documentación | Seguro vigente (*auto*) | C | [A] Ley 24.449 art. 40 |
| Documentación | RTO vigente (*auto*, solo si circula) | C | [A] Ley 24.449 art. 34 |
| Documentación | Service al día (*auto*) | M | [B] |
| Documentación | Certificación de izaje vigente (*auto*, solo con izaje) | C | [B] [C] |
| Documentación | Revisión trimestral de izaje vigente (*auto*, solo con izaje) | C | [A] Dec. 351 art. 116 |
| Documentación | Operador capacitado, con registro | C | [A] Dec. 351 art. 134, Dec. 911 art. 265 |
| Mecánica y seguridad | Prueba de frenos y dirección | C | [A] Dec. 351 art. 134 |
| Mecánica y seguridad | Protección del operador y accesos a la cabina sin daño | C | [A] Dec. 911 arts. 274 y 276 |
| Mecánica y seguridad | Cinturón inercial | C | [A] Dec. 911 art. 257 |
| Mecánica y seguridad | Luces, balizas, bocina y alarma de retroceso | M | [A]/[B] |
| Mecánica y seguridad | Sin pérdidas; niveles y mangueras hidráulicas en buen estado | M | [B] |
| Mecánica y seguridad | Neumáticos u orugas | M | [B] |
| Mecánica y seguridad | Carga máxima marcada y visible | M | [A] Dec. 351 arts. 114 y 134 |
| Mecánica y seguridad | Extintor vigente y kit de derrames | M | [A]/[B] |
| Izaje (solo con elementos de izaje) | Cable de izar sin hilos rotos ni aplastamientos | C | [A] Dec. 351 arts. 116 y 118 |
| Izaje (solo con elementos de izaje) | Ganchos con traba y sin deformación | C | [A] Dec. 351 art. 118 |
| Izaje (solo con elementos de izaje) | Eslingas y grilletes identificados y sin daño | C | [B] |
| Izaje (solo con elementos de izaje) | Limitador de carga y fin de carrera operativos | C | [A] Dec. 351 art. 116 |
| Izaje (solo con elementos de izaje) | Tablas de carga legibles | M | [A] Dec. 911 art. 266 |
| Lectura | Horómetro / odómetro | — | [B] |

### T5. `light_pre_use` — Control previo al uso, vehículos livianos (lo hace el conductor)

Política: no libera; no genera `DueItem`.

| Sección | Ítem | Crit. | Fuente |
|---|---|---|---|
| Documentación | Licencia del conductor vigente y de la categoría | C | [A] Ley 24.449 art. 40 |
| Documentación | Documentación a bordo (cédula, comprobante de seguro) | m | [A] Ley 24.449 art. 40 |
| Seguridad | Frenos | C | [A] Ley 24.449 art. 39 |
| Seguridad | Dirección | C | [B] |
| Seguridad | Neumáticos sin cortes ni deformaciones | C | [B] |
| Seguridad | Cinturones de seguridad | C | [A] Ley 24.449 art. 30 |
| Visibilidad | Luces (bajas, freno, giro) | M | [A] Ley 24.449 art. 31 |
| Visibilidad | Parabrisas, limpiaparabrisas y espejos | M | [A] Ley 24.449 art. 30 |
| Mecánica | Sin pérdidas bajo el vehículo | M | [B] |
| Lectura | Odómetro (lectura, km) | — | [B] |

### T6. `light_periodic` — Inspección mensual, vehículos livianos (SST)

Política: libera; hallazgo si hay NC crítica.

| Sección | Ítem | Crit. | Fuente |
|---|---|---|---|
| Documentación | Seguro vigente (*auto*) | C | [A] Ley 24.449 art. 40 |
| Documentación | RTO vigente (*auto*) | C | [A] Ley 24.449 art. 34 |
| Documentación | Service al día (*auto*) | M | [B] |
| Documentación | Monitoreo satelital activo (*auto*, si corresponde) | m | [B] |
| Seguridad | Frenos y dirección (prueba) | C | [B] |
| Seguridad | Profundidad del dibujo del neumático (mm; límite mínimo editable) | M | [C] 1,6 mm habitual |
| Seguridad | Neumáticos sin daño estructural | C | [B] |
| Seguridad | Cinturones y apoyacabezas | C | [A] Ley 24.449 art. 30 |
| Seguridad | Barra o jaula antivuelco (solo si corresponde) | M | [C] |
| Visibilidad | Luces, bocina, espejos, parabrisas y limpiaparabrisas | M | [A] Ley 24.449 arts. 30 y 31 |
| Mecánica | Niveles y sin pérdidas | m | [B] |
| Kit | Matafuego vigente | M | [A] Ley 24.449 art. 40 |
| Kit | Balizas portátiles | M | [A] Ley 24.449 art. 40 |
| Kit | Botiquín | m | [B] |
| Kit | Chaleco reflectivo | m | [B] |
| Kit | Rueda de auxilio, gato y llave | M | [B] |
| Lectura | Odómetro (km) | — | [B] |

### T7. `field_audit` — Auditoría de seguridad en campo

Política: actividad (sede + tarea + contratista + supervisor); hallazgo si hay NC crítica; se mide contra la meta mensual de la sede. Los ítems de "tareas especiales" aparecen según las tareas especiales marcadas al iniciar.

| Sección | Ítem | Crit. | Fuente |
|---|---|---|---|
| Documentación | Permiso de trabajo seguro (PTS) firmado y vigente | C | [A] Res. SRT 61/2023 (altura, construcción); [B] en el resto |
| Documentación | Análisis de trabajo seguro (ATS/AST) firmado y difundido | M | [B] |
| Documentación | Charla previa registrada | m | [A] Res. SRT 61/2023 (5 minutos); [B] |
| Personas | EPP adecuado y en uso | C | [B] |
| Personas | Personal capacitado y habilitado para la tarea | C | [A] Dec. 351 art. 134, Dec. 911 art. 265 |
| Personas | Supervisor presente en el frente | M | [B] |
| Condiciones | Herramientas inspeccionadas y en buen estado | M | [B] |
| Condiciones | Frente ordenado, delimitado y señalizado | M | [B] |
| Condiciones | Bloqueo y etiquetado de energías, cuando corresponde | C | [A] Dec. 351 art. 109 |
| Altura | Arnés y cabo inspeccionados, vigentes (código del activo) | C | [A] Res. SRT 61/2023 |
| Altura | Punto de anclaje adecuado e independiente de la plataforma | C | [A] Res. SRT 61/2023 ítem 39 |
| Espacio confinado | Medición de gases registrada con un equipo calibrado (oxígeno ≥ 18,5 %) | C | [A] Dec. 911 art. 125; calibración: Task 16 |
| Espacio confinado | Vigía y plan de rescate | C | [A] Dec. 911 art. 342 |
| Izaje | Plan de izaje y rigger designado | C | [B] [C] |
| Izaje | Zona de maniobra señalizada; nadie bajo la carga | C | [A] Dec. 911 art. 268 |
| Ambiente | Sin derrames; residuos bien dispuestos | M | [B] |
| Observaciones | Actos inseguros observados (texto) | — | [B] |
| Observaciones | Observaciones positivas (texto) | — | [B] |

Salida: puntaje % y cumplimiento del programa de la sede (auditorías hechas / meta mensual).

### T8. `fall_protection_periodic` — Arneses y cabos de vida (inspección periódica)

Política: `retireOnUnfit` (un no apto pasa a dado de baja; no hay liberación). Los ítems críticos son casi todos, porque cualquier daño en un equipo anticaídas lo inhabilita.

| Sección | Ítem | Crit. | Fuente |
|---|---|---|---|
| Identificación | Etiqueta o marcado legible (norma, serie, fabricación) | C | [A] Res. SRT 61/2023 ítem 34; [B] HSE |
| Identificación | Vida útil vigente (*auto*) | C | [B] [C] |
| Cintas y costuras | Cintas sin cortes, deshilachado, quemaduras ni daño químico | C | [B] HSE |
| Cintas y costuras | Costuras íntegras | C | [B] |
| Cintas y costuras | Sin nudos ni empalmes | C | [B] |
| Herrajes | Hebillas y argollas D sin deformación ni corrosión | C | [B] |
| Herrajes | Ganchos y mosquetones con traba y cierre correcto | C | [B] |
| Absorbedor | Indicador de caída o absorbedor sin activar | C | [B] |
| Absorbedor | Sin registro de caída detenida desde la última inspección | C | [B] HSE; [A] Res. 61/2023 (resumen) |
| Retráctil (solo si corresponde) | Retracción y freno funcionan | C | [B] |
| Arnés (solo si se usa desde 6 m) | Dispositivo antitrauma presente | M | [A] Res. SRT 61/2023 |
| Conservación | Limpio, seco y guardado según el fabricante | m | [A] Res. SRT 61/2023; [B] |

No apto: cualquier ítem crítico no conforme. Consecuencia: **baja definitiva**; acción "destruir el equipo y adjuntar la foto"; sin próxima inspección.

## Aprobación

- [ ] Aprobado por el PO (pendiente)
- [ ] Anexo de plantillas revisado por un profesional de Higiene y Seguridad (requisito para activar el módulo en producción)
