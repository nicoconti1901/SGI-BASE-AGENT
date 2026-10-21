# Investigación: equipos de medición y calibraciones (ISO 9001 §7.1.5 · 14001 y 45001 §9.1.1)

**Estado:** Task 16.0, investigación para el SPEC `SPEC-calibration.md`
**Fecha:** 2026-10-21
**Alcance:** control metrológico de los equipos de seguimiento y medición (calibración, verificación, prueba funcional), regla de decisión, intervalos, evaluación de impacto y contexto argentino.

## Cómo leer las etiquetas de confianza

| Etiqueta | Significado |
|---|---|
| **A** | Confirmado en la fuente primaria (texto de la norma, resolución o documento del emisor), leído en esta investigación |
| **B** | Práctica habitual o fuente secundaria (blog, guía de laboratorio, resumen de terceros). Coherente entre fuentes, pero no leí el texto oficial |
| **C** | No verificado. Es conocimiento general o inferencia: **validar con un metrólogo** antes de fijarlo como regla |

Los textos de ISO 9001, 14001, 45001 e ISO/IEC 17025 son pagos y no pude leerlos completos: lo que sigue de ellos viene de citas en fuentes secundarias (etiqueta B). Los documentos de ILAC, OIML/JCGM, OSHA y las resoluciones argentinas sí los leí directamente (etiqueta A).

---

## 0. Pregunta central

> ¿Puedo confiar en lo que midió este equipo, hoy y en el pasado? Si no, ¿qué mediciones quedan en duda y qué hago?

---

## A. Qué exigen las normas

| Requisito (paráfrasis) | Implicación en producto | Fuente | Conf. |
|---|---|---|---|
| **9001 §7.1.5.2**: cuando la trazabilidad de la medición es un requisito, o la organización la considera parte esencial para dar confianza en la validez de los resultados, el equipo debe (a) calibrarse o verificarse, o ambos, a intervalos especificados o antes de su uso, contra patrones trazables a patrones nacionales o internacionales; si no existen, se **conserva como información documentada la base usada**; (b) **identificarse** para determinar su estado; (c) **protegerse** de ajustes, daños o deterioro que invaliden el estado de calibración | Registro con intervalo, estado visible y etiqueta; campo "base de calibración" cuando no hay patrón; el estado no se puede editar a mano | Citas parciales en [Auditor Training Online](https://blog.auditortrainingonline.com/blog/iso-9001-7-1-5-2-measurement-traceability) | B |
| **9001 §7.1.5.2**, último párrafo: si se halla que el equipo **no es apto para su propósito**, la organización determina si la **validez de los resultados anteriores** se vio afectada y toma la acción apropiada | `ImpactAssessment`: ventana, qué se midió, decisión y acción. La norma exige hacerlo y actuar; **no fija el orden** respecto de volver a usar el equipo | [Auditor Training Online](https://blog.auditortrainingonline.com/blog/iso-9001-7-1-5-2-measurement-traceability); [The Core Solution](https://www.thecoresolution.com/clause-7-1-5-iso-9001-explained) | B |
| **9001 §7.1.5.1**: los recursos de seguimiento y medición son adecuados para la actividad y se mantienen aptos; se **conserva información documentada como evidencia de que son aptos para su propósito** | Se guarda el historial completo (puntos, certificado). Una reseña de la FDIS observa que la norma "sigue sin exigir registros de calibración" como tales y que la oración sobre registros está en 7.1.5.1, no en 7.1.5.2 | Texto de 7.1.5.1 **no verificado en fuente**; la observación viene de [Oxebridge — FDIS 9001:2026](https://www.oxebridge.com/emma/iso-fdis-90012026-full-review/) | C / B |
| **9001:2026**: 7.1.5 figura **sin cambios** respecto de 2015 en la reseña de la FDIS; una guía lo ubica entre los cambios "pequeños (editoriales)". No encontré requisito de validar software dentro de 7.1.5 | Sin cambios de diseño por la edición 2026. El módulo igual se diseña como software de medición: funciones puras y testeadas (coherente con `RESEARCH-indicators.md`) | [Oxebridge](https://www.oxebridge.com/emma/iso-fdis-90012026-full-review/); [Advisera — 2015 vs 2026](https://advisera.com/articles/iso-9001-2015-vs-9001-2026-main-differences/) | B |
| **14001 §9.1.1**: asegurar que se usa y mantiene, "según corresponda", equipo de seguimiento y medición **calibrado o verificado** | Aplica a los equipos con que la organización mide su desempeño ambiental (ruido, emisiones, efluentes). Permite marcar un equipo como "indicativo, sin control" con justificación | Resumen en [Presencis — 14001 §9.1](https://cdn.presencis.com/regulations/iso-14001/article-9.1/) | B |
| **45001 §9.1.1**: la organización asegura que el equipo de seguimiento y medición está **calibrado o verificado "según corresponda"** y se usa y mantiene apropiadamente | Idem para SST (gases, ruido, iluminación, puesta a tierra). Un asesor de Advisera lo lee como "todo el equipo de medición de lo que la organización determinó medir en SST" | Cita en [Advisera Community](https://community.advisera.com/topic/iso-45001-and-calibration-of-equipment/) | B |
| **ISO/IEC 17025:2017 §7.8.6 y §3.7**: cuando un laboratorio emite una declaración de conformidad, debe **documentar y aplicar una regla de decisión** que tenga en cuenta el nivel de riesgo, e informarla en el certificado salvo que esté implícita en la especificación; si la regla viene del cliente, la ley o un reglamento, no hace falta evaluar el riesgo. Debe acordarse con el cliente (§7.1.3) | Cada registro guarda **qué regla se aplicó** y contra qué especificación. Un "conforme" del laboratorio solo vale con ambas | [NIST — crosswalk 17025](https://www.nist.gov/document/7-8-17025-crosswalk-reporting-results-20180201pdf); resumen de §7.1.3/§3.7 en [Fluke](https://www.fluke.com/en-us/learn/blog/calibration-software/decision-rules-conformity-assessment) | A / B |
| **ISO/IEC 17025:2017 §7.8.4 y Anexo A**: el certificado de calibración informa la incertidumbre en las unidades del mensurando y la evidencia de trazabilidad | Los puntos llevan U y la ficha el laboratorio y la ruta de trazabilidad | [NIST — crosswalk 17025](https://www.nist.gov/document/7-8-17025-crosswalk-reporting-results-20180201pdf) | A (parcial) |
| **ISO 10012:2003**: "confirmación metrológica" = comparar las características del equipo (rango, resolución, **error máximo permitido**) con los requisitos del uso; no da un criterio para fijar intervalos y remite a ILAC-G24/OIML D 10 | El EMP lo define el **uso**, no el certificado; ISO 10012 es una guía opcional, no se exige certificar contra ella | [Bioblast — ISO 10012](https://bioblast.at/index.php/ISO_10012:2003_Measurement_management_systems); [IMEKO 2015](https://imeko.org/publications/wc-2015/IMEKO-WC-2015-TC6-175.pdf) | B |

### Lo que las normas de gestión **no** dicen

- No exigen un laboratorio acreditado: exigen **trazabilidad**. La acreditación es la forma más simple de demostrarla (ver §B).
- No fijan intervalos de calibración ("intervalos especificados" los especifica la organización).
- No imponen una regla de decisión para el criterio de aptitud del equipo (esa regla es del usuario, ver §C).
- No obligan a bloquear el equipo hasta terminar la evaluación de impacto: obligan a evaluar y actuar. El bloqueo es una **política del producto** (decisión del PO).

---

## B. Trazabilidad, laboratorio y certificado

| Hecho | Fuente | Conf. |
|---|---|---|
| Trazabilidad metrológica = propiedad de un resultado de medición que lo relaciona con una referencia por una **cadena documentada e ininterrumpida de calibraciones**, cada una con su incertidumbre. La trazabilidad no pertenece a una organización ("trazable al INTI") sino a los patrones y resultados | [ILAC P10:01/2013](https://cdn-v2.iasonline.org/wp-content/uploads/2021/02/04-04-ILAC_P10_01_2013.pdf) | A |
| Rutas de trazabilidad aceptadas por ILAC: (1) un **instituto nacional de metrología** cubierto por el CIPM MRA; (2) un **laboratorio de calibración acreditado cuyo alcance cubre específicamente** la calibración requerida, con un organismo de acreditación firmante de ILAC o de un acuerdo regional reconocido; (3) rutas fuera de esos acuerdos, solo cuando (1) y (2) no son posibles, con evidencia que debe evaluarse. Las calibraciones internas ("in-house") entran en la misma política | [ILAC P10:01/2013](https://cdn-v2.iasonline.org/wp-content/uploads/2021/02/04-04-ILAC_P10_01_2013.pdf) | A (edición 2013) |
| La versión vigente es **ILAC P10:07/2020** (cumplimiento exigido desde julio de 2021); no leí su texto, solo resúmenes que mantienen las mismas rutas | [SCC — ILAC P10](https://scc-ccn.ca/accreditation/bulletins/ilac-p10-ilac-policy-metrological-traceability-measurement-results) | B |
| El sello del organismo de acreditación o el logo ILAC MRA en el certificado puede tomarse como evidencia de trazabilidad (P10 2013). Igual hay que mirar el **alcance** de la acreditación | [ILAC P10:01/2013](https://cdn-v2.iasonline.org/wp-content/uploads/2021/02/04-04-ILAC_P10_01_2013.pdf) | A |
| **Argentina:** el OAA es el organismo nacional de acreditación; su directorio público de entidades acreditadas está en `/publico/entidades-acreditadas`. No pude confirmar en su sitio la condición de firmante ILAC/IAAC | [OAA — entidades acreditadas](https://www.oaa.org.ar/publico/entidades-acreditadas) | A / C (firmante) |
| **Argentina:** el INTI es el instituto nacional de metrología; se presenta como firmante del CIPM-MRA | Resumen en [Argentina.gob.ar — Mediciones para la productividad](https://www.argentina.gob.ar/noticias/mediciones-para-la-productividad) | B |
| **Argentina, cambio reciente:** la **Resolución INTI 198/2025** (sancionada 28/11/2025, publicada 01/12/2025) **disolvió el Servicio Argentino de Calibración y Medición (SAC)** y su Red INTI-SAC; prohíbe nuevas autorizaciones para emitir certificados de calibración y manda terminar los convenios con 30 días de aviso. **No dice** qué pasa con los certificados SAC ya emitidos. Fundamento: evitar superposición con el OAA | [Resolución 198/2025](https://www.argentina.gob.ar/normativa/nacional/norma-420817/texto) | A |
| Las resoluciones de la SRT que fijan protocolos de medición (ruido, iluminación, puesta a tierra) piden **marca, modelo y serie del instrumento, la fecha de su última calibración en laboratorio y adjuntar copia del certificado**. Las que leí **no fijan ni un plazo de validez ni quién debe emitir el certificado** | Ruido: [Res. SRT 85/2012](https://www.argentina.gob.ar/normativa/nacional/193617/texto) (ítems 8 y 15, instrumento clase o tipo 2 como mínimo según IRAM 4074 e IEC 804); iluminación: [Res. SRT 84/2012](https://www.argentina.gob.ar/normativa/nacional/193616/texto); puesta a tierra: [Res. SRT 900/2015, anexo](https://www.argentina.gob.ar/sites/default/files/res_srt_900_15-anexo.pdf) (ítems 7, 8 y 14) | A (85 y 900); B (84, resumen) |
| La guía oficial de **espacios confinados** (Ministerio de Trabajo) manda "elaborar y mantener actualizado un **inventario de la calibración** del equipamiento de medición utilizado" y proveer monitoreo de gases de lectura directa con alarma. No fija intervalo. La Res. SRT 953/2010 remite a IRAM 3625:2003 (no la leí) | [Guía espacios confinados 2021](https://argentina.gob.ar/sites/default/files/ft_espacios_confinados_ago2021.pdf) (A); [Res. SRT 953/2010](https://e-legis-ar.msal.gov.ar/htdocs/legisalud/migration/pdf/15960.pdf) (B) | A / B |
| IEC 804 (citada por la Res. 85/2012) fue reemplazada por la familia IEC 61672; la Res. 85/2012 sigue citándola | Conocimiento general; el alcance de [IEC 61672-3:2013](https://www.evs.ee/en/iec-61672-3-2013) (ensayos periódicos de sonómetros clase 1 y 2) sí figura en el catálogo | C |

### Qué debería mostrar un certificado utilizable (para el formulario de carga)

Según el crosswalk de 17025 (§7.8.4 y Anexo A) y P10: identificación del equipo, fecha de calibración, resultados con su **incertidumbre expandida** en las unidades del mensurando, condiciones de la calibración, **declaración de trazabilidad**, y, si hay declaración de conformidad, la **especificación y la regla de decisión**. Conf. A (parcial) / B.

Nota práctica (C): ISO/IEC 17025 §7.8.4.3 impediría al laboratorio recomendar un intervalo de recalibración salvo acuerdo con el cliente. No lo verifiqué. Consecuencia para el producto: el intervalo lo decide el usuario aunque el certificado traiga una "próxima calibración".

---

## C. Regla de decisión: evaluación crítica de |error| + U ≤ EMP

### Qué es esa regla en el marco internacional

- Con **EMP** como límite de tolerancia y **U** como incertidumbre expandida, exigir `|e| + U ≤ EMP` equivale a una **regla con banda de guarda w = U** (límite de aceptación = EMP − U). JCGM 106:2012 §8.3 dice que "una elección común es r = 1, en cuyo caso w = U", y cita la regla por defecto de ISO 14253-1 (w = U = 2u), que asegura una probabilidad de **aceptar un ítem no conforme de a lo sumo 2,3 %** (con distribución normal), máxima justo en el límite de aceptación. **A**: [JCGM 106:2012 / OIML G 1-106](https://www.oiml.org/en/files/pdf_g/g001-106-e12.pdf), §8.3.
- La alternativa es la **aceptación simple** (`|e| ≤ EMP`, w = 0), también llamada **riesgo compartido**: el productor y el usuario comparten las consecuencias de una decisión incorrecta. JCGM 106 §8.2 dice que en la práctica se exige que la incertidumbre "haya sido considerada y juzgada aceptable", por ejemplo exigiendo `U ≤ Umax` acordado; su ejemplo de metrología legal usa `|e| ≤ Emax` **y** `U ≤ Emax/3`. **A**: [JCGM 106](https://www.oiml.org/en/files/pdf_g/g001-106-e12.pdf), §8.2.
- ILAC-G8:09/2019 es la guía para laboratorios acreditados: la regla debe elegirse, documentarse y acordarse; describe aceptación simple (AL = TL), banda de guarda w = U con declaración binaria y la variante **no binaria** (aprobado / aprobado condicional / fallo condicional / fallo). Un resumen de laboratorio señala que con aceptación simple el riesgo de falsa aceptación puede llegar a cerca del 50 % para resultados pegados al límite. **B**: resumen en [ÉMI Lab — regla de decisión según ILAC-G8](https://epito.emi.hu/EMI/web.nsf/Pub/5B26U7/$FILE/ÉMILAB_Decision%20rule_ILAC_G8_09_2019%20EN%2020200623.pdf) y [ILAC — G8 revisado](https://ilac.org/latest_ilac_news/revised-ilac-g8-published/). No leí el texto de ILAC-G8.
- 17025:2017 no impone una banda de guarda: exige que la regla esté definida, aplicada y acordada. **B**: resumen en el [crosswalk de NIST](https://www.nist.gov/document/7-8-17025-crosswalk-reporting-results-20180201pdf) y [Fluke](https://www.fluke.com/en-us/learn/blog/calibration-software/decision-rules-conformity-assessment).

### Veredicto sobre el default de `tasks/todo.md`

| Pregunta | Respuesta |
|---|---|
| ¿Es una regla válida y defendible? | **Sí.** Es la regla de banda de guarda con w = U, la opción conservadora que protege al usuario (el "consumidor" del certificado). Es razonable como **default** para equipos de seguridad (gases, puesta a tierra) |
| ¿Es la única posible? | **No.** La aceptación simple es legítima si se documenta y se controla que U sea pequeña frente al EMP |
| ¿Qué falla si se aplica sin matices? | (1) Si `U > EMP`, el equipo **nunca** puede pasar, aunque su error sea cero: el problema es el laboratorio o el EMP, no el equipo. (2) Rechaza equipos cuyo error está dentro del EMP pero cuya incertidumbre no permite asegurarlo (zona de guarda): conviene mostrarlo distinto de "error fuera de tolerancia". (3) Un laboratorio que aplicó otra regla en su "conforme" produce una declaración **no comparable** |
| ¿Qué no cubre? | La U del certificado es la de **la calibración**. No incluye la deriva del equipo entre calibraciones: eso lo cubre el **intervalo** (ILAC-G24), no la banda de guarda. Razonamiento metrológico habitual, **C**: validar con un metrólogo |
| ¿Cómo se documenta? | Por equipo: regla elegida, justificación si no es la default, EMP con su fundamento (uso/fabricante). Por registro: **foto** de la regla y del EMP aplicados a cada punto, para que un cambio posterior no reescriba decisiones pasadas |

### Recomendación

1. Default `guard_band` (`|e| + U ≤ EMP`, límite inclusivo).
2. Permitir por equipo `simple_acceptance` con **justificación obligatoria** y advertencia visible cuando `|e| ≤ EMP < |e| + U` ("aceptado con riesgo compartido").
3. Permitir `certificate_statement` ("conforme" del laboratorio sin números) solo si el certificado indica la **especificación** y la **regla de decisión** y el equipo **no** es de uso crítico.
4. Mostrar un aviso de capacidad cuando `U > EMP/3` (tomado del ejemplo de JCGM 106 §8.2.3; **C** como criterio general, validar el divisor con un metrólogo).
5. Representar el resultado como `apto` / `no apto` / `incompleto` y el motivo por punto (`dentro`, `error fuera del EMP`, `zona de guarda`, `U mayor que el EMP`, `falta U`). La variante no binaria de ILAC-G8 queda fuera de alcance.

---

## D. Calibración, verificación, ajuste y prueba funcional

| Concepto | Qué es | Efecto en el producto | Fuente | Conf. |
|---|---|---|---|---|
| **Calibración** | Compara el equipo con un patrón trazable y **informa** error e incertidumbre por punto. Por sí sola no dice si el equipo es apto: eso lo decide el usuario con su EMP | Registro con puntos; el resultado lo calcula la regla de decisión | [ILAC P10](https://cdn-v2.iasonline.org/wp-content/uploads/2021/02/04-04-ILAC_P10_01_2013.pdf); definición VIM citada allí | A / B |
| **Verificación** | Confirma, con evidencia objetiva, que el equipo cumple requisitos del uso; puede hacerse internamente contra un patrón propio, que debe ser **trazable** (la política de P10 alcanza a las calibraciones internas) | Mismo formulario con `kind = verification`; el patrón propio es otro equipo registrado y vigente | [ILAC P10](https://cdn-v2.iasonline.org/wp-content/uploads/2021/02/04-04-ILAC_P10_01_2013.pdf) | A (alcance de P10) / C (diseño) |
| **Ajuste** | Modifica el equipo para acercarlo al patrón. Los valores **antes** (as-found) y **después** (as-left) son datos distintos | `adjusted` + dos juegos de puntos. El as-found decide el impacto en el pasado; el as-left decide si vuelve a servir | [ICS Schneider](https://www.ics-schneider.de/messgeraet-kalibrieren-mit-as-found-und-as-left-warum-beide-werte-wichtig-sind/?lang=en); [InCompliance](https://incompliancemag.com/as-found-out-of-tolerance-what-to-do-next/) | B |
| **Prueba funcional (bump test)** | Control **cualitativo** de que el gas llega al sensor y las alarmas se activan; **no mide exactitud**. La "verificación de calibración" (calibration check) sí compara contra un gas de concentración conocida, con tolerancia típica ±10 % a ±20 % del valor aplicado salvo que el fabricante diga otra cosa | Registro opcional con plantilla del motor de la Task 15; una falla pone el equipo fuera de servicio y abre evaluación de impacto; **no extiende** la vigencia de la calibración | [OSHA SHIB](https://osha.gov/publications/shib093013); [Honeywell, aviso de producto](https://core.instrumart.com/assets/Honeywell-Gas-Detection-Bump-Test-and-Calibration-Frequency.pdf) | A |

OSHA (aviso informativo, **no** norma ni obligación legal en Argentina): bump test o calibration check **antes de cada día de uso**, siguiendo al fabricante; si falla, **calibración completa** antes de usar; si falla la calibración completa, **retirar de servicio** y consultar al fabricante; conservar los registros durante la vida del instrumento. **A**: [OSHA SHIB](https://osha.gov/publications/shib093013). La página de OSHA muestra fechas inconsistentes (2013 y 2024): citar con cautela.

---

## E. Intervalos: qué hay y qué no hay

**Hallazgo central:** no existe una norma que fije un intervalo universal por magnitud. La guía ILAC-G24:2022 / OIML D 10:2022 dice que la elección inicial se basa en un **análisis de riesgo** con factores como la incertidumbre requerida, el riesgo de exceder el EMP, las recomendaciones del fabricante, la tendencia a deriva y desgaste, la intensidad de uso, las condiciones ambientales y el transporte; que la decisión la toma personal competente; y que los **intervalos fijos no se recomiendan** salvo que los fije un documento normativo. Propone métodos de revisión, entre ellos el **"escalera"** (alargar o mantener si la desviación fue pequeña respecto del EMP, acortar si fue grande) y advierte contra intervalos extremadamente largos. **A**: [ILAC-G24:2022 / OIML D 10:2022](https://www.oiml.org/en/files/pdf_d/d010-e22.pdf), §5 y §6.

| Magnitud / equipo | Qué dice una fuente | Intervalo sugerido como default editable | Conf. |
|---|---|---|---|
| **Detector portátil de gases (multigás, explosímetro)** | Prueba funcional o verificación **antes de cada día de uso** (OSHA, ISEA vía OSHA). Calibración completa "cada 30 a 180 días" o tras una falla de bump test (aviso de producto de Honeywell, **específico de ese fabricante**). Fijos: verificación de exactitud cada 4–6 meses y calibración cero/span al menos anual (mismo aviso) | Bump: cada uso. Calibración: **6 meses** (tope de 180 días), **sujeto al manual del fabricante** | A (fuentes) / C (el default) |
| **Sonómetro** | La Res. SRT 85/2012 pide la fecha de la última calibración en laboratorio y el certificado adjunto; **no fija plazo**. IEC 61672-3 define ensayos periódicos; no encontré su intervalo | 12 meses | B / C |
| **Luxómetro** | Res. SRT 84/2012: fecha de calibración y certificado; sin plazo en lo que leí | 12 meses | B / C |
| **Telurímetro** | Res. SRT 900/2015: marca, modelo, serie, fecha de la última calibración y copia del certificado; sin plazo | 12 meses | A (exigencia) / C (plazo) |
| **Manómetro, termómetro, balanza interna, calibre** | Sin fuente consultada. G24 pide fijarlo por riesgo y deriva | 12 meses | C |
| **Balanza de uso comercial** | Es metrología legal (Res. 611/19 y modificatorias, verificación primitiva y periódica a cargo de INTI/reparadores autorizados). Constancias de reparadores del INTI muestran vigencias de aproximadamente un año; no encontré el plazo normativo | Fuera del módulo: remitir a la normativa de metrología legal | B / C |
| **Patrón de trabajo** (para verificaciones internas) | Debe tener su propia calibración trazable (P10) | 12 meses | C |

**Regla del producto (propuesta):** los intervalos de la tabla son **sugerencias precargadas y editables**, nunca un requisito normativo; cada equipo guarda su intervalo y, opcionalmente, el motivo. En 16.x posteriores se puede ofrecer el método de la escalera como sugerencia, sin cambiar el intervalo solo.

---

## F. Evaluación de impacto cuando un equipo está fuera de tolerancia

| Práctica | Fuente | Conf. |
|---|---|---|
| Contener primero: sacar el equipo de servicio y registrar el hallazgo antes de terminar el análisis | [CASRAI — out-of-tolerance](https://www.casrai.org/guides/out-of-tolerance-calibration) (resumen de búsqueda; la página agotó el tiempo al abrirla) | B |
| **Ventana de revisión:** desde la última comprobación apta hasta el momento en que se detectó la falla; reunir los resultados generados con ese equipo en ese lapso a partir de registros, no de memoria | CASRAI; [ICS Schneider](https://www.ics-schneider.de/messgeraet-kalibrieren-mit-as-found-und-as-left-warum-beide-werte-wichtig-sind/?lang=en) | B |
| Usar los datos **as-found y as-left**: sin as-found no se puede saber cuánto y desde cuándo se desvió | [InCompliance](https://incompliancemag.com/as-found-out-of-tolerance-what-to-do-next/) | B |
| Si el as-left es bueno y no hubo golpe, sobrecarga o mal uso conocido, los resultados anteriores probablemente siguen siendo utilizables; si no, hay que repetir mediciones, reevaluar lo producido o informar a quien recibió los resultados | ICS Schneider; 9001 §7.1.5.2 (acción apropiada) | B |
| Un plazo de 48 horas para iniciar la evaluación aparece en una página de un proveedor de CMMS: **no lo usamos** | [Oxmaint](https://oxmaint.com/industries/healthcare/out-of-tolerance-calibration-capa-workflow) | C |

**Gatillos propuestos para abrir una evaluación:** (1) as-found no apto; (2) equipo ajustado de **uso crítico** sin datos as-found (no se puede descartar); (3) falla de una prueba funcional.
**Cierres posibles:** sin resultados afectados (con justificación escrita), resultados afectados con acción/hallazgo, o "no se puede determinar" (se trata como afectado y exige acción).

---

## G. Anti-patrones

| Anti-patrón | Por qué falla | Qué hace el módulo |
|---|---|---|
| Tipear "apto/no apto" a mano | No es reproducible ni auditable | El resultado sale de la regla de decisión |
| Estado editable o guardado y desactualizado | "Vigente" pasa a "vencido" sin que nadie escriba nada | Estado derivado de `validUntil` con la fecha de hoy |
| Ignorar la incertidumbre | Aceptar equipos con riesgo oculto | Regla explícita con U |
| Regla distinta en cada registro, sin dejar constancia | No se puede comparar ni defender en auditoría | La regla y el EMP aplicados quedan guardados en cada punto |
| Dar por bueno cualquier certificado | Trazabilidad no demostrada (ruta fuera de P10) | Campos de ruta de trazabilidad y de alcance acreditado, con advertencia |
| Confundir bump test con calibración | El bump no mide exactitud | Registros separados; el bump no cambia la vigencia |
| Ajustar el equipo sin registrar el as-found | Impide evaluar el impacto | Dos juegos de puntos |
| Un solo intervalo de 12 meses para todo | Detectores de gases derivan antes | Sugerencias por tipo; revisión por historial |
| Contar el vencimiento desde la fecha del certificado | El equipo deriva desde que se calibró | Se cuenta desde la fecha de ejecución |
| Ocultar el equipo vencido de los selectores | El usuario no sabe por qué no aparece y usa otro sin control | Se muestra deshabilitado con el motivo |
| "Sin impacto" sin justificación | Cierra el trámite sin evidencia | La justificación es obligatoria |
| Comparar con coma flotante binaria | `0,1 + 0,2 ≠ 0,3` rompe el caso límite | Aritmética decimal en el dominio |
| Alertar a cada responsable por cada equipo | Fatiga de avisos | `DueItem` con `ownerUserId`/`siteId`; resumen diario ya existente |
| Calibración en un laboratorio cuyo alcance no cubre el rango | Trazabilidad aparente | Casilla "el alcance cubre el servicio" |
| Borrar un registro erróneo | Se pierde la trazabilidad | Anulación con motivo; el registro se conserva |

---

## H. Qué no pude verificar → validar con un metrólogo

1. Texto oficial de ISO 9001 §7.1.5.1 y §7.1.5.2, ISO 14001 §9.1.1, ISO 45001 §9.1.1 e ISO/IEC 17025:2017 (solo citas secundarias).
2. Texto de ILAC-G8:09/2019 (solo resúmenes de un laboratorio y de ILAC) y de ILAC P10:07/2020 (leí la edición 2013).
3. El divisor `U ≤ EMP/3` como criterio general de capacidad (JCGM 106 lo usa como ejemplo de metrología legal).
4. Que ISO/IEC 17025 §7.8.4.3 impida al laboratorio recomendar un intervalo.
5. Todos los intervalos de 12 meses (ninguna fuente los fija) y el de 6 meses para detectores (tope de 180 días de un fabricante).
6. Intervalos o requisitos específicos de IRAM 3625 y de la Res. SRT 953/2010 para detectores en espacios confinados; plazo de vigencia del certificado en las resoluciones SRT de iluminación (texto leído solo vía resumen).
7. Si el OAA es firmante del acuerdo ILAC/IAAC (la página consultada no lo dice) y cómo ILAC pasó a GLOBAC desde el 01/01/2026 (la página del OAA lo menciona sin detalle).
8. Validez de los certificados SAC emitidos antes de la disolución (la Res. INTI 198/2025 no lo aclara).
9. Que IEC 804 haya sido reemplazada por IEC 61672 (conocimiento general).
10. Reglas de metrología legal aplicables a balanzas (Res. 611/19) y su plazo de verificación periódica.

---

## I. Tabla de fuentes

| # | Fuente | URL | Lo que respalda | Conf. |
|---|---|---|---|---|
| 1 | ILAC-G24:2022 / OIML D 10:2022, intervalos de recalibración | https://www.oiml.org/en/files/pdf_d/d010-e22.pdf | Factores, métodos de revisión, no recomendar intervalos fijos | A |
| 2 | JCGM 106:2012 / OIML G 1-106, regla de decisión | https://www.oiml.org/en/files/pdf_g/g001-106-e12.pdf | Aceptación simple, banda de guarda, 2,3 %, ejemplo U ≤ Emax/3 | A |
| 3 | ILAC P10:01/2013, trazabilidad | https://cdn-v2.iasonline.org/wp-content/uploads/2021/02/04-04-ILAC_P10_01_2013.pdf | Definición, rutas aceptadas, calibraciones internas | A |
| 4 | SCC, aviso sobre ILAC P10 (edición 2020) | https://scc-ccn.ca/accreditation/bulletins/ilac-p10-ilac-policy-metrological-traceability-measurement-results | Existencia de la edición vigente | B |
| 5 | ÉMI Lab, regla de decisión según ILAC-G8 | https://epito.emi.hu/EMI/web.nsf/Pub/5B26U7/$FILE/ÉMILAB_Decision%20rule_ILAC_G8_09_2019%20EN%2020200623.pdf | Reglas de G8 y su riesgo | B |
| 6 | ILAC, G8 revisado | https://ilac.org/latest_ilac_news/revised-ilac-g8-published/ | Existencia y propósito de G8 | B |
| 7 | NIST, crosswalk ISO/IEC 17025 | https://www.nist.gov/document/7-8-17025-crosswalk-reporting-results-20180201pdf | §7.8.4, §7.8.6, trazabilidad en el certificado | A (parcial) |
| 8 | Fluke, reglas de decisión | https://www.fluke.com/en-us/learn/blog/calibration-software/decision-rules-conformity-assessment | §3.7 y §7.1.3 de 17025 | B |
| 9 | Auditor Training Online, 9001 §7.1.5.2 | https://blog.auditortrainingonline.com/blog/iso-9001-7-1-5-2-measurement-traceability | Citas de 7.1.5.2 | B |
| 10 | The Core Solution, 9001 §7.1.5 | https://www.thecoresolution.com/clause-7-1-5-iso-9001-explained | Resumen de 7.1.5 | B |
| 11 | Oxebridge, FDIS ISO 9001:2026 | https://www.oxebridge.com/emma/iso-fdis-90012026-full-review/ | 7.1.5 sin cambios; observación sobre registros | B |
| 12 | Advisera, 9001:2015 vs 2026 | https://advisera.com/articles/iso-9001-2015-vs-9001-2026-main-differences/ | 7.1.5 entre cambios editoriales | B |
| 13 | Advisera Community, 45001 y calibración | https://community.advisera.com/topic/iso-45001-and-calibration-of-equipment/ | Redacción de 45001 §9.1.1 | B |
| 14 | Presencis, 14001 §9.1 | https://cdn.presencis.com/regulations/iso-14001/article-9.1/ | Redacción de 14001 §9.1.1 | B |
| 15 | OSHA, boletín sobre monitores de gases | https://osha.gov/publications/shib093013 | Bump test, calibración, frecuencia, registros | A |
| 16 | Honeywell Analytics, aviso de producto 2017115-2 | https://core.instrumart.com/assets/Honeywell-Gas-Detection-Bump-Test-and-Calibration-Frequency.pdf | Frecuencias de un fabricante, tolerancia ±10–20 % | A (de ese fabricante) |
| 17 | Res. SRT 85/2012 (ruido) | https://www.argentina.gob.ar/normativa/nacional/193617/texto | Fecha de calibración y certificado | A |
| 18 | Res. SRT 84/2012 (iluminación) | https://www.argentina.gob.ar/normativa/nacional/193616/texto | Idem | B |
| 19 | Res. SRT 900/2015, anexo (puesta a tierra) | https://www.argentina.gob.ar/sites/default/files/res_srt_900_15-anexo.pdf | Idem | A |
| 20 | Res. INTI 198/2025 | https://www.argentina.gob.ar/normativa/nacional/norma-420817/texto | Disolución del SAC | A |
| 21 | OAA, entidades acreditadas | https://www.oaa.org.ar/publico/entidades-acreditadas | Dónde verificar un laboratorio | A |
| 22 | Guía de espacios confinados (Ministerio de Trabajo) | https://argentina.gob.ar/sites/default/files/ft_espacios_confinados_ago2021.pdf | Inventario de calibración | A |
| 23 | Res. SRT 953/2010 | https://e-legis-ar.msal.gov.ar/htdocs/legisalud/migration/pdf/15960.pdf | Remisión a IRAM 3625 | B |
| 24 | Bioblast, ISO 10012:2003 | https://bioblast.at/index.php/ISO_10012:2003_Measurement_management_systems | Confirmación metrológica | B |
| 25 | IMEKO 2015, intervalos y EMP | https://imeko.org/publications/wc-2015/IMEKO-WC-2015-TC6-175.pdf | ISO 10012 sin criterio de intervalos | B |
| 26 | CASRAI, calibraciones fuera de tolerancia | https://www.casrai.org/guides/out-of-tolerance-calibration | Ventana y contención | B |
| 27 | ICS Schneider, as-found / as-left | https://www.ics-schneider.de/messgeraet-kalibrieren-mit-as-found-und-as-left-warum-beide-werte-wichtig-sind/?lang=en | Uso de los dos juegos de datos | B |
| 28 | InCompliance, as-found fuera de tolerancia | https://incompliancemag.com/as-found-out-of-tolerance-what-to-do-next/ | Datos completos para el impacto | B |
| 29 | EVS, IEC 61672-3:2013 | https://www.evs.ee/en/iec-61672-3-2013 | Alcance de ensayos periódicos | B |
