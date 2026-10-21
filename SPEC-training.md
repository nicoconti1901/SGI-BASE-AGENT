# Spec: `training` — Capacitaciones: matriz por puesto y tarea, seguimiento por persona y sede (Task 20)

Estado: **aprobado por el PO el 2026-10-21** (con las recomendaciones del borrador). Base normativa y fuentes: `RESEARCH-training.md`. Depende de la Task 14 (hecha) y de la base común de la Fase 5 (`SPEC-fase5-fundacion.md`, hecha).

## Objective

Que una empresa responda, sin armar planillas, tres preguntas de ISO 9001/14001/45001 §7.2–7.3:
1. **¿Qué necesita saber cada persona?** (según su puesto, sus tareas y lo que se exige a todos).
2. **¿Qué tiene vigente, por vencer, vencido o falta?** por persona y por sede.
3. **¿Lo que se dio funcionó?** (eficacia, solo donde corresponde) y **¿quién está habilitado para una tarea crítica?**

El estado de cada persona en cada curso **se calcula**, nunca se marca a mano. El cliente solo mantiene dos cosas: **los requisitos (la matriz)** y **los registros (lo que se hizo)**.

### Success criteria
- Definir la matriz una vez (puesto, tarea o todo el personal × curso) y ver el semáforo de toda la empresa sin cargar nada más.
- Registrar una sesión con 40 asistentes en menos de un minuto de trabajo del usuario (filtrar por sede o puesto, tildar, resultado por persona, subir la planilla).
- Cambiar el puesto o las tareas de una persona recalcula lo que se le exige **sin tocar su historial**.
- Una persona con un curso obligatorio de una tarea crítica faltante, vencido o en plazo figura **no habilitada** para esa tarea.
- La matriz de 500 personas × 20 cursos y el tablero por sede se calculan **en la base** y paginan; nunca se cargan 10.000 filas en memoria.
- Los vencimientos se avisan agrupados por persona (no por celda) y sin saturar al importar el histórico.
- Dos tenants nunca ven los datos del otro.

## Decisiones a confirmar (defaults propuestos)

| # | Decisión | Default propuesto | Por qué |
|---|---|---|---|
| 1 | **Destinos de un requisito** | Puesto, tarea **o "todo el personal"** (tercer destino). Cada requisito: obligatorio o recomendado. Inducción, toma de conciencia y evacuación se cargan una vez con "todo el personal". | Sin esto hay que tildar cada puesto para los cursos transversales (905/15 Anexo II 13, ISO §7.3). Solo lo obligatorio cuenta para el % y la habilitación. |
| 2 | **Plazo de gracia** | 30 días para requisitos de puesto y de "todo el personal"; **0 para requisitos de tarea crítica y para inducción**. Se cuenta desde el **más tardío** entre ingreso, fecha de asignación del puesto o tarea y fecha de vigencia del requisito. El plazo es **inclusivo** (el último día todavía es "en plazo"). **"En plazo" no habilita una tarea crítica.** | Ver `RESEARCH-training.md` §5: la inducción es "al ingresar" y la capacitación básica de obra tiene plazos cortos; la gracia no puede convivir con una habilitación de seguridad. |
| 3 | **Por vencer** | 30 días por defecto, **configurable por curso** (15–90). Un registro vence **al final** de su fecha de vencimiento (inclusive). | Cursos con proveedor externo necesitan más margen. |
| 4 | **Vigencia** | Cada curso define meses (1–120) o "no vence". El vencimiento se **guarda en cada registro** (foto del momento). Un certificado externo puede traer su **propia fecha**. Cambiar la vigencia del curso **no** reescribe registros ya cargados; una acción explícita "recalcular vigencias del curso" lo hace, con auditoría. | Auditable ("el certificado decía hasta el X"), indexable para la agregación, y permite el vencimiento del proveedor. |
| 5 | **Eficacia** | Solo cursos con la casilla "requiere eficacia". Plazo por curso, default **90 días** (30–180). Evaluación **por sesión** (método, criterio, resultado) con **excepciones por persona**. No eficaz → se crea una `Action` o se fija una nueva fecha. Si el curso es requisito obligatorio de una **tarea crítica**, un "no eficaz" **deja de habilitar** hasta que haya un nuevo registro aprobado. | Ver `RESEARCH-training.md` §3: evitar la eficacia de papel y dar consecuencia real. |
| 6 | **Resultado del registro** | `aprobado` / `no aprobado`, marcado por quien registra. Nota numérica (0–100) opcional e informativa; no se aprueba automáticamente por nota. Un `no aprobado` no invalida un registro aprobado anterior todavía vigente. | La Res. 905/15 pide definir la metodología de evaluación, no un umbral numérico. |
| 7 | **Contratistas** | Las personas de contratistas (`employer = contractor`) se exigen igual que las propias. | ISO §7.2/7.3 alcanza a quien trabaja bajo control de la organización; 905/15 Anexo I ítem 20 menciona al personal eventual. |
| 8 | **Quién recibe los avisos** | Un `DueItem` abierto **por persona**; `ownerUserId` = el **responsable de capacitaciones** de la empresa (ajuste de empresa, un usuario) y, si la persona tiene usuario, ella lo ve en su ficha. Sin responsable definido, el aviso va a los administradores agrupado por sede (mecanismo de la base común). La evaluación de eficacia va al **evaluador designado** en la sesión. | `Person` puede no tener usuario; `DueItem.ownerUserId` es un usuario. |
| 9 | **Importación del histórico** | CSV de registros. Los cursos deben existir. Reimportar actualiza, no duplica. Los registros importados nacen **sin avisos**: lo que ya está vencido aparece en el tablero pero **no** dispara mails ni notificaciones el primer día. Se marcan "sin evidencia" hasta que se suba el archivo. | Evitar 500 avisos en la puesta en marcha. |
| 10 | **Columnas nuevas en datos maestros** | `PersonJobTask.assignedAt` y `Person.positionSince`. Se escriben al asignar una tarea o cambiar de puesto. Backfill con la fecha de alta de la persona. | Sin estas fechas el plazo de gracia por cambio de puesto o tarea no se puede calcular. Es un cambio **aditivo** en modelos de la Task 14 (ver "Cambios en modelos compartidos"). |
| 11 | **Catálogo sugerido** | El cliente puede **importar** cursos desde una lista sugerida (código, no datos) con vigencia sugerida y etiqueta de confianza (ver `RESEARCH-training.md` §7). Nada se activa sin que el cliente lo elija; todas las vigencias son editables. | Evita la hoja en blanco sin presentar como ley lo que no está verificado. |
| 12 | **Plan anual** | Se modela con **sesiones planificadas** (`planned`) por sede y nivel (superior / intermedio / operativo, Dec. 351 art. 210). Vista plan vs realizado y exportación para firma. El plan firmado se sube a **Documentos** (módulo existente). Deja de ser "opcional": es exigencia del Dec. 351 art. 211 y la Res. 905/15. | Ver `RESEARCH-training.md` §4. |
| 13 | **Corrección de errores** | Un registro o una sesión se **anula con motivo** (nunca se borra) y se vuelve a cargar. Los anulados no cuentan para nada y se ven en el historial. | Trazabilidad de auditoría. |
| 14 | **Visibilidad de la nota** | Todos los roles ven estado, fechas y resultado. La **nota numérica y las observaciones** solo las ven quienes pueden registrar. | La nota es dato de desempeño; el estado es dato de cumplimiento. |
| 15 | **Sello de revisión de la matriz** | Un registro simple: fecha, quién, y nota libre con **quiénes participaron o fueron consultados** (ISO 45001 §5.4). Se agrega 45001 §5.4 a las cláusulas del módulo. | Es la pregunta típica de auditoría de 45001. |

## Domain model (conceptual)

Todos los modelos llevan `tenantId` y se leen por los helpers tenant-scoped existentes. Los IDs de otros módulos se referencian por FK normal (patrón de la Task 14). Los vínculos van **del lado del módulo** (regla de la Fase 5): `TrainingEffectiveness.actionId`, no se agregan columnas a `Finding` ni valores a `ActionLinkTarget`.

- **Course**: `name` (único por tenant), `code`?, `category` (`induction`, `awareness`, `safety`, `environment`, `quality`, `driving`, `other`), `standards` (qué normas ayuda a cumplir), `modality` (`in_person`, `online`, `on_the_job`, `external`), `defaultHours`?, `validityMonths`? (nulo = no vence; 1–120), `reminderDays` (default 30), `requiresEffectiveness`, `effectivenessDays` (default 90), `legalBasis`? (texto libre, p. ej. "Res. SRT 905/15 Anexo II 9.3"), `defaultProvider`?, `active`. La baja es lógica y se bloquea si tiene requisitos activos (mismo criterio que la Task 14).
- **TrainingRequirement**: `courseId`, `targetKind` (`position` / `task` / `all`), `positionId`?, `jobTaskId`?, `mandatory`, `graceDays` (0–365), `effectiveFrom` (fecha; default hoy). Restricción CHECK: coherencia entre `targetKind` y las FK (exactamente la que corresponde). Únicos parciales: (curso, puesto), (curso, tarea) y (curso) para `all`.
- **TrainingSession**: `courseId`, `status` (`planned` / `held` / `cancelled`), `heldAt` (o fecha planificada), `siteId`?, `level`? (`senior` / `middle` / `operational`), `instructorKind` (`internal` / `external`), `instructorName`, `providerName`?, `hours`?, `evaluatorUserId`?, `notes`, anulación con motivo. Planilla de asistencia como adjunto.
- **TrainingRecord**: `personId`, `courseId`, `sessionId`?, `completedAt` (fecha), `result` (`passed` / `failed`), `score`? (0–100), `validUntil`? (foto del vencimiento; nulo = no vence), `validUntilSource` (`computed` / `certificate`), `source` (`session` / `individual` / `import`), `certificateNumber`?, `providerName`?, `notes`, anulación (`voidedAt`, `voidedByUserId`, `voidReason`). Únicos: (sesión, persona) si hay sesión y no está anulado; (persona, curso, `completedAt`, `result`) entre los no anulados (idempotencia de la importación y del doble clic).
- **TrainingEffectiveness**: `recordId` (único), `dueAt`, `evaluatorUserId`?, `status` (reutiliza `EffectivenessStatus`: `pending` / `effective` / `partially_effective` / `not_effective` / `not_applicable`), `method` (`observation` / `practical_test` / `written_test` / `indicator` / `supervisor_review`), `note`, `evaluatedAt`?, `actionId`?, `rescheduledTo`?. Se crea al registrar un `passed` de un curso con `requiresEffectiveness`.
- **TrainingAttachment**: `sessionId` **o** `recordId` (CHECK exactamente uno), `storageKey`, `fileName`, `contentType`, `sizeBytes`, `uploadedById`. Mismo patrón y mismo almacenamiento S3 que `ActionAttachment` (`src/lib/storage`). Tipos permitidos: PDF, JPG, PNG; tamaño máximo a definir en el diseño (referencia: el de los adjuntos de hallazgos).
- **TrainingSettings** (una fila por tenant): `ownerUserId`? (responsable de avisos), `matrixReviewedAt`?, `matrixReviewedByUserId`?, `matrixReviewNote`?.
- **TrainingAudit**: quién, cuándo, qué y motivo, para cambios de curso, requisito, anulaciones e importaciones (mismo estilo que `MasterDataAudit`).

### Cambios en modelos compartidos (marcar en el PR)
- `PersonJobTask.assignedAt DateTime @default(now())` y `Person.positionSince DateTime?`: aditivos; el código de `src/lib/masterdata.ts` los escribe al asignar tarea o cambiar de puesto. Backfill: fecha de alta de la persona. **Van en el primer PR de la Task 20 (20.1)**, antes de cualquier otra cosa del módulo.
- `DueItem`: **sin cambios** (usa `personId`, `siteId`, `ownerUserId`, `entityType`, `entityId`).
- `Finding`, `ActionLinkTarget`, `authz.ts` (solo se **agregan** dos acciones): sin otros cambios.

### Funciones puras (`src/domain/training/`)

Todas reciben `today` (fecha en la zona del tenant; default `America/Argentina/Buenos_Aires`) y no leen la base ni el reloj.

**`resolveRequirements(person, requirements, today)`** → una fila por curso exigido a la persona.
- Fuentes: requisitos de su puesto + de cada tarea asignada + los de "todo el personal". Persona inactiva → ninguna.
- Si un curso se exige por varias fuentes: `mandatory` = **alguna** es obligatoria; `graceEnd` = el **más temprano** entre las fuentes obligatorias (gana la más estricta).
- Cada fuente: `graceEnd = max(hiredAt, positionSince / assignedAt de esa fuente, effectiveFrom) + graceDays`.

**`computeTrainingStatus(person, requirements, records, today)`** → por curso: `{ courseId, status, mandatory, validUntil?, daysToExpiry?, detail?, effectiveness? }`, con `status` ∈ {`valid`, `expiring`, `expired`, `missing`, `in_grace`, `not_required`}.
1. El **mejor registro** es el aprobado, no anulado y con `completedAt ≤ today` que tenga el **mayor** `validUntil` (nulo = infinito).
2. Con mejor registro: `validUntil` nulo → `valid`; `validUntil < today` → `expired`; `validUntil − today ≤ reminderDays` → `expiring`; si no, `valid`. La gracia **no** se aplica a una renovación.
3. Sin ningún aprobado: si hay fuente obligatoria y `today ≤ graceEnd` → `in_grace`; si no → `missing`. Si el último intento fue `failed`, `detail = "failed"`.
4. Curso no exigido pero con registros → `not_required` (se ve en la ficha como "otros cursos", no cuenta).
5. Solo recomendado: se calcula igual pero `mandatory = false` (no entra en %, ni en habilitación, ni en avisos).
6. `effectiveness` del mejor registro: `pending` / `effective` / `not_effective` / `n/a`.

**`isQualifiedForTask(person, taskId, requirements, records, today)`** → `{ qualified, hasRequirements, assigned, blockers: [{courseId, reason}] }`.
- Considera solo los requisitos **obligatorios de esa tarea**. `qualified` ⇔ cada uno está `valid` o `expiring` y su eficacia no es `not_effective`.
- Motivos de bloqueo: `missing`, `expired`, `in_grace`, `ineffective`.
- Tarea sin requisitos obligatorios → `qualified: true`, `hasRequirements: false` (el consumidor muestra "sin requisitos definidos").
- `assigned` indica si la tarea figura entre las de la persona; el cálculo no depende de eso (el consumidor decide).

**`computeValidUntil(completedAt, validityMonths)`**: suma de meses con ajuste a fin de mes. **`summarizeCompliance(statuses)`**: `% = (valid + expiring) / (valid + expiring + expired + missing + in_grace)` solo obligatorios; `in_grace` suma al denominador pero se informa aparte.
**`planTrainingImport(existing, rows)`** y **`parseTrainingCsv`**: `create` / `update` / `unchanged` / `error` por fila, con número de fila.
**`planDueItemSync(personSummary, existingDueItem)`**: devuelve `create` / `update` / `close` / `noop` (ver "Avisos").

### Tabla de casos de las funciones puras

Convención: hoy = `2026-10-21`; `reminderDays = 30`; curso con vigencia de 12 meses salvo que se diga otra cosa.

| # | Caso | Entrada resumida | Resultado esperado |
|---|---|---|---|
| 1 | Dentro de la gracia | Obligatorio por puesto, gracia 30, `positionSince = 2026-09-21`, sin registros | `in_grace` (`graceEnd = 2026-10-21`, último día inclusive) |
| 2 | Gracia vencida | Igual, `positionSince = 2026-09-20` | `missing` |
| 3 | Vigente | Aprobado `2026-08-19`, 12 meses (`validUntil 2027-08-19`) | `valid` |
| 4 | Por vencer, límite | `validUntil = 2026-11-20` (hoy + 30) | `expiring` |
| 5 | No por vencer aún | `validUntil = 2026-11-21` (hoy + 31) | `valid` |
| 6 | Vence hoy | `validUntil = 2026-10-21` | `expiring` (vigente todo el día) |
| 7 | Venció ayer | `validUntil = 2026-10-20` | `expired` (sin gracia de renovación) |
| 8 | Reprobado, en plazo | Solo un `failed`; dentro de gracia | `in_grace`, `detail = failed` |
| 9 | Reprobado, fuera de plazo | Solo un `failed`; gracia vencida | `missing`, `detail = failed` |
| 10 | Falla posterior a un vigente | `passed` vigente (vence 2027-03-01) + `failed` más nuevo | `valid` (el fallo no invalida el anterior) |
| 11 | Curso sin vencimiento | `validityMonths = null`, aprobado en 2019 | `valid`, `validUntil = null`, no genera vencimiento |
| 12 | Cambio de puesto | Puesto A exige X (vigente) y Puesto B exige Y (sin registros), `positionSince = 2026-10-16` | X: `not_required` (registro intacto); Y: `in_grace`. Volver a A → X vuelve a `valid` sin recargar nada |
| 13 | Dos fuentes, gana la estricta | Curso exigido por puesto (gracia 30, en plazo) y por tarea crítica (gracia 0) | `missing`, `mandatory = true` |
| 14 | Obligatorio y recomendado | Obligatorio por puesto, recomendado por tarea | `mandatory = true` |
| 15 | Solo recomendado, sin registro | `mandatory = false` | `missing` con `mandatory = false`: fuera del % y de los avisos |
| 16 | Registro futuro | `completedAt = 2026-10-25` | Ignorado (la persona sigue como sin registro) |
| 17 | Registro anulado | Único registro con `voidedAt` | Ignorado |
| 18 | Registros desordenados | Dos aprobados: uno vence 2026-12-01 (cargado último), otro 2027-06-30 | Se usa el de mayor `validUntil` (2027-06-30) |
| 19 | Requisito nuevo para el personal existente | `effectiveFrom = 2026-10-21`, persona ingresó en 2020 | Gracia desde `effectiveFrom`: `in_grace` 30 días, no `missing` de golpe |
| 20 | Persona dada de baja | `status = inactive` | Sin filas; sus registros se conservan |
| 21 | Fin de mes | `completedAt = 2026-01-31`, vigencia 1 mes | `validUntil = 2026-02-28` |
| 22 | Aprobado antes de que se exigiera | Aprobado hace 3 meses, requisito creado hoy | `valid` de inmediato (los registros cuentan siempre) |
| 23 | Habilitación: dos tareas críticas | Altura exige A y B; Izaje exige B y C. A vigente, B vencido, C vigente | Altura: no (B). Izaje: no (B). Al renovar B, ambas sí |
| 24 | Habilitación: solo cae una | Mismo caso, pero A vencido y B, C vigentes | Altura: no (A). Izaje: **sí** |
| 25 | Habilitación: en plazo | Curso obligatorio de tarea crítica `in_grace` | `qualified: false` |
| 26 | Habilitación: por vencer | Curso `expiring` | `qualified: true` (se informa `daysToExpiry`) |
| 27 | Habilitación: no eficaz | Curso `valid` con eficacia `not_effective`, tarea crítica | `qualified: false`, motivo `ineffective`; vuelve a `true` con un nuevo aprobado |
| 28 | Habilitación: eficacia pendiente o vencida sin evaluar | Eficacia `pending` | `qualified: true` (la falta de evaluación no bloquea; se señala en la bandeja del evaluador) |
| 29 | Tarea crítica sin requisitos | Sin obligatorios | `qualified: true`, `hasRequirements: false` |
| 30 | Persona sin la tarea asignada | `assigned: false` | Se calcula igual; `assigned: false` |
| 31 | Contratista | `employer = contractor`, mismos requisitos | Se calcula igual que una persona propia |
| 32 | % de cumplimiento | 10 obligatorios: 6 `valid`, 1 `expiring`, 1 `expired`, 1 `missing`, 1 `in_grace` | 70 %; `in_grace` se informa aparte |
| 33 | Importación | Misma fila (legajo, curso, fecha, resultado) | `unchanged`; con otra nota o vencimiento: `update`; curso inexistente: `error` con fila y motivo |

## Estrategia de cálculo y paginación a escala

**Principio:** el estado es una función del tiempo. No se persiste (no hay tabla `status` que haya que mantener ni recalcular de noche). Se calcula **al leer**, de dos maneras que dan el mismo resultado:

1. **Vistas individuales** (ficha de una persona, `isQualifiedForTask`, pickers, el bloque de un registro recién cargado): se usa la **función pura en TypeScript** con los datos de **una** persona (a lo sumo unas decenas de requisitos y registros). Son 2–3 consultas acotadas por `personId`.
2. **Vistas agregadas** (tablero por sede, matriz de cumplimiento, exportación, conciliación de avisos): una **consulta SQL parametrizada** (`$queryRaw`, siempre con `tenantId` como primer parámetro) que reproduce la misma regla:
   - Expande lo exigido: `person` ⨝ `training_requirement` (por `positionId`, por tarea en `person_job_task`, o `targetKind = all`), agrupado por (persona, curso) con `bool_or(mandatory)` y `min(graceEnd)`.
   - Une el **mejor registro** con un `LATERAL` sobre un índice parcial (aprobado, no anulado): el de mayor `validUntil`.
   - Resuelve el estado con un `CASE` usando `today` como parámetro.
   - Filtros en la base: **sede** (base **o** adicional, con `EXISTS` sobre `person_site`), puesto, tarea, curso, estado (persona con al menos una celda en ese estado, con `EXISTS`), solo activos.
3. **Garantía de paridad:** la función TypeScript es **la especificación**. Un test de paridad siembra un conjunto aleatorio fijo (≥ 300 personas, cambios de puesto, registros fuera de orden, anulados, futuros) y compara **celda por celda** el estado de SQL contra el de TypeScript. Si difieren, falla CI.

### Paginación y límites
- **Matriz:** paginación por **persona** con cursor (`nombre, id`), 50 por página. Para esas 50 personas se traen solo sus celdas (≤ 50 × columnas). Columnas = cursos obligatorios para el filtro actual, con un selector y tope de **25 visibles**; el resto, por scroll o selección. Nunca se arma la matriz completa.
- **Resumen y tablero:** una consulta `GROUP BY` (sede, estado) que devuelve filas agregadas (a lo sumo sedes × 6), otra para "faltantes por curso" (top N) y otra para los buckets 30/60/90 días sobre `validUntil`. Sin traer personas.
- **Exportación CSV:** formato largo (una fila por persona y curso), por lotes de 500 personas con cursor y respuesta en streaming; límite por solicitud y registro de auditoría.
- **Importación de registros:** hasta 5.000 filas por archivo; validación en memoria de las filas (no de la tabla), upsert en lotes dentro de transacciones por lote.
- **Índices** (a revisar con `/review-migration`): `training_record (tenantId, personId, courseId, completedAt)`; parcial `training_record (tenantId, courseId, validUntil) WHERE result='passed' AND voidedAt IS NULL`; únicos parciales de `training_requirement`; los de `person`, `person_site (tenantId, siteId)` y `person_job_task (tenantId, jobTaskId)` ya existen. `training_attachment (tenantId, recordId)` y `(tenantId, sessionId)`.
- **Presupuesto de rendimiento (verificable en tests de integración):** con 2.000 personas × 30 cursos sembrados, el tablero y una página de matriz no ejecutan más de **N consultas fijas** (independiente del número de personas) y ninguna consulta carga `findMany` sin `take` sobre `person`, `training_record` o `training_requirement`. Objetivo orientativo: tablero < 300 ms y ficha < 100 ms en la base de CI.

### Por qué no una tabla de estado materializada
Los estados cambian por el paso del tiempo (un `valid` pasa a `expiring` sin que nadie escriba nada) y por cambios en datos maestros que este módulo no controla (otro módulo cambia el puesto). Una tabla materializada exigiría un trabajo nocturno y puntos de invalidación en dos módulos. Se reabre solo si las mediciones del presupuesto no se cumplen.

## Avisos (`DueItem`) y eficacia

- **Un `DueItem` abierto por persona** (`entityType = "training_person"`, `entityId = personId`, `personId`, `siteId = sede base`, `ownerUserId` = responsable de capacitaciones). Su `dueAt` es **el primer instante en que la persona deja de cumplir**: el menor entre los `validUntil` de sus cursos obligatorios vigentes y el `graceEnd` de los obligatorios faltantes. `leadDays` = `reminderDays` más chico entre esos cursos. El título lleva los conteos ("Juan Pérez: 1 vencida, 2 por vencer"). Si ya no hay nada pendiente, se **cierra**. Cuando renueva un curso se recalcula al siguiente punto.
- **Conciliación idempotente:** una consulta SQL por tenant arma (persona, próximo `dueAt`, conteos) y se compara contra los `DueItem` abiertos; se aplica solo la diferencia (`planDueItemSync`). Corre en el scan diario existente **solo para tenants con el módulo activo**, y además de forma inmediata para la persona afectada después de cada alta, anulación o corrección. Cubre el caso de que otro módulo cambie el puesto o las tareas sin avisar.
- **Sin avisos por celda.** La app muestra el detalle por curso en la ficha y la matriz; el mail diario por persona/sede ya lo arma la base común.
- **Alta silenciosa del histórico:** registros importados y requisitos creados en lote **no disparan recordatorios** de lo que ya estaba vencido o faltante (se marcan como ya avisados con el mecanismo de `lastReminderKind` de `src/lib/automation.ts`; el detalle se confirma en el diseño de 20.5). Solo avisan las transiciones posteriores.
- **Riesgo conocido:** 500 personas con vencimiento el mismo mes generan 500 `DueItem` y, según la base común, una notificación in-app por vencimiento. Mitigación propuesta: alta silenciosa (arriba), y proponer en 20.5 que el scan agrupe las notificaciones in-app por `entityType` cuando superan un umbral. Si la base común no lo permite, se decide con el PO antes de 20.5.
- **Eficacia:** al registrar un aprobado de un curso con `requiresEffectiveness` se crea un `TrainingEffectiveness`. Un `DueItem` por **sesión** (`entityType = "training_session_effectiveness"`, `dueAt = heldAt + effectivenessDays`, dueño = evaluador designado) o por registro individual si no hay sesión. Se cierra cuando todos los asistentes quedan resueltos.
- **No eficaz:** el evaluador elige (a) **crear una `Action`** (se vincula con `TrainingEffectiveness.actionId`; dueño = evaluador, fecha sugerida; no se crea un modelo de acción nuevo) o (b) **reprogramar** la evaluación (`rescheduledTo`). Siempre con nota. Un hallazgo (`Finding`) se puede abrir a mano si el cliente lo considera una no conformidad: fuera de alcance automatizarlo.

## Permisos

Se agregan dos acciones en `src/domain/identity/authz.ts`, con el mismo patrón que `manage_master_data` / `assign_job_tasks`.

| Rol | Ver (matriz, tablero, fichas) | Registrar sesiones y registros, importar | Cursos y matriz de requisitos, anular, sello de revisión | Evaluar eficacia |
|---|---|---|---|---|
| `tenant_admin` | sí | sí | sí (`manage_training`) | sí |
| `process_owner` | sí | sí (`record_training`) | sí (`manage_training`) | sí |
| `contributor` | sí | sí (`record_training`) | no | solo si es el evaluador designado |
| `viewer` | sí | no | no | no |

- La nota y las observaciones se ocultan a quien no tiene `record_training` (decisión 14).
- El módulo respeta la activación por empresa: desactivado, sus páginas dan 404 (no reemplaza los permisos).
- Cada alta, edición, anulación, cambio de requisito e importación deja registro de auditoría (quién, cuándo, qué, motivo).
- Los archivos se sirven por URL firmada y solo dentro del tenant. Un certificado puede contener el DNI: se aplica el mismo criterio de acceso que a los adjuntos de hallazgos.

## Qué ve el cliente

Menú **Personas y terceros → Capacitaciones** (`/t/[slug]/training`), activable por empresa. Cinco pestañas, sin jerga ISO en los títulos.

1. **Resumen.** Tarjetas por sede con un semáforo: % de cumplimiento, cuántas vencidas, por vencer a 30/60/90 días, y "los cursos que más faltan". Filtro de sede. Un clic en un número abre la matriz ya filtrada.
2. **Cumplimiento (la matriz).** Personas en filas y cursos en columnas, una celda con color y fecha de vencimiento. Filtros por sede, puesto, tarea, estado y curso; buscador por nombre o legajo; 50 personas por página; botón "Exportar CSV". Clic en una persona abre su ficha.
3. **Ficha de la persona** (`/training/people/[id]`, también enlazada desde Datos maestros). Cursos exigidos con estado, historial de lo realizado (incluido lo de un puesto anterior), próximos vencimientos, **tareas para las que está habilitada** y por qué no lo está (p. ej. "falta Trabajo en altura"), archivos de evidencia y botón "Registrar capacitación".
4. **Sesiones.** Lista de sesiones realizadas y planificadas (con el plan vs realizado por sede). **"Nueva sesión"**: curso, fecha, sede, instructor (interno o externo), evaluador de eficacia si corresponde; se eligen asistentes filtrando por sede o puesto y tildando, con resultado por asistente (aprobó / no aprobó, nota opcional); se sube la planilla firmada. Un botón "Planilla para imprimir" genera la lista con los campos que pide la Res. 905/15 (tema, contenido, duración, fecha, DNI, puesto, firmas). También: carga individual de un certificado externo (con su propia fecha de vencimiento) e **importación CSV** del histórico (subir, vista previa con válidas / errores / sin cambios, confirmar).
5. **Eficacia.** Bandeja del evaluador: "sesiones a evaluar" con fecha límite. Se completa método, resultado, nota y excepciones por persona; si no fue eficaz, "crear acción" o "reprogramar".

Configuración (solo `manage_training`): **Cursos y requisitos** con dos grillas, **puestos × cursos** y **tareas × cursos**, más una fila "Todo el personal". Cada celda alterna entre "—", "obligatorio" y "recomendado"; el plazo de gracia se edita por celda. Antes de guardar, **vista previa del impacto** ("este cambio exige Trabajo en altura a 34 personas: 12 ya lo tienen, 22 quedan en plazo"). El editor avisa si una **tarea crítica no tiene cursos obligatorios**. Desde ahí se puede importar del **catálogo sugerido** y registrar el **sello de revisión de la matriz** (fecha, quién, quiénes participaron).

Importar CSV de registros: columnas `legajo, curso, fecha, resultado, nota, vence, proveedor, certificado`. Personas por legajo, cursos por nombre o código. Los cursos o legajos inexistentes se informan por fila; no se crean en silencio. Lo importado queda marcado "sin evidencia" hasta subir el archivo.

Copy y estilo según identidad SGI (skill `sgi-frontend-identity`): qué es, qué hacer, sin jerga.

## Acceptance tests (ejemplos)

**Dominio (unit)**: los 33 casos de la tabla; paridad SQL/TypeScript sobre el conjunto sembrado; `computeValidUntil` con fin de mes y años bisiestos; `planDueItemSync` (crear, actualizar, cerrar, sin cambios).

**Integración**
- Una sesión con 10 asistentes crea 10 registros, **un** `DueItem` de eficacia (si el curso lo pide) y actualiza los `DueItem` de las 10 personas; repetir la misma sesión no duplica.
- Cambiar el puesto de una persona (por el módulo de datos maestros) y correr la conciliación: sus requisitos cambian, su historial queda igual y su `DueItem` se recalcula.
- Anular un registro lo saca del cálculo y vuelve a calcular el vencimiento; el registro anulado sigue en el historial con motivo.
- Dos tenants: ninguna lectura ni escritura (cursos, requisitos, sesiones, registros, adjuntos) cruza de uno a otro; un `personId` de otro tenant se rechaza.
- Reimportar el mismo CSV da 0 creados y N sin cambios; una fila con curso inexistente da error con su número de fila; la importación no dispara avisos del backlog.
- Escala: con 2.000 personas × 30 cursos, la página de matriz y el tablero respetan el presupuesto de consultas y devuelven la sede filtrada con el % correcto; el filtro por sede incluye a quien tiene esa sede como adicional.
- Persona inactiva: no aparece en la matriz ni en los pickers, sí en su ficha histórica; sus `DueItem` se cierran.
- Permisos: `viewer` no puede registrar; `contributor` no puede editar la matriz ni anular; la nota no se ve sin `record_training`; módulo desactivado responde 404.
- Una tarea crítica sin cursos obligatorios muestra la advertencia; el cambio de una vigencia de curso no toca registros hasta ejecutar "recalcular".

**e2e**: definir la matriz con vista previa de impacto; registrar una sesión con asistentes y planilla; ver el semáforo por persona y por sede; una persona con el curso crítico vencido figura no habilitada; evaluar la eficacia de una sesión con una excepción y crear la acción.

## Fuera de alcance

- Datos de salud, aptitud médica y exámenes médicos (Res. SRT 37/2010 es de exámenes médicos, no de capacitación).
- Aprendizaje en línea (LMS): reproductor de contenido, exámenes autocorregidos, SCORM.
- Firma electrónica de planillas; el cliente imprime, firma y sube el escaneo.
- Costos y presupuesto de capacitación; evaluación de proveedores de capacitación (eso es la Task 19).
- Generar automáticamente un hallazgo por una capacitación no eficaz.
- Evaluación de competencia por experiencia o por observación como proceso aparte (se puede cargar como registro `source = individual`, sin un flujo propio).
- Portal para que el contratista cargue sus propios certificados.
- Integración con RR. HH. o con proveedores de cursos.
- Validar la vigencia legal de cada curso: las vigencias sugeridas no son asesoramiento legal.
- Pantalla por requisito ISO (ya diferida en la base común); el módulo solo declara las cláusulas 7.2 y 7.3 (y 45001 §5.4 si se aprueba la decisión 15).

## Plan vertical (Task 20)

Cada paso termina con pruebas y es revisable por separado.

1. **20.1 Dominio + Prisma + SQL de paridad.**
   - Migración: modelos de arriba, columnas `assignedAt` / `positionSince`, índices e invariantes (CHECK, únicos parciales). Revisar con `/review-migration`.
   - `src/domain/training/`: `resolveRequirements`, `computeTrainingStatus`, `isQualifiedForTask`, `computeValidUntil`, `summarizeCompliance`, parsers y planes de importación; los 33 casos en `vitest`.
   - `src/lib/training.ts`: consulta SQL agregada y test de paridad; presupuesto de consultas con datos sembrados.
   - `masterdata.ts` escribe `assignedAt` / `positionSince`.
   - Acciones de permiso `manage_training` / `record_training`.
2. **20.2 Catálogo de cursos y editor de la matriz.** Cursos, catálogo sugerido, grillas puesto/tarea × curso con "todo el personal", vista previa del impacto, advertencia de tarea crítica sin cursos, sello de revisión. El módulo pasa a `status: "available"` en `catalog.ts` (sigue `defaultEnabled: false`), cláusulas 7.2 y 7.3.
3. **20.3 Registro.** Sesión con asistentes (filtro por sede o puesto), resultado por asistente, adjuntos en S3, planilla para imprimir, carga individual, anulación con motivo, importación CSV del histórico.
4. **20.4 Seguimiento.** Resumen por sede, matriz paginada con filtros, ficha por persona con habilitaciones, exportación CSV.
5. **20.5 Avisos, eficacia y plan anual.** Conciliación de `DueItem` por persona (alta silenciosa), `TrainingEffectiveness` con bandeja, `Action` por "no eficaz", sesiones planificadas y plan vs realizado por sede.
6. **20.6 Uso de las habilitaciones.** `getTaskQualification(personId, taskId)` en `src/lib/training.ts` y una insignia "habilitado / no habilitado" en `PersonPicker` (propiedad opcional). Se conecta en 15.9, 15.11 y 18.4 a medida que existan; hasta entonces siguen siendo ítems manuales del checklist. Guía, menú, e2e, README.

## Decisiones del PO

Aprobadas el 2026-10-21 con las recomendaciones del borrador. Las cinco que más condicionan el trabajo: (2) gracia y habilitación, (5) alcance y consecuencia de la eficacia, (1) y (7) destino "todo el personal" y contratistas, (8) y (9) avisos, responsable y alta silenciosa, (11) catálogo sugerido con vigencias a validar.

## Aprobación

- [x] Aprobado por el PO el 2026-10-21, con las recomendaciones del borrador
- [ ] Vigencias del catálogo sugerido validadas por un profesional de Higiene y Seguridad (pendiente; ver `RESEARCH-training.md` §10)
