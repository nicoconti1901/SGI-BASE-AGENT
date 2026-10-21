# Investigación: estadísticas de accidentabilidad (ISO 45001 §9.1, §10.2) — Task 17

**Estado:** Task 17.0 — investigación
**Fecha:** 2026-10-21
**Alcance:** definiciones y fórmulas de los índices de siniestralidad, clasificación de eventos, in itinere, contratistas, privacidad de datos de salud y anti-patrones de estadística. Insumo de `SPEC-accident-stats.md`.
**Aviso:** no es asesoramiento legal ni técnico. Todo lo marcado C debe validarlo un profesional de Higiene y Seguridad (y un abogado, en lo de datos personales) antes de fijarse como regla.

**Escala de confianza:** **A** = confirmado en la fuente (la leí en esta investigación). **B** = práctica habitual o fuente secundaria. **C** = no verificado, validar con un profesional.

---

## 0. Resumen ejecutivo

1. **En Argentina no hay una fórmula legal obligatoria de IF/IG por horas-hombre.** La Res. SRT 905/2015 (Anexo I, punto 13) solo manda a los servicios de Higiene y Seguridad a "elaborar estadísticas de accidentes de trabajo, enfermedades profesionales, ausentismo" y evaluarlas "por medio de Índices de Frecuencia, Gravedad, Incidencia, Riesgos"; no da fórmulas ni bases (A). Las fórmulas por HHT salen de la práctica internacional (ANSI Z16.1, OIT, INSST). El `todo.md` las llama "criterio de la SRT": es inexacto.
2. **Lo que sí publica la SRT** se calcula sobre **trabajadores cubiertos**, no sobre HHT: índice de incidencia (×1.000), incidencia de fallecidos (×1.000.000), índice de pérdida (jornadas ×1.000), duración media de las bajas y letalidad (×100.000 casos) (A, §2.1).
3. **Cargo de 6.000 días por muerte:** es de ANSI Z16.1 (A, fuente secundaria), no de la OIT. La OIT calcula la gravedad solo con incapacidad temporaria y pide compilar aparte muertes e incapacidad permanente (A).
4. **Base del IG:** 1.000.000 (ANSI, OIT, IOGP) o 1.000 (INSST, España). El `todo.md` usa 1.000 (A que ambas existen; la elección es del PO).
5. **In itinere** va aparte: coincide con la OIT, con las NTP del INSST y con el índice SRT "AT y EP". Legalmente sigue siendo accidente de trabajo (Ley 24.557 art. 6.1), así que se registra, se denuncia y se informa, pero no entra en IF/IG/II.
6. **Datos de salud = datos sensibles** (Ley 25.326 art. 2). Hay base legal para registrarlos (obligación legal del empleador, Ley 24.557 art. 31), pero exige seguridad y confidencialidad (arts. 9 y 10) y conviene mostrar solo agregados disociados al resto de los roles.

---

## 1. Qué piden las normas ISO 45001

| Requisito (paráfrasis) | Implicación en producto | Conf. | Fuente |
|---|---|---|---|
| §9.1.1: determinar qué se mide, métodos, cuándo se mide y cuándo se analiza y evalúa; conservar información documentada | Cada índice tiene fórmula y base visibles; el período de carga es mensual | B | Proyecto: `RESEARCH-indicators.md` §A; texto oficial ISO de pago: no pude abrirlo (HTTP 403) |
| La norma **no prescribe** índices concretos (IF, IG, TRIR…) | La organización elige y documenta su fórmula; por eso la base y el cargo son configurables y se muestran | B | Idem; verificar contra el texto oficial |
| §10.2: reaccionar, evaluar con participación de los trabajadores la necesidad de acción, determinar causas, revisar riesgos, implementar la acción, **revisar su eficacia** | El accidente es un Hallazgo con 5 Porqués, medidas y verificación de eficacia (Tasks 10b–10d); la estadística no reemplaza esto | B | [ecesis — 45001 Incident and Corrective Action](https://www.ecesis.net/ISO-45001/Incident-and-Corrective-Action.aspx), [presencis — 45001 art. 10.2](https://cdn.presencis.com/regulations/iso-45001/article-10.2/); proyecto: `RESEARCH-findings-lifecycle.md` |
| "Incidente" en 45001 abarca el suceso con o sin lesión (el casi accidente es un incidente) | La clasificación incluye casi accidente y primeros auxilios aunque no entren en los índices | B | Conocimiento de la norma; definición 3.x no verificada contra el texto oficial |
| Combinar indicadores reactivos (accidentes) y proactivos (inspecciones, capacitaciones) | El tablero ofrece vincular un Indicador de la Task 11c; no se presenta como único termómetro del SGI | B | `RESEARCH-indicators.md` §B |

---

## 2. Argentina

### 2.1 Índices que publica la SRT (A)

Fuente principal: [SRT — Definiciones y notas metodológicas sobre accidentabilidad](https://www.srt.gob.ar/estadisticas/acc_definiciones.php). Fórmulas de la edición 2012 reproducidas en [OISS — Indicadores de siniestralidad laboral en Iberoamérica](https://oiss.org/wp-content/uploads/2018/12/17-Recopilacion_de_los_Indicadores_de_Siniestralidad_Laboral_en_Iberoamerica.pdf) (sección Argentina).

| Índice SRT | Fórmula | Denominador |
|---|---|---|
| Índice de incidencia (global y "AT y EP") | casos notificados con al menos 1 día de baja o secuela × 1.000 | trabajadores cubiertos |
| Incidencia de fallecidos | trabajadores fallecidos × 1.000.000 | trabajadores cubiertos |
| Índice de pérdida | jornadas no trabajadas × 1.000 | trabajadores cubiertos |
| Duración media de las bajas | jornadas no trabajadas / damnificados con baja | casos con baja |
| Índice de letalidad | fallecidos × 100.000 | casos notificados |

Matices de la SRT que importan al diseño:
- "Global" incluye accidentes, enfermedades profesionales, **in itinere** y reingresos; la variante **"AT y EP" excluye in itinere y reingresos** (A: SRT y OISS, nota al pie "Se excluyen accidentes in itinere y reagravaciones").
- La SRT habla de **jornadas** (días hábiles no trabajados) por incapacidad laboral temporaria; la OIT, el INSST y OSHA cuentan **días corridos** (A, ver §3). Los dos criterios no son equivalentes: comparar con los sectores de la SRT es aproximado.
- La OIT recomienda calcular solo con accidentes con baja (A: OISS).
- Cobertura: el denominador es el parte mensual de trabajadores declarados por los empleadores, no horas.

### 2.2 Obligaciones y definiciones legales

| Tema | Qué dice | Conf. | Fuente |
|---|---|---|---|
| Accidente de trabajo | "todo acontecimiento súbito y violento ocurrido por el hecho o en ocasión del trabajo, o en el trayecto entre el domicilio del trabajador y el lugar de trabajo", si no se interrumpió o alteró por causas ajenas al trabajo. El trabajador puede declarar por escrito que el itinere se modifica (estudio, otro empleo, familiar enfermo no conviviente); el empleador lo comunica a la ART en 72 horas | A | [Ley 24.557 art. 6.1](https://www.argentina.gob.ar/normativa/nacional/ley-24557-27971/texto) |
| Enfermedad profesional | Solo las del listado del Poder Ejecutivo (agente, cuadro clínico, exposición, actividades) o las que la Comisión Médica Central determine caso por caso | A | Ley 24.557 art. 6.2; el listado se aprobó por Decreto 658/96 ([OISS](https://oiss.org/wp-content/uploads/2018/12/17-Recopilacion_de_los_Indicadores_de_Siniestralidad_Laboral_en_Iberoamerica.pdf)). Listado vigente y modificatorias: **C** |
| Incapacidad laboral temporaria (ILT) | Impide temporalmente las tareas habituales; cesa por alta médica, declaración de incapacidad permanente, **un año desde la primera manifestación invalidante** o muerte | A (texto consultado; reformas posteriores sin verificar → **C**; un blog menciona 2 años) | Ley 24.557 art. 7 |
| Denuncia | El empleador debe denunciar ante la ART y la SRT los accidentes y enfermedades profesionales que ocurran en sus establecimientos; y llevar un **registro de siniestralidad por establecimiento**. El trabajador debe denunciar al empleador | A | Ley 24.557 art. 31 (2.c, 2.e, 3.e) |
| Plazo para denunciar | La ley consultada no fija un plazo general. Una plantilla de formulario menciona 24 horas | **C** | [forms-legal (plantilla, no norma)](https://forms-legal.com/argentina/employment/forms/formulario-art-denuncia-accidente-trabajo-argentina); canal electrónico de denuncias: Res. SRT 1021/2008 (solo el título visto) |
| Investigación de accidentes | Los servicios de H&S deben investigar la totalidad de los accidentes con "Árbol de Causas u otro método similar", indicar causas y definir medidas correctivas y preventivas | A | [Res. SRT 905/2015, Anexo II punto 12](https://www.argentina.gob.ar/normativa/nacional/246509/texto) |
| Registro | El Servicio de Medicina del Trabajo debe llevar un "Registro de Enfermedades Profesionales y Accidentes de Trabajo" con datos personales y laborales; verificar que se hayan denunciado en tiempo y forma | A | Res. SRT 905/2015, Anexo III puntos 10 y 11 |
| Estadísticas | Elaborar estadísticas de accidentes, enfermedades profesionales y ausentismo evaluadas por Índices de Frecuencia, Gravedad, Incidencia y Riesgos. **No da fórmulas** | A | Res. SRT 905/2015, Anexo I punto 13 |
| Qué cuenta como "con baja" para la SRT | Casos con al menos un día de baja laboral o secuela permanente | A | [SRT definiciones](https://www.srt.gob.ar/estadisticas/acc_definiciones.php) |
| Plazos de pago de los primeros días de ILT (empleador/ART) | Una calculadora online dice "días 1–10 el empleador"; no lo pude confirmar | **C** — no se usa en el producto | — |
| Tablas oficiales de códigos (forma del accidente, agente material, naturaleza de la lesión, zona del cuerpo) en la denuncia a la ART | Los formularios de denuncia tienen esos campos; **no pude obtener las tablas oficiales** | **C** | [Formulario ART (CONICET)](https://nordeste.conicet.gov.ar/wp-content/uploads/sites/34/2025/09/ART_formulario.pdf) muestra los campos, no los códigos |

### 2.3 Ley 25.326 de protección de datos personales (A)

Texto: [argentina.gob.ar — Ley 25.326](https://www.argentina.gob.ar/normativa/nacional/64790/texto).

| Artículo | Contenido | Consecuencia práctica |
|---|---|---|
| 2 | **Datos sensibles** incluyen "información referente a la salud". **Disociación**: tratamiento que impide asociar la información a una persona determinada o determinable | La ficha de lesión es dato sensible; los totales sin nombres son datos disociados |
| 4 | Datos adecuados, pertinentes y **no excesivos** para la finalidad; no usarlos para fines incompatibles; no conservarlos más de lo necesario | Pedir solo lo que la estadística y la investigación necesitan; sin diagnóstico libre; definir retención |
| 5.2 | No hace falta consentimiento cuando los datos se recaban "en virtud de una obligación legal" o derivan de una relación contractual/profesional necesaria para su cumplimiento | El registro de siniestralidad se apoya en Ley 24.557 art. 31.2.e (obligación legal). Conf. B: la lectura es razonable, **validar con abogado** |
| 7.1–7.3 | Nadie está obligado a dar datos sensibles; solo se tratan por razones de interés general autorizadas por ley, o **con fines estadísticos si no se puede identificar a los titulares**; prohíbe archivos que revelen datos sensibles | Refuerza el diseño: identificación solo para quien tiene necesidad (SST); el resto ve agregados disociados. El art. 7.3 es una tensión a validar con abogado |
| 9 | Medidas técnicas y organizativas para seguridad y confidencialidad; evitar consulta o tratamiento no autorizado; **detectar desviaciones** | Permisos por rol, aislamiento por tenant, registro de quién modificó/consultó la ficha |
| 10 | Deber de confidencialidad de quien participa del tratamiento, aun después de terminada la relación | Cláusula en los términos del servicio; el personal de plataforma no ve fichas (ver SPEC) |
| 14–16 | Derecho de acceso (respuesta en 10 días corridos), rectificación, actualización y supresión (5 días hábiles); no se suprime si hay deber legal de conservar | El trabajador puede pedir su ficha al cliente; el sistema debe poder exportarla y corregirla; la baja física no aplica a lo que debe conservarse |

Sin verificar (**C**): estado actual de las reformas al proyecto de ley de datos; obligación de inscribir la base ante la autoridad de aplicación; si el SaaS actúa como prestador de servicios de tratamiento por cuenta de terceros (art. 25) y qué contrato corresponde; plazo de conservación de la ficha de accidente.

---

## 3. Estándares internacionales

### 3.1 OIT — resolución de estadísticas de lesiones por accidentes del trabajo (1998)

Fuente: [ILO — presentación de la resolución](https://www.ilo.org/media/289311/download) (leída). La diapositiva dice "17.ª" Conferencia; el resto de las fuentes dice 16.ª, octubre de 1998. Página de la resolución: [ILO](https://www.ilo.org/resource/resolution-concerning-statistics-occupational-injuries-resulting) (solo vista en resultados de búsqueda).

| Concepto | Definición OIT | Conf. |
|---|---|---|
| Cobertura | Lesiones mortales y no mortales con ausencia de al menos 1 día. **Los accidentes de trayecto ("commuting") se compilan y difunden por separado** | A |
| Caso mortal | Fallecido por accidente del trabajo cuando la muerte ocurre **dentro del año** del accidente | A |
| Incapacidad temporaria | No pudo trabajar desde el día siguiente al accidente y volvió a sus tareas habituales dentro del año | A |
| Días perdidos | **Días corridos** de incapacidad, **excluido el día del accidente**, hasta un máximo de un año. Para incapacidad permanente y muertes "pueden estimarse pero deben compilarse y difundirse por separado" | A |
| Tasa de frecuencia (mortales y no mortales) | casos nuevos del año × **1.000.000** / horas trabajadas | A |
| Tasa de incidencia | casos nuevos del año × **100.000** / trabajadores | A |
| Tasa de gravedad | días perdidos por casos nuevos del año × **1.000.000** / horas trabajadas; **solo incapacidad temporaria** | A |
| Días perdidos por lesión | mediana o media por lesión | A |
| Clasificaciones | tipo de lesión, **parte del cuerpo**, tipo de lugar, **forma (modo) y agente material** de la lesión, sexo, edad, ocupación | A |
| Atribución temporal | Se cuentan los casos nuevos **del año** y los días que provocan: el caso pertenece al período del accidente | A (por la redacción "new cases … during the calendar year") |

### 3.2 ANSI Z16.1 (histórico, origen del "cargo de días")

- Frecuencia = lesiones incapacitantes × 10^6 / horas de exposición; **gravedad = (días perdidos + días cargados) × 10^6 / horas**; promedio de días cargados = gravedad / frecuencia. Cargo de **6.000 días por muerte** (A: [Petersen, Professional Safety, ASSP 2005](https://aeasseincludes.assp.org/professionalsafety/pastissues/050/12/041205as.pdf)). Ejemplo del artículo: 7.872 días = 6.000 (muerte) + 1.800 (pérdida de un ojo) + días de casos temporarios.
- Tabla de cargos de ANSI Z16.1: muerte e incapacidad total permanente = 6.000; si la suma de varias incapacidades parciales supera 6.000 se topea en 6.000; para enfermedades profesionales no listadas se aplica el porcentaje de incapacidad permanente × 6.000 (A: [ISP Chile, guía de días cargo, RE 635/2025](https://previsionsocial.gob.cl/wp-content/uploads/2025/01/RE-635_2025-ISP_-GUIA-DE-APLICACION-DE-DIAS-CARGO-PARA-EL-CALCULO-DE-LA-TASA-DE-GRAVEDAD.pdf); jurisdicción chilena, pero explica la tabla). La guía agrega que **OSHA reemplazó a ANSI Z16.1 en EE.UU.** y que las tablas españolas calculan la gravedad **por mil horas** en lugar de por millón.
- El 6.000 como criterio de uso casi universal aparece también en la recopilación de la OISS, en la ficha de Brasil: "cada morte ou incapacidade permanente total seja computada como equivalente a 6.000 dias" (A, [OISS](https://oiss.org/wp-content/uploads/2018/12/17-Recopilacion_de_los_Indicadores_de_Siniestralidad_Laboral_en_Iberoamerica.pdf)).

### 3.3 OSHA (EE.UU.)

| Concepto | Contenido | Conf. | Fuente |
|---|---|---|---|
| Tasa de incidencia | casos × **200.000** / horas trabajadas; 200.000 = 100 empleados × 40 h × 50 semanas | A | [BLS — compute incidence rates](https://www.bls.gov/iif/overview/compute-nonfatal-incidence-rates.htm) |
| TRIR | Tasa sobre todos los casos registrables: muerte, días de ausencia, trabajo restringido o traslado, tratamiento médico más allá de primeros auxilios, pérdida de conocimiento, diagnóstico significativo | A | [29 CFR 1904.7](https://www.osha.gov/laws-regs/regulations/standardnumber/1904/1904.7) |
| DART | Casos con días de ausencia + trabajo restringido/traslado (columnas H + I del Formulario 300) × 200.000 / horas; **la muerte no entra en H ni en I** | A | BLS (idem) |
| Conteo de días | Días corridos; se cuenta desde el día **siguiente** a la lesión; se puede topear en **180 días**; un caso que cruza de año se registra **una sola vez, en el año en que ocurrió** | A | 29 CFR 1904.7(b)(3) |
| Trayecto | Los accidentes de tránsito en el estacionamiento o camino de acceso de la empresa durante el trayecto **no** son laborales; los viajes en interés del empleador sí; los desvíos personales no | A | [29 CFR 1904.5](https://www.osha.gov/laws-regs/regulations/standardnumber/1904/1904.5) |

### 3.4 IOGP / IMCA (petróleo y gas; relevante para clientes de yacimientos y contratistas)

| Índice | Definición | Conf. | Fuente |
|---|---|---|---|
| LTIF | (muertes + casos con días perdidos) × 1.000.000 / horas. **Numéricamente es el IF si el IF cuenta los fatales** | B | [IADC lexicon — LTIF](https://iadclexicon.org/ltif/) (atribuye a OGP Report 456, 2011); [IMCA safety statistics](https://www.imca-int.com/media/okucyrbs/imca-safety-statistics-2017.pdf) |
| FAR (tasa de accidentes fatales) | muertes × 100.000.000 / horas | B | IMCA; [JPT — IOGP 2024](https://jpt.spe.org/report-presents-complex-safety-picture-as-fatalities-rise-but-fatality-rate-dips) (0,77 con 32 muertes y 4.159 millones de horas, consistente) |
| TRCF (frecuencia de casos registrables) | Incluye muertes, LTI, trabajo restringido y tratamiento médico, por millón de horas | **C** (la definición IOGP exacta está en una guía que exige registro; IMCA da una variante) | [IOGP — user guide](https://idms.iogp.org/Documents/829) |
| Contratistas | IOGP reporta empleados y contratistas, ambos con sus horas | B | JPT |

### 3.5 INSST (España), NTP 1211 (B, fuente secundaria)

Resumen en [Sabentis](https://www.sabentis.com/explora/indices-de-siniestralidad/): incidencia = accidentes con baja / trabajadores expuestos × 1.000 (la estadística oficial usa × 100.000); **frecuencia × 1.000.000 horas**; **gravedad = jornadas perdidas × 1.000 / horas** (días corridos); duración media = jornadas perdidas / accidentes con baja. Los in itinere "se distinguen y analizan aparte" y no se incluyen en el índice de frecuencia. Los cargos por muerte o incapacidad permanente se computan con "baremos convencionales" (no da el valor). Es la fuente de la base 1.000 del IG en el `todo.md`.

### 3.6 Clasificación de causas y lesiones

| Fuente | Variables | Conf. |
|---|---|---|
| OIT 1998 | tipo de lesión, parte del cuerpo, forma y agente material de la lesión (A) | A |
| Eurostat ESAW | tipo de lesión, parte del cuerpo, desviación, contacto-modo de lesión, agente material, proceso de trabajo, actividad física específica; gravedad en días corridos completos sin contar el día del accidente; cuenta accidentes con **más de 3 días** de ausencia, incapacidad permanente o muerte dentro del año ([Eurostat ESAW](https://ec.europa.eu/eurostat/cache/metadata/en/hsw_acc7_work_esms.htm), [KS-RA-12-102](https://ec.europa.eu/eurostat/documents/3859598/5926181/KS-RA-12-102-EN.PDF)) | B |
| Denuncia a la ART (Argentina) | forma del accidente, agente material asociado, naturaleza de la lesión, zona del cuerpo afectada (los campos existen; las tablas oficiales, **C**) | A campos / C códigos |

Consecuencia: el SPEC define **listas propias, cortas y estables** (claves en código) inspiradas en estas variables, con "Otros". No se declaran equivalentes a la tabla oficial de la SRT hasta validarla.

---

## 4. Tratamiento de casos especiales

### 4.1 In itinere (accidente de trayecto)

- Legalmente es accidente de trabajo (Ley 24.557 art. 6.1) y se denuncia a la ART (A).
- Estadísticamente va **aparte**: OIT (A), INSST (B), SRT "AT y EP" (A), OSHA excluye casi todo el trayecto (A). Una resolución anterior de la SRT sobre empresas testigo también lo excluía del índice de incidencia ([Res. SRT 700/2000, vista en resultados de búsqueda](https://fio.unicen.edu.ar/usuario/segumar/Laura/material/LEGISLACI%d3N/Resoluci%f3n%20SRT%20700-00.pdf), B).
- Razón de fondo: el empleador no controla el trayecto, y mezclarlo distorsiona la lectura de lo que ocurre en el establecimiento.
- Debe seguir contando para la Task 18 si es vial, y mostrarse en el tablero como tarjeta propia (casos y días).
- Un casi accidente "in itinere" no es un evento registrable: el SPEC lo impide.

### 4.2 Contratistas

- Los reportes de la industria (IOGP) calculan empleados y contratistas por separado, cada uno con sus horas (B). La OIT calcula por "grupo de referencia" (A).
- Regla: el accidentado se asigna a **propio** o **contratista** según su ficha de Persona (`employer`), y se calcula contra las horas del mismo grupo. Nunca dividir los accidentes de contratistas por las horas del personal propio ni al revés.
- La denuncia a la ART del contratista corresponde a su empleador (Ley 24.557 art. 31 obliga al empleador); si el comitente también debe registrar el hecho es **C**.
- Un total (propio + contratista) solo es válido si ambos grupos están cargados el mismo mes.

### 4.3 Accidente que abarca varios meses

- OSHA: se registra una vez, en el año en que ocurrió (A). OIT: casos nuevos del año con los días que provocan (A). Entonces los **días perdidos se imputan al mes del accidente**, aunque la baja se prolongue. Es el default del `todo.md` y queda respaldado.
- Consecuencia: mientras el caso está abierto, el IG de ese mes es **provisorio** (crece al actualizar). El tablero lo debe marcar y la medición del indicador vinculado no debe fijarse hasta que cierre.
- Tope de días reales: 365 (OIT: un año; Ley 24.557 art. 7: la ILT cesa al año). OSHA topea en 180 (A), criterio distinto; se deja 365 configurable.

### 4.4 Enfermedad profesional

- No es un "accidente": se registra y se informa, pero **no entra en IF/IG** por defecto (la OIT trata las lesiones por accidentes; la SRT las suma en "AT y EP", que es sobre trabajadores cubiertos). Fecha de referencia: primera manifestación (ver ILT, art. 7). Conf. B; decisión del PO.

### 4.5 Fatal e incapacidad permanente

- Muerte: cargo de 6.000 días (ANSI, A secundaria); no se suman días reales (el cargo reemplaza).
- Incapacidad permanente: ANSI tabula cargos parciales; la guía chilena usa porcentaje de incapacidad × 6.000 para casos no tabulados (A); en Argentina la ART fija el porcentaje de incapacidad (Ley 24.557; dato manual del cliente). Conf. B para usarlo como cargo; **C** para equivalencia con la práctica local.
- La OIT cuenta como fatal solo si la muerte ocurre dentro del año (A).

---

## 5. Anti-patrones de estadística

| Anti-patrón | Por qué es un problema | Regla del producto |
|---|---|---|
| Mostrar **0** cuando falta la exposición | Parece "sin accidentes" y premia no cargar datos | "Sin datos" distinto de 0.00; un 0.00 solo con exposición cargada |
| **Promediar índices mensuales** (o sumar tasas) | El promedio de tasas pondera igual meses con distinta exposición | Siempre sumar numeradores y denominadores de la ventana y recién ahí dividir |
| **Dotación sumada** en una ventana de varios meses | Un II anual con dotación de 12 meses sumados da un número 12 veces menor | Dotación = promedio de los meses de la ventana |
| Eventos de un mes **sin horas** dentro del numerador | Infla el índice | El mes sin exposición sale de numerador y denominador, y se avisa (ventana "parcial") |
| Total propio + contratista con uno de los grupos ausente | El total parece mejor/peor según qué falte | El mes entra al total solo si todos los grupos están cargados |
| **Duración media con cargo de 6.000** | Un fatal lleva el promedio a miles de días | ID usa días reales de casos no fatales; sin casos → "sin casos" (no 0) |
| Tasas con **números chicos** (p. ej. FAR con 18.000 h y 1 muerte = 5.555) | Volatilidad sin significado | No se muestra FAR por defecto; ventanas con pocas horas llevan advertencia; preferir 12 meses móviles |
| Mezclar **bases distintas** (×1.000 vs ×1.000.000) al comparar con un benchmark | Diferencias de 1.000 veces | La base va en la etiqueta del índice y en el export |
| **In itinere** en los índices del establecimiento | Distorsiona; no lo controla el empleador | Aparte |
| "Días sin accidentes" como meta | Incentiva a no registrar | Se muestra, pero la guía advierte; empieza a contar desde que hay datos (nunca "infinitos" en una empresa nueva) |
| Índices de un mes **modificados sin rastro** al corregir | Auditoría imposible | Historial de seguimiento del caso y de correcciones de exposición |
| **Estimar HHT** desde la dotación sin avisar | Falsa precisión | No se estima; se muestra "sin datos" (decisión del PO) |
| Contar **primeros auxilios o casi accidentes** en IF | Cambia el significado del índice | Solo con baja y fatales en IF/IG; registrables (OSHA) en TRIR |
| Usar un índice como **único termómetro** | Reactivo y tardío | Vincular a Indicadores proactivos de la Task 11c |

---

## 6. Privacidad y datos de salud (diseño)

Principios que salen de la Ley 25.326 (§2.3) aplicados al producto:

1. **Minimización (art. 4):** estructura cerrada (clasificación, naturaleza de la lesión, parte del cuerpo, días perdidos); sin diagnóstico ni historia clínica; los adjuntos médicos no se piden.
2. **Disociación para estadísticas (arts. 2 y 7.2):** el tablero y los export agregados no incluyen nombres.
3. **Seguridad y detección (art. 9):** permisos por rol, aislamiento por tenant, registro de altas, ediciones y consultas de la ficha, y personal de plataforma sin acceso a la ficha de salud por defecto.
4. **Texto libre = riesgo:** el título, la descripción, los 5 Porqués y los adjuntos del Hallazgo pueden contener nombres y diagnósticos. El PO decidió (2026-10-21) que todos los roles de la empresa ven las fichas y el Hallazgo completos, por lo que el SPEC no oculta nada por rol: el riesgo queda asumido y pendiente de revisión legal; la mitigación es el registro de cada consulta y el aviso de no escribir diagnósticos.
5. **Re-identificación:** con sedes chicas, un total por sede identifica a la persona. Se documenta como riesgo; el umbral de supresión queda fuera de alcance (**C**).
6. **Retención (art. 4.7):** plazo legal de conservación **C**; la baja de una Persona no borra el historial (decisión ya tomada en Task 14); se prevé exportar la ficha de una persona (arts. 14–16).

---

## 7. Qué quedó sin verificar (validar con un profesional de Higiene y Seguridad)

- Tablas oficiales SRT de forma del accidente, agente material, naturaleza de la lesión y zona del cuerpo (y su codificación en la denuncia).
- Plazo legal de la denuncia a la ART y reformas posteriores a la Ley 24.557 (Ley 26.773, Ley 27.348 y reglamentos). No se encontró fuente oficial en esta corrida.
- Cómo cuenta la ART los días de baja (jornadas vs. días corridos; si el día del accidente cuenta), y el efecto de la reforma sobre la ILT.
- Listado vigente de enfermedades profesionales (Decreto 658/96 y modificatorios).
- Norma IRAM o resolución argentina que fije la fórmula de IF/IG por HHT (no encontrada; la Res. 905/2015 solo los nombra).
- Definición exacta de TRCF de IOGP y su guía de validación (la guía exige registro).
- Texto oficial de ISO 45001:2018 (9.1.1, 10.2, definición de incidente): paywall.
- Obligaciones de la Ley 25.326 para el SaaS (inscripción, prestador por cuenta de terceros), retención, y si el registro de salud con identificación cumple el art. 7.3.
- Tratamiento del contratista en la denuncia y en el registro del comitente.
- Cargos de días para incapacidades permanentes parciales en Argentina.

---

## 8. Tabla de fuentes

| # | Fuente | URL | Se usó para | Conf. |
|---|---|---|---|---|
| 1 | SRT — definiciones de accidentabilidad | https://www.srt.gob.ar/estadisticas/acc_definiciones.php | índices SRT, in itinere en "global" | A |
| 2 | OISS — Indicadores de siniestralidad en Iberoamérica (2012) | https://oiss.org/wp-content/uploads/2018/12/17-Recopilacion_de_los_Indicadores_de_Siniestralidad_Laboral_en_Iberoamerica.pdf | fórmulas SRT, 6.000 días (Brasil), nota in itinere | A (secundaria) |
| 3 | Res. SRT 905/2015 | https://www.argentina.gob.ar/normativa/nacional/246509/texto | obligación de estadísticas, registro, investigación | A |
| 4 | Ley 24.557 | https://www.argentina.gob.ar/normativa/nacional/ley-24557-27971/texto | accidente, in itinere, ILT, denuncia, registro | A (versión sin cotejar con reformas) |
| 5 | Ley 25.326 | https://www.argentina.gob.ar/normativa/nacional/64790/texto | datos sensibles, seguridad, confidencialidad | A |
| 6 | OIT — resolución de estadísticas de lesiones 1998 (presentación) | https://www.ilo.org/media/289311/download | definiciones, tasas, clasificaciones | A |
| 7 | OSHA 29 CFR 1904.7 | https://www.osha.gov/laws-regs/regulations/standardnumber/1904/1904.7 | registrables, conteo de días | A |
| 8 | OSHA 29 CFR 1904.5 | https://www.osha.gov/laws-regs/regulations/standardnumber/1904/1904.5 | trayecto | A |
| 9 | BLS — tasas de incidencia | https://www.bls.gov/iif/overview/compute-nonfatal-incidence-rates.htm | 200.000, DART | A |
| 10 | ASSP — Petersen (2005) | https://aeasseincludes.assp.org/professionalsafety/pastissues/050/12/041205as.pdf | ANSI Z16.1, 6.000 días | A (secundaria) |
| 11 | ISP Chile — guía de días cargo (RE 635/2025) | https://previsionsocial.gob.cl/wp-content/uploads/2025/01/RE-635_2025-ISP_-GUIA-DE-APLICACION-DE-DIAS-CARGO-PARA-EL-CALCULO-DE-LA-TASA-DE-GRAVEDAD.pdf | tabla de cargos, tope 6.000, 1.000 vs 10^6, OSHA 180 días | A (otra jurisdicción) |
| 12 | Sabentis (NTP 1211 INSST) | https://www.sabentis.com/explora/indices-de-siniestralidad/ | base 1.000 del IG, in itinere | B |
| 13 | IADC lexicon — LTIF | https://iadclexicon.org/ltif/ | LTIF | B |
| 14 | IMCA — safety statistics 2017 | https://www.imca-int.com/media/okucyrbs/imca-safety-statistics-2017.pdf | LTIF, FAR (vía resultado de búsqueda) | B |
| 15 | JPT — IOGP 2024 | https://jpt.spe.org/report-presents-complex-safety-picture-as-fatalities-rise-but-fatality-rate-dips | FAR, contratistas | B |
| 16 | IOGP — user guide 2017 (acceso con registro) | https://idms.iogp.org/Documents/829 | confirma que las definiciones están tras registro | — |
| 17 | Eurostat ESAW | https://ec.europa.eu/eurostat/cache/metadata/en/hsw_acc7_work_esms.htm | variables de clasificación | B |
| 18 | ecesis / presencis — ISO 45001 10.2 | https://www.ecesis.net/ISO-45001/Incident-and-Corrective-Action.aspx | pasos de 10.2 | B |
| 19 | Res. SRT 700/2000 | https://fio.unicen.edu.ar/usuario/segumar/Laura/material/LEGISLACI%d3N/Resoluci%f3n%20SRT%20700-00.pdf | in itinere excluido (visto en resumen) | B |
| 20 | Plantilla de denuncia ART | https://forms-legal.com/argentina/employment/forms/formulario-art-denuncia-accidente-trabajo-argentina | plazo de 24 h (no es norma) | C |
| 21 | Proyecto | `RESEARCH-indicators.md`, `RESEARCH-findings-lifecycle.md` | 9.1.1, 10.2 | B |

---

## 9. Dónde la investigación matiza `tasks/todo.md`

| Punto del `todo.md` | Hallazgo | Acción en el SPEC |
|---|---|---|
| "Índices (criterio de la SRT)" | La SRT no define IF/IG por HHT; sus índices usan trabajadores cubiertos y jornadas | Se aclara el origen (OIT/ANSI/INSST) y se ofrece "estilo SRT" solo en II e ID |
| IG = días × 1.000 / HHT | Base 1.000 (INSST) vs 1.000.000 (ANSI, OIT) | Base configurable, por defecto 1.000; la etiqueta la muestra |
| Cargo fijo 6.000 días por fatal | Es ANSI; la OIT lo excluye de la gravedad y pide compilarlo aparte; ANSI aplica el mismo cargo a incapacidad total permanente y cargos parciales | Se mantiene como default configurable; el export muestra "días reales" y "días con cargo"; cargo opcional por % de incapacidad |
| ID = días perdidos / accidentes con baja | Con el cargo incluido, el fatal arruina el promedio; la SRT/OIT usan días reales | ID con días reales, sin fatales |
| II = accidentes con baja × 1.000 / dotación | Coincide con la SRT (×1.000); la OIT usa ×100.000 | Se mantiene ×1.000; dotación = promedio de la ventana |
| LTIF opcional | Es numéricamente el IF si el IF incluye fatales | Se muestra como alias, no como índice aparte |
| TRIR opcional | Requiere el concepto "registrable" (tratamiento más allá de primeros auxilios o trabajo restringido) que la clasificación del `todo.md` no distingue | Se agrega un indicador "tareas restringidas" a "sin baja" y se define "sin baja" |
| Imputación al mes del accidente | Respaldada por OSHA y OIT | Se confirma; mes provisorio mientras el caso esté abierto |
| Integration test "publicar → aparece en el tablero" | Esperar la publicación (que exige análisis de causas) retrasa la estadística | Contar desde que se guarda la ficha, salvo hallazgo anulado (decisión del PO) |
| "días perdidos" sin definición | SRT: jornadas; OIT/OSHA/INSST: días corridos sin el día del accidente | Días corridos, sin el día del accidente, tope 365 |
