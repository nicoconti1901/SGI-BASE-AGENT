# Investigación: seguridad vial (ISO 39001) — Task 18

**Estado:** Task 18.0 — investigación, revisada bajo el enfoque "ISO 39001 como norma propia" (PARA APROBAR junto con `SPEC-road-safety.md`)
**Fecha:** 2026-10-28 (revisión de la del 2026-10-27, PR #32)
**Alcance:** qué pide ISO 39001, qué dice la normativa argentina de tránsito, cómo miden la siniestralidad vial las empresas (estilo IOGP), de dónde salen los km, privacidad y anti-patrones. Insumo de `SPEC-road-safety.md`.
**Aviso:** no es asesoramiento legal ni técnico. Todo lo marcado C debe validarlo un profesional de Higiene y Seguridad (y un abogado, en lo de datos personales) antes de fijarse como regla.

**Escala de confianza:** **A** = confirmado en la fuente consultada en esta investigación. **B** = práctica habitual o fuente secundaria (resumen, nota, listado). **C** = no verificado, validar con un profesional.

---

## 0. Resumen ejecutivo

1. **ISO 39001:2012 es un sistema de gestión, no una fórmula.** Pide política, objetivos, plan de acción y la distinción entre lo que la organización controla y lo que solo influye. Su resultado final de interés son **muertes y lesiones graves**; la exposición (km) y los resultados intermedios son factores de desempeño. No prescribe índices (A para el alcance; B para la clasificación de factores). El producto elige y muestra sus fórmulas.
2. **La Ley 24.449 define el accidente de tránsito de forma amplia (art. 64): todo hecho que cause daño a personas o cosas.** Por eso el evento con solo daño material es un accidente vial legal y entra en la estadística vial (A).
3. **No encontré ninguna fórmula legal argentina de siniestralidad vial por km para empresas.** Lo que existe son obligaciones de conducta (art. 65: detenerse, dar datos, denunciar; art. 77 h: incumplirlas es falta grave), de habilitación (licencia profesional art. 20, revisión técnica art. 34) y de velocidad (art. 51). El índice por millón de km es práctica de la industria (IOGP), no obligación (A que la ley no lo exige en el texto leído; C que no exista una norma complementaria).
4. **IOGP mide los choques por millón de km** (A para la unidad, en sus reportes de datos 2008–2022; B para la definición exacta de cada categoría). El cinturón y la fatiga aparecen como causas principales de muertes y choques (B, resumen de IOGP).
5. **Los km son el denominador y el punto débil:** salen de odómetros de las inspecciones (S8, S10), con huecos. Un mes sin km es "sin dato", nunca cero, y una tasa con pocos km es ruido.
6. **Datos personales:** la ubicación y los desplazamientos de una persona son datos personales (AAIP, Ley 25.326); el conductor identificado en un evento con lesiones se suma a los datos de salud de la Task 17. Riesgo principal: usar los rankings de conductores como herramienta disciplinaria (C, requiere revisión legal).

---

## 1. ISO 39001:2012 (Sistemas de gestión de la seguridad vial)

| Tema | Implicación en producto | Conf. | Fuente |
|---|---|---|---|
| Objeto: que una organización que interactúa con el sistema vial reduzca **muertes y lesiones graves** por choques viales que puede influir | El tablero muestra primero el conteo de eventos con muertos y lesionados graves, antes que la tasa de eventos | A | [ISO 39001 (listado)](https://scc-ccn.ca/standardsdb/standards/8151879) |
| Requisitos: política vial, objetivos y planes de acción considerando requisitos legales; elementos que la organización **controla** frente a los que solo **influye** | Cada evento marca si fue en misión (se controla) o in itinere (solo se influye); van en secciones separadas | A | ISO 39001 (listado y resumen ACRS: [ACRS](https://archive.acrs.org.au/article/iso-390012012-road-traffic-safety-rts-management-systems-requirements-with-guidance-for-use)) |
| Factores de desempeño en tres grupos: **exposición** (volumen de tráfico, km), **resultados finales** (muertes, lesiones graves) y **resultados intermedios** (planificación, operación y uso seguros) | Km = exposición; eventos = resultado final; flota con inspección al día, conductores habilitados y excesos de velocidad = resultados intermedios | B (resumen en [Wikipedia](https://en.wikipedia.org/wiki/ISO_39001); no verificado contra el texto oficial) | |
| Publicada en octubre de 2012, estado vigente (ICS 03.100.70 y 03.220.20). Si sigue la estructura común de las normas ISO de gestión: no verificado (ver 1.1) | Se enlaza al catálogo ISO existente como una norma más; mismo lenguaje de "evento, causa, acción, eficacia" | A (estado y fecha, ficha de [AFNOR](https://www.boutique.afnor.org/en-gb/standard/iso-390012012/road-traffic-safety-rts-management-systems-requirements-with-guidance-for-u/xs117819/119697)); C (estructura) | |
| No prescribe índices | Las fórmulas y bases son del producto y se muestran en pantalla y en el export | B | Idem |

### 1.1 Verificación de cláusulas (revisión 2026-10-28)

**Resultado: ninguna cláusula de ISO 39001 pudo verificarse contra el texto oficial.** El texto es de pago; la vista previa de ISO (OBP) y la ficha `iso.org/standard/44958.html` respondieron 403 al leerlas; la ficha de AFNOR solo trae el resumen. Lo que sí se confirmó es el alcance (A), no la numeración. Corrección al borrador anterior: no se afirma que la norma use la "estructura de alto nivel común"; solo se sabe que los títulos de primer nivel coinciden con ese esquema según fuentes secundarias (B), y una fuente ubica los factores de desempeño en 6.2, no los objetivos (C), por lo que la numeración "6.2 objetivos" del borrador queda **descartada**.

| Cláusula | Título según fuente secundaria | Estado | Fuente |
|---|---|---|---|
| 4 / 4.1 / 4.2 | Contexto de la organización; comprender la organización y su contexto; necesidades y expectativas de las partes interesadas | **NO VERIFICADA** (B) | resumen de un sitio de cumplimiento de terceros ([theartofservice](https://theartofservice.com/frameworks/iso-39001-2012-road-traffic-safety-management)) |
| 5 / 5.1 | Liderazgo; liderazgo y compromiso | **NO VERIFICADA** (B) | idem |
| 6 | Planificación | **NO VERIFICADA** (B) | idem; [Wikipedia](https://en.wikipedia.org/wiki/ISO_39001) la numera distinto (inconsistente) |
| 6.2 (¿?) | Factores de desempeño de seguridad vial | **NO VERIFICADA** (C) | un solo sitio de terceros; Wikipedia ubica los factores en "planificación" sin subcláusula |
| 6.1, 6.3, 7 y subcláusulas | Riesgos y oportunidades, objetivos, apoyo | **NO VERIFICADA** (C) | no hay fuente; se supone el esquema común de normas ISO de gestión |
| 8 / 8.1 / 8.2 | Operación; planificación y control operacional; preparación y respuesta ante emergencias | **NO VERIFICADA** (B) | theartofservice |
| 9 / 9.1 | Evaluación del desempeño; seguimiento, medición, análisis y evaluación | **NO VERIFICADA** (B) | idem |
| 10 / 10.1 / 10.2 | Mejora; no conformidad y acción correctiva; mejora continua | **NO VERIFICADA** (B) | idem |
| Anexo A | Guía informativa de uso | **NO VERIFICADA** (B) | idem y Wikipedia |

**Contenido confirmado en más de una fuente (B, no es numeración):** tres grupos de factores de desempeño. (a) *Exposición*: volumen y kilometraje de tráfico por tipo de vehículo y usuario, y volumen del producto o servicio de la organización. (b) *Resultados finales*: muertes y lesiones graves. (c) *Resultados intermedios*: planificación, diseño, operación y uso seguros de la red (velocidad segura, cinturón y casco, aptitud del conductor —fatiga, distracción, alcohol, drogas—, viaje planificado); entrada y salida seguras (seguridad del vehículo, aptitud técnica, carga asegurada, licencia adecuada, retiro de vehículos y conductores no aptos); y atención posterior al choque (primeros auxilios, preparación ante emergencias, recuperación y rehabilitación).

**Cómo cerrar la verificación (acción del PO, fuera de este PR):** contar con una copia licenciada de ISO 39001:2012 (compra en ISO o en el organismo local de normalización) y comparar el índice de cláusulas con la tabla de arriba. Hasta entonces, el catálogo ISO carga las cláusulas con la etiqueta `sin-verificar` (ver SPEC, D1).

---

## 2. Argentina

### 2.1 Ley 24.449 de Tránsito (A, texto consolidado en [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/818/texto); leído parcialmente, no verificada la última modificación)

| Artículo | Contenido (paráfrasis) | Uso en el producto |
|---|---|---|
| 8 | Registro nacional de licencias e infracciones; menciona estadísticas de accidentes | El módulo no reemplaza ese registro |
| 11 y 20 | Edad mínima 21 años para clases C, D y E; la licencia profesional exige clase B con un año; no se otorga por primera vez a mayores de 65 | Fecha de vencimiento de licencia en el conductor habilitado (18.4) |
| 34 | Revisión técnica periódica de automotores, acoplados y semirremolques en la vía pública | `rto` ya existe como vencimiento en la inspección de livianos (`light_periodic`) |
| 40 | Para circular: licencia, cédula, seguro vigente, patente legible, matafuego y balizas | Check de documentación del vehículo |
| 48 a) | Prohibido conducir con alcohol, drogas o medicamentos que reduzcan la capacidad | Causa principal "conducción bajo efecto" |
| 51 | Velocidades máximas (calle 40, avenida 60, ruta 110 autos, 90 colectivos, 80 camiones; autopista hasta 130) | El producto no fija límites propios; el exceso lo carga el cliente |
| 53 g) | Dispositivo inalterable que registra velocidad, distancia y tiempo en la mayoría de los vehículos de transporte | Posible fuente de datos de velocidad y km (B, no se integra) |
| 64 | Accidente de tránsito = hecho que causa daño a personas o cosas | Un evento con solo daño material es un accidente vial |
| 65 | Quien participa debe detenerse, dar datos de licencia y seguro, **denunciar ante una autoridad** y comparecer | Campo "denuncia policial/aseguradora realizada" (sí/no/n.°) |
| 66 | Investigación del accidente, acta de choque, casos graves | Se apoya en el Hallazgo y sus 5 Porqués |
| 77 h) | Falta grave no cumplir las obligaciones del accidente | Recordatorio de la obligación al registrar el evento |

- La ley rige en jurisdicción nacional y se aplica donde los organismos provinciales y municipales adhieran (art. 2, B): licencia, RTO y plazos concretos cambian por jurisdicción. El producto **no** calcula vencimientos legales por jurisdicción: guarda la fecha que carga el cliente.

### 2.2 Decreto 779/95 (reglamentación)

- Anexo 1 reglamenta la Ley 24.449. Según una fuente secundaria, el Decreto 196/2025 lo modificó para exigir **constancia de aptitud psicofísica** de profesionales registrados ante la ANSV para renovar la licencia (B, [Expte. Legislatura de Jujuy](https://cdjujuy.gob.ar/wp-content/uploads/2026/05/Expt.410-x-2026.pdf)).
- **No verificado (C):** régimen de cargas peligrosas, límites de horas de conducción para transporte de cargas y de pasajeros, requisitos de licencia para clases específicas. Quedan fuera del alcance (ver SPEC) hasta que un profesional los valide.

### 2.3 Ley 25.326 de Protección de Datos Personales (riesgo)

- La AAIP sostiene que la ubicación y los desplazamientos de una persona son **datos personales**; para tratarlos hace falta una base del art. 5 (por ejemplo, consentimiento libre, expreso e informado) (A en el comunicado de 2020 que reproduce [argentina.gob.ar](https://www.argentina.gob.ar/node/195420); es de la pandemia, puede haberse actualizado). No prohíbe el seguimiento, pero exige exactitud y proporcionalidad.
- No encontré jurisprudencia argentina sobre GPS laboral (C). La Ley de Contrato de Trabajo (art. 70, controles personales que salvaguarden la dignidad del trabajador) es relevante pero **no se verificó** (B).
- Datos de salud: ya tratados en la Task 17 (art. 2 sensibles; arts. 9 y 10 seguridad y confidencialidad). Un evento vial con lesionados reutiliza `IncidentHealth`; la Task 18 **no** agrega datos de salud propios.

---

## 3. Cómo miden las empresas (estilo IOGP)

| Medida | Definición habitual | Conf. |
|---|---|---|
| Eventos viales por millón de km | `eventos × 1.000.000 / km` de la flota en la ventana | A (unidad); B (qué se cuenta) |
| Eventos con lesionados por millón de km | Solo los que dejaron al menos una persona lesionada | B |
| Muertes y lesiones graves | Conteo absoluto; la tasa por 100 millones de km es de uso en estadística pública (**no** se calcula) | B/C |
| Vuelcos por millón de km | Subconjunto por forma del evento; los vuelcos tienen alta letalidad | B |
| Eventos por conductor | Reincidencia: dos o más eventos en 12 meses como bandera de revisión, no de sanción | B |
| Excesos de velocidad | Del monitoreo satelital o registrador; el cliente los carga a mano | B |

- Los reportes IOGP separan las causas: sin cinturón (principal causa de muerte) y fatiga (B). Por eso el evento guarda **uso del cinturón** y **fatiga** como campos concretos, no como texto libre.
- No encontré una definición única de "lesión grave" aplicable en Argentina (C). Default del SPEC: lesión grave = requirió **internación**, un dato que el cliente conoce sin diagnóstico.

---

## 4. De dónde salen los km

| Fuente | Ventajas | Problemas | Default |
|---|---|---|---|
| Odómetro en inspecciones (control previo y mensual, S8/S10) | Ya se carga; coherente con el vehículo | Huecos de varios días; lecturas de distinto mes; cambio o reparación de odómetro; la inspección S8 pide **confirmación** si la lectura baja (no error) | Principal |
| Carga manual mensual | Cubre vehículos sin inspecciones; el cliente la conoce | Error de tipeo; deriva | Siempre disponible, con motivo si pisa lo calculado |
| Monitoreo satelital / registrador | Exacto | Integración (n8n) y privacidad | Fuera de alcance |

**Regla de cálculo (default):** km del mes = lectura de cierre del mes menos lectura de cierre del mes anterior. Si falta la del mes anterior, se usa la última disponible, y la distancia entre dos lecturas separadas por meses sin lectura se reparte **proporcional a los días** (B, práctica de flotas; hay que validarla). Un mes con distancia no repartible o sin lecturas es "sin dato". Una lectura menor que la anterior es un error de cálculo salvo que esté marcada como **reinicio de odómetro** (cambio de tablero): esa marca corta la serie y la distancia del tramo no se estima.

---

## 5. Anti-patrones y casos borde

1. **Tasa con pocos km:** dos eventos en 10.000 km dan 200 por millón. El tablero muestra el conteo absoluto siempre, y una advertencia "poca exposición" bajo 100.000 km en la ventana (C: el umbral lo valida un profesional).
2. **Mes sin km = cero:** falso. Es "sin dato", y los eventos de ese vehículo y mes salen de la tasa (como `missing` en la Task 17).
3. **In itinere o vehículo particular en tasa por km:** no hay km de la flota. Cuentan como eventos pero **no** entran en las tasas por km; tarjeta aparte.
4. **Evento sin vehículo cargado** (por ejemplo, peatón o vehículo del contratista): cuenta como evento, no en tasas por vehículo; se avisa.
5. **Doble contabilidad con la Task 17:** un evento con lesión en jornada ya está en los índices laborales y aparece en ambos tableros; uno in itinere, solo en el vial (por diseño de la Task 17). El evento solo con daño material **no** entra en IF, IG ni II (`SPEC-accident-stats.md`, punto de extensión).
6. **Ranking de conductores:** muestra personas con nombre. Se limita a quien gestiona el módulo y se presenta como "para revisar", no como puntaje.
7. **Vehículos de contratistas:** sus km no los carga la empresa. Quedan fuera de la tasa de flota salvo que el cliente los cargue a mano (decisión).

---

## 6. Preguntas abiertas para el PO y profesionales

Ver "Decisiones a confirmar" en `SPEC-road-safety.md`. Pendientes de un profesional: definición de lesión grave, umbral de poca exposición, validez del reparto por días, base legal y consentimiento del tratamiento de excesos de velocidad por conductor, retención de datos, y la numeración de cláusulas ISO 39001 (§1.1, ninguna verificada).

## Fuentes

- [ISO 39001:2012 — ficha ISO](https://www.iso.org/standard/44958.html) y [listado SCC](https://scc-ccn.ca/standardsdb/standards/8151879) (alcance, estado y revisión).
- [ACRS — resumen de ISO 39001](https://archive.acrs.org.au/article/iso-390012012-road-traffic-safety-rts-management-systems-requirements-with-guidance-for-use) y [Wikipedia — ISO 39001](https://en.wikipedia.org/wiki/ISO_39001) (factores de desempeño).
- [Ley 24.449 — texto consolidado](https://www.argentina.gob.ar/normativa/nacional/818/texto) (arts. 8, 11, 20, 34, 40, 48, 51, 53, 64–66, 77).
- Decreto 779/95 y modificaciones: [Expediente Legislatura de Jujuy](https://cdjujuy.gob.ar/wp-content/uploads/2026/05/Expt.410-x-2026.pdf) (fuente secundaria); no se leyó el texto del decreto.
- [IOGP — Motor vehicle crash data 2008–2022](https://idms.iogp.org/Documents/1205) y [reportes publicados](https://www.iogp.org/blog/news/motor-vehicle-crash-data-reports-published/); IOGP Report 365 (Land transport safety recommended practice, no leído).
- [AAIP — ubicación como dato personal (Ley 25.326)](https://www.argentina.gob.ar/node/195420).
- Proyecto: `RESEARCH-accident-stats.md`, `SPEC-accident-stats.md`, `SPEC-inspections.md`, `tasks/todo.md` (Task 18).
