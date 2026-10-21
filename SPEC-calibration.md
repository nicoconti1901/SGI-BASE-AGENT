# Spec: `calibration` — Equipos de medición y calibraciones (Task 16)

Estado: **borrador, pendiente de aprobación del PO** (2026-10-21). Investigación de respaldo: `RESEARCH-calibration.md` (las referencias "R§" apuntan a sus secciones).
Depende de: Task 15.1–15.2 (`Asset`), Task 14 (`Site`, `Person`), base común de la Fase 5 (`DueItem`, `Action`, `Finding.origin`, catálogo de módulos).

## Objective

Que la empresa sepa, de un vistazo, **qué equipos de medición puede usar hoy y cuáles no**, y que pueda demostrar a un auditor la trazabilidad de cada medición: quién calibró, contra qué patrón, con qué error e incertidumbre, si el equipo era apto, y qué se hizo cuando no lo era.

Cubre ISO 9001 §7.1.5 (§7.1.5.1 y §7.1.5.2), ISO 14001 §9.1.1 e ISO 45001 §9.1.1 (R§A). Cláusulas verificadas en el catálogo sembrado: `ISO9001:7.1.5`, `ISO9001:7.1.5.1`, `ISO9001:7.1.5.2`, `ISO14001:9.1.1`, `ISO45001:9.1.1`. La entrada `instruments` de `src/domain/modules/catalog.ts` ya declara tres de ellas; se propone **sumar `ISO9001:7.1.5.1`** (evidencia de aptitud) y pasar `status` a `"available"` al terminar 16.2.

### Success criteria
- Un equipo vencido, no apto, sin calibración inicial, en calibración o con evaluación de impacto pendiente se ve como **"No usar"** en la lista, la ficha y los selectores de otros módulos, con el motivo.
- El resultado de una calibración se **calcula** de los puntos; nadie lo tipea. El estado del equipo se **deriva**; nadie lo edita.
- Un certificado de un detector de gases con 3 puntos se carga en menos de 2 minutos y muestra pasa/no pasa por punto con la razón.
- Un equipo que salió fuera de tolerancia no vuelve a "utilizable" sin una evaluación de impacto registrada.
- Dos empresas nunca ven los equipos ni los certificados de la otra.
- Con 1.000 equipos, la lista y los contadores responden con consultas agregadas en la base y paginadas, sin cargar todo en memoria.

## Decisiones a confirmar (defaults propuestos)

| # | Decisión | Default | Nota de la investigación |
|---|---|---|---|
| 1 | Regla de decisión | Por equipo, tres opciones: **`guard_band`** (default: apto si `\|e\| + U ≤ EMP` en todos los puntos), `simple_acceptance` (`\|e\| ≤ EMP`, con justificación obligatoria) y `certificate_statement` ("conforme" del laboratorio, sin números). La regla y el EMP aplicados se guardan en cada punto | El default equivale a banda de guarda w = U (JCGM 106 §8.3; ≤ 2,3 % de falsa aceptación en el límite). Aceptación simple es legítima y documentada (R§C) |
| 2 | "Conforme" del laboratorio sin puntos | Se acepta solo si el certificado informa la **especificación** y la **regla de decisión**, y el equipo **no** es de uso crítico | Sin esas dos cosas, una declaración de conformidad no es comparable (17025 §7.8.6, R§A) |
| 3 | Error y signo | `error = medido − nominal` (indicación menos patrón). Se cargan nominal y medido; el error se calcula. U = incertidumbre **expandida** informada, en las unidades del mensurando; `k` se registra (default 2) | Convención VIM; evita errores de signo con certificados que informan "corrección" |
| 4 | EMP | Por canal, fórmula lineal: `EMP = abs + %lectura × \|nominal\| + %fondo de escala × rango`. Lo fija el tenant según el **uso**; puede precargarse del manual del fabricante | Cubre "±10–20 % del gas aplicado" y "±(1 % + 2 dígitos)". Un EMP en cero se rechaza al guardar (R§A, ISO 10012) |
| 5 | Equipos de varios canales | Un equipo tiene N **canales** (sensor/magnitud/unidad/rango/EMP); un multigás tiene O₂, CO, H₂S, LEL. Un registro debe cubrir todos los canales activos | Sin esto no se puede cargar un detector real |
| 6 | As-found / as-left | Si se ajustó, el registro lleva dos juegos de puntos. El **as-left** decide si el equipo vuelve a servir; el **as-found** decide si hay impacto en el pasado | R§D y R§F |
| 7 | Estados | Derivados: `valid`, `due_soon`, `expired`, `not_apt`, `in_calibration` + `never_calibrated`, `impact_pending`, `not_required`. Se agrupan en 5 colores en pantalla | Agrego tres a los cinco del todo.md (ver "Estados") |
| 8 | Intervalos | Sin intervalo normativo universal (R§E). Se precargan **sugerencias editables** por tipo: 12 meses en general; **6 meses** en detectores portátiles de gases (tope de 180 días de un fabricante); verificación o prueba funcional antes de cada uso en detectores. Campo opcional "motivo del intervalo" | El todo.md y el plan dicen "12 meses" para todo: no aplica a detectores |
| 9 | Aviso previo | `alertLeadDays = 30` por equipo (configurable) | Dar tiempo al laboratorio |
| 10 | Cuándo vence | Desde la **fecha de ejecución** de la calibración (no la del certificado), en meses calendario con ajuste a fin de mes; el equipo es utilizable **todo el día** del vencimiento y vencido desde el día siguiente | Fecha local de la empresa (America/Argentina/Buenos_Aires) |
| 11 | Evaluación de impacto: cuándo | Se abre sola cuando (1) el **as-found es no apto**, (2) se ajustó un equipo de **uso crítico** sin datos as-found, o (3) falla una prueba funcional | Nota: el gatillo es el as-found, no el "no apto" final |
| 12 | Evaluación de impacto: bloqueo | **Bloquea el uso** (`impact_pending`) hasta completarse, para todos los equipos. Si el equipo se da de baja, la evaluación sigue pendiente igual | Las normas exigen evaluar y actuar, **no** el orden (R§A). El bloqueo es política del producto. Alternativa: bloquear solo los de uso crítico |
| 13 | Hallazgo derivado | **Valor nuevo `calibration` en `FindingOrigin`** (no reutilizar `inspection`). Borrador automático si el cierre es "resultados afectados"; opcional en los demás. Vínculo del lado del módulo: `ImpactAssessment.findingId` | El enum es de un modelo compartido: la migración es una línea (`ALTER TYPE … ADD VALUE`), va en la migración de 16.1 con rebase en serie |
| 14 | Seguimientos | Con `Action` existente, vinculada por una tabla puente del módulo (`ImpactAssessmentAction`), sin tocar `ActionLinkTarget` | Cumple "del lado del módulo" |
| 15 | Dónde viven los datos metrológicos | Tabla 1:1 `InstrumentControl` con columnas filtrables y derivadas; el resto de los atributos descriptivos (marca, modelo, serie, rango) van en el JSON validado de `Asset.attributes` | Los filtros y contadores necesitan columnas indexadas (ver Performance) |
| 16 | Estado en `Asset.status` | **No se escribe.** `Asset.status` (`in_service` / `out_of_service` / `retired`) lo mueve el registro de activos; la utilizabilidad del equipo se compone con `instrumentUsability` | Evita dos fuentes de verdad |
| 17 | Verificación interna | El patrón es **otro equipo registrado** (`referenceStandardAssetId`) y debe estar vigente a la fecha; si no, no se puede cerrar como apta | P10: las calibraciones internas también requieren trazabilidad (R§B) |
| 18 | Trazabilidad del laboratorio | Campo `traceability`: `nmi` (INTI), `accredited_lab` (con casilla "el alcance cubre el servicio" y organismo/n.° de acreditación), `other_lab` (advertencia: documentar la base), `in_house`. No se exige laboratorio acreditado | 9001 exige trazabilidad, no acreditación (R§A). Cómo verificar: directorio del OAA |
| 19 | Certificado | PDF o imagen en el storage S3 existente (mismos tipos y límite que los adjuntos de hallazgos). Un registro **no puede cerrarse** sin certificado salvo `in_house` | Evidencia 9001 §7.1.5.1 |
| 20 | Registro cerrado | No se edita. Se **anula con motivo** y se vuelve a cargar; el anulado se conserva y no cuenta en los cálculos | Patrón de `MeasurementCorrection` |
| 21 | Equipos sin control | Se pueden marcar "indicativo, sin calibración" con **justificación obligatoria**; aparecen en gris como "Sin control metrológico" | 14001/45001 dicen "según corresponda" (R§A) |
| 22 | Prueba funcional (bump test) | Opcional, con una plantilla del motor de la Task 15 (16.5). Una falla pone el equipo fuera de servicio y abre evaluación de impacto. No extiende la vigencia de la calibración | OSHA/ISEA: antes de cada uso, qualitative function check (R§D) |
| 23 | Etiqueta de estado | Vista imprimible mínima (código, última calibración, próximo vencimiento, QR a la ficha). Es una foto del momento; la verdad es la ficha | 9001 §7.1.5.2 (b): identificar el estado |
| 24 | Permisos | Ver tabla "Permisos". Nueva acción `manage_calibration` (admin y responsable de proceso) | — |

## Domain model (conceptual)

Todas las tablas llevan `tenantId` y se leen por los helpers tenant-scoped. Nombres de columna orientativos; el diseño final se revisa en 16.1 con `data-modeling-discipline`.

**Supuesto sobre Task 15.1:** `Asset` ya tiene `tenantId`, `type` (incluye `measuring_equipment`), `code`, `name`, `siteId`, `status`, `assignedPersonId` y `attributes` (JSON). Si 15.1 difiere, solo cambian los nombres de campo.

### `Asset` de tipo `measuring_equipment` — atributos descriptivos (JSON, zod)
Marca, modelo, n.° de serie, fecha de alta/puesta en uso (`inServiceSince`), observaciones. Los **canales** son parte del dominio metrológico y van validados con zod dentro de `InstrumentControl.channels`.

### `InstrumentControl` (1:1 con `Asset`)
- `assetId` (único), `tenantId`.
- `magnitude`: clave del catálogo en código (`gas_concentration`, `pressure`, `temperature`, `mass`, `sound_level`, `illuminance`, `earth_resistance`, `length`, `electrical`, `flow`, `humidity`, `torque`, `other`). Indexada.
- `isReferenceStandard` (patrón de trabajo), `criticalUse` (+ `criticalUseReason`).
- `requiresCalibration`, `calibrationIntervalMonths?`, `requiresVerification`, `verificationIntervalMonths?`, `intervalReason?`, `noControlReason?` (obligatoria si ninguno de los dos requiere control).
- `decisionRule` (`guard_band` | `simple_acceptance` | `certificate_statement`) y `decisionRuleReason?` (obligatoria si no es `guard_band`).
- `alertLeadDays` (default 30).
- `channels` (JSON validado): `[{ key, label, unit, rangeMin, rangeMax, resolution, emp: { abs, pctReading, pctFullScale }, requiredPoints?, active }]`. Al menos un coeficiente de EMP mayor que cero.
- **Columnas derivadas** (las escribe `recomputeInstrumentControl` al cerrar o anular un registro; se pueden reconstruir siempre desde los registros): `calibrationValidUntil?`, `verificationValidUntil?`, `nextDueAt?` (el menor de los dos), `lastDecision?` (`apt` | `not_apt`), `impactPending`, `inCalibrationSince?`, `expectedReturnAt?`.
- Índices: `[tenantId, nextDueAt]`, `[tenantId, magnitude]`, `[tenantId, impactPending]`.

### `CalibrationRecord`
- `assetId`, `kind` (`calibration` | `verification`), `status` (`draft` | `closed` | `voided`), `voidReason?`, `voidedByUserId?`.
- `performedAt` (fecha), `certificateNumber?`, `certificateIssuedAt?`.
- `labName`, `traceability` (`nmi` | `accredited_lab` | `other_lab` | `in_house`), `accreditationBody?`, `accreditationNumber?`, `accreditationScopeCovers?`, `traceabilityBasis?` (texto, obligatoria si `other_lab`), `referenceStandardAssetId?` (obligatorio si `in_house`), `conditions?` (temperatura, humedad: texto libre).
- `adjusted` (boolean).
- Snapshot de la regla: `ruleApplied`, `ruleReasonApplied?`.
- `basis` (`points` | `certificate_statement`); si es `certificate_statement`: `labStatement` (`conforme` | `no_conforme`), `labStatementSpec` (texto), `labDecisionRule` (texto).
- Resultados calculados: `asFoundResult` (`apt` | `not_apt` | `not_evaluated`), `asLeftResult` (`apt` | `not_apt`), `intervalMonthsApplied`, `validUntil?` (solo si `asLeftResult = apt`).
- `loadedByUserId`, `closedAt`, `notes?`.
- Adjuntos (`CalibrationAttachment`: `storageKey`, `fileName`, `contentType`, `sizeBytes`), mismo patrón que `FindingAttachment`.
- Índices: `[tenantId, assetId, performedAt]`, `[tenantId, status]`.

### `CalibrationPoint`
- `recordId`, `tenantId`, `channelKey`, `stage` (`as_found` | `as_left`), `nominal`, `measured`, `uncertainty?`, `coverageK?`.
- **Calculados y guardados al cerrar:** `error`, `empApplied`, `unit`, `ok`, `reason` (`within` | `error_exceeds_emp` | `in_guard_band` | `uncertainty_exceeds_emp` | `missing_uncertainty`).
- Tipo `Decimal` (no `Float`); el dominio opera en decimal exacto.

### `ImpactAssessment`
- `assetId`, `triggerRecordId?` (único cuando existe), `trigger` (`as_found_not_apt` | `adjusted_without_as_found` | `functional_check_failed`).
- `windowFrom?` (fecha del último registro apto; nulo = "desde que se empezó a usar"), `windowTo`.
- `status` (`pending` | `completed`), `outcome?` (`no_affected_results` | `affected_results_actioned` | `cannot_determine`), `affectedSummary` (qué se midió con el equipo), `rationale` (obligatoria), `completedByUserId?`, `completedAt?`, `findingId?`.
- `ImpactAssessmentAction`: `impactAssessmentId` × `actionId` (única).
- Regla: `outcome` distinto de `no_affected_results` exige al menos una `Action` o un `Finding` vinculado.
- Si Task 15 ya guarda qué equipo usó cada inspección, la ficha de la evaluación lista **las inspecciones hechas con el equipo dentro de la ventana** (solo lectura, sin FK nueva en este módulo).

### `InstrumentShipment` (envío a calibrar; mínimo)
`assetId`, `sentAt`, `expectedReturnAt?`, `returnedAt?`, `labName?`. Mientras `returnedAt` es nulo el equipo está `in_calibration`. Devolver no cambia el estado de calibración: eso lo hace el registro cargado.

## Reglas puras (en `src/domain/calibration/`)

Aritmética **decimal**: las comparaciones usan enteros escalados o una librería decimal, nunca `number` binario (caso 6 de la tabla).

### `resolveEmp(emp, nominal, rangeSpan)`
`abs + pctReading/100 × |nominal| + pctFullScale/100 × rangeSpan`. Con todos los coeficientes en cero es error de configuración (se rechaza al guardar el canal).

### `calibrationDecision({ rule, criticalUse, channels, points, labStatement? })`
Devuelve `{ result: 'apt' | 'not_apt' | 'incomplete', basis, points: [{ error, emp, margin, ok, reason }], incompleteReasons }`.
- `guard_band`: punto OK si `|e| + U ≤ EMP`. Falta U → `incomplete`.
- `simple_acceptance`: punto OK si `|e| ≤ EMP`; si además `|e| + U > EMP` se marca `in_guard_band` como **advertencia**, no como falla.
- `certificate_statement`: sin puntos; `conforme` + especificación y regla informadas + sin uso crítico → `apt`; `no_conforme` → `not_apt`; el resto → `incomplete`.
- `not_apt` si algún punto falla. `incomplete` si falta algún canal activo o hay menos de `requiredPoints` puntos distintos.

Tabla de casos (EMP en las unidades del canal):

| # | Regla | Datos | Resultado | Motivo / nota |
|---|---|---|---|---|
| 1 | guard_band | EMP 0,5 · 10 → 10,2 · U 0,2 | apto | 0,2 + 0,2 = 0,4 |
| 2 | guard_band | EMP 0,5 · 10 → 10,3 · U 0,2 | **apto** | **Límite: `\|e\| + U = EMP`** (inclusivo) |
| 3 | guard_band | EMP 0,5 · 10 → 10,3 · U 0,21 | no apto | `in_guard_band` (0,51 > 0,5; el error solo está dentro del EMP) |
| 4 | guard_band | EMP 0,5 · 10 → 9,7 · U 0,2 | apto | Error negativo simétrico al caso 2 |
| 5 | guard_band | EMP 0,5 · 10 → 10,6 · U 0,1 | no apto | `error_exceeds_emp` (0,6 > 0,5) |
| 6 | guard_band | EMP 0,5 · 0,1 → 0,4 · U 0,2 | **apto** | En `float` binario `0,4 − 0,1` da 0,30000000000000004 y falla; en decimal es 0,3 |
| 7 | guard_band | EMP 0,5 · 10 → 10 · U 0,6 | no apto | `uncertainty_exceeds_emp`: no puede pasar ni con error cero |
| 8 | guard_band | U vacía | incompleto | `missing_uncertainty` |
| 9 | guard_band | H₂S, EMP 10 % de lectura. 10 → 10,5 · U 0,3 · 25 → 27,2 · U 0,3 · 50 → 53,0 · U 0,5 | **apto** | Punto 2 en el límite: EMP 2,5; 2,2 + 0,3 = 2,5. Punto 3: EMP 5,0; 3,0 + 0,5 = 3,5 |
| 10 | guard_band | Igual al caso 9 pero 50 → 55,6 · U 0,5 | no apto | Solo falla el punto 3 (5,6 > 5,0); el resultado lista cuál |
| 11 | guard_band | EMP = 0,5 abs + 5 % lectura · 0 → 0,4 · U 0,1 | apto | Límite en el cero: EMP 0,5 gracias al piso absoluto |
| 12 | guard_band | EMP solo 10 % de lectura · nominal 0 | incompleto | `emp_zero_at_point`: el EMP vale 0 en el cero; usar un punto distinto de cero o definir un piso absoluto |
| 13 | simple_acceptance | EMP 0,5 · 10 → 10,4 · U 0,3 | apto + advertencia | `in_guard_band`: 0,4 ≤ 0,5 pero 0,7 > 0,5 (riesgo compartido) |
| 14 | simple_acceptance | EMP 0,5 · 10 → 10,6 · U 0,3 | no apto | `error_exceeds_emp` |
| 15 | certificate_statement | "conforme", con especificación y regla, uso no crítico | apto (base: certificado) | Etiqueta "declarado por el laboratorio" |
| 16 | certificate_statement | "conforme" sin especificación o sin regla | incompleto | — |
| 17 | certificate_statement | "conforme", uso crítico | incompleto | `certificate_not_allowed_for_critical_use` |
| 18 | certificate_statement | "no conforme" | no apto | — |
| 19 | cualquiera | Multigás con 4 canales activos y puntos de 3 | incompleto | `missing_channel` |
| 20 | cualquiera | Canal con `requiredPoints = 3` y 2 puntos | incompleto | `missing_points` |
| 21 | cualquiera | Canal marcado inactivo sin puntos | no cuenta | Un sensor retirado no bloquea el registro |

### `evaluateRecord(record)`
- Sin ajuste: `asLeftResult = asFoundResult = calibrationDecision(puntos)`.
- Con ajuste: se evalúan los dos juegos por separado. Sin as-left → `incomplete` (no se puede cerrar). Sin as-found → `asFoundResult = not_evaluated`.
- Tabla:

| # | Caso | `asFound` | `asLeft` | Efecto |
|---|---|---|---|---|
| 1 | Sin ajuste, todo dentro | apto | apto | Vigente hasta `validUntil` |
| 2 | Sin ajuste, un punto fuera | no apto | no apto | `not_apt`; evaluación de impacto |
| 3 | Ajustado, as-found fuera, as-left dentro | no apto | apto | Vuelve a servir **tras** la evaluación de impacto |
| 4 | Ajustado, as-found dentro | apto | apto | Sin impacto |
| 5 | Ajustado, sin as-found, uso crítico | no evaluado | apto | Evaluación de impacto (gatillo 2) |
| 6 | Ajustado, sin as-found, uso no crítico | no evaluado | apto | Sin evaluación; se muestra la nota "sin datos as-found" |
| 7 | Ajustado, as-left fuera | cualquiera | no apto | `not_apt` |

### `nextCalibrationDue({ performedAt, intervalMonths })` y `validUntil`
Suma de **meses calendario**; si el día no existe, se usa el último día del mes. `validUntil` = ese día, **inclusive**. Sin intervalo o con `asLeftResult = not_apt` → `null`.

| performedAt | Meses | validUntil |
|---|---|---|
| 2026-10-21 | 12 | 2027-10-21 |
| 2026-01-31 | 1 | 2026-02-28 |
| 2024-02-29 | 12 | 2025-02-28 |
| 2026-08-31 | 6 | 2027-02-28 |
| 2026-10-21 | sin intervalo | null |

### `assessmentRequired({ evaluation, criticalUse, previousAptDate })`
Devuelve `{ required, trigger, windowFrom, windowTo }`. `windowFrom` es la fecha del último registro **apto** anterior (o nulo); `windowTo` es la fecha del registro que detectó la falla. Para la prueba funcional fallida (16.5), `windowFrom` es la última comprobación apta (calibración, verificación o prueba funcional).

### `calibrationStatus({ today, requirements, validity, hold, leadDays })`
Entradas derivadas: `calibrationValidUntil`, `verificationValidUntil` (solo las requeridas), `lastDecision`, `impactPending`, `inCalibrationSince`, `hasAnyAptRecord`. Precedencia (el primero que aplica fija el estado; los demás motivos se listan):

`in_calibration` → `not_apt` → `impact_pending` → `never_calibrated` → `expired` → `due_soon` → `valid`. Sin ningún control requerido: `not_required`.

| # | Situación (hoy → fecha local) | Estado |
|---|---|---|
| 1 | Requiere calibración y no hay ningún registro apto | `never_calibrated` |
| 2 | `validUntil` 2027-10-21, aviso 30 días, hoy 2027-09-20 | `valid` |
| 3 | Ídem, hoy 2027-09-21 | `due_soon` (primer día de la ventana, inclusive) |
| 4 | Ídem, hoy 2027-10-21 | `due_soon` (último día utilizable) |
| 5 | Ídem, hoy 2027-10-22 | `expired` |
| 6 | Hay envío abierto, calibración vigente | `in_calibration` |
| 7 | Último registro no apto, un registro anterior sigue vigente | `not_apt` (el último manda) |
| 8 | Registro apto posterior a uno no apto | `valid` |
| 9 | Requiere calibración **y** verificación; calibración vigente, verificación vencida | `expired` (rige la peor) |
| 10 | Último registro apto pero con evaluación de impacto pendiente | `impact_pending` |
| 11 | Ni calibración ni verificación requeridas, con justificación | `not_required` |
| 12 | Sin justificación y sin control requerido | dato inválido (no se guarda) |

### `instrumentUsability({ assetStatus, status })`
`usable` solo si `assetStatus = in_service` y `status ∈ { valid, due_soon, not_required }`. Devuelve también `reason` en español y un `action` sugerido ("Calibrar", "Completar evaluación de impacto", "Esperar el regreso del laboratorio").

### `wasInstrumentValidOn(date)` (consulta)
Existe un registro `closed`, `asLeftResult = apt` con `performedAt ≤ date ≤ validUntil`. Sirve a los módulos que cargan una medición **con fecha pasada** (por ejemplo, un protocolo de la SRT que debe indicar la calibración vigente al día de la medición).

### `recomputeInstrumentControl(assetId)`
Transaccional e idempotente: lee los registros no anulados, aplica las funciones anteriores, escribe las columnas derivadas y sincroniza los `DueItem`. Se invoca al cerrar o anular un registro, al abrir/cerrar un envío, al completar una evaluación de impacto y al cambiar intervalos.

## Consecuencias

### Vencimientos (`DueItem`)
- Se reutilizan `upsertOpenDueItemForEntity` y `closeDueItemsForEntity` (`src/lib/automation.ts`).
- `entityType`: `instrument_calibration`, `instrument_verification` (con `entityId = assetId`) e `instrument_impact` (con `entityId = id de la evaluación`).
- `dueAt` = fin del día de `validUntil` (local); `leadDays` = `alertLeadDays`; `ownerUserId` = usuario de la persona asignada al activo si existe; `siteId` = sede del activo; `personId` = persona asignada.
- Un único `DueItem` abierto por equipo y tipo. Al cerrar un registro apto se cierra el anterior y se crea el nuevo. Reintentar `recomputeInstrumentControl` no duplica.
- `instrument_impact`: vence a los 10 días corridos de abierta la evaluación (configurable en el código, no por empresa).
- Los avisos usan el resumen diario ya existente: no se crea otro mecanismo de notificación.

### Hallazgo y acciones
- Al completar una evaluación con `outcome ≠ no_affected_results` se crea (o vincula) un `Finding` en borrador con `type = nonconformity`, `origin = calibration`, `location` = nombre de la sede, `source` = "Equipo {código}", `severity` según uso crítico. El vínculo es `ImpactAssessment.findingId`; **no se agrega ninguna columna a `Finding`** salvo el valor del enum.
- Los seguimientos (repetir mediciones, reevaluar lo producido, informar al cliente) son `Action` existentes vinculadas por `ImpactAssessmentAction`.

### Selectores de otros módulos
Se entrega un `InstrumentPicker` (como `SitePicker` y `PersonPicker`): búsqueda por código o nombre, filtro por sede y magnitud. Los equipos no utilizables **aparecen deshabilitados con el motivo** ("No usar: calibración vencida el 12/09/2026"), no se ocultan. Además, el servidor del módulo que lo consume llama a `instrumentUsability` (y a `wasInstrumentValidOn` si la fecha es pasada) antes de guardar: el bloqueo no depende de la pantalla.

## Permisos

| Rol | Ver | Cargar calibración/verificación y envíos | Configurar equipo (regla, EMP, intervalos), anular registros, completar evaluación de impacto |
|---|---|---|---|
| `tenant_admin` | sí | sí | sí |
| `process_owner` | sí | sí | sí |
| `contributor` | sí | sí (queda a nombre de quien carga) | no |
| `viewer` | sí | no | no |

Nueva acción `manage_calibration` en `src/domain/identity/authz.ts` para `process_owner` y `tenant_admin`; la carga usa `write`. Los certificados se descargan con la misma verificación de tenant que los demás adjuntos. Altas, cierres, anulaciones y evaluaciones dejan registro de auditoría (quién, cuándo, qué).

## Qué ve el cliente

Pocas pantallas: **lista con tablero, ficha, formulario de carga**. La evaluación de impacto es un panel dentro de la ficha. El alta y la edición del equipo usan el registro de activos de la Task 15 con una pestaña "Control metrológico".

### 1. Lista `/t/[slug]/instruments`
- Arriba, contadores clicables (son los filtros): **Vigentes · Por vencer (30 días) · No usar · En calibración · Evaluaciones pendientes**. Debajo, "Cumplimiento del plan": equipos utilizables sobre equipos con control, y calibraciones hechas a tiempo en los últimos 12 meses.
- Filtros por sede, magnitud y estado. Orden por defecto: primero lo que hay que atender (no usar, luego por vencer más próximo).
- Columnas: código, equipo, magnitud, sede, responsable, **estado** y próximo vencimiento. Cada fila "No usar" muestra el motivo en texto, no solo el color ("No usar: calibración vencida el 12/09/2026").
- Paginada (25 por página). Exportación CSV.

### 2. Ficha `/t/[slug]/instruments/[id]`
- Cabecera con el estado grande. Si no se puede usar: **"NO USAR"**, el motivo y qué hacer ("Cargar la nueva calibración", "Completar la evaluación de impacto", "Esperando al laboratorio, regreso estimado 30/10").
- Datos del equipo, regla de decisión y EMP por canal en lenguaje llano ("Se acepta si el error más la incertidumbre no supera ±0,5 ppm").
- Historial de calibraciones y verificaciones: fecha, laboratorio, resultado (al recibir / al entregar si hubo ajuste), vigencia, certificado para descargar. Los anulados se ven tachados con el motivo.
- Panel **Evaluación de impacto** cuando hay una pendiente: ventana de fechas, qué se midió, decisión, justificación, "¿registrar hallazgo?" y acciones.
- Botones: Cargar calibración o verificación · Enviar a calibrar / Registrar regreso · Imprimir etiqueta.

### 3. Formulario de carga
- Datos del certificado (fecha de calibración, laboratorio, n.° de certificado, ruta de trazabilidad con advertencias) → tabla de puntos por canal (nominal, medido, U; el **error, el EMP y "pasa / no pasa" se calculan en vivo** con la razón) → "¿Se ajustó el equipo?" (abre la tabla "después del ajuste") → adjuntar el PDF → **resultado calculado** → cerrar.
- Se puede guardar como borrador (el certificado a veces llega después). Es usable en el celular.
- Si el certificado solo dice "conforme", un modo alternativo pide especificación y regla del laboratorio.

### Cómo se ve "no usar" en los demás lugares
- **Lista y ficha:** badge rojo con el texto "No usar" y el motivo; nunca solo color.
- **Selectores de otros módulos** (inspección de espacio confinado, auditoría de seguridad en campo): fila deshabilitada con el motivo; el servidor rechaza igual.
- **Panel de la empresa:** los vencimientos de calibración aparecen como cualquier `DueItem`.
- **Etiqueta impresa:** código, fecha de calibración, próximo vencimiento y QR a la ficha (foto del momento).

## Performance, aislamiento y almacenamiento
- Las columnas derivadas de `InstrumentControl` (`calibrationValidUntil`, `nextDueAt`, `impactPending`, `inCalibrationSince`) permiten calcular el estado con `CASE` en SQL y contar con `GROUP BY` / `count(*) FILTER`; no se cargan equipos para contarlos. "Por vencer" usa `nextDueAt − alertLeadDays ≤ hoy ≤ nextDueAt`.
- Listas con paginación por cursor u offset con límite; la ficha carga el historial paginado.
- Todo filtra por `tenantId`; las referencias (`referenceStandardAssetId`, `findingId`, `actionId`) se validan contra el mismo tenant.
- Certificados: mismo helper de storage S3 que los adjuntos de hallazgos; clave con `tenantId` en el prefijo; descarga con verificación de tenant.
- Prueba de carga de referencia: 1.000 equipos, 5.000 registros.

## Acceptance tests (ejemplos)

- Los casos de las tablas de arriba, uno por fila, incluido el límite `|e| + U = EMP` y el caso decimal 6.
- Un registro con ajuste y as-found fuera de tolerancia: el equipo vuelve a "utilizable" solo después de completar la evaluación de impacto.
- Una evaluación con "resultados afectados" sin acción ni hallazgo no se puede completar.
- Un registro `in_house` sin patrón, o con el patrón vencido, no se puede cerrar como apto.
- Cambiar el EMP o la regla de un equipo **no cambia** el resultado de registros cerrados.
- Cerrar un registro apto cierra el `DueItem` anterior y deja uno abierto; ejecutar `recomputeInstrumentControl` dos veces deja un solo `DueItem`.
- Un registro anulado no cuenta para el estado ni para el `DueItem`; el anterior vuelve a regir.
- El selector de un módulo consumidor muestra el equipo vencido deshabilitado y el servidor rechaza guardarlo.
- `wasInstrumentValidOn`: una medición con fecha dentro de la vigencia pasada es válida aunque hoy el equipo esté vencido.
- Un certificado de un detector de gases con 3 puntos (caso 9) se carga, se calcula y se descarga.
- Tenant A no lee ni modifica equipos, registros, evaluaciones ni certificados del tenant B.
- Un `viewer` no puede cargar; un `contributor` no puede cambiar la regla ni completar una evaluación.
- Lista con 1.000 equipos: contadores por una consulta agregada, 25 filas por página.
- e2e: cargar una calibración no apta de un detector, ver "No usar" en la lista y en un selector, completar la evaluación con hallazgo y volver a "Vigente".

## Fuera de alcance

- Software de gestión de incertidumbres, planes de muestreo o estudios de capacidad del sistema de medición.
- Regla de decisión no binaria (aprobado condicional) y reglas probabilísticas de JCGM 106 cap. 8–9.
- Revisión automática de intervalos por el método de la escalera (solo se muestra como sugerencia en una fase posterior).
- Emisión de certificados propios o acreditación del laboratorio interno.
- Metrología legal (balanzas de uso comercial, surtidores): se rige por su propia normativa.
- Consulta automática al directorio del OAA y aplicación de correcciones del certificado a las lecturas.
- Carga sin conexión, lectura directa desde el equipo o datalogger.
- Costos y órdenes de compra de calibración.

## Plan vertical (Task 16)

1. **16.1 Dominio + Prisma + tests.** `InstrumentControl`, `CalibrationRecord`, `CalibrationPoint`, `CalibrationAttachment`, `ImpactAssessment`, `ImpactAssessmentAction`, `InstrumentShipment`; valor `calibration` en `FindingOrigin`; funciones puras de la sección anterior con las tablas de casos como tests. Aislamiento entre tenants.
2. **16.2 Registro y lista de equipos.** Pestaña "Control metrológico" del activo, lista con filtros, contadores y semáforo, ficha con historial y descarga de certificados, etiqueta imprimible, `InstrumentPicker`. El módulo pasa a `available`.
3. **16.3 Carga de calibración o verificación.** Formulario por puntos con cálculo en vivo, as-found/as-left, certificado, borrador y cierre, anulación con motivo, envío a calibrar y regreso.
4. **16.4 Vencidos y fuera de tolerancia.** `recomputeInstrumentControl` con `DueItem`, bloqueo "No usar", validación en el servidor de los módulos consumidores, evaluación de impacto con hallazgo y acciones.
5. **16.5 Prueba funcional y tablero.** Plantilla "prueba funcional" sobre el motor de la Task 15 (enganche para abrir la evaluación al fallar; si el motor no tiene punto de extensión, se agrega uno mínimo en 15.5), tablero de la lista (30 días y cumplimiento del plan), guía, menú, README, e2e.

Cada slice termina con lint, tsc, vitest y verificación en el navegador (incluido el ancho de celular de 375 px para la carga).

## Preguntas abiertas para el PO

Las decisiones 1, 8, 11, 12 y 13 son las que más cambian el producto; el resto puede quedar con el default.

## Aprobación

- [ ] Aprobado por el PO (pendiente)
