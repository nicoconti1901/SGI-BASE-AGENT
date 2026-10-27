# Spec: `road-safety` — Seguridad vial (Task 18)

Estado: **PARA APROBAR** (borrador del 2026-10-27, sin aprobación del PO). Hasta que se apruebe no se construye nada: bloquea `/modulo seguridad-vial`.
Investigación y fuentes en `RESEARCH-road-safety.md` (las referencias "R§" apuntan a esa sección; cada afirmación lleva su marca de confianza A/B/C).
Normas: ISO 39001:2012 (sistema de gestión de la seguridad vial) · Ley 24.449 de Tránsito (arts. 20, 34, 40, 51, 64–66, 77) y Decreto 779/95 · Ley 25.326 como riesgo de privacidad.
Se apoya en `SPEC-accident-stats.md` (ficha de accidente, punto de extensión), `SPEC-inspections.md` (vehículos y odómetro), `SPEC-master-data.md` (sedes, personas), `SPEC-training.md` (conductor habilitado) y `SPEC-findings.md`.

## Objective

Que la empresa vea la siniestralidad de su flota **separada de la accidentabilidad laboral**: todos los eventos viales (con o sin lesión, en misión o in itinere, y los que solo dejan daño material), con tasas por **millón de km recorridos**, y que sepa qué conductores y vehículos hay que revisar. El evento vial es el mismo Hallazgo `incident` y la misma ficha de accidente de la Task 17, con un detalle vial 1:1; no se carga dos veces.

### Success criteria
- Un evento vial se registra una sola vez (Hallazgo `incident` + `IncidentRecord` con `isRoad = true` + `RoadEventDetail`); los 5 Porqués, medidas y eficacia son los de las Tasks 10b–10d.
- Las tasas por millón de km, por mes, acumulado y 12 meses móviles, coinciden con el cálculo manual del dataset de referencia (§ Dataset).
- El tablero `/road-safety` es **separado** del `/safety/stats` y tiene su propia entrada en el menú.
- Un evento con solo daño material cuenta en la estadística vial y **no** en los índices laborales; uno con lesión en jornada aparece en ambos tableros; uno in itinere, solo en el vial.
- Sin km no hay tasa: dice "sin datos". Nunca 0.
- Los km del mes se calculan con odómetros cuando hay lecturas y se pueden pisar a mano con motivo.
- Ninguna lista nombra personas a quien no gestiona el módulo.

## Decisiones a confirmar (defaults propuestos)

| # | Decisión | Default propuesto | Alternativa / por qué (R§) |
|---|---|---|---|
| D1 | Qué es un "evento vial" en las tasas | Todo evento de la flota **en misión**, con vehículo de la empresa o del contratista cargado, cuya clasificación **no** sea `near_miss`. Incluye daño material, primeros auxilios, sin tiempo perdido, con tiempo perdido y fatal | Contar también el incidente sin daño inflaría la tasa; se muestra aparte como "incidentes sin daño" (R§3, R§5.1) |
| D2 | Base de las tasas | **Por 1.000.000 de km** (eventos, eventos con lesionados, vuelcos). La base va en la etiqueta y en el export. No se calcula tasa de muertes por 100 millones de km | Unidad de IOGP (R§3). El número de muertes y lesionados graves se muestra como conteo (ISO 39001, R§1) |
| D3 | Lesión grave | **Requirió internación** (campo "lesionados internados"). Se cuentan personas, no eventos | No hay definición única local (R§3, C): validar con un profesional de Higiene y Seguridad |
| D4 | Daño material solo | Se agrega el valor `property_damage_only` al enum `IncidentClassification` (migración propia). Las funciones de la Task 17 lo tratan como "no entra en los índices laborales" | Ya previsto en `SPEC-accident-stats.md`. Alternativa: campo propio en `RoadEventDetail` (no usa la ficha) |
| D5 | Incidente sin daño | Es un `near_miss` de la Task 17 con `isRoad = true`; no entra en las tasas, tiene su tarjeta | Evita un tipo de evento paralelo |
| D6 | In itinere | `inItinere = true`: aparece **solo** en el tablero vial, con tarjeta aparte, fuera de las tasas por km. En el tablero vial se cuenta como "no controlado por la empresa" | ISO 39001: controla vs. influye (R§1, R§5.3) |
| D7 | Km: fuente y cálculo | Km del mes = lectura de cierre del mes menos la del mes anterior. Entre lecturas separadas por meses sin lectura, el reparto es **proporcional a los días**. Sin lectura utilizable = "sin dato" | R§4 (el reparto es B: validar) |
| D8 | Km manuales | Se pueden cargar o pisar con **motivo obligatorio**; queda `source = manual`, con el valor calculado anterior en la revisión | Cubre vehículos sin inspecciones |
| D9 | Lectura de odómetro menor | Es un **error de cálculo** para ese tramo, salvo que se marque un **reinicio de odómetro** (cambio de tablero) con fecha y motivo. Eso corta la serie; los km del tramo no se estiman. La inspección S8 solo pide confirmación; no se cambia | El criterio de aceptación pide error; no se endurece la inspección |
| D10 | Mes sin km de un vehículo | Los eventos de ese vehículo y mes salen de numerador y denominador y la ventana se marca "parcial (falta marzo de V2)". Evento sin vehículo cargado: cuenta como evento pero no en las tasas | Mismo criterio que D8 de la Task 17 (R§5.2, R§5.4) |
| D11 | Poca exposición | Debajo de **100.000 km** en la ventana la tasa se muestra con aviso "poca exposición: mirá el número absoluto". Configurable | R§5.1 (C: umbral a validar) |
| D12 | Vehículos de contratistas | Sus km **no** se piden. Quedan fuera de las tasas de flota salvo que el cliente los cargue a mano; sus eventos cuentan como eventos | R§5.7 |
| D13 | Quién ve nombres de conductores | Solo `tenant_admin` y `process_owner` (acción `manage_road_safety`). El resto ve totales y desgloses sin nombres. Lista "para revisar", sin puntaje ni ranking | Ley 25.326 (R§2.3, C), uso disciplinario (R§5.6). Distinto de D10 de la Task 17 (salud); requiere confirmación |
| D14 | Reincidencia de conductor | Bandera con **2 o más eventos viales (D1) en 12 meses**; configurable. Es para revisión, nunca sanción | R§3 |
| D15 | Excesos de velocidad | Carga manual mensual, **por vehículo**; por conductor es opcional y queda detrás de un ajuste apagado por defecto con aviso de privacidad. Sin integración satelital (fuera de alcance) | Ley 25.326, base legal y consentimiento (R§2.3, C) |
| D16 | Flota con inspección al día | % de vehículos activos cuya última inspección periódica no está vencida (periodicidad del tipo + tolerancia de la plantilla). Un vehículo sin ninguna inspección cuenta como vencido | Reutiliza S8/S10 |
| D17 | Conductor habilitado (18.4) | Licencia vigente **y** habilitación de manejo defensivo vigente (Task 20), calculado con `isQualifiedForTask`. La fecha de licencia la carga el cliente; el producto no valida la jurisdicción | Arts. 11 y 20 de la Ley 24.449 (R§2.1) |
| D18 | `DueItem` de km | Uno por mes para el sitio de cada vehículo con **vencimiento el día 10 del mes siguiente**, aviso 5 días antes; se cierra al confirmar los km de ese mes. Idempotente | Mismo patrón que la exposición de la Task 17 |
| D19 | Denuncia | El evento guarda "¿se hizo la denuncia (art. 65)?" y un n.° opcional. Si no, aviso al registrar | Ley 24.449 arts. 65 y 77 h) (R§2.1) |
| D20 | Retención | Se conserva el historial; plazo de borrado a definir con un abogado. Misma postura que la Task 17 | Ley 25.326 (R§2.3) |
| D21 | Catálogo ISO | `road_safety` pasa de `planned` a `available` con las cláusulas de ISO 39001 **después** de validar la numeración contra el texto oficial | R§1 (B/C) |

## Domain model (conceptual)

Todo lleva `tenantId`. El vehículo es un `Asset` (`typeKey` = `light_vehicle` o `heavy_equipment` que circula por vía pública); el conductor es una `Persona`; la sede es la del evento.

### RoadEventDetail (1:1 con `IncidentRecord` con `isRoad = true`)
`incidentRecordId` (único), `vehicleKind` (`own` / `contractor` / `private` / `none`), `assetId?` (obligatorio si `own`), `vehicleLabel?` (texto para `contractor` / `private`: dominio), `driverPersonId?`, `eventType` (`collision_vehicle`, `collision_fixed_object`, `rollover`, `run_off_road`, `pedestrian_cyclist`, `other`), `roadSurface` (`asphalt`, `gravel`, `dirt`, `unknown`), `light` (`day`, `night`, `dawn_dusk`, `unknown`), `weather` (`clear`, `rain`, `fog`, `wind`, `snow_ice`, `unknown`), `seatbelt` (`all`, `some_not`, `none`, `not_applicable`, `unknown`), `estimatedSpeedKmh?` (0–250), `propertyDamage` (`none`, `minor`, `major`), `injuredCount`, `hospitalizedCount` (≤ `injuredCount`), `fatalCount`, `mainCause` (`speed`, `fatigue_distraction`, `alcohol_drugs`, `mechanical`, `road_conditions`, `other_driver`, `weather`, `other`, `undetermined`), `reportFiled`, `reportRef?`.
- La **persona lesionada** sigue en `IncidentHealth` (Task 17). El detalle vial **no** agrega datos de salud, solo conteos.
- El alta fija `accidentForm` y `materialAgent` de la ficha de la Task 17 con valores viales (si la lista de la Task 17 no los trae, se agregan en 18.1 de forma aditiva).
- `inItinere` y `isRoad` ya existen en `IncidentRecord`. El detalle **no** repite si es en misión o in itinere.

### VehicleKmPeriod
`assetId`, `periodMonth` (día 1, `@db.Date`), `km` (Int ≥ 0), `source` (`odometer` / `manual`), `computedKm?` (lo que habría calculado), `manualReason?` (obligatorio si `manual` y pisa `computedKm`), `confirmedAt?`. Único por (`tenantId`, `assetId`, `periodMonth`). Cada cambio deja registro de auditoría (quién, cuándo, valor anterior y motivo).

### VehicleOdometerReset
`assetId`, `effectiveOn` (`@db.Date`), `reason`. Corta la serie de lecturas de ese vehículo (D9).

### SpeedingPeriod (opcional, D15)
`periodMonth`, `assetId`, `personId?`, `count` (Int ≥ 0), `note?`. Único por (`tenantId`, `periodMonth`, `assetId`, `personId`).

### RoadSafetySettings (uno por tenant)
`minExposureKm` (100.000), `repeatThreshold` (2), `repeatWindowMonths` (12), `speedingPerDriver` (false). La base de las tasas (1.000.000) no es configurable.

### Reglas puras (en `src/domain/road-safety/`)
- `computeVehicleMonthKm({ readings, resets, month })` → `{ km, status: ok | allocated | no_data | inconsistent }`. Usa la lectura de cierre de cada mes; reparte entre lecturas distantes proporcional a los días con el método del mayor resto (la suma se conserva); lectura que baja sin reinicio → `inconsistent` (error). Recibe lecturas ya traídas; no consulta la base.
- `allocateByDays(total, spans)` → km enteros por mes que suman exactamente `total`.
- `classifyVehicleMonth(kmRow | undefined, hasEvents)` → `ok` / `missing` / `empty`.
- `isRoadEventCounted(record)` → verdadero si es en misión y no `near_miss` (D1); `isRoadRateEligible(record, detail)` → además tiene vehículo propio o de contratista con km cargados (D10, D12).
- `aggregateRoadWindow({ km, events, months, settings })` → `{ status: ok | partial | no_data, monthsUsed, monthsExcluded, totals, indices, lowExposure }`.
- `computeRoadIndices(totals)` → eventos, eventos con lesionados y vuelcos por millón de km, o `null`.
- `repeatDrivers(events, settings, asOf)` → conductores con ≥ umbral eventos en la ventana, sin puntaje.
- `fleetInspectionCompliance(vehicles, asOf)` → `{ upToDate, total, pct }`.
- `validateRoadEvent(input)` → errores por campo (ver casos borde).

### Fórmulas (sobre la ventana, sumando antes de dividir)

| Medida | Fórmula | Numerador | Denominador |
|---|---|---|---|
| Eventos por millón de km | eventos × 1.000.000 / km | eventos D1 elegibles de meses válidos | km de los vehículos-mes válidos |
| Eventos con lesionados por millón de km | idem | los anteriores con `injuredCount ≥ 1` | idem |
| Vuelcos por millón de km | idem | los anteriores con `eventType = rollover` | idem |
| Muertes / lesionados graves | conteo | Σ`fatalCount` / Σ`hospitalizedCount` de eventos en misión | — |
| Eventos por conductor | conteo | eventos D1 con `driverPersonId` | — |
| Flota al día | upToDate / total | vehículos activos | — |

Los resultados se muestran con 2 decimales (redondeo comercial); los tests comparan con tolerancia 0,005.

### Casos borde (reglas de dominio y tests)

| Caso | Regla |
|---|---|
| Vehículo-mes sin lectura utilizable ni km manuales | "Sin dato": sus eventos y km salen; la ventana se marca parcial |
| Vehículo-mes con km = 0 y sin eventos | Válido ("estuvo parado"); no es falta |
| Vehículo-mes con km = 0 y con eventos | Inconsistente: aviso y se excluye hasta corregir |
| Eventos 0 con km > 0 | Tasa 0 válida |
| Km total de la ventana = 0 | Tasa `null` ("sin km") |
| Lectura menor que la anterior sin reinicio | Error de cálculo del tramo; se pide confirmar el reinicio o corregir la lectura |
| Reinicio de odómetro | Corta la serie; los km del tramo del reinicio no se estiman; el resto se calcula normal |
| Dos lecturas el mismo día | Se usa la última cargada ese día |
| `hospitalizedCount > injuredCount` | Error |
| `fatalCount > 0` | La clasificación debe ser `fatal`; si no, error |
| `vehicleKind = own` sin `assetId` | Error |
| Evento in itinere o `private` / `none` | Cuenta como evento vial, no entra en las tasas por km |
| Vehículo dado de baja con km del mes | Sus km del período cuentan hasta la baja |
| Zona horaria | Mismos criterios que la Task 17 (`deriveEventPeriod`) |

## Dataset de referencia (valores calculados a mano, para los tests)

Ventana: enero a marzo (3 meses). Vehículos propios: V1 (liviano), V2 (camioneta). Conductores: D1, D2, D3.

**Km por vehículo y mes**

| Vehículo | Ene | Feb | Mar | Total |
|---|---|---|---|---|
| V1 | 10.000 | 12.000 | 8.000 | 30.000 |
| V2 | 20.000 | 18.000 | 12.000 | 50.000 |
| Flota | 30.000 | 30.000 | 20.000 | **80.000** |

**Eventos**

| Id | Mes | Vehículo / conductor | Tipo y clasificación | Detalle |
|---|---|---|---|---|
| E1 | Ene | V1 / D1, en misión | choque con otro vehículo, `property_damage_only` | 0 lesionados |
| E2 | Feb | V2 / D2, en misión | vuelco, `lost_time` | 2 lesionados, 1 internado |
| E3 | Feb | V2 / D2, en misión | despiste, `near_miss` | sin daño |
| E4 | Mar | V1 / D1, en misión | choque con objeto fijo, `no_lost_time` | 1 lesionado |
| E5 | Mar | particular / D3, in itinere | choque, `lost_time` | 1 lesionado |

**Resultados esperados (ventana completa)**

| Medida | Cálculo | Resultado |
|---|---|---|
| Eventos viales (E1, E2, E4) | 3 × 1.000.000 / 80.000 | **37,50** |
| Con lesionados (E2, E4) | 2 × 1.000.000 / 80.000 | **25,00** |
| Vuelcos (E2) | 1 × 1.000.000 / 80.000 | **12,50** |
| Lesionados graves | Σ`hospitalizedCount` | **1** |
| Muertes | Σ`fatalCount` | **0** |
| Incidentes sin daño (E3) | conteo | **1** |
| In itinere (E5) | conteo, fuera de las tasas | **1** |

| Mes | Eventos | Km | Eventos por millón de km |
|---|---|---|---|
| Enero | 1 | 30.000 | 33,33 |
| Febrero | 1 | 30.000 | 33,33 |
| Marzo | 1 | 20.000 | 50,00 |

- **Eventos por conductor:** D1 = 2 (E1, E4: bandera de revisión), D2 = 1 (E2; E3 es `near_miss`), D3 = 0 (in itinere, fuera).
- **Mes con km faltantes:** sin km de V2 en marzo, marzo queda parcial: km de marzo = 8.000 (solo V1), E4 cuenta (V1) → marzo = 1 × 1.000.000 / 8.000 = **125,00** con aviso "parcial: falta V2". Ventana: km = 68.000 (30.000 + 30.000 + 8.000) y eventos = 3 → 3 × 1.000.000 / 68.000 = **44,12**, estado `partial`.
- **Cruce con la Task 17:** E1 no entra en IF, IG, II (solo daño material). E2 entra en IF (laboral, `lost_time`). E4 solo en TRIR opcional. E5 (in itinere): solo en el tablero vial.
- **Odómetro de V1:** lecturas 31/12 = 50.000; 31/01 = 60.000; 28/02 = 72.000; 31/03 = 80.000 → 10.000, 12.000 y 8.000 km. Variante sin la lectura de febrero (31/01 = 60.000 y 31/03 = 80.000): 20.000 km a repartir entre febrero (28 días) y marzo (31 días): febrero = 20.000 × 28 / 59 = 9.491,5 → **9.492** y marzo = **10.508** (método del mayor resto, la suma da 20.000); estado `allocated`.
- **Odómetro que baja:** 31/01 = 60.000 y 28/02 = 55.000 sin reinicio → `inconsistent` (error). Con reinicio el 15/02: los km de febrero no se estiman (`no_data`) y marzo se calcula desde la lectura del reinicio.

## Permisos por rol

Acción nueva en `src/domain/identity/authz.ts`: `manage_road_safety`. Es el único cambio a un modelo compartido y va en un PR de fundación serial antes del módulo (como en la Task 17).

| Acción | tenant_admin | process_owner | contributor | viewer |
|---|---|---|---|---|
| Ver el tablero, tasas, desgloses y totales (sin nombres) | sí | sí | sí | sí |
| Ver el Hallazgo del evento y el detalle vial (sin conductor) | sí | sí | sí | sí |
| Ver el conductor del evento y la lista "para revisar" | sí | sí | no | no |
| Dar de alta el evento vial (paso extra del alta del incidente) | sí | sí | sí | no |
| Cargar y confirmar km, reinicios de odómetro, excesos de velocidad, ajustes | sí | sí | no | no |
| Exportar totales (CSV agregado, resumen imprimible) | sí | sí | sí | sí |
| Exportar casos con nombre de conductor | sí | sí | no | no |

- El superusuario de plataforma no ve al conductor ni las fichas de salud por defecto.
- Cada alta, edición, carga o corrección de km, reinicio, consulta del conductor y export con nombres deja registro de auditoría.
- Los eventos del `Finding` (publicar, cerrar, anular) siguen `SPEC-findings-lifecycle.md` sin cambios.

## Qué ve el cliente

Lenguaje llano, sin "KPI" ni jerga.

- **Alta del evento:** un paso más al registrar un incidente marcado como vial: vehículo (de la flota, de un contratista o particular), conductor, tipo, camino, luz y clima, cinturón, lesionados, internados, causa principal y si se hizo la denuncia. Se ofrece también para los que solo dejan daño material y para los incidentes sin daño.
- **Km del mes:** una grilla vehículo × mes precargada con los odómetros ("calculado de las inspecciones"), editable con motivo. Estados claros: calculado, repartido, sin dato, manual.
- **Tablero `/road-safety`:** muertes y lesionados graves arriba; eventos por millón de km del mes, del año y de los últimos 12 meses con "sin datos", "parcial" y "poca exposición" cuando corresponde; desgloses por sede, tipo de vehículo, tipo de evento y en misión frente a in itinere; flota con inspección o documentación vencida; conductores para revisar (solo quien gestiona el módulo); excesos de velocidad; exportación.
- **Ficha del vehículo y del evento:** indicación de conductor habilitado (licencia + manejo defensivo) cruzada con la Task 20.
- **Guía:** una pantalla breve que explica qué se cuenta, por qué los km pueden estar "sin dato" y que el número no se usa para sancionar.

## Acceptance tests (ejemplos)

| Id | Prueba |
|---|---|
| AR-01 | Dataset: eventos por millón de km = 37,50; con lesionados = 25,00; vuelcos = 12,50; graves = 1; muertes = 0 |
| AR-02 | Dataset mensual: 33,33 / 33,33 / 50,00 |
| AR-03 | Sin km de V2 en marzo: ventana parcial, 44,12 y marzo 125,00 con aviso |
| AR-04 | Km total 0 → `null`, la pantalla dice "sin datos", nunca 0 |
| AR-05 | Odómetro: lecturas del dataset → 10.000, 12.000 y 8.000 km |
| AR-06 | Reparto por días: 9.492 y 10.508, suma 20.000 |
| AR-07 | Lectura que baja sin reinicio → `inconsistent`; con reinicio → corta la serie |
| AR-08 | E1 (daño material) está en el tablero vial y no en IF, IG, II |
| AR-09 | E2 (lesión en jornada) está en ambos tableros; E5 (in itinere), solo en el vial |
| AR-10 | E3 (`near_miss`) no entra en las tasas y sí en "incidentes sin daño" |
| AR-11 | `hospitalizedCount > injuredCount` y `fatalCount > 0` con clasificación no fatal → error |
| AR-12 | Km manual sin motivo cuando pisa el calculado → error; con motivo, `source = manual` y queda registro |
| AR-13 | Conductores: D1 aparece para revisar con 2 eventos; un `contributor` no ve el nombre |
| AR-14 | Aislamiento por empresa: km, eventos y vehículos de otra empresa no se ven ni se editan |
| AR-15 | El `DueItem` mensual de km es idempotente y se cierra al confirmar los km |
| AR-16 | Flota al día: un vehículo sin ninguna inspección cuenta como vencido |
| AR-17 | Conductor habilitado: licencia vencida o sin manejo defensivo vigente → no habilitado |
| AR-18 | Poca exposición: debajo de 100.000 km se muestra el aviso junto a la tasa |
| e2e | Registrar un choque con daño material, cargar km, ver el índice en `/road-safety` y verificar que no suma al tablero laboral |

## Fuera de alcance

- Integración con monitoreo satelital o registrador de datos (vía n8n): los excesos de velocidad y los km se cargan a mano.
- Régimen de cargas peligrosas, límites de horas de conducción y habilitaciones específicas por tipo de transporte (R§2.2, sin validar).
- Cálculo de vencimientos legales de licencia o RTO por jurisdicción (el cliente carga la fecha).
- Puntaje o ranking de conductores, y cualquier uso disciplinario.
- Tasas de víctimas por 100 millones de km y comparación con estadística pública.
- Km de vehículos de contratistas (salvo carga manual).
- Gestión de flota (mantenimiento, combustible, costos).

## Plan vertical (Task 18)

Dependencias: Task 17 (ficha de accidente y punto de extensión) y S8 (vehículos livianos y odómetro) en `main`; S10 (pesados) para los que circulan por vía pública; Task 20 para el conductor habilitado (ya en `main`).

1. **18.1 Dominio + Prisma.** Enums, funciones puras y su unit test sobre el dataset (AR-01 a AR-07, AR-11, AR-16, AR-18), migración propia (`RoadEventDetail`, `VehicleKmPeriod`, `VehicleOdometerReset`, `SpeedingPeriod`, `RoadSafetySettings`, valor `property_damage_only`), acción `manage_road_safety` (PR de fundación serial).
2. **18.2 Registro.** Paso vial en el alta del incidente (incluidos daño material y sin daño), grilla de km con precarga desde odómetros, reinicios, `DueItem` mensual, auditoría. AR-08, AR-09, AR-12, AR-14, AR-15.
3. **18.3 Tablero `/road-safety`.** Ventanas, desgloses, estados "sin datos / parcial / poca exposición", conductores para revisar, flota vencida, excesos, exportación. AR-10, AR-13, e2e.
4. **18.4 Conductor habilitado y cierre.** Licencia + manejo defensivo en la ficha del vehículo y del evento (AR-17), guía, menú, catálogo `road_safety` de `planned` a `available` (D21), README.

Cada paso se publica por separado; la 18.1 puede revisarse sin UI. Cambios en modelos compartidos (`Finding`, `DueItem`, `Tenant`, `authz.ts`): solo la acción nueva, en un PR de fundación serial primero. El módulo solo edita su entrada en `src/domain/modules/catalog.ts`.

## Pendiente de validar con profesionales antes de ofrecer los defaults como "recomendados"

- Definición de lesión grave (D3), umbral de poca exposición (D11), reparto de km por días (D7).
- Base legal y consentimiento para tratar conductores y excesos de velocidad (D13, D15, Ley 25.326, Ley de Contrato de Trabajo).
- Numeración de cláusulas de ISO 39001 contra el texto oficial (D21).
- Retención y plazo de borrado (D20).

## Aprobación

- [ ] Aprobado por el PO (pendiente: esperar la decisión; ningún default está aprobado)
