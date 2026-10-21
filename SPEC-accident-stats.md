# Spec: `safety-stats` — Estadísticas de accidentabilidad (Task 17)

Estado: **aprobado por el PO el 2026-10-21** (con las recomendaciones del borrador; D10 y D12 cambiados, ver "Decisiones del PO"). Investigación y fuentes en `RESEARCH-accident-stats.md` (las referencias "R§" apuntan a esa sección). Se apoya en `SPEC-master-data.md` (sedes, personas), `SPEC-findings-lifecycle.md` (el accidente es un Hallazgo) y `SPEC-fase5-fundacion.md` (módulo activable, `DueItem`, `Action`). Base de la Task 18 (seguridad vial).

## Objective

Que la empresa registre cada accidente una sola vez, como un Hallazgo de tipo incidente con una **ficha de accidente**, y que vea sus índices de siniestralidad **calculados**, nunca cargados a mano, a partir de los eventos y de la exposición (horas-hombre trabajadas y dotación) que carga cada mes por sede.

### Success criteria
- Cada accidente es un Hallazgo `incident` con su `IncidentRecord` 1:1; los 5 Porqués, las medidas y la verificación de eficacia son los de las Tasks 10b–10d.
- IF, IG, II e ID por mes, año acumulado y 12 meses móviles, por sede y por propio/contratista/total, coinciden con el cálculo manual del conjunto de referencia (§ Dataset).
- Sin exposición cargada, el índice dice "sin datos". Nunca 0.
- Los accidentes in itinere se ven aparte y no entran en los índices.
- Todos los roles de la empresa ven las fichas (decisión del PO, D10); cada consulta de una ficha de salud deja registro (quién, cuándo).
- Las agregaciones se hacen en la base (group by sede/mes); el tablero no trae eventos a memoria.
- Dos tenants nunca ven los datos del otro.
- Cargar la exposición de un mes toma menos de 2 minutos para una empresa con 5 sedes.

## Decisiones a confirmar (defaults propuestos)

| # | Decisión | Default propuesto | Por qué (R§) |
|---|---|---|---|
| D1 | Bases de los índices | IF ×1.000.000 horas · **IG ×1.000 horas (configurable a ×1.000.000)** · II ×1.000 trabajadores · ID en días. La base va en la etiqueta y en el export | La SRT no fija IF/IG por horas (R§0, R§2.1). Existen ×1.000 (INSST) y ×1.000.000 (ANSI, OIT) (R§3). Se mantiene el default del `todo.md` |
| D2 | Cargo de días | **6.000 días** por fatal (configurable). Se suma un cargo proporcional al % de incapacidad permanente (6.000 × %) si el cliente lo carga. El tablero muestra IG "con cargos" y el export también "solo días reales" | Origen ANSI (R§3.2); la OIT lo excluye de la gravedad (R§3.1) |
| D3 | Días perdidos | **Días corridos, sin contar el día del accidente, tope 365** | OIT, OSHA, INSST (R§3). La SRT usa jornadas: la comparación con sus tablas es aproximada (R§2.1) |
| D4 | Desde cuándo cuenta un accidente | **Desde que se guarda la ficha** (Hallazgo en borrador incluido), salvo Hallazgo **anulado**. No espera la publicación | La publicación exige el análisis de causas; esperar subregistra y atrasa el índice. Cambia el test de integración del `todo.md` ("publicar → aparece") |
| D5 | Accidente que abarca meses | Los días se imputan al **mes del accidente**. Mientras el caso está abierto, ese mes se marca "provisorio" | OSHA y OIT (R§4.3) |
| D6 | In itinere y enfermedad profesional | Ambos **fuera** de IF, IG, II, ID, LTIF, TRIR; con tarjeta propia. Enfermedad profesional con fecha de primera manifestación | OIT, INSST, SRT "AT y EP" (R§4.1, R§4.4) |
| D7 | Fatales | Cuentan en IF (y en LTIF) y llevan el cargo en IG. **No** entran en ID | Evita que 6.000 días arruinen el promedio (R§5) |
| D8 | Meses sin exposición y totales | El mes sin exposición sale del numerador y del denominador y la ventana se marca "parcial (falta marzo)". El total propio + contratista solo usa meses con los dos grupos cargados | Anti-patrones (R§5) |
| D9 | HHT estimada | **No se estima** desde la dotación. Se valida la plausibilidad (horas por persona) | Falsa precisión (R§5) |
| D10 | Quién ve datos de salud | **Todos los roles de la empresa** (`tenant_admin`, `process_owner`, `contributor`, `viewer`) ven las fichas en lectura. Editan la ficha de salud el `tenant_admin` y el `process_owner`. Cada consulta deja registro. No existe permiso ni lista aparte | **Decisión del PO (2026-10-21)**, que reemplaza la recomendación de restringir. Los datos de salud son sensibles (Ley 25.326): el riesgo queda asumido por el PO y pendiente de revisión por un abogado (R§6). Un cliente que no quiera exponerlos puede desactivar el módulo |
| D11 | Alta por colaboradores | El `contributor` puede dar de alta el hecho (fecha, sede, clasificación, propio/contratista, forma, agente). La ficha de salud (persona, lesión, días) la completan el `tenant_admin` y el `process_owner` | La gente de campo reporta; SST completa la ficha |
| D12 | Texto del Hallazgo | El Hallazgo del incidente se ve completo para todos los roles: título, descripción, 5 Porqués y adjuntos. El alta avisa que conviene no escribir diagnósticos | Decisión del PO (D10). El título generado y el ocultamiento por rol se descartan |
| D13 | Personal de plataforma | El superusuario **no** ve fichas de salud por defecto | Confidencialidad (Ley 25.326 art. 10) |
| D14 | Índices opcionales | LTIF se muestra como alias del IF. TRIR y DART detrás de "Más indicadores" (apagado por defecto). FAR no se muestra | Números chicos (R§5) |
| D15 | Meta | El tablero lee la meta de un Indicador de la Task 11c; **no escribe** mediciones | Los índices son calculados; la medición de 11c es manual |
| D16 | Listas de clasificación | Listas propias y cortas (forma, agente, naturaleza, parte del cuerpo) en código, no editables por el cliente en esta versión. No equivalen a la tabla oficial SRT hasta validarla | Tablas SRT sin verificar (R§2.2) |
| D17 | Aviso de carga de exposición | `DueItem` por sede y mes, vence el **día 10 del mes siguiente**, aviso 5 días antes; se cierra al guardar los grupos de esa sede/mes | Reutiliza la base común |
| D18 | Retención | Se conserva el historial; se puede exportar la ficha de una persona (acceso, rectificación). Plazo de borrado: a definir con un abogado | Ley 25.326 arts. 4, 14–16 (R§2.3) |

## Domain model (conceptual)

Todo con `tenantId`, todo con índice por `tenantId`. Las lecturas pasan por los helpers tenant-scoped existentes.

### IncidentRecord (1:1 con `Finding`)
- `findingId` **único**, FK del lado del módulo (`onDelete: Restrict`). **No se agregan columnas a `Finding`.** Se crea en la misma transacción que el Hallazgo, que se da de alta con `type = incident` y `origin = incident`. Regla de dominio y test: no puede haber un `IncidentRecord` cuyo Hallazgo no sea de tipo incidente ni de otro tenant.
- Hecho (visible para quien ve el Hallazgo):
  - `siteId` (FK `Site`, Restrict), `occurredAt` (con hora), `classification`, `inItinere`, `isRoad`, `employerKind` (`own` / `contractor`, copiado de la Persona o elegido en el alta), `restrictedWork` (solo `no_lost_time`), `accidentForm`, `materialAgent`.
  - Derivados al guardar por una función pura, nunca tipeados: `occurredOn` (fecha local del tenant, zona `America/Argentina/Buenos_Aires`), `periodMonth` (primer día del mes), `weekday`, `hourOfDay`. Así el group by se hace con columnas simples.
- Datos numéricos de gravedad (sin identificar, usados para sumar): `lostDays` (días reales), `returnToWorkDate?`, `chargePct` (100 si es fatal; porcentaje de incapacidad permanente si lo hay; 0 si no). Un caso con `classification = lost_time` y sin `returnToWorkDate` está **abierto**.
- `createdByUserId`, `createdAt`, `updatedAt`.
- `classification` (enum): `near_miss` (casi accidente) · `first_aid` (primeros auxilios) · `no_lost_time` (sin baja: tratamiento médico o tareas restringidas, siguió o volvió a trabajar) · `lost_time` (con baja) · `fatal` · `occupational_disease`.
- Índices: `[tenantId, periodMonth, siteId]`, `[tenantId, classification]`, `[siteId, occurredOn]`.

### IncidentHealth (1:1 con `IncidentRecord`, tabla aparte)
Separada para que un `select` descuidado del registro no filtre datos de salud.
- `affectedPersonId?` (FK `Person`, Restrict; obligatoria salvo `near_miss`), `natureOfInjury?`, `bodyPart?`, `artClaimNumber?` (n.° de denuncia a la ART), `deathDate?`.
- Sin diagnóstico libre, sin adjuntos médicos.

### IncidentFollowUp (historial, solo se agrega)
- `incidentRecordId`, `at`, `authorUserId`, `classification`, `lostDays`, `returnToWorkDate?`, `chargePct`, `note?`.
- Cada cambio de clasificación (p. ej. de sin baja a con baja o a fatal) o de días perdidos crea una fila. El registro vigente es el último; la clasificación nueva reubica el caso en el **mes del accidente** (D5).
- Lo leen todos los roles de la empresa; lo escriben el `tenant_admin` y el `process_owner`.
- Mientras el caso está abierto se crea un `DueItem` "Actualizar días perdidos de …" (15 días, con `siteId`, `ownerUserId` = quien lo dio de alta o el admin) que se renueva en cada seguimiento y se cierra con la fecha de reintegro.

### ExposurePeriod
- `siteId` × `periodMonth` × `employerKind` (**único**), `hours` (HHT, entero ≥ 0), `headcountAvg` (dotación promedio del mes, decimal ≥ 0), `recordedByUserId`, `createdAt`, `updatedAt`.
- Fila con `hours = 0` y `headcountAvg = 0` = "sin actividad ese mes" (por ejemplo, no hubo contratistas). **Es distinto de no haber cargado la fila.**
- `ExposureRevision` (solo se agrega): valores anteriores y nuevos, motivo (obligatorio), quién, cuándo. Toda corrección de un mes pasado deja rastro.

### SafetyStatsSettings (uno por tenant)
`fatalChargeDays` (6000), `severityBase` (1.000 o 1.000.000), `lostDaysCap` (365), `exposureDueDay` (10), `exposureOwnerUserId?`, `showOptionalIndices` (false).

### SafetyIndicatorLink (slice 17.4, opcional)
`metric` (`if` / `ig` / `ii` / `id`) × `indicatorId`, para leer la meta.

### Punto de extensión para la Task 18 (no se especifica acá)
- `IncidentRecord.isRoad` ya existe. La Task 18 agrega `RoadEventDetail` 1:1 con `IncidentRecord` (vehículo, conductor, tipo de evento…).
- Para eventos viales **sin lesión y con daño material**, la Task 18 puede agregar un valor al enum `classification` (migración propia). Las funciones puras de esta task tratan cualquier clasificación que no conoce como "no entra en los índices laborales", así que agregar el valor no cambia ningún resultado de la Task 17.
- `inItinere = true` y `isRoad = true` se muestran solo en el tablero vial; `inItinere = false` y `isRoad = true` cuentan en ambos.
- El estado del Hallazgo y los seguimientos son los mismos.

### Reglas puras (en `src/domain/safety-stats/`)
- `deriveEventPeriod(occurredAt, timeZone)` → `{ occurredOn, periodMonth, weekday, hourOfDay }`. Un accidente a las 23:30 del 31/01 hora local es de enero aunque sea 01/02 en UTC.
- `computeLostDays({ occurredOn, returnToWorkDate, asOf, cap })` → días corridos = `returnToWorkDate − occurredOn − 1` (sin contar el día del accidente), mínimo 0, tope `cap`. Abierto: `asOf − occurredOn`, mínimo 1.
- `validateIncident(input)` → errores por campo (ver casos borde).
- `validateExposure(row)` → errores y advertencias (horas por persona).
- `classifySegmentMonth(exposureRow | undefined, rawCounts)` → `ok` / `empty` / `missing` / `inconsistent`.
- `aggregateWindow({ exposure, eventAggregates, months, segments, settings })` → `{ status: ok | partial | no_data, monthsUsed, monthsExcluded: [{ month, segment, reason }], totals, indices, provisionalMonths }`. Recibe filas ya agregadas por la base, no eventos.
- `computeIndices(totals, settings)` → valores o `null`.
- `daysSinceLastLostTime(lastLostTimeOnBySite, asOf)`.
- `canViewHealthData({ role, isPlatformSuperuser })`: todo integrante de la empresa, nunca el personal de plataforma (D10, D13). No hay ocultamiento por rol.

### Fórmulas (todas sobre la ventana, sumando antes de dividir)

| Índice | Fórmula | Numerador | Denominador |
|---|---|---|---|
| IF | casos × 1.000.000 / HHT | `lost_time` + `fatal` laborales | HHT de los meses válidos |
| IG | (días reales + cargo) × base / HHT | cargo = `fatalChargeDays` × Σ`chargePct` / 100 | HHT |
| II | casos × 1.000 / dotación | igual que IF | suma, por grupo, del promedio de dotación de los meses válidos |
| ID | días reales / casos no fatales | `lost_time` (sin fatales) | — ; sin casos = "sin casos" |
| TRIR (opcional) | registrables × 200.000 / HHT | `fatal` + `lost_time` + `no_lost_time` | HHT |
| DART (opcional) | (`lost_time` + `no_lost_time` con `restrictedWork`) × 200.000 / HHT | sin fatales | HHT |
| LTIF | = IF | | |

"Laboral" = `inItinere = false`. Los resultados se redondean a 2 decimales (ID a 1) con redondeo comercial; los tests comparan con tolerancia 0,005.

### Casos borde (reglas de dominio y tests)

| Caso | Regla |
|---|---|
| HHT = 0 sin eventos y dotación = 0 | "Sin actividad": el mes no produce índice y no es un error. Para totales no cuenta como "falta" |
| HHT = 0 **con** accidentes con baja o fatales ese mes | `inconsistent`: el mes sale de los índices, el caso sigue contando en los conteos crudos y el tablero avisa "hay 1 accidente en enero sin horas cargadas" |
| Fila de exposición ausente | `missing`: "sin datos"; el `DueItem` sigue abierto |
| HHT > 0 y dotación = 0 | IF, IG y TRIR se calculan; II dice "sin datos" |
| Ventana con exposición en solo algunos meses | Se calcula con los meses válidos y se marca "parcial (faltan: …)" |
| Ventana sin ningún mes válido | "Sin datos" en todos los índices |
| Total propio + contratista | El mes cuenta solo si ambos grupos están `ok` o `empty` y al menos uno `ok` |
| Fatal | Cuenta 1 en IF y su cargo en IG; sus días reales no se suman; no entra en ID; si solo hay fatales, ID = "sin casos" |
| Fatal con `lostDays` cargados | Se ignoran para el IG (advertencia) |
| `deathDate` más de 365 días después del accidente | Advertencia: la OIT cuenta solo muertes dentro del año; el caso queda como fatal y se revisa |
| Accidente que abarca meses | Va al mes del accidente. Mientras `lost_time` esté abierto, ese mes es `provisional` |
| `lost_time` con 0 días | Error: sin días perdidos es `no_lost_time` |
| `returnToWorkDate` anterior a `occurredOn` | Error |
| Días perdidos > `lostDaysCap` | Se topean en 365 y se sugiere cargar incapacidad permanente |
| `inItinere` con `near_miss` u `occupational_disease` | Error |
| `occurredAt` futuro | Error |
| Cambio de clasificación | Nueva fila de seguimiento; el conteo se mueve en el mes del accidente |
| Hallazgo anulado | Sale de todos los conteos; reabrirlo lo devuelve |
| Persona cambió de empleador después | La ficha conserva el `employerKind` del momento del accidente |
| Sede dada de baja | El historial queda; no aparece en los selectores |
| Horas por persona > 744 (24 h × 31 días) | Error al cargar exposición. Fuera de 80–260 h por persona al mes: advertencia, configurable |
| Tendencia | Se compara con la ventana anterior de igual largo, solo si **ambas** son `ok`. Si no, no se muestra flecha |
| Días sin accidente con baja | `fecha de consulta − fecha del último lost_time o fatal laboral` de la sede (propio + contratista). Sin accidentes registrados: "sin accidentes con baja desde {primer mes con exposición}"; sin exposición: "sin datos" |

## Dataset de referencia (valores calculados a mano, para los tests)

Configuración: `fatalChargeDays = 6000`, IG ×1.000, II ×1.000, TRIR/DART ×200.000. Zona horaria `America/Argentina/Buenos_Aires`. Consulta "al 31/03/2026". Sedes A = Planta Norte, B = Obra Sur.

### Exposición (horas / dotación promedio)

| Sede | Grupo | Ene 2026 | Feb 2026 | Mar 2026 |
|---|---|---|---|---|
| A | propio | 20.000 / 110 | 18.000 / 108 | 22.000 / 112 |
| A | contratista | 5.000 / 28 | 4.000 / 25 | **no cargado** |
| B | propio | 10.000 / 55 | 10.000 / 55 | 10.000 / 55 |
| B | contratista | **0 / 0** (explícito) | 3.000 / 15 | 3.000 / 15 |

### Eventos (laborales salvo E5)

| Id | Sede | Grupo | Fecha | Clasificación | Datos | Días reales |
|---|---|---|---|---|---|---|
| E1 | A | propio | 10/01 | con baja | reintegro 21/01 | 10 |
| E2 | A | propio | 25/01 | con baja | reintegro 15/02 (cruza de mes) | 20 |
| E3 | A | propio | 05/02 | fatal | chargePct 100 | 0 |
| E4 | A | propio | 12/02 | sin baja | tareas restringidas | 0 |
| E5 | A | propio | 20/02 | con baja, **in itinere** | reintegro 23/03 | 30 |
| E6 | A | contratista | 03/02 | con baja | reintegro 09/02 | 5 |
| E7 | B | propio | 02/03 | con baja | reintegro 06/03 | 3 |
| E8 | B | propio | 15/03 | primeros auxilios | | 0 |
| E9 | B | propio | 20/03 | casi accidente | | 0 |
| E10 | B | propio | 18/01 | con baja | reintegro 31/01 | 12 |
| E11 | B | contratista | 14/01 | con baja | reintegro 22/01 (el grupo tiene 0 horas en enero) | 7 |

Días reales = reintegro − fecha − 1 (p. ej. E2: 15/02 − 25/01 − 1 = 20).

### Resultados esperados

`n/d` = "sin datos". `s/c` = "sin casos". Columnas: HHT · dotación · casos (de ellos fatales) · días reales · IF · IG (con cargo, ×1.000) · II · ID · TRIR · DART.

| # | Consulta | Estado | HHT | Dot. | Casos (fat.) | Días | IF | IG | II | ID | TRIR | DART |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | A · propio · ene | ok | 20.000 | 110,0 | 2 (0) | 30 | 100,00 | 1,50 | 18,18 | 15,0 | 20,00 | 20,00 |
| 2 | A · propio · feb | ok | 18.000 | 108,0 | 1 (1) | 0 | 55,56 | 333,33 | 9,26 | s/c | 22,22 | 11,11 |
| 3 | A · propio · mar | ok | 22.000 | 112,0 | 0 (0) | 0 | **0,00** | 0,00 | 0,00 | s/c | 0,00 | 0,00 |
| 4 | A · propio · ene–mar | ok | 60.000 | 110,0 | 3 (1) | 30 | 50,00 | 100,50 | 27,27 | 15,0 | 13,33 | 10,00 |
| 5 | A · contratista · feb | ok | 4.000 | 25,0 | 1 (0) | 5 | 250,00 | 1,25 | 40,00 | 5,0 | 50,00 | 50,00 |
| 6 | A · contratista · mar | **sin datos** | | | | | n/d | n/d | n/d | n/d | n/d | n/d |
| 7 | A · contratista · ene–mar | parcial (falta mar) | 9.000 | 26,5 | 1 (0) | 5 | 111,11 | 0,56 | 37,74 | 5,0 | 22,22 | 22,22 |
| 8 | A · total · feb | ok | 22.000 | 133,0 | 2 (1) | 5 | 90,91 | 272,95 | 15,04 | 5,0 | 27,27 | 18,18 |
| 9 | A · total · mar | **sin datos** (falta contratista) | | | | | n/d | n/d | n/d | n/d | n/d | n/d |
| 10 | A · total · ene–mar | parcial (usa ene y feb) | 47.000 | 135,5 | 4 (1) | 35 | 85,11 | 128,40 | 29,52 | 11,7 | 21,28 | 17,02 |
| 11 | B · propio · ene–mar | ok | 30.000 | 55,0 | 2 (0) | 15 | 66,67 | 0,50 | 36,36 | 7,5 | 13,33 | 13,33 |
| 12 | B · contratista · ene | **sin datos** (inconsistente: 1 accidente con 0 horas) | | | | | n/d | n/d | n/d | n/d | n/d | n/d |
| 13 | B · contratista · ene–mar | parcial (usa feb y mar) | 6.000 | 15,0 | 0 (0) | 0 | 0,00 | 0,00 | 0,00 | s/c | 0,00 | 0,00 |
| 14 | B · total · ene–mar | parcial (usa feb y mar) | 26.000 | 70,0 | 1 (0) | 3 | 38,46 | 0,12 | 14,29 | 3,0 | 7,69 | 7,69 |
| 15 | Empresa · total · ene–mar | parcial (solo feb) | 35.000 | 203,0 | 2 (1) | 5 | 57,14 | 171,57 | 9,85 | 5,0 | 17,14 | 11,43 |

Cómo se llega a algunos valores (verificables a mano):
- #1: IF = 2 × 1.000.000 / 20.000 = 100; IG = 30 × 1.000 / 20.000 = 1,5; II = 2 × 1.000 / 110 = 18,18; ID = 30 / 2 = 15; TRIR = 2 × 200.000 / 20.000 = 20.
- #2: IG = 6.000 × 1.000 / 18.000 = 333,33; ID es "sin casos" porque el único caso es fatal; DART = 1 (E4) × 200.000 / 18.000 = 11,11 (el fatal no entra en DART); TRIR = 2 (E3 + E4) × 200.000 / 18.000 = 22,22.
- #4: dotación = (110 + 108 + 112) / 3 = 110; IG = (30 + 6.000) × 1.000 / 60.000 = 100,5; promediar las tasas mensuales daría otra cosa y es un error.
- #7: solo ene y feb de A contratista; E6 (feb) es el único caso: 1 × 1.000.000 / 9.000 = 111,11; dotación = (28 + 25) / 2 = 26,5.
- #10: la ventana usa ene y feb (marzo no tiene contratista): HHT = 20.000 + 18.000 + 5.000 + 4.000 = 47.000; casos E1, E2, E3, E6 = 4; días reales 10 + 20 + 5 = 35; IG = (35 + 6.000) × 1.000 / 47.000 = 128,40; dotación = 109 + 26,5 = 135,5; ID = 35 / 3 = 11,67.
- #12–#14: enero de B contratista es `inconsistent` (E11 con 0 horas): sale de los índices; en #14 también sale el enero de B propio, porque el total necesita los dos grupos válidos.
- #15: solo febrero es válido en todos los grupos de las dos sedes.

Conteos crudos que **no** dependen de la exposición (ene–mar, todo el tenant, laborales): casi accidente 1 · primeros auxilios 1 · sin baja 1 · con baja 6 (E1, E2, E6, E7, E10, E11) · fatal 1; días reales 57 (10 + 20 + 5 + 3 + 12 + 7).
In itinere (aparte): 1 caso, 30 días (E5); no figura en ninguna fila de la tabla anterior.
Mes provisorio: ningún caso queda abierto. Si E2 no tuviera reintegro, enero de A propio sería provisorio.
Días sin accidentes con baja al 31/03/2026: A = 54 (último: E3, 05/02); B = 29 (último: E7, 02/03).
Con IG ×1.000.000: #1 = 1.500,00; #2 = 333.333,33.

## Permisos por rol

Acción nueva en `src/domain/identity/authz.ts` (hoy no existe ninguna de SST): `manage_safety_stats`. Ver las fichas de salud no necesita permiso propio: lo pueden todos los roles de la empresa (D10).

| Acción | tenant_admin | process_owner | contributor | viewer |
|---|---|---|---|---|
| Ver el tablero y los totales (sin nombres) | sí | sí | sí | sí |
| Ver el Hallazgo del incidente (estado, sede, fecha, clasificación, medidas) | sí | sí | sí | sí |
| Ver descripción, causas (5 Porqués) y adjuntos del Hallazgo del incidente | sí | sí | sí | sí |
| Ver persona afectada, naturaleza de la lesión, parte del cuerpo, días perdidos por caso, n.° de ART, seguimientos (con registro de la consulta) | sí | sí | sí | sí |
| Dar de alta el hecho (fecha, sede, clasificación, propio/contratista, forma, agente) | sí | sí | sí | no |
| Completar la ficha de salud, actualizar días, reclasificar | sí | sí | no | no |
| Cargar y corregir exposición, importar CSV, ajustes | sí | sí | no | no |
| Exportar totales (CSV agregado, resumen imprimible) | sí | sí | sí | sí |
| Exportar casos con nombres | sí | sí | sí | sí |

- El `viewer` y el `contributor` ven la ficha de salud en solo lectura: sin botones de edición.
- El superusuario de plataforma no ve fichas de salud por defecto (D13).
- Cada alta, edición, reclasificación, consulta de la ficha de salud, carga o corrección de exposición, cambio de acceso y export de casos deja registro (quién, cuándo, qué), con el mecanismo de auditoría de datos maestros.
- Los eventos de `Finding` (publicar, cerrar, anular) siguen las reglas de `SPEC-findings-lifecycle.md` sin cambios.

## Qué ve el cliente

Tres pantallas y un paso. Copy sin jerga, según la identidad SGI (skill `sgi-frontend-identity`).

1. **Alta de accidente (un paso más del alta de hallazgo).** Al elegir el tipo "Incidente", aparece "Ficha de accidente" con tres bloques cortos:
   - "¿Qué pasó?": fecha y hora, sede, "¿Hubo lesión?" y, si hubo, "¿Cuánto se perdió?" (casi accidente · primeros auxilios · sin baja · con baja · fatal · enfermedad profesional); "¿Fue en el trayecto de ida o vuelta al trabajo?"; "¿Fue un hecho de tránsito?"; "¿Es personal propio o de un contratista?"; forma del accidente y agente.
   - "¿A quién?" y "¿Qué lesión?": los completa el `tenant_admin` o el `process_owner`; para el resto el bloque queda en solo lectura.
   - "¿Cuántos días de baja?": fecha de reintegro o "sigue de baja" (el sistema cuenta los días).
   Se avisa que la descripción no debería incluir diagnósticos.
2. **Exposición del mes** (`/safety/exposure`): una grilla de sedes × (personal propio, contratista) con horas trabajadas y dotación promedio. "Sin personal contratista este mes" guarda 0/0. Importación CSV con vista previa (`sede, mes, empresa, horas, dotacion`; una sede inexistente es error, no se crea). Aviso mensual por `DueItem`.
3. **Tablero** (`/safety/stats`):
   - Selector: mes · año acumulado · 12 meses móviles; filtros por sede y por propio / contratista / total.
   - Tarjetas IF, IG, II e ID con flecha de tendencia y la etiqueta de su base. Una tarjeta "sin datos" explica qué falta y lleva a cargarlo ("Falta cargar las horas de marzo en Obra Sur").
   - Pirámide de eventos, distribución por forma del accidente, agente, parte del cuerpo, día de la semana y hora (todos agregados, sin nombres), días sin accidentes con baja por sede, tarjeta aparte de in itinere y de enfermedades profesionales, meta del Indicador vinculado.
   - Pestaña "Casos": lista, fichas incompletas, casos abiertos.
   - "Ajustes" (solo admin): cargo por fatal, base del IG, quién carga la exposición.
4. Exportación: CSV agregado por sede y mes con numeradores, denominadores y estado; CSV de casos; resumen imprimible para la revisión por la dirección (ISO 45001 §9.3).

## Acceptance tests (ejemplos)

Unit (funciones puras, sobre el dataset):
- AT-01: las 15 filas de resultados coinciden con la tabla (tolerancia 0,005; ID a 1 decimal).
- AT-02: promediar las tasas mensuales de A propio da un valor distinto al IF acumulado; la función solo suma numeradores y denominadores.
- AT-03: A contratista en marzo (fila ausente) → todos los índices "sin datos", nunca 0.
- AT-04: A propio en marzo (con horas y sin casos) → IF 0,00; distinto de "sin datos".
- AT-05: B contratista en enero (0 horas con 1 accidente) → `inconsistent`; el caso suma en los conteos crudos y no en los índices.
- AT-06: fatal únicamente → ID "sin casos"; IG incluye el cargo; cambiar `fatalChargeDays` a 0 deja el IG con días reales.
- AT-07: E2 cruza de enero a febrero: sus 20 días están en enero, no en febrero; sin reintegro, enero queda provisorio.
- AT-08: E5 (in itinere) no aparece en ningún índice, ni en TRIR, ni en la pirámide laboral; sí en su tarjeta.
- AT-09: `computeLostDays`: accidente 10/01, reintegro 11/01 → 0; 21/01 → 10; tope 365; reintegro anterior al accidente → error.
- AT-10: un accidente a las 23:30 del 31/01 (hora local) pertenece a enero.
- AT-11: HHT > dotación × 744 → error; dotación 0 con horas → II "sin datos", IF calculado.
- AT-12: tendencia sin flecha si alguna de las dos ventanas no es `ok`.
- AT-13: días sin accidentes con baja: A = 54, B = 29; sede sin accidentes y sin exposición → "sin datos".
- AT-14: con base 1.000.000 el IG de #1 es 1.500,00.

Integration (base de datos):
- AT-15: crear un Hallazgo incidente con ficha → el caso aparece en el tablero de su sede y mes, aún en borrador; al anularlo, desaparece de los conteos (D4).
- AT-16: un `IncidentRecord` no puede apuntar a un Hallazgo que no sea `incident`, ni de otro tenant; dos fichas para el mismo Hallazgo fallan por la unicidad.
- AT-17: las agregaciones salen de `groupBy` en la base: con 50.000 eventos y 5 sedes el tablero hace un número acotado de consultas y no carga eventos.
- AT-18: tenant A no ve ni modifica fichas, exposición ni ajustes de tenant B; el group by siempre filtra `tenantId`.
- AT-19: el `viewer` y el `contributor` ven la ficha de salud y el Hallazgo completos, pero ningún control de edición ni acción de servidor de escritura les responde; cada consulta de una ficha deja registro.
- AT-20: el `process_owner` y el `tenant_admin` completan la ficha de salud; el `contributor` da de alta el hecho pero no puede completarla.
- AT-21: el superusuario de plataforma no recibe la ficha de salud.
- AT-22: corregir la exposición de un mes pasado exige motivo y deja `ExposureRevision`; el tablero refleja el valor nuevo.
- AT-23: el `DueItem` de exposición se crea una vez por sede y mes (idempotente), vence el día 10 del mes siguiente, lleva `siteId` y se cierra al guardar los grupos; reintentar no duplica.
- AT-24: el cambio de clasificación de un caso crea seguimiento y mueve el conteo; el historial queda legible para todos los roles de la empresa.
- AT-25: CSV de exposición: reimportar el mismo archivo no cambia nada; una sede desconocida es un error por fila.
- AT-26: si el módulo `safety_stats` está desactivado, las páginas dan 404 y la ficha no se pide en el alta del Hallazgo.

e2e (Playwright):
- AT-27: registrar un accidente con baja con fecha de reintegro, cargar las horas del mes, ver el IF del mes en el tablero.
- AT-28: sin horas cargadas, el tablero muestra "sin datos" y el enlace para cargarlas.
- AT-29: como `viewer`, el tablero muestra totales y la pestaña Casos en solo lectura, sin controles de edición.

## Fuera de alcance

- Seguridad vial (Task 18): vehículos, km, tipos de evento viales, daño material sin lesión.
- Gestión completa de enfermedades profesionales y de la relación con la ART o la Comisión Médica; denuncia en línea a la ART o la SRT (Fase 5, fuera de alcance).
- Diagnósticos, historia clínica, adjuntos médicos, aptitud médica.
- Comparación contra los índices sectoriales de la SRT (requiere CIIU y datos externos), costos de accidentes, ausentismo por enfermedad.
- Estimar horas trabajadas desde nóminas; integrar con control de acceso, fichadas o sistemas de RR.HH.
- Umbral de supresión por sede chica (riesgo de re-identificación): documentado, no resuelto.
- Códigos oficiales de la denuncia a la ART y su sincronización.
- Tablas de cargos de días para incapacidades parciales por segmento anatómico (solo se usa el porcentaje).
- Carga sin conexión, modo móvil especial.
- Edición de las listas de clasificación por el cliente.
- Plazos de retención y borrado.

## Plan vertical (Task 17)

1. **17.1 Dominio + Prisma.** Enums y listas (clasificación, forma, agente, naturaleza, parte del cuerpo), funciones puras y su unit test sobre el dataset (AT-01 a AT-14), migración propia con `IncidentRecord`, `IncidentHealth`, `IncidentFollowUp`, `ExposurePeriod`, `ExposureRevision`, `SafetyStatsSettings`; acción de authz nueva; test de aislamiento a nivel repositorio (AT-16, AT-18). Sin UI. Verde cuando el dataset da los 15 resultados.
2. **17.2 Registro.** Paso "Ficha de accidente" en el alta de hallazgo (solo si el módulo está activo), seguimientos de días perdidos y reclasificación, `DueItem` de seguimiento, auditoría. AT-15, AT-19, AT-20, AT-21, AT-24.
3. **17.3 Exposición.** Grilla mensual por sede, importación CSV con vista previa, plausibilidad, `ExposureRevision`, `DueItem` mensual idempotente (coordinar con el automatizador existente). AT-22, AT-23, AT-25.
4. **17.4 Tablero `/safety/stats`.** Ventanas, filtros, tarjetas con "sin datos" y "parcial", tendencia, pirámide, distribuciones, días sin accidentes, in itinere, pestaña Casos, meta de un Indicador. AT-17, AT-12, AT-13.
5. **17.5 Cierre.** Export CSV y resumen imprimible, guía, menú, entrada del catálogo `safety_stats` de `planned` a `available` (cláusulas ISO 45001 9.1.1, 10.2 y 9.3, todas presentes en el catálogo sembrado), e2e (AT-26 a AT-29), README.

Cada paso se publica por separado; la 17.1 puede revisarse sin UI. Los pasos 17.2 y 17.3 no dependen entre sí y pueden construirse en paralelo después de la 17.1. Cambios en modelos compartidos (`Finding`, `DueItem`, `Tenant`, `authz.ts`): solo la acción nueva de `authz.ts`, que va en la 17.1.

## Decisiones del PO

Aprobadas el 2026-10-21 con las recomendaciones del borrador, salvo D10 y D12: el PO decidió que los datos de salud los ven todos los roles de la empresa (ver D10, D12 y la sección Permisos por rol). Queda pendiente la revisión legal de ese punto (Ley 25.326).

## Aprobación

- [x] Aprobado por el PO el 2026-10-21
