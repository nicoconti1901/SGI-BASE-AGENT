# Spec: `suppliers` — Evaluación de proveedores (Task 19)

Estado: **aprobado por el PO el 2026-10-21** (con las recomendaciones del borrador). Investigación: `RESEARCH-suppliers.md` (cada afirmación lleva su marca de confianza (a)/(b)/(c)).
Normas: ISO 9001 §8.4 (8.4.1, 8.4.2, 8.4.3) · ISO 14001 §8.1 · ISO 45001 §8.1.4 (8.1.4.2 contratistas, 8.1.4.3 tercerización).
Depende de: Task 14 (Sede, Persona), Task 14b (`DueItem` con dueño/sede/persona, `Finding.origin = supplier` reservado, catálogo de módulos), Task 10 (Finding), Task 11 (Action).

## Objective

Que cada empresa sepa **a quién le compra, por qué confía en él y cuánto control le aplica**: registrar proveedores (productos, servicios y contratistas), evaluarlos con criterios propios, reevaluarlos a tiempo, controlar la documentación vencible de los contratistas, y mostrarle a un auditor la cadena completa en una pantalla: **lista de aprobados, evaluación, criterios, evidencia, acción**.

### Success criteria

- [ ] Alta de proveedores con CUIT único por empresa, tipo (producto / servicio / contratista), criticidad con motivo y responsable interno.
- [ ] Plantillas de criterios con **versiones**; cada evaluación guarda una **copia fija** de criterios, pesos y umbrales. Cambiar criterios no toca el pasado.
- [ ] El puntaje y el resultado se **calculan** (`scoreEvaluation`, `resultFromScore`, `nextEvaluationDue`); nunca se tipean.
- [ ] **Criterios excluyentes:** un 1 en un criterio excluyente es "no aprobado" y un 2 es "como mucho condicional", sea cual sea el total.
- [ ] Tres niveles de criticidad y una **evaluación simplificada** para no críticos; bajo impacto con motivo escrito.
- [ ] Reevaluación periódica y por evento, con `DueItem`; reevaluación vencida visible y notificada.
- [ ] Un resultado condicional **exige** su plan de mejora (`Action`); un hallazgo de proveedor es un `Finding` con `origin = supplier`.
- [ ] Documentos del proveedor con vencimiento (`DueItem`); un contratista con un documento bloqueante vencido o faltante aparece **no habilitado**.
- [ ] **Lista de aprobados** fechada y exportable.
- [ ] Listados paginados; estado agregado en la base; dos empresas nunca ven los datos de la otra.

## Decisiones a confirmar (defaults propuestos)

| # | Decisión | Default propuesto | Alternativa / nota |
|---|---|---|---|
| 1 | **Fórmula del puntaje** | `total = Σ(peso × nota) × 20 / Σpeso`, nota 1 a 5, rango **20 a 100**; se **trunca** a un decimal | El todo.md dice "0 a 100"; con 1–5 eso solo se logra con `(nota−1)/4`, que deja "todo 4" en 75 (bajo el umbral de 80). Ver Research D.1 |
| 2 | **Criterios excluyentes** | Marca por criterio: nota 1 = **no aprobado**; nota 2 = **como mucho condicional**; resultado = el peor entre puntaje y excluyentes. Un excluyente no admite N/A | Alternativa: nota mínima configurable por criterio (más flexible, más difícil de explicar) |
| 3 | **Criticidad** | **3 niveles**: crítico · estándar · bajo impacto. Crítico = afecta conformidad, seguridad o ambiente. Bajo impacto exige **motivo escrito** | El todo.md tiene 2 (crítico / no crítico). Ver Research D.5 |
| 4 | **Periodicidad de reevaluación** | Crítico **12 m** · estándar **24 m** · bajo impacto **ninguna** · condicional **6 m** (o al cerrar el plan, lo que ocurra primero) · no aprobado: ninguna (se reevalúa a pedido). Más reevaluación **por evento**. Configurable por empresa | El todo.md propone 6 m críticos / 12 m no críticos. El modelo soporta 6/12 sin cambios. Ver Research D.4 |
| 5 | **Umbrales** | Aprobado ≥ **80**, condicional **60 a 79,9**, no aprobado < 60. Se guardan **con la versión de la plantilla** y se copian a cada evaluación | Sin fuente que los fije (c); configurables |
| 6 | **Evaluación simplificada** | Solo para **no críticos**; usa los criterios "básicos" + todos los excluyentes; mismo cálculo; queda marcada como simplificada | Alternativa: no ofrecerla |
| 7 | **Bajo impacto** | Se "acepta" con una evaluación de tipo *declarada*: sin notas, resultado aprobado, **motivo obligatorio**. Así todo aprobado tiene un registro | Alternativa: estado propio "no aplica evaluación" |
| 8 | **Habilitación documental** | Concepto **separado** del puntaje: *habilitado* = aprobado o condicional **y** sin documento bloqueante vencido ni faltante. Un contratista no habilitado se ve en rojo aunque tenga 95 puntos | Qué documentos bloquean por defecto: ver tabla de tipos |
| 9 | **Documentos sugeridos** | Se cargan al activar el módulo (editables) con el aviso "orientativo, validar con su asesor". La plataforma registra y avisa vencimientos; **no verifica** el contenido de pólizas | Research F: mucho es práctica de mercado (b) o no verificado (c) |
| 10 | **Seguimiento de un condicional** | `Action` obligatoria creada en el mismo paso que la evaluación. Requiere **agregar un valor al enum `ActionLinkTarget`** (`supplier_evaluation`): cambio aditivo en un modelo compartido | Alternativa: un `Finding` automático por cada condicional y la `Action` vinculada a él (ensucia Hallazgos) |
| 11 | **Contratista y personas** | Agregar `Person.supplierId` opcional (Task 14 ya lo previó). La ficha del contratista lista sus personas. `contractorName` sigue como texto y se puede vincular a mano | Tabla compartida con master-data: coordinar el orden de merge |
| 12 | **Comunicaciones (§8.4.3)** | Un registro con dos tipos: *requisitos comunicados* (lo que pide 8.4.3) y *resultado de evaluación*. Solo se **registra** (fecha, canal, resumen, adjunto); no envía mails | El todo.md dice que 8.4.3 es "comunicar el resultado": es matiz normativo, ver Research D.6 |
| 13 | **Sedes del proveedor** | N sedes a las que atiende; **vacío = todas**. La evaluación es del proveedor, no por sede | Evaluación por sede: fuera de alcance |
| 14 | **Proveedor extranjero** | CUIT opcional; único por empresa cuando existe | Alternativa: CUIT obligatorio |
| 15 | **Anular una evaluación** | Las evaluaciones son **inmutables**. Una equivocada se **anula con motivo**; el estado del proveedor se recalcula con la última no anulada | Alternativa: permitir editar (pierde trazabilidad) |
| 16 | **Importación CSV de proveedores** | Incluida (slice 19.2). Todos entran como `potential`; **nunca se aprueba al importar** | Un cliente de 500 no los va a tipear |
| 17 | **Aprobación excepcional** (proveedor único) | **No hay override del resultado.** Si no hay alternativa, se aprueba como condicional con plan de mejora | Alternativa: override con motivo y aprobación del admin |

## Domain model (conceptual)

Todas las tablas llevan `tenantId` (índices por tenant) y se leen con los helpers tenant-scoped existentes. Las FK a entidades de otra tabla del mismo módulo se validan en el servicio contra el tenant y tienen test de aislamiento. Cada alta, edición, baja, carga de documento, evaluación, anulación y exportación deja registro de auditoría (quién, cuándo, qué), con el mismo mecanismo que `master-data`.

### Supplier

- `legalName`, `tradeName?`, `taxId?` (11 dígitos normalizados, **único por tenant** cuando existe, validado con `isValidCuit`).
- `type`: `product` | `service` | `contractor`. `category` (rubro, texto libre con sugerencias de los ya usados).
- `criticality`: `critical` | `standard` | `low`; `criticalityReason` (obligatorio en `low` y en `critical`).
- `ownerUserId` (responsable interno; usuario del tenant), contacto (nombre, mail, teléfono), `notes`.
- `status`: `potential` | `approved` | `conditional` | `not_approved` | `inactive`. **Derivado** de la última evaluación no anulada (ver `deriveSupplierStatus`); solo `inactive` se marca a mano (`inactiveAt`, `inactiveReason`).
- **Resumen desnormalizado** (para listar y filtrar sin joins ni recorrer evaluaciones): `lastEvaluationId`, `lastEvaluatedAt`, `lastScore`, `nextEvaluationDueAt`, `blockingDocExpiresAt`, `missingRequiredDocs`, `missingBlockingDocs`, **`attentionAt`** (ver más abajo). Lo mantiene un único servicio `recomputeSupplierSummary` dentro de la misma transacción de cada escritura relevante.
- `SupplierSite`: `supplierId` × `siteId` (única), `tenantId`. Sin filas = atiende todas las sedes.
- Índices: `unique(tenantId, taxId)`, `(tenantId, status)`, `(tenantId, criticality)`, `(tenantId, attentionAt)`, `(tenantId, legalName)`.

`attentionAt` = el instante más próximo en que el proveedor necesita atención: el menor entre `nextEvaluationDueAt` y `blockingDocExpiresAt`; si falta un documento bloqueante, es el instante del recálculo (ya "pasado"). Con una sola columna indexada se resuelven "rojo", "ámbar" y el orden de la lista, sin cron que "actualice semáforos": el semáforo se calcula contra la hora actual al leer.

### Plantillas de criterios (con versiones)

- **SupplierCriteriaTemplate**: `supplierType`, `version` (entero, único por tenant y tipo), `status` (`draft` | `published` | `retired`), `approvedMin` (80), `conditionalMin` (60), `changeNote`, `publishedAt`, `publishedByUserId`. A lo sumo **una publicada** por tenant y tipo (índice parcial único).
- **SupplierCriterion**: `templateId`, `position`, `name`, `description`, descriptores de la nota 1, 3 y 5 (textos cortos), `weight` (entero > 0), `excluding`, `allowNA`, `phase` (`selection` | `performance` | `both`), `basic` (entra en la evaluación simplificada).
- Reglas al **publicar**: los pesos suman 100; un excluyente no admite N/A; al menos un criterio; nombres únicos dentro de la versión. Una versión publicada **no se edita**: editar crea un borrador (clon) y publicar lo vuelve vigente y retira la anterior.
- Al activar el módulo se siembra la **v1** de cada tipo (idempotente, `ensureSupplierDefaults(tenantId)`). Pesos de partida: Research C, "a validar con un especialista".

### SupplierEvaluation

- `supplierId`, `kind`: `initial` | `periodic` | `event`. `mode`: `full` | `simplified` | `declared` (bajo impacto, sin notas).
- Copia fija: `templateId`, `templateVersion`, `approvedMin`, `conditionalMin`, `criticalityAtEvaluation`.
- `periodFrom`, `periodTo` (fechas), `evaluatedAt` (fecha), `evaluatorUserId`.
- Calculados y **persistidos al guardar** (nunca recibidos del cliente): `totalScore` (decimal 1 dígito, nulo si `declared`), `coverage` (% del peso aplicado respondido), `result`: `approved` | `conditional` | `not_approved`, `resultReason`: `score` | `excluding_criterion` | `declared`.
- `comment`, `voidedAt?`, `voidedByUserId?`, `voidReason?`.
- **SupplierEvaluationItem** (copia fija por criterio): `evaluationId`, `criterionId?` (trazabilidad), `name`, `description`, `weight`, `excluding`, `allowNA`, `score` (1 a 5, o nulo si N/A), `comment`.
- Restricciones en la base: `CHECK (score BETWEEN 1 AND 5)`, `CHECK (weight > 0)` en la migración SQL; el servicio las repite.
- **Inmutable.** La única modificación permitida es anular (`voidedAt`, motivo obligatorio).

### SupplierDocumentType y SupplierDocument

- **SupplierDocumentType** (por tenant, editable): `key`, `name`, `appliesTo` (tipos de proveedor), `required`, `blocksEnablement`, `validityMonths?` (sugerencia al cargar), `recurrence` (`none` | `monthly`), `note` (por ejemplo "práctica de mercado; validar con su asesor"), `active`.
- **SupplierDocument**: `supplierId`, `typeId`, `issuedAt?`, `expiresAt?`, archivo (clave de storage, nombre, tipo, tamaño; mismo servicio de storage que `ActionAttachment`), `uploadedByUserId`, `supersededAt?`, `voidedAt?`. Se conserva el historial; el **vigente** es el último no anulado por tipo.
- Sin `expiresAt` el documento no vence (por ejemplo, una constancia sin plazo).
- Juego sugerido al activar (Research F; todos editables):

| Tipo de documento | Aplica a | Obligatorio | Bloquea | Vigencia sugerida | Recurrencia |
|---|---|---|---|---|---|
| Certificado de cobertura de ART (con cláusula de no repetición o endoso a favor de la empresa) | contratista | sí | sí | según certificado | no |
| Nómina de personal cubierto | contratista | sí | sí | según certificado | no |
| Seguro de vida colectivo (certificado) | contratista | sí | sí | según certificado | no |
| F.931 y constancia de pago a la seguridad social | contratista | sí | sí | 1 mes | mensual |
| Constancia de inscripción (CUIT / ARCA) | todos | sí | no | sin vencimiento | no |
| Programa de Seguridad aprobado por la ART (obras) | contratista | no | no | según obra | no |
| Seguro de responsabilidad civil | contratista, servicio | no | no | según póliza | no |
| Póliza de accidentes personales (autónomos) | contratista | no | no | según póliza | no |
| Habilitaciones específicas del rubro (transporte, residuos, matrículas) | todos | no | no | según habilitación | no |
| Certificación ISO u otras | producto, servicio | no | no | según certificado | no |

### Hallazgos, comunicaciones

- **SupplierFinding**: `supplierId`, `findingId` (**único**), `kind` (`quality` | `delivery` | `safety` | `environment` | `documentation` | `claim`), `evaluationId?`. El `Finding` se crea con `origin = supplier`. **Sin columnas nuevas en `Finding`.**
- **SupplierCommunication**: `supplierId`, `kind` (`requirements` | `evaluation_result`), `evaluationId?`, `sentAt`, `channel` (`email` | `letter` | `meeting` | `other`), `recipientName?`, `summary`, adjunto opcional.

### Vencimientos (`DueItem`) y seguimiento (`Action`)

| Qué | `entityType` / `entityId` | `dueAt` | `leadDays` | Dueño / sede |
|---|---|---|---|---|
| Evaluación inicial pendiente (crítico y estándar) | `supplier_evaluation` / `supplier.id` | alta + 30 días | 7 | `ownerUserId` del proveedor |
| Reevaluación | `supplier_evaluation` / `supplier.id` | `nextEvaluationDue` | 30 | idem |
| Documento vigente | `supplier_document` / `document.id` | `expiresAt` | 30 (7 si es mensual) | idem |

- `siteId` del `DueItem` = la sede del proveedor **solo si atiende exactamente una**; si no, nulo (el resumen diario lo agrupa en "Sin sede").
- A lo sumo **un `DueItem` abierto** por (tenant, `entityType`, `entityId`): el servicio cierra el anterior al crear el siguiente; reintentar no duplica (test de idempotencia).
- Plan de mejora: `Action` con `ActionLink(targetType = supplier_evaluation, targetId = evaluation.id)`. Se usa `createAction` tal cual (responsable obligatorio). El seguimiento y la eficacia siguen el flujo existente de Acciones.

### Funciones puras (`src/domain/suppliers/`)

Todas sin acceso a base ni reloj propio (la fecha entra por parámetro).

**`isValidCuit(raw)`**: 11 dígitos, dígito verificador módulo 11 con pesos 5-4-3-2-7-6-5-4-3-2 (práctica conocida, **(b)**: contrastar con una fuente oficial en 19.1). Acepta guiones y espacios al ingreso; devuelve el valor normalizado.

| Entrada | Esperado |
|---|---|
| `20-12345678-6` | válido (`20123456786`) |
| `20-12345678-5` | inválido (dígito verificador) |
| `2012345678` (10 dígitos) | inválido |
| `20-1234567A-6` | inválido |
| vacío | inválido (el alta lo permite solo si el proveedor es extranjero) |

**`scoreEvaluation(items, mode, criticality)`** → `{ total, applicableWeight, answeredWeight, coverage, excludingFailures[] }` o error tipado.
Reglas: la nota es entera de 1 a 5 o `null` (N/A, solo si `allowNA`); el total es `floor(Σ(peso × nota) × 200 / Σpeso_respondido) / 10` (aritmética entera: sin errores de coma flotante); N/A se repondera; cobertura mínima **60 %** del peso aplicable; en `simplified` solo cuentan los `basic` y los `excluding`, y no se permite si `criticality = critical`.

Fixture **F**: A (peso 40, excluyente) · B (30) · C (20) · D (10, excluyente); umbrales 80 / 60; salvo que se indique, todos con N/A no permitido.

| # | Caso | Notas (A, B, C, D) | Total | Resultado | Razón |
|---|---|---|---|---|---|
| 1 | todo 5 | 5, 5, 5, 5 | 100,0 | aprobado | puntaje |
| 2 | todo 4 (límite inclusivo) | 4, 4, 4, 4 | 80,0 | aprobado | puntaje |
| 3 | todo 3 (límite inclusivo) | 3, 3, 3, 3 | 60,0 | condicional | puntaje |
| 4 | todo 2 | 2, 2, 2, 2 | 40,0 | no aprobado | puntaje (el excluyente en 2 solo limitaría a condicional) |
| 5 | todo 1 | 1, 1, 1, 1 | 20,0 | no aprobado | puntaje |
| 6 | **el puntaje oculta un 1 excluyente** | 5, 5, 5, **1** | 92,0 | **no aprobado** | excluyente (D) |
| 7 | excluyente en 2 con total alto | 5, 5, 5, **2** | 94,0 | **condicional** | excluyente (D) |
| 8 | excluyente en 2 con total bajo | **2**, 5, 5, 5 | 76,0 | condicional | puntaje y excluyente (A) |
| 9 | un 1 en criterio **no** excluyente | 5, **1**, 5, 5 | 76,0 | condicional | puntaje (sin freno por excluyente) |
| 10 | justo bajo el umbral | 4, 4, 4, 3 | 78,0 | condicional | puntaje |
| 11 | sobre el umbral | 4, 4, 4, 5 | 82,0 | aprobado | puntaje |
| 12 | fixture **F'** (como F pero D **no** excluyente y con N/A permitido); D queda sin responder | 4, 4, 4, N/A | 80,0 (360 ÷ 90 × 20) | aprobado | puntaje (el peso aplicable es 90) |
| 13 | F', con una nota menor (truncado, no redondeado) | 4, 4, 3, N/A | 75,5 (340 ÷ 90 × 20 = 75,55) | condicional | puntaje |
| 14 | **truncado en el límite**: pesos 399 y 1, notas 4 y 3 (`Σw = 400`) | 4, 3 | 79,9 (79,95 exacto) | condicional | puntaje: nunca se aprueba por redondeo |
| 15 | pesos 99 y 1, notas 4 y 3 | 4, 3 | 79,8 | condicional | puntaje |

Errores tipados:

| Caso | Error |
|---|---|
| Nota 0, 6, 3,5 o texto | `INVALID_SCORE` |
| N/A en criterio que no lo permite | `NA_NOT_ALLOWED` |
| Peso 0 o negativo | `INVALID_WEIGHT` |
| Lista vacía o sin respuestas | `NO_ITEMS` |
| Fixture con N/A permitido en todos y ninguno excluyente: solo se respondió A (40 % del peso aplicable) | `INSUFFICIENT_COVERAGE` |
| `simplified` con proveedor crítico | `SIMPLIFIED_NOT_ALLOWED` |
| `declared` con criticidad distinta de bajo impacto | `DECLARED_NOT_ALLOWED` |

Evaluación simplificada sobre F con `basic` solo en B (A y D entran por ser excluyentes), proveedor estándar:

| Caso | Notas (A, B, D) | Total | Resultado |
|---|---|---|---|
| simplificada todo 4 | 4, 4, 4 | 80,0 (320 ÷ 80) | aprobado, marcada `simplified` |
| simplificada con D = 1 | 4, 4, **1** | 72,5 (290 ÷ 80 × 20) | no aprobado por excluyente (el puntaje solo daría condicional) |
| simplificada, proveedor crítico | cualquiera | n/a | `SIMPLIFIED_NOT_ALLOWED` |

**`resultFromScore(total, excludingFailures, thresholds)`** → `{ result, reason }`. `total ≥ approvedMin` aprobado; `≥ conditionalMin` condicional; si no, no aprobado; luego se aplica el tope de los excluyentes (nota 1: no aprobado; nota 2: condicional como máximo) y se toma el **peor**. `reason = excluding_criterion` solo si el excluyente cambió el resultado. Los casos 1 a 15 de la tabla anterior son también los tests de esta función; además: `total = 80,0` con umbral configurado en 85 → condicional; umbrales inconsistentes (`conditionalMin > approvedMin`) → `INVALID_THRESHOLDS`.

**`nextEvaluationDue(lastEvaluatedAt, criticality, result, config)`** → fecha o `null`. `config` por defecto: crítico 12, estándar 24, condicional 6 (meses). Suma de meses de calendario con tope al último día del mes.

| Última evaluación | Criticidad | Resultado | Próxima |
|---|---|---|---|
| 2026-10-21 | crítico | aprobado | 2027-10-21 |
| 2026-10-21 | estándar | aprobado | 2028-10-21 |
| 2026-10-21 | crítico | condicional | 2027-04-21 |
| 2026-10-21 | estándar | condicional | 2027-04-21 (el menor entre 24 y 6) |
| 2026-10-21 | bajo impacto | aprobado | `null` |
| 2026-10-21 | cualquiera | no aprobado | `null` |
| 2026-01-31 | crítico | condicional | 2026-07-31 |
| 2026-08-31 | estándar | condicional | 2027-02-28 (tope de fin de mes) |
| 2024-02-29 | crítico | aprobado | 2025-02-28 |
| 2026-10-21 | crítico, `config.critical = 6` | aprobado | 2027-04-21 |

**`deriveSupplierStatus(inactiveAt, lastNonVoidedEvaluation)`**

| Entrada | Estado |
|---|---|
| `inactiveAt` presente | `inactive` |
| sin evaluaciones (o todas anuladas) | `potential` |
| última no anulada: aprobado / condicional / no aprobado | `approved` / `conditional` / `not_approved` |
| se anula la última evaluación | el estado vuelve al de la anterior no anulada |
| reactivar un `inactive` | recalcula con la regla anterior; si la última es vieja y venció, queda rojo hasta reevaluar |

**`documentStatus(expiresAt, today, warnDays)`**: sin vencimiento = `valid`; `expiresAt < today` = `expired`; dentro de `warnDays` = `expiring`; si no, `valid`. El día del vencimiento todavía es válido.

**`supplierSemaphore(status, attentionAt, missingRequiredDocs, now, windowDays = 30)`**

| Caso | Semáforo |
|---|---|
| `potential` o `inactive` | gris |
| `not_approved` | rojo |
| `attentionAt < now` (reevaluación vencida o documento bloqueante vencido o faltante) | rojo |
| `attentionAt == now` | ámbar (vence hoy, todavía no pasó) |
| `attentionAt` a 10 días | ámbar |
| `attentionAt` a 45 días y aprobado | verde |
| `attentionAt` nulo, aprobado, sin documentos faltantes | verde |
| aprobado con 1 documento obligatorio no bloqueante faltante | ámbar |
| `conditional` con `attentionAt` a 200 días | ámbar |

**`isEnabled(status, missingBlockingDocs, blockingDocExpiresAt, now)`**: habilitado si el estado es aprobado o condicional, no falta ningún documento bloqueante y ninguno venció. Contratista con ART vencida: no habilitado aunque `lastScore = 95`.

**`validateTemplateForPublish(template)`**: pesos suman 100; excluyente sin N/A; un criterio como mínimo; umbrales consistentes.

**`buildApprovedList(suppliers, now)`**: devuelve `approved` y `conditional` habilitados, ordenados por razón social, con `generatedAt`; los excluidos se cuentan aparte ("N no figuran por documentación vencida o faltante").

### Servicios (`src/lib/suppliers.ts`)

- `saveEvaluation(...)`: en una transacción, valida con las funciones puras, **recalcula** (ignora cualquier total del cliente), guarda evaluación e ítems, cierra el `DueItem` abierto, crea el siguiente si `nextEvaluationDue ≠ null`, recalcula el resumen y, si el resultado es condicional, **exige** y crea la `Action` (título sugerido, responsable, fecha) con su vínculo.
- `voidEvaluation(...)`: anula con motivo y recalcula resumen y `DueItem`.
- `uploadDocument(...)`, `voidDocument(...)`: mantienen el `DueItem` del documento y el resumen.
- `recomputeSupplierSummary(supplierId)`: único lugar que escribe las columnas desnormalizadas; test de integridad: recalcular desde cero da lo mismo que la actualización incremental.
- `ensureSupplierDefaults(tenantId)`: plantillas v1 y tipos de documento sugeridos, idempotente.
- Cambiar la criticidad o el tipo del proveedor, o el juego de tipos de documento, recalcula `nextEvaluationDueAt` y los faltantes (para toda la empresa en lote cuando cambia el juego de tipos; con 500 proveedores es trivial).

## Permisos

| Rol | Proveedores y documentos | Evaluar | Plantillas de criterios y tipos de documento | Lista de aprobados |
|---|---|---|---|---|
| `tenant_admin` | alta, edición, baja, comunicaciones, hallazgos | sí (incluye anular) | edición y publicación | ver y exportar |
| `process_owner` | alta, edición, baja, comunicaciones, hallazgos | sí | lectura | ver y exportar |
| `contributor` | lectura + **cargar documentos** | no | lectura | ver y exportar |
| `viewer` | lectura | no | lectura | ver y exportar |

Permisos nuevos: `manage_suppliers`, `evaluate_suppliers`, `manage_supplier_criteria`, `upload_supplier_documents`. Registrar un hallazgo de proveedor sigue el permiso vigente para crear hallazgos. Activar el módulo es del superusuario desde la ficha de la empresa (Task 14b). Con el módulo inactivo las rutas dan 404.

## Qué ve el cliente

Pocas pantallas. Copy según la identidad SGI (`sgi-frontend-identity`): qué es, qué hacer, sin jerga.

**1. Lista `/t/[slug]/suppliers`**
- Franja superior con 4 números: *Rojos · Ámbar · Sin evaluar · Aprobados vigentes* (conteos en la base). Un clic filtra.
- Tabla con **semáforo**, razón social, CUIT, tipo, rubro, criticidad, último puntaje y fecha, próxima atención ("reevaluar en 12 días", "ART vencida hace 3 días").
- Vista inicial: "Requieren atención" si hay alguno; si no, "Todos". Orden: lo más urgente primero.
- Filtros: estado, criticidad, tipo, rubro, sede, "no habilitados". Búsqueda por razón social o CUIT. **Paginada de a 25** en el servidor.
- Acciones: *Nuevo proveedor*, *Importar CSV*, *Exportar lista de aprobados*.
- Vacío: "Todavía no cargó proveedores. Empiece por los que afectan la calidad, la seguridad o el ambiente."

**2. Ficha `/suppliers/[id]`**
- Arriba: nombre, semáforo, estado, criticidad con su motivo, "Habilitado / No habilitado" y por qué, responsable, próxima reevaluación, botón **Evaluar**.
- Pestañas: *Resumen* (evolución del puntaje, últimos hallazgos, acciones abiertas) · *Evaluaciones* (historial; cada una abre su copia fija de criterios) · *Documentos* (por tipo: vigente, vence, falta) · *Hallazgos y acciones* · *Comunicaciones* · *Personas* (solo contratistas).
- Está pensada para que un auditor recorra lista, evaluación, criterios, evidencia y acción sin salir de la ficha.

**3. Evaluar `/suppliers/[id]/evaluate`**
- Se elige tipo (inicial / periódica / por evento) y, si corresponde, evaluación simplificada. Para bajo impacto: un solo campo, el motivo.
- Una fila por criterio: nombre, descriptores de 1 / 3 / 5, nota, comentario. Los criterios excluyentes están marcados.
- **Evidencia precargada** del período: hallazgos del proveedor, acciones abiertas, estado de documentos.
- Puntaje y resultado se muestran **en vivo** (la misma función pura que usa el servidor) con la razón ("no aprobado: seguridad en 1").
- Comentario obligatorio con nota ≤ 2. Aviso suave, no bloqueante: "Todas las notas son iguales y no hay comentarios: ¿tiene evidencia?".
- Si el resultado es condicional, el paso siguiente es el **plan de mejora** (responsable y fecha), y no se guarda sin él.
- Después de guardar: "Registrar que se lo comunicó".

**4. Criterios `/suppliers/criteria`** (administrador): una plantilla por tipo, con sus versiones, pesos, umbrales, excluyentes y criterios básicos; borrador, publicar, ver versiones anteriores. Misma pantalla para los *tipos de documento*.

**5. Lista de aprobados**: botón de la lista. Exporta **CSV** (UTF-8 con BOM) y ofrece vista imprimible; lleva fecha y hora de generación, quién la generó, criticidad, estado, "con condiciones" si corresponde y la fecha de la próxima reevaluación. Al pie, cuántos no figuran por documentación.

### Dos clientes tipo

| | 20 proveedores | 500 proveedores |
|---|---|---|
| Alta | A mano, en una tarde | Importación CSV (entran `potential`, nunca aprobados) |
| Criticidad | Casi todos críticos o estándar | La mayoría **bajo impacto** con motivo (aceptación de un paso); los críticos (por ejemplo 40) con evaluación completa |
| Evaluaciones por año | ~20 | ~40 críticas + parte de ~100 estándar cada 24 meses; no 1000 |
| Lista | Cabe en una página | Filtros + paginación + "Requieren atención" |
| Aviso | Resumen diario por persona (Task 14b) | Igual, agrupado por responsable y sede |

## Acceptance tests (ejemplos)

**Unit (funciones puras):** las tablas de arriba (CUIT, `scoreEvaluation`, `resultFromScore`, `nextEvaluationDue`, `deriveSupplierStatus`, `documentStatus`, `supplierSemaphore`, `isEnabled`, `validateTemplateForPublish`, `buildApprovedList`).

**Integración (con base):**
- Mismo CUIT en dos proveedores del mismo tenant → error; en otro tenant → permitido.
- Guardar una evaluación con `totalScore` y `result` falsificados en la entrada → se ignoran y se guardan los calculados.
- Publicar la v2 de una plantilla con otro peso: la evaluación hecha con la v1 conserva sus criterios, pesos, umbrales y total.
- Evaluación condicional sin responsable del plan → no se guarda; con él se crean evaluación, `Action` con vínculo y `DueItem` de reevaluación a los 6 meses.
- Evaluación no aprobada → proveedor `not_approved`, sin `DueItem` de reevaluación, sale de la lista de aprobados.
- Anular la última evaluación → el estado y el `DueItem` vuelven a los de la anterior.
- Cargar un nuevo documento reemplaza al vigente: el `DueItem` anterior se cierra y se abre uno nuevo (nunca dos abiertos); repetir la operación no duplica.
- Contratista con ART vencida: aparece rojo y "no habilitado", y no figura en la lista de aprobados; al cargar una ART vigente vuelve a figurar.
- Falta un documento bloqueante que nunca se cargó → "no habilitado".
- Hallazgo desde la ficha → `Finding.origin = supplier` y un `SupplierFinding`; la reevaluación siguiente lo precarga como evidencia.
- `recomputeSupplierSummary` incremental = recalculado desde cero (propiedad).
- Dos tenants no ven ni modifican proveedores, plantillas, documentos, evaluaciones ni comunicaciones del otro (incluida la lectura de archivos por clave de storage).
- Con el módulo desactivado, las rutas dan 404; al reactivarlo vuelve todo.
- Importar 500 proveedores por CSV con 3 filas inválidas → vista previa con 497 y 3 errores con número de fila; reimportar no duplica (idempotente por CUIT).
- La lista de 500 con filtros y conteos se resuelve con consultas acotadas (sin N+1, sin traer todas las evaluaciones).
- Las cláusulas del catálogo (`ISO9001:8.4`, `ISO14001:8.1`, `ISO45001:8.1.4`) existen en el catálogo ISO sembrado (verificado en esta investigación; incluyen sus subcláusulas 8.4.1 a 8.4.3 y 8.1.4.1 a 8.1.4.3).

**e2e:** alta de un proveedor crítico → evaluación → aprobado → figura en la lista de aprobados; alta de un contratista, evaluación condicional con plan de mejora, y vencimiento de su ART que lo pasa a "no habilitado".

## Fuera de alcance

Portal o autoservicio del proveedor · módulo de compras, órdenes de compra y recepción (por eso no hay puntaje automático por entregas o rechazos) · integración con ARCA o con las ART · verificación del contenido de pólizas y de la cláusula de no repetición · evaluación por sede · cuestionarios enviados al proveedor · aptitud médica y datos de salud de las personas (ya excluido en master-data) · control de montos de compras · aprobación en dos pasos y override del resultado · envío real de mails (sigue el stub) · estudios de ciclo de vida · scoring financiero del proveedor · migrar `Finding.location` a sede.

## Plan vertical (Task 19)

Una sola regla de integración: cada slice es un PR; los cambios en modelos compartidos (valor `supplier_evaluation` en `ActionLinkTarget`, `Person.supplierId`) van **solos y primero** en 19.1, aditivos, para no pisar a otros módulos de la Fase 5 (ver `SPEC-fase5-fundacion.md`). El módulo cambia en el catálogo de `planned` a `available` al terminar 19.2 (con `defaultEnabled: false`); `Finding.origin = supplier` ya está reservado.

| Slice | Entrega | Tamaño |
|---|---|---|
| **19.1** Dominio + Prisma | Funciones puras con todas las tablas de casos como tests; schema y migración (`Supplier`, `SupplierSite`, plantillas y criterios, evaluaciones e ítems, tipos de documento y documentos, `SupplierFinding`, `SupplierCommunication`, `SupplierSettings`); `ActionLinkTarget.supplier_evaluation`; `Person.supplierId?`; permisos; `ensureSupplierDefaults`; tests de aislamiento entre tenants y de unicidad | M |
| **19.2** Registro y lista | Alta, edición y baja; lista con semáforo, filtros, conteos y paginación en el servidor; ficha (resumen y pestañas vacías); **importación CSV** con vista previa; personas del contratista; **lista de aprobados** exportable; catálogo a `available` | M |
| **19.3** Criterios, evaluación inicial y documentos | Pantalla de criterios con versiones; formulario de evaluación (completa, simplificada, declarada) con cálculo en vivo; `saveEvaluation` y `voidEvaluation`; tipos de documento y carga con `DueItem`; habilitación; evaluación condicional con su `Action` | L (si crece, partir en 19.3a criterios + evaluación y 19.3b documentos) |
| **19.4** Reevaluación | `DueItem` de reevaluación y evaluación inicial pendiente; reevaluación periódica y por evento con evidencia precargada (hallazgos, acciones, documentos); suspensión al no aprobar; avisos | M |
| **19.5** Hallazgos, comunicaciones y cierre | `SupplierFinding` desde la ficha; comunicaciones (requisitos y resultado); franja de conteos y evolución del puntaje; guía breve; menú; e2e; README | M |

Verificación general por slice: `tsc`, `eslint`, `vitest` (unit e integración), y `e2e` desde 19.2.

## Pendiente de validar con profesionales antes de ofrecer los defaults como "recomendados"

- Pesos y descriptores de las plantillas (auditor ISO).
- Juego de documentos de contratistas y cuáles bloquean (abogado laboralista y profesional de seguridad e higiene): Research F.
- Si "cláusula de endoso a favor del principal" (LCT art. 30 reformado) equivale a la "cláusula de no repetición" que piden los pliegos.
- Algoritmo del CUIT contra una fuente oficial.

## Aprobación

- [x] Aprobado por el PO el 2026-10-21 (decisiones 1 a 17, con las recomendaciones del borrador)
