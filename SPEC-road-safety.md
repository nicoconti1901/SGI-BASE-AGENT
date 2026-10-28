# Spec: `road-safety` — Seguridad vial bajo ISO 39001 (Task 18)

Estado: **APROBADO por el PO el 2026-10-28** con los defaults D1–D26 (reescritura del borrador del PR #32). **Excepción: el índice de cláusulas de ISO 39001 sigue sin verificar**; el tag `sin-verificar` (D1) no se retira hasta que el PO lo confirme contra la norma licenciada.
Investigación y fuentes: `RESEARCH-road-safety.md` ("R§" apunta a esa sección; marcas A/B/C). **Ninguna cláusula de ISO 39001 está verificada contra el texto oficial** (R§1.1): donde este SPEC nombra una cláusula, lo dice.
Se apoya en `SPEC-accident-stats.md` (ficha de accidente), `SPEC-inspections.md` (vehículos, odómetro), `SPEC-master-data.md`, `SPEC-training.md`, `SPEC-findings.md`, `SPEC-risks-opportunities.md` y `SPEC-audits.md`.

## Qué cambia respecto del borrador del PR #32

El borrador trataba la seguridad vial como un tablero de tasas colgado de ISO 45001 (`road_safety` mapeado a 45001 9.1.1). Este SPEC la trata como **una norma propia**:
1. ISO 39001 entra al catálogo ISO como cuarta norma (`ISO39001`), con su lista de requisitos, para vincular hallazgos, auditorías y objetivos a sus cláusulas como con 9001/14001/45001.
2. El módulo se organiza por los **tres grupos de factores de desempeño** de la norma (exposición, resultados finales, resultados intermedios; R§1), no por una sola tasa. Las muertes y lesiones graves van primero.
3. El módulo no duplica lo que ya existe: política y objetivos → Objetivos; riesgos viales → Riesgos; no conformidades y acciones → Hallazgos; auditoría → Auditorías; conductor habilitado → Capacitaciones; vehículo apto → Inspecciones.
4. Se separa lo que la empresa **controla** (en misión, flota propia) de lo que solo **influye** (in itinere, terceros), como pide la norma (R§1).

## Objective

Que una empresa que adopta ISO 39001 gestione la seguridad vial de su flota con el mismo circuito que las otras normas: ver sus factores de desempeño, registrar los eventos viales una sola vez (el mismo Hallazgo `incident` y ficha de la Task 17, más un detalle vial 1:1), medir la siniestralidad por millón de km, y saber qué conductores y vehículos revisar.

### Success criteria
- `ISO39001` existe como norma en el catálogo ISO; las empresas que no la adoptan no ven cambios (pantallas, conteos, auditorías).
- Un evento vial se registra una sola vez; 5 Porqués, medidas y eficacia son los de las Tasks 10b–10d.
- Las tasas por millón de km coinciden con el dataset calculado a mano (§ Dataset).
- El tablero `/road-safety` está separado de `/safety/stats` y agrupa por factores de desempeño.
- Un evento con solo daño material cuenta en el tablero vial y **no** en los índices laborales; con lesión en jornada aparece en ambos; in itinere, solo en el vial.
- Sin km no hay tasa: dice "sin datos", nunca 0.
- Ninguna lista nombra personas a quien no gestiona el módulo.

## Decisiones a confirmar (defaults propuestos)

### A. ISO 39001 en el catálogo (nuevo)

| # | Decisión | Default propuesto | Alternativa / por qué |
|---|---|---|---|
| D1 | Cláusulas sin verificar | El catálogo carga los requisitos de ISO 39001 **con el tag `sin-verificar`** y solo a nivel de las cláusulas de primer nivel (4 a 10) y las subcláusulas con título visto en alguna fuente (R§1.1). El `summary` no cita texto de la norma: paráfrasis propia. Ninguna sale del tag hasta que el PO confirme el índice contra una copia licenciada | Esperar la norma antes de todo: frena la fundación sin necesidad; el tag deja el riesgo a la vista (R§1.1) |
| D2 | Norma en el modelo | Se agrega `ISO39001` al enum `IsoStandard` de Prisma (`ALTER TYPE … ADD VALUE`, migración aditiva sin reescritura) y a `IsoStandardCode` | Un `String` libre: pierde el chequeo de tipos de todo el catálogo |
| D3 | Alcance en pantallas existentes | `AuditStandard`, selectores de Objetivos/Auditorías y la vista del catálogo de plataforma **incluyen** `ISO39001`, pero solo se ofrece a la empresa que la adoptó | Dejarla solo en el catálogo: Hallazgos y Auditorías no podrían vincularla |
| D4 | Cómo se adopta | **Verificado en 18.0:** la plantilla copiaba todo lo esencial y lo «escalable» de todas las normas al crear la empresa, y no había otra vía; ahora `selectRequirementIdsForTemplate` excluye las normas opt-in y el superusuario las adopta por empresa desde `/platform/tenants/<slug>` (`adoptOptInStandard`, idempotente). Opt-in por empresa; ninguna empresa existente la recibe sin activarla | Adopción automática: ensucia las vistas por requisito de todos |
| D5 | Mapeo de `road_safety` en el catálogo de módulos | Pasa a `status: "available"` solo en 18.4. Cláusulas: las de `ISO39001` que correspondan según D1 (operación, evaluación del desempeño, mejora) y se **mantiene** `ISO45001 9.1.1` como secundaria. Los números salen de la tabla R§1.1 | Mapear solo a 45001: es el estado actual y no respeta la norma propia |

### B. Eventos, tasas y km (heredado del borrador, ajustado)

| # | Decisión | Default propuesto | Alternativa / por qué (R§) |
|---|---|---|---|
| D6 | Evento vial en las tasas | Todo evento de la flota **en misión**, con vehículo propio o de contratista, cuya clasificación **no** sea `near_miss` (con o sin lesión, daño material, fatal) | Contar el incidente sin daño inflaría la tasa; va aparte (R§3, R§5.1) |
| D7 | Base de las tasas | **Por 1.000.000 de km** (eventos, con lesionados, vuelcos). La base va en la etiqueta y el export. No se calcula tasa de muertes por 100 millones | Unidad IOGP (R§3). Muertes y lesionados graves se muestran como conteo (R§1) |
| D8 | Lesión grave | **Requirió internación** (`hospitalizedCount`); se cuentan personas | No hay definición local única (R§3, C): validar |
| D9 | Daño material solo | Valor `property_damage_only` en `IncidentClassification` (migración propia, foundation 18.0). No entra en IF, IG, II | Ya previsto en `SPEC-accident-stats.md` |
| D10 | Incidente sin daño | `near_miss` con `isRoad = true`; no entra en las tasas, tarjeta propia | Evita un tipo paralelo |
| D11 | Controla / influye | `inItinere = true` y vehículos `private` / `none` van en la sección "Fuera del control de la empresa": cuentan como evento, no entran en tasas por km | R§1, R§5.3 |
| D12 | Km: fuente | Km del mes = lectura de cierre menos la del mes anterior; entre lecturas separadas por meses sin lectura, reparto **proporcional a los días** (mayor resto). Sin lectura utilizable = "sin dato" | R§4 (reparto B: validar) |
| D13 | Km manuales | Cargar o pisar con **motivo obligatorio**; `source = manual`, queda el valor calculado | Cubre vehículos sin inspecciones |
| D14 | Odómetro que baja | Error de cálculo del tramo salvo **reinicio de odómetro** marcado (fecha y motivo): corta la serie sin estimar. No se cambia la inspección S8 | |
| D15 | Mes sin km | Los eventos de ese vehículo y mes salen de numerador y denominador; ventana "parcial (falta marzo de V2)". Evento sin vehículo: cuenta como evento, no en tasas | R§5.2, R§5.4 |
| D16 | Poca exposición | Bajo **100.000 km** en la ventana, aviso "poca exposición: mirá el número absoluto". Configurable | R§5.1 (C) |
| D17 | Contratistas | No se piden sus km; fuera de la tasa salvo carga manual; sus eventos cuentan | R§5.7 |

### C. Factores de desempeño de resultado intermedio (nuevo)

| # | Decisión | Default propuesto | Alternativa / por qué |
|---|---|---|---|
| D18 | Qué muestra el grupo "intermedios" | Solo medidas con dato disponible en el producto: **cinturón** (% de eventos con todos los ocupantes con cinturón), **fatiga/alcohol** como causa principal, **flota con inspección al día**, **conductores habilitados**, **excesos de velocidad** (carga manual) y **denuncia realizada**. No se inventan otras | Mostrar los 3 subgrupos completos de la norma con datos vacíos: tablero vacío (R§1.1, B) |
| D19 | Flota al día | % de vehículos activos con inspección periódica no vencida (periodicidad del tipo + tolerancia de la plantilla); sin inspección = vencido | Reutiliza S8/S10 |
| D20 | Conductor habilitado | Licencia vigente **y** manejo defensivo vigente (Task 20, `isQualifiedForTask`). La fecha de licencia la carga el cliente; no se valida por jurisdicción | Arts. 11 y 20 de la Ley 24.449 (R§2.1) |
| D21 | Excesos de velocidad | Carga manual mensual **por vehículo**; por conductor opcional, detrás de un ajuste apagado con aviso de privacidad. Sin integración satelital | Ley 25.326 (R§2.3, C) |
| D22 | Atención posterior al choque | Solo el dato "¿se hizo la denuncia (art. 65)?" y n.° opcional. El plan de emergencia vive en Documentos; no se modela un flujo | Ley 24.449 arts. 65 y 77 h) (R§2.1) |
| D23 | Política, objetivos y riesgos viales | No hay tablas nuevas: el catálogo sugiere en Objetivos indicadores viales (tasa, cinturón, flota al día) y Riesgos usa su estructura actual. **A confirmar en 18.2** si Riesgos tiene categoría o hace falta un tag | Duplicar Objetivos/Riesgos |

### D. Datos personales

| # | Decisión | Default propuesto | Alternativa / por qué |
|---|---|---|---|
| D24 | Quién ve conductores | Solo `tenant_admin` y `process_owner` (acción `manage_road_safety`). El resto ve totales sin nombres. Lista "para revisar", sin puntaje | Ley 25.326, uso disciplinario (R§2.3, R§5.6, C) |
| D25 | Reincidencia | Bandera con **2 o más eventos (D6) en 12 meses**; configurable; es para revisión, no sanción | R§3 |
| D26 | Retención | Se conserva el historial; borrado a definir con un abogado | Ley 25.326 |

## Domain model (conceptual)

Todo lleva `tenantId`. El vehículo es un `Asset` (`light_vehicle` o `heavy_equipment` en vía pública); el conductor, una `Persona`.

- **RoadEventDetail** (1:1 con `IncidentRecord` con `isRoad = true`): `incidentRecordId` (único), `vehicleKind` (`own` / `contractor` / `private` / `none`), `assetId?` (obligatorio si `own`), `vehicleLabel?`, `driverPersonId?`, `eventType` (`collision_vehicle`, `collision_fixed_object`, `rollover`, `run_off_road`, `pedestrian_cyclist`, `other`), `roadSurface`, `light`, `weather`, `seatbelt` (`all`, `some_not`, `none`, `not_applicable`, `unknown`), `estimatedSpeedKmh?` (0–250), `propertyDamage` (`none`, `minor`, `major`), `injuredCount`, `hospitalizedCount` (≤ `injuredCount`), `fatalCount`, `mainCause` (`speed`, `fatigue_distraction`, `alcohol_drugs`, `mechanical`, `road_conditions`, `other_driver`, `weather`, `other`, `undetermined`), `reportFiled`, `reportRef?`. La persona lesionada sigue en `IncidentHealth`; el detalle no agrega datos de salud.
- **VehicleKmPeriod**: `assetId`, `periodMonth` (día 1, `@db.Date`), `km` (Int ≥ 0), `source` (`odometer` / `manual`), `computedKm?`, `manualReason?` (obligatorio si pisa lo calculado), `confirmedAt?`. Único por (`tenantId`, `assetId`, `periodMonth`). Cada cambio deja auditoría.
- **VehicleOdometerReset**: `assetId`, `effectiveOn`, `reason` (D14).
- **SpeedingPeriod** (opcional, D21): `periodMonth`, `assetId`, `personId?`, `count`, `note?`.
- **RoadSafetySettings** (uno por tenant): `minExposureKm` (100.000), `repeatThreshold` (2), `repeatWindowMonths` (12), `speedingPerDriver` (false). La base 1.000.000 no es configurable.

### Reglas puras (`src/domain/road-safety/`)
`computeVehicleMonthKm` (→ `ok | allocated | no_data | inconsistent`), `allocateByDays` (mayor resto, la suma se conserva), `classifyVehicleMonth`, `isRoadEventCounted` / `isRoadRateEligible` (D6, D11, D17), `aggregateRoadWindow` (→ `ok | partial | no_data`, `lowExposure`), `computeRoadIndices` (o `null`), `repeatDrivers`, `fleetInspectionCompliance`, `intermediateFactors` (D18), `validateRoadEvent`. Reciben datos ya traídos; no consultan la base.

### Fórmulas (sobre la ventana, sumando antes de dividir)

| Medida | Fórmula | Numerador | Denominador |
|---|---|---|---|
| Eventos por millón de km | eventos × 1.000.000 / km | eventos D6 elegibles de meses válidos | km de vehículos-mes válidos |
| Con lesionados por millón de km | idem | los anteriores con `injuredCount ≥ 1` | idem |
| Vuelcos por millón de km | idem | los anteriores con `rollover` | idem |
| Muertes / lesionados graves | conteo | Σ`fatalCount` / Σ`hospitalizedCount` de eventos en misión | — |
| Cinturón | % | eventos con `seatbelt = all` | eventos con `seatbelt` distinto de `not_applicable` y `unknown` |
| Flota al día | upToDate / total | vehículos activos | — |

Dos decimales (redondeo comercial); tests con tolerancia 0,005.

### Casos borde
Vehículo-mes sin lectura ni km manuales → "sin dato", sale de la ventana (parcial). Km = 0 sin eventos → válido; km = 0 con eventos → inconsistente, excluido hasta corregir. Eventos 0 con km > 0 → tasa 0. Km total 0 → `null`. Lectura menor sin reinicio → `inconsistent`. Dos lecturas el mismo día → la última cargada. `hospitalizedCount > injuredCount` → error. `fatalCount > 0` con clasificación no fatal → error. `own` sin `assetId` → error. Vehículo dado de baja → sus km cuentan hasta la baja. Zona horaria: `deriveEventPeriod` (Task 17).

## Dataset de referencia (calculado a mano)

Ventana ene–mar. Vehículos V1, V2; conductores D1, D2, D3.

| Vehículo | Ene | Feb | Mar | Total |
|---|---|---|---|---|
| V1 | 10.000 | 12.000 | 8.000 | 30.000 |
| V2 | 20.000 | 18.000 | 12.000 | 50.000 |
| Flota | 30.000 | 30.000 | 20.000 | **80.000** |

| Id | Mes | Vehículo / conductor | Tipo y clasificación | Detalle |
|---|---|---|---|---|
| E1 | Ene | V1 / D1, en misión | choque con vehículo, `property_damage_only` | 0 lesionados |
| E2 | Feb | V2 / D2, en misión | vuelco, `lost_time` | 2 lesionados, 1 internado |
| E3 | Feb | V2 / D2, en misión | despiste, `near_miss` | sin daño |
| E4 | Mar | V1 / D1, en misión | choque con objeto fijo, `no_lost_time` | 1 lesionado |
| E5 | Mar | particular / D3, in itinere | choque, `lost_time` | 1 lesionado |

| Medida | Cálculo | Resultado |
|---|---|---|
| Eventos (E1, E2, E4) | 3 × 1.000.000 / 80.000 | **37,50** |
| Con lesionados (E2, E4) | 2 × 1.000.000 / 80.000 | **25,00** |
| Vuelcos (E2) | 1 × 1.000.000 / 80.000 | **12,50** |
| Lesionados graves / muertes | Σ`hospitalizedCount` / Σ`fatalCount` | **1 / 0** |
| Incidentes sin daño (E3); in itinere (E5) | conteo, fuera de las tasas | **1; 1** |

Mensual: enero 33,33 · febrero 33,33 · marzo 50,00. Conductores: D1 = 2 (para revisar), D2 = 1, D3 = 0.
- **Marzo sin km de V2:** km de marzo = 8.000, E4 cuenta → 125,00 con aviso; ventana: 68.000 km, 3 eventos → **44,12**, `partial`.
- **Cruce con Task 17:** E1 no entra en IF, IG, II; E2 entra en IF; E5 solo en el vial.
- **Odómetro V1:** 31/12 = 50.000; 31/01 = 60.000; 28/02 = 72.000; 31/03 = 80.000 → 10.000, 12.000, 8.000. Sin la lectura de febrero: 20.000 km entre febrero (28 días) y marzo (31): 20.000 × 28 / 59 = 9.491,5 → **9.492** y **10.508** (suma 20.000), `allocated`.
- **Odómetro que baja:** 31/01 = 60.000 y 28/02 = 55.000 sin reinicio → `inconsistent`. Con reinicio el 15/02: febrero `no_data`, marzo desde la lectura del reinicio.

## Permisos por rol

Acción nueva `manage_road_safety` en `src/domain/identity/authz.ts` (PR de fundación serial).

| Acción | tenant_admin | process_owner | contributor | viewer |
|---|---|---|---|---|
| Ver tablero, tasas, desgloses y totales (sin nombres) | sí | sí | sí | sí |
| Ver el evento y su detalle vial (sin conductor) | sí | sí | sí | sí |
| Ver conductor del evento y lista "para revisar" | sí | sí | no | no |
| Alta del evento vial | sí | sí | sí | no |
| Cargar/confirmar km, reinicios, excesos, ajustes | sí | sí | no | no |
| Exportar totales | sí | sí | sí | sí |
| Exportar casos con nombre de conductor | sí | sí | no | no |

El superusuario de plataforma no ve conductores ni fichas de salud por defecto. Alta, edición, corrección de km, reinicio, consulta del conductor y export con nombres dejan auditoría.

## Qué ve el cliente

Lenguaje llano, sin "KPI".
- **Tablero `/road-safety`**, en este orden: (1) *Resultado final*: muertes y lesionados graves; (2) *Exposición*: km del período y estado ("calculado", "repartido", "sin dato", "manual"); (3) *Tasas* por millón de km del mes, año y 12 meses ("sin datos", "parcial", "poca exposición"); (4) *Resultados intermedios* (D18); (5) *Fuera del control de la empresa* (D11); (6) conductores para revisar (solo quien gestiona).
- **Alta del evento:** un paso más al registrar un incidente vial (también daño material y sin daño).
- **Km del mes:** grilla vehículo × mes precargada con odómetros, editable con motivo.
- **Guía** breve: qué se cuenta, por qué los km pueden estar "sin dato", que el número no se usa para sancionar, y que las cláusulas de ISO 39001 del catálogo figuran "sin verificar" hasta confirmarlas.

## Acceptance tests

| Id | Prueba |
|---|---|
| AR-01 | Dataset: 37,50 / 25,00 / 12,50; graves = 1; muertes = 0 |
| AR-02 | Mensual: 33,33 / 33,33 / 50,00 |
| AR-03 | Sin km de V2 en marzo: parcial, 44,12 y marzo 125,00 con aviso |
| AR-04 | Km total 0 → `null`; la pantalla dice "sin datos" |
| AR-05 | Odómetro del dataset → 10.000, 12.000, 8.000 |
| AR-06 | Reparto por días: 9.492 y 10.508 |
| AR-07 | Lectura que baja: `inconsistent`; con reinicio, corta la serie |
| AR-08 | E1 en el tablero vial y no en IF, IG, II |
| AR-09 | E2 en ambos tableros; E5 solo en el vial |
| AR-10 | E3 fuera de las tasas y en "sin daño" |
| AR-11 | `hospitalizedCount > injuredCount` y `fatalCount > 0` no fatal → error |
| AR-12 | Km manual sin motivo al pisar lo calculado → error; con motivo queda registro |
| AR-13 | D1 aparece para revisar con 2 eventos; `contributor` no ve el nombre |
| AR-14 | Aislamiento por empresa en km, eventos y vehículos |
| AR-15 | `DueItem` mensual de km idempotente; se cierra al confirmar |
| AR-16 | Vehículo sin inspección cuenta como vencido |
| AR-17 | Licencia vencida o sin manejo defensivo → no habilitado |
| AR-18 | Bajo 100.000 km: aviso de poca exposición |
| AR-19 | Cinturón: % sobre eventos con dato, excluye `not_applicable` y `unknown` |
| AR-20 | `ISO39001` en catálogo: las 3 normas anteriores conservan sus conteos; la empresa que no la adoptó no la ve (pantallas y selectores) |
| AR-21 | Todo requisito `ISO39001` del seed lleva el tag `sin-verificar` y `clauseKey` único |
| AR-22 | Migración del enum aditiva: `migrate dev` sin drift y datos existentes intactos |
| e2e | Choque con daño material, km, índice en `/road-safety` y sin suma en el tablero laboral |

## Fuera de alcance
Monitoreo satelital/registrador; cargas peligrosas, horas de conducción y habilitaciones por transporte (R§2.2); vencimientos legales por jurisdicción; puntaje/ranking de conductores y uso disciplinario; tasas de víctimas por 100 millones de km; km de contratistas (salvo manual); gestión de flota; certificación ISO 39001 ni revisión por la dirección (no existe módulo).

## Plan vertical (Task 18)

Dependencias: Task 17 y S8 (odómetro) en `main`; S10 para pesados en vía pública; Task 20 (ya en `main`).

0. **18.0 Fundación (PR serial, no `/modulo`).** `ISO39001` en enum, tipos y listas (D2, D3); seed de requisitos con tag `sin-verificar` (D1); verificar adopción por empresa (D4); `manage_road_safety`; `property_damage_only` (D9). AR-20 a AR-22.
1. **18.1 Dominio + Prisma.** Enums, reglas puras sobre el dataset (AR-01 a AR-07, AR-11, AR-16, AR-18, AR-19) y migración de las tablas del módulo.
2. **18.2 Registro.** Paso vial en el alta, grilla de km, reinicios, `DueItem` mensual (vence el día 10 del mes siguiente, aviso 5 días antes), auditoría, decisión D23. AR-08, AR-09, AR-12, AR-14, AR-15.
3. **18.3 Tablero.** Orden por factores, desgloses, estados, conductores, exportación. AR-10, AR-13, e2e.
4. **18.4 Habilitaciones y cierre.** Conductor habilitado (AR-17), guía, menú, `road_safety` a `available` con sus cláusulas (D5), README.

Cada paso se publica por separado. Modelos compartidos (`Finding`, `DueItem`, `Tenant`, `authz.ts`, `IsoStandard`) solo en 18.0. Después: `/modulo seguridad-vial 18.1 18.2`, luego `18.3 18.4`.

## Pendiente de validar con profesionales
Índice de cláusulas de ISO 39001 contra una copia licenciada (D1, D5); lesión grave (D8); poca exposición (D16); reparto por días (D12); base legal y consentimiento para conductores y excesos (D21, D24); retención (D26).

## Aprobación
- [x] Aprobado por el PO el 2026-10-28 (defaults D1–D26). Pendiente del PO: confirmar el índice de cláusulas contra ISO 39001:2012 licenciada; hasta entonces todo requisito `ISO39001` lleva `sin-verificar`.
