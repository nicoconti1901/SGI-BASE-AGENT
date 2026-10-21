# Research: capacitaciones, competencia y toma de conciencia (Task 20)

Fecha de la investigación: 2026-10-21. Insumo del `SPEC-training.md`.

**Escala de confianza usada en todo el documento**
- **A. Confirmado en fuente**: lo dice la norma o una resolución, y se leyó el texto (oficial o reproducción fiel). Se cita la URL.
- **B. Práctica habitual**: lo hace el mercado o lo recomiendan consultoras y auditores, pero ninguna norma lo fija. Es una buena opción por defecto, no una obligación.
- **C. No verificado**: no se pudo leer la fuente primaria o no se encontró. **Validar con un profesional de Higiene y Seguridad (HyS) antes de presentarlo al cliente como obligación.**

Limitación general: el texto oficial de las normas ISO es de pago y no se accedió a él. Lo que sigue de las ISO se apoya en fuentes secundarias coincidentes (DNV, Ecesis, EcoOnline, Presencis) y en el conocimiento del texto de la edición 2015. Cuando una afirmación depende de eso, se marca.

---

## 1. Qué exigen las normas

### 1.1 ISO 9001:2015 §7.2 Competencia

La organización debe (parafraseo, confianza A- por fuentes secundarias coincidentes):
1. **Determinar** la competencia necesaria de las personas que, bajo su control, hacen un trabajo que afecta el desempeño y la eficacia del sistema.
2. **Asegurar** que esas personas son competentes **sobre la base de educación, formación o experiencia** apropiadas.
3. **Cuando sea aplicable**, tomar acciones para **adquirir** la competencia necesaria y **evaluar la eficacia** de las acciones tomadas.
4. **Conservar información documentada** apropiada como **evidencia** de la competencia.

Matices que importan para el diseño:
- La capacitación es **una** de las acciones posibles (también tutoría, reasignación, contratar a alguien competente). El módulo registra formación, pero el SPEC deja abierta la puerta a "experiencia / evaluación directa" como registro (ver `source`).
- "Cuando sea aplicable" se aplica a la acción y a la evaluación de su eficacia: **no hay que evaluar la eficacia de todo curso**; sí hay que poder explicar el criterio.
- Se evalúa la eficacia de **las acciones tomadas**, no la asistencia.

Fuentes: [DNV, 7.2 competence management (PDF)](https://www.dnv.com/siteassets/images/pdf-documents/espresso-the-new-iso-9001-14001-and-45001-requirements---7.2-competence-management.pdf), [Ecesis, Competence and Awareness 9001](https://www.ecesis.net/ISO-9001/Competence-and-Awareness.aspx), [Quality Magazine, Competence, awareness and training](https://qualitymag.com/articles/print/97406-competence-awareness-and-training-oh-my), [Fabrico, ISO 9001 7.2](https://www.fabrico.io/blog/iso-9001-clause-7-2-competence/). Las fuentes difieren en si citan "where applicable"; el texto normativo exacto requiere la norma comprada.

### 1.2 ISO 9001:2015 §7.3 Toma de conciencia

Las personas bajo el control de la organización deben ser conscientes de: la política de calidad, los objetivos de calidad pertinentes, su contribución a la eficacia del sistema (incluidos los beneficios de una mejora del desempeño) y las implicancias de no cumplir los requisitos (confianza A- / B: texto de la edición 2015 conocido, fuentes secundarias en la misma línea).

**Aviso de revisión:** la edición ISO 9001:2026 está en transición (FDIS publicado en junio 2026 según el CQI; publicación final prevista entre septiembre y noviembre de 2026; transición de unos 3 años). Las comparaciones coinciden en que **§7.3 cambia** (se agrega cultura de calidad y comportamiento ético) y no se encontró qué cambia en §7.2. El catálogo sembrado del repo usa la edición 2015: antes de construir 20.4 hay que revisar si el texto final altera 7.2 o 7.3. Fuentes: [Advisera, 9001:2015 vs 9001:2026](https://advisera.com/articles/iso-9001-2015-vs-9001-2026-main-differences/), [DQS, cronograma](https://www.dqsglobal.com/en/explore/blog/iso-9001-2026-changes-timeline-transition). Confianza B (fechas contradictorias entre fuentes).

### 1.3 ISO 14001:2015 §7.2 y §7.3

- §7.2: igual estructura que 9001 pero la competencia se determina para quien hace un trabajo que afecta **el desempeño ambiental** y la capacidad de cumplir los **requisitos legales y otros** (obligaciones de cumplimiento); además de competencia, se conserva evidencia.
- §7.3: toma de conciencia de la política ambiental, los **aspectos ambientales significativos** y los impactos reales o potenciales de su trabajo, su contribución a la eficacia del sistema y las **consecuencias de no cumplir** (incluidas las obligaciones de cumplimiento).
- Ambas aplican a todas las personas bajo el control de la organización, **incluidos contratistas** en lo que corresponda.

Fuentes: [Ecesis, 14001 Competence and Awareness](https://www.ecesis.net/ISO-14001/Competence-and-Awareness.aspx), [Presencis 14001 art. 7.2](https://cdn.presencis.com/regulations/iso-14001/article-7.2/), [Presencis 14001 art. 7.3](https://cdn.presencis.com/regulations/iso-14001/article-7.3/). Confianza A- (secundarias coincidentes).

### 1.4 ISO 45001:2018 §7.2, §7.3 y §5.4

- §7.2: determinar la competencia de los **trabajadores** que afecta o puede afectar el desempeño de SST; asegurar que son competentes (educación, formación o experiencia), tomar acciones para adquirirla y evaluarlas **cuando sea aplicable**, y conservar evidencia.
- §7.3: los trabajadores deben ser conscientes de la política y los objetivos de SST, su contribución a la eficacia del sistema, las implicancias de no cumplir, **los incidentes e investigaciones relevantes para ellos, los peligros y riesgos que les conciernen y su capacidad de apartarse de situaciones de peligro grave e inminente** sin represalias (la "autoridad de parar el trabajo").
- §5.4 (consulta y participación): los trabajadores no directivos **participan** en, entre otros temas, determinar los requisitos de competencia, las necesidades de formación y la evaluación de la formación (según un checklist de auditoría; confianza B hasta verificar el texto). Consecuencia práctica: **quién fue consultado al definir la matriz de capacitación es una pregunta de auditoría de 45001.**

Fuentes: [Auditor Training Online, 45001 clause 7.3](https://blog.auditortrainingonline.com/blog/iso-45001-clause-7-3), [Presencis 45001 art. 5.4](https://cdn.presencis.com/regulations/iso-45001/article-5.4/), [EcoOnline, 45001 clauses](https://www.ecoonline.com/en-us/blog/iso-45001-clauses/), [Ecesis 45001 internal audit checklist](https://www.ecesis.net/documents/ISO-45001-OHS-Internal-Audit-Checklist.docx).

Las cláusulas 7.2, 7.3 (las tres normas) y 45001 §5.4 **existen en el catálogo sembrado** del repo (verificado en `ESSENTIAL_CATALOG_SEED`). El módulo `training` ya declara 7.2 y 7.3 para las tres normas.

### 1.5 ISO 10015:2019 (gestión de la competencia y el desarrollo de las personas)

Guía (no certificable) que **reemplazó a la ISO 10015:1999 "Directrices para la formación"** y pasó de "formación" a "gestión de la competencia y desarrollo de las personas". Aplica a cualquier organización; revisada y confirmada en 2025. El ciclo clásico de la guía es: **definir necesidades → diseñar y planificar → proveer → evaluar resultados**, con seguimiento del cumplimiento de lo planificado. Confianza A para el alcance y la historia ([ISO 10015:2019](https://www.iso.org/standard/69459.html)); el detalle del ciclo es B (no se accedió al texto).

### 1.6 Modelo de Kirkpatrick (para "eficacia")

Cuatro niveles: **1 Reacción** (satisfacción), **2 Aprendizaje** (conocimiento o habilidad adquirida, con prueba), **3 Comportamiento** (aplica lo aprendido en el trabajo), **4 Resultados** (impacto en indicadores). Cada nivel aporta información más valiosa y es más difícil de medir. Confianza B (modelo ampliamente usado; fuentes secundarias: [Devlin Peck](https://devlinpeck.com/content/kirkpatrick-model-evaluation), [Adobe eLearning](https://elearning.adobe.com/2023/07/what-is-kirkpatrick-evaluation-model-kem)).

---

## 2. Formación, competencia, toma de conciencia y eficacia: cuatro cosas distintas

| Concepto | Pregunta que responde | Evidencia típica | Dónde vive en el módulo |
|---|---|---|---|
| **Formación** (un evento) | ¿Se dictó y quién asistió? | Planilla de asistencia, certificado | `TrainingSession`, `TrainingRecord` |
| **Aprendizaje** (Kirkpatrick 2) | ¿Entendió? | Examen, práctica evaluada, nota | `TrainingRecord.result` / `score` |
| **Competencia** (§7.2 a, b) | ¿Puede hacer la tarea? | Formación + experiencia + evaluación; habilitación | Estado calculado + `isQualifiedForTask` |
| **Eficacia** (§7.2 c; Kirkpatrick 3-4) | ¿La acción tomada funcionó? Lo aplica en el trabajo | Observación del supervisor, indicador, reincidencia | `TrainingEffectiveness` |
| **Toma de conciencia** (§7.3) | ¿Sabe por qué importa la política, los riesgos, las consecuencias? | Charla de inducción, registro de comunicación | Curso de tipo `awareness`, requisito "todo el personal" |

Regla de diseño que se desprende: **asistir no es ser competente, y aprobar un examen no es ser eficaz**. Un auditor 9001/14001/45001 pide poder ver cada eslabón por separado cuando se aplica.

---

## 3. Cómo evaluar la eficacia de forma realista

Hallazgo típico de auditoría: ante el legajo de un operario se muestra una planilla de asistencia firmada y, a la pregunta "¿cómo evaluaron que sirvió?", no hay respuesta; suele cerrarse como no conformidad menor. Los métodos aceptados que mencionan las fuentes: tarea observada contra el procedimiento, prueba escrita o práctica con umbral, visto bueno del supervisor tras corridas supervisadas, y datos del proceso (desvíos, reprocesos, incidentes). Un plazo habitual para evaluar es **30 a 90 días** después del curso (fuentes de consultoras: confianza B). Fuente: [Fabrico](https://www.fabrico.io/blog/iso-9001-clause-7-2-competence/), [Ecesis](https://www.ecesis.net/ISO-9001/Competence-and-Awareness.aspx), [Open Exam Prep, guía de auditor líder](https://open-exam-prep.com/study-guides/iso-9001-lead-auditor/chapter-2a/planning-support).

Recomendaciones para un sistema que el cliente **realmente mantenga**:
1. **Dos capas, no una.** (a) Evaluación inmediata del aprendizaje (examen o práctica) en **todo** curso de HyS: la Res. SRT 905/15 la pide (ver 4.2). (b) Evaluación de eficacia diferida (comportamiento en el puesto), **solo** en los cursos marcados como críticos o de alto riesgo.
2. **Eficacia por sesión, con excepciones por persona.** El supervisor evalúa la sesión (método + criterio + nota) y marca **excepciones** (quien no aplica lo aprendido). Evaluar 40 asistentes uno por uno a los 90 días es la receta para la "eficacia de papel".
3. **Método explícito y limitado.** Lista corta: observación en el puesto, práctica evaluada, prueba escrita, indicador. Sin método y sin nota no se puede cerrar.
4. **Consecuencia real.** Un "no eficaz" debe generar una acción (reentrenar, tutoría, reasignar) y, si el curso habilita una tarea crítica, **no** debe seguir habilitando. Si no pasa nada con un "no eficaz", nadie lo va a marcar nunca.
5. **El criterio de aplicabilidad lo define la empresa**, no el software. El módulo solo ofrece la casilla "requiere evaluación de eficacia" por curso y un campo de texto para el criterio de muestreo, si lo usa.

---

## 4. Marco argentino

### 4.1 Ley 19.587 y Decreto 351/79 — **A (leído en texto oficial)**

- **Ley 19.587, art. 9 inc. k**: el empleador debe "promover la capacitación del personal en materia de higiene y seguridad en el trabajo, particularmente en lo relativo a la prevención de los riesgos específicos de las tareas asignadas". Fuente: [Biblioteca AFIP, Ley 19.587](https://biblioteca.afip.gob.ar/dcp/LEY_C_019587_1972_04_21). **Matiz sobre el encargo original:** la capacitación está en el **art. 9 inc. k** (obligaciones del empleador); el art. 8 trata de las medidas de higiene y seguridad en edificios, máquinas y protección personal. El art. 10 es el deber del trabajador de asistir a los cursos en horario de trabajo.
- **Decreto 351/79, Anexo I, Capítulo 21 "Capacitación" (arts. 208 a 213)**: todo establecimiento debe capacitar a su personal en HyS (art. 208); la capacitación se da por conferencias, cursos, seminarios y clases con apoyo de material (art. 209); alcanza **tres niveles**: superior (dirección, gerencias y jefaturas), intermedio (supervisión de línea y encargados) y operativo (art. 210); cada establecimiento **planifica anualmente** programas por nivel y los presenta a la autoridad si se lo piden (art. 211); los programas son elaborados y desarrollados por los Servicios de Medicina, Higiene y Seguridad (art. 212); se entregan por escrito al trabajador las medidas preventivas (art. 213). Lo que **no** dice: no fija frecuencia más allá de lo anual, ni un registro con formato, ni vigencias individuales. Fuente: [Infoleg, Decreto 351/79 Anexo I](https://servicios.infoleg.gob.ar/infolegInternet/anexos/30000-34999/32030/dto351-1979-anexo1.htm) (resumen del texto por una herramienta de lectura; citar el artículo exacto antes de publicarlo al cliente).

### 4.2 Resolución SRT 905/2015 — **A (leído en argentina.gob.ar)**

Define las funciones de los Servicios de HyS y de Medicina del Trabajo. Vigente desde el 5/5/2015; los plazos de implementación los fija la SRT según el riesgo y el tamaño de la empresa (art. 1). Fuente: [argentina.gob.ar, Res. 905/2015](https://www.argentina.gob.ar/normativa/nacional/246509/texto). Lo relevante para el módulo (los números de ítem salen de esa lectura; confirmar el ítem exacto al citar):
- **Anexo I (funciones conjuntas), ítem 15**: elaborar y ejecutar el **Programa Anual de Capacitación por establecimiento**, firmado por los niveles jerárquicos. Contenido mínimo: identificación de peligros y estimación de riesgos de las tareas **por puesto de trabajo**; prevención de enfermedades profesionales y accidentes (incluidos in itinere); procedimientos de trabajo seguro **por tarea** (con uso de EPP); conceptos de ergonomía.
- **Mismo ítem, 15.2**: emitir y entregar **certificados que acrediten la asistencia**; **determinar la metodología para evaluar a los participantes** y verificar si la capacitación funcionó; **documentar** cada capacitación con temas, contenidos, duración, fechas y **firmas** de responsables, capacitadores y capacitados, con **DNI y puesto** de cada trabajador; entregar el material.
- **Anexo II (Servicio de HyS)**: ítem 9, **Plan de Capacitación anual** con mínimo de: uso de EPP, plan de evacuación, riesgo de incendio y uso de extintores, **riesgo eléctrico**, autocontrol preventivo, manejo seguro y responsable, otros; ítem 10, **registrar** la capacitación; ítem 13, **capacitar en la inducción** a quien ingresa por primera vez a un puesto.
- Ítem 20 del Anexo I: definir los requisitos de HyS y capacitación del **personal eventual** (contratado o tercerizado).

**Qué implica para el producto:** (1) lo que la ley pide es un **programa anual**, cursos mínimos y **registro con DNI, puesto, firma y método de evaluación**, no certificados con vencimiento en meses; (2) la planilla de asistencia debe tener los campos de 15.2.3, así que el módulo debe poder **generar** esa planilla para imprimir y firmar; (3) el "plan anual" del todo.md (20.5, "opcional") es en la práctica una **obligación legal** para el establecimiento: conviene dejar de llamarlo opcional.

### 4.3 Normas específicas

| Tema | Norma | Qué se verificó | Conf. |
|---|---|---|---|
| Espacios confinados | Res. SRT 953/2010 (criterios de seguridad; se cumplen con IRAM 3625:2003) | Existe y sigue vigente según un documento comercial de 3M; que el empleador debe formar a todo el personal que participa y que el equipo de rescate practica con frecuencia mínima semestral sale de un **folleto comercial**. La ficha técnica de la SRT es una guía de recomendaciones, no obligación. | **C** para la periodicidad; A- para la existencia. [3M, compliance guide](https://multimedia.3m.com/mws/media/1829972O/compliance-guide-confined-spaces-arg.pdf), [SRT, ficha técnica](https://argentina.gob.ar/sites/default/files/ft_espacios_confinados_ago2021.pdf) (PDF ilegible para la herramienta; el texto no se leyó) |
| Trabajo en altura | Res. SRT **61/2023** (Boletín Oficial 6/12/2023; el archivo de argentina.gob.ar se titula "62-23") | Aprueba "Medidas de seguridad en altura" (Anexo I), glosario, checklists de equipos; complementa el Dec. 911/96; vigencia a los 90 días de publicada. Los considerandos citan la falta de **capacitación** como causa de accidentes graves. **No se pudo leer el Anexo I**: no se sabe si fija capacitación específica ni periodicidad. | A para existencia; **C** para requisitos de capacitación. [Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/300086/20231206) |
| Construcción | Dec. 911/96 y Res. SRT 231/96 y 51/97 | Un formulario de relevamiento de la SRT vincula el "programa de capacitación al personal" con el art. 20 Cap. 4 del Dec. 911/96 y la Res. 231/96 art. 3 inc. a; "capacitación básica con constancias firmadas" (art. 1 inc. g) y "completar la capacitación básica a los 15 días" (art. 1 inc. m). Es un formulario, **no** el texto. | **C**. [Búsqueda: resumen Dec. 911/96](https://fio.unicen.edu.ar/usuario/segumar/Laura/material/LEGISLACI%d3N/Resumen%20Decreto%20911.pdf) |
| Sustancias químicas | Res. SRT 801/2015 (SGA/GHS) | Art. 2: el empleador aplica el SGA/GHS en **capacitación**, etiquetado y señalización. Cronograma modificado por Res. 155/2016: verificar versión consolidada. | A (art. 2); fechas **C**. [argentina.gob.ar, Res. 801/2015](https://www.argentina.gob.ar/normativa/nacional/norma-245850/texto) |
| Residuos peligrosos | Decreto 831/93 (reglamenta Ley 24.051) | Art. 34 inc. h: manual de HyS con "programa de difusión y capacitación de todo el personal" de la planta; art. 25 inc. d-e: curso específico para conductores de transporte de residuos peligrosos y certificado para la licencia especial. Aparece en la lectura de [Infoleg 12830](https://servicios.infoleg.gob.ar/infolegInternet/anexos/10000-14999/12830/norma.htm) (la herramienta resumió, no se leyó artículo por artículo). | A- |
| Manejo defensivo | Ley 24.449 art. 14 inc. a y Disp. ANSV 380/12 | La ANSV **registra** cursos de manejo defensivo (incluso integrados con HyS) para licencias profesionales; **no se encontró** una regla nacional general que exija el curso con una vigencia. Cada jurisdicción y actividad (cargas peligrosas) puede variar. | **C**. [Boletín Oficial ANSV 2017](https://www.boletinoficial.gob.ar/pdf/aviso/primera/161670/20170406) |
| Riesgo eléctrico | Dec. 351/79 Cap. 14 remite a la reglamentación AEA 90364; existe un reglamento SRT/AEA de trabajos con tensión hasta 1 kV | La habilitación del personal que trabaja con tensión no se pudo verificar. **Res. SRT 592/2004: no se pudo identificar ni verificar** (no aparece en las búsquedas). | **C** |
| Exámenes médicos | Res. SRT 37/2010 | **Es de exámenes médicos en salud, no de capacitación.** No corresponde a este módulo (y los datos de salud están fuera del alcance de la Task 14). | A. [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/163171/texto) |
| Protocolos de medición | Res. SRT 84/2012 | No se pudo verificar qué regula (probablemente un protocolo de medición, no capacitación). | **C** |
| Izaje / operadores de grúa o autoelevador | — | No se encontró norma nacional general con requisito de capacitación o vigencia. | **C** |
| Uso de extintores | Res. 905/15 Anexo II ítem 9.3 (tema mínimo del plan anual) | Confirmado como **tema mínimo anual**; el art. 176 del Dec. 351 (instrucción del personal) no se pudo leer. | A (905/15), C (Dec. 351 art. 176) |
| Primeros auxilios / RCP | — | No se encontró obligación individual verificada. AHA: certificación BLS de **2 años** según proveedores de curso (no la AHA). | Obligación **C**; vigencia 2 años **B**. [SureFire CPR](https://surefirecpr.com/bls/how-to-renew-american-heart-association-bls-certification/) |

**Otras citas pedidas que no corresponden o no se pudieron verificar:** Res. SRT 84/12 (no verificado), Res. SRT 37/10 (es de exámenes médicos), Res. SRT 592/04 (no identificada). **No se debe sembrar ninguna de las tres como fundamento de un curso.**

### 4.4 Lo que NO existe en la normativa leída

Ninguna norma leída fija "este curso vence a los N meses" para el personal en general: lo que hay es un **programa anual** con temas mínimos (905/15) y requisitos puntuales por actividad. Los vencimientos de 12 o 24 meses son una **decisión de la empresa** (típicamente derivada del programa anual y del criterio del profesional de HyS) o de **los certificados externos** (AHA 2 años, licencias, etc.). Por eso el módulo guarda la vigencia como dato **editable por curso** y la **fecha de vencimiento del certificado externo** cuando el proveedor la informa.

---

## 5. Evaluación crítica de los defaults de `tasks/todo.md`

| Default del todo | Veredicto | Ajuste propuesto |
|---|---|---|
| **Vigencia en meses (o no vence) por curso** | Correcto y necesario: la ley no fija vigencias generales. | Editable por curso; sembrar solo como **sugerencia** con etiqueta de confianza; guardar el vencimiento en el registro (foto) y permitir el del certificado externo. |
| **Por vencer a 30 días** | Razonable como default; corto para cursos que requieren agendar un proveedor externo (recertificar altura, rescate). | Default 30; **configurable por curso** (15-90). |
| **Gracia de 30 días desde ingreso o asignación** | **Problemático como regla única.** (1) La inducción del ingresante la debe dar el Servicio de HyS **al ingresar** al puesto (905/15 Anexo II ítem 13): gracia 0. (2) La capacitación básica de obra tiene un plazo de 15 días según un formulario de la SRT (C): una gracia de 30 sería incumplimiento. (3) Para tareas críticas la gracia no puede convivir con la habilitación. | Default 30 para cursos de puesto; **0 para inducción y para requisitos de tarea crítica**; "en plazo" **no** habilita para tarea crítica. El editor avisa si la gracia supera 15 días en un curso marcado "inducción" o de construcción. |
| **Eficacia a los 90 días solo si el curso lo pide** | Correcto: ISO dice "cuando sea aplicable". Pero la Res. 905/15 (15.2.2) pide definir **cómo se evalúa a los participantes**, lo que equivale a una evaluación **inmediata** de aprendizaje en todo curso de HyS. | Dos capas (ver 3): resultado/nota en todo registro; eficacia diferida solo en cursos marcados; 90 días como default **editable** (30-180). |
| **Habilitación para tarea crítica** | Correcto como control. Falta definir: si hay 2 tareas críticas con cursos compartidos; qué pasa con "en plazo"; qué pasa con un "no eficaz". | Reglas explícitas en el SPEC con casos de prueba. Una tarea crítica **sin** cursos obligatorios debe mostrar una advertencia (da una falsa sensación de habilitación). |
| **Estados vigente/por vencer/vencida/faltante/en plazo/no requerida** | Completo para el semáforo. "Reprobado" y "recomendado" no son estados sino **detalles**. | Se mantienen los 6 estados; `failed` y `recommended` son atributos. |
| **Plan anual "opcional" (20.5)** | **Matizar:** el Decreto 351 (art. 211) y la Res. 905/15 (Anexo I ítem 15) exigen un programa anual por establecimiento. | Sacar el "opcional": sesiones `planned` con vista plan vs realizado, exportable para firma. |
| **Persona = puesto + tareas** | Correcto, pero falta "todo el personal" (inducción, toma de conciencia, evacuación). | Tercer destino de requisito: "todo el personal". |
| **Un `DueItem` agrupado por persona/sede** | Correcto. | Un `DueItem` por persona (próximo punto de incumplimiento); sin avisos por celda; alta silenciosa del histórico importado (ver SPEC). |

---

## 6. Qué pide un auditor

Para una muestra de personas (confianza B, coherente con las fuentes de 3):
1. Descripción o perfil del puesto y **competencia requerida** (la matriz).
2. **Evidencia de que la persona la cumple**: certificados, planillas, experiencia previa.
3. Evidencia de que lo hecho **funcionó** (donde la empresa dijo que corresponde evaluarlo).
4. Cómo se actúa cuando falta algo (acciones, reasignación).
5. Para ISO 45001: cómo participaron los trabajadores en definir la capacitación (§5.4) y evidencia de toma de conciencia (§7.3: política, peligros, derecho a retirarse de un peligro grave).
6. Para Argentina: el **Programa Anual de Capacitación** firmado, y los registros con los campos de 905/15 Anexo I 15.2.3.

---

## 7. Cursos típicos y vigencias sugeridas

**Aviso:** la columna "Vigencia sugerida" es un punto de partida editable. **Salvo donde diga A, ninguna es una obligación legal verificada.** La obligatoriedad real depende de la actividad y de la ART; validarla con un profesional de HyS.

| Curso | Vigencia sugerida | Obligatoriedad / destino | Fuente | Conf. |
|---|---|---|---|---|
| Inducción de seguridad al ingreso al puesto | No vence (se repite al cambiar de puesto) | Obligatorio, **todo el personal**, gracia 0 | Res. 905/15 Anexo II ítem 13 | **A** (obligación del Servicio) |
| Toma de conciencia del SGI (política, objetivos, aspectos significativos, peligros, derecho a retirarse) | 12 meses | Obligatorio, todo el personal | ISO 9001/14001/45001 §7.3 | A- (norma) / B (12 m) |
| Uso de EPP | 12 meses | Obligatorio por puesto | Res. 905/15 Anexo II 9.1 (tema mínimo anual) | **A** tema / B vigencia |
| Plan de evacuación y emergencias | 12 meses | Obligatorio, todo el personal | Res. 905/15 Anexo II 9.2 | **A** tema / B vigencia |
| Riesgo de incendio y uso de extintores | 12 meses | Obligatorio, todo el personal | Res. 905/15 Anexo II 9.3 | **A** tema / B vigencia |
| Riesgo eléctrico | 12 meses | Obligatorio por puesto o tarea que corresponda | Res. 905/15 Anexo II 9.4 | **A** tema / B vigencia |
| Autocontrol preventivo | 12 meses | Obligatorio | Res. 905/15 Anexo II 9.5 | **A** tema / B vigencia |
| Manejo seguro y responsable | 12 meses | Obligatorio para quien conduce | Res. 905/15 Anexo II 9.6 | **A** tema / B vigencia |
| Identificación de peligros y procedimientos de trabajo seguro de la tarea | Al cambiar de puesto o tarea; revisión 12 meses | Obligatorio por puesto/tarea | Res. 905/15 Anexo I 15.1.1 y 15.1.3 | **A** tema / B vigencia |
| Ergonomía | 12 meses | Por puesto | Res. 905/15 Anexo I 15.1.4 | **A** tema / B vigencia |
| Sustancias químicas / SGA-GHS (etiquetas y hojas de seguridad) | 12 meses | Por puesto con exposición | Res. SRT 801/2015 art. 2 | **A** (aplicar SGA en capacitación) / B vigencia |
| Manejo de residuos peligrosos | 12 meses | Por puesto en plantas generadoras | Dec. 831/93 art. 34 h | A- / B |
| Trabajo en altura | 12 meses | **Tarea crítica**, obligatorio | Res. SRT 61/2023 (existe); contenido de capacitación no leído | A- existencia / **C** requisito / B vigencia |
| Espacios confinados (trabajador, vigía, rescate) | 12 meses (rescate: práctica semestral) | **Tarea crítica**, obligatorio | Res. SRT 953/2010 + IRAM 3625 | A- existencia / **C** periodicidad |
| Izaje de cargas y operación de autoelevador o grúa | 12-24 meses | **Tarea crítica** | No se encontró norma nacional | **C** / B |
| Manejo defensivo | 24 meses | **Tarea crítica** (conducción) | ANSV registra cursos; sin norma nacional general encontrada | **C** / B |
| Primeros auxilios y RCP | 24 meses | Brigadistas y personal designado | AHA 2 años (proveedores) | Obligación **C** / vigencia B |
| Trabajos con tensión eléctrica | 12 meses | **Tarea crítica** | Reglamento SRT/AEA (número no identificado) | **C** |
| Respuesta a derrames y emergencias ambientales | 12 meses | Por puesto | ISO 14001 §8.2 (preparación ante emergencias) | B |
| Auditor interno (9001/14001/45001) | No vence; actualizar a criterio | Equipo auditor | ISO 19011 / práctica | B |
| Calibración y uso de instrumentos | No vence | Por puesto (calidad) | Práctica | B |

Reglas para la siembra: son **plantillas del catálogo sugerido** (código, no datos del cliente); el cliente las elige, las edita y es dueño de lo que activa. Cada plantilla muestra su etiqueta de confianza.

---

## 8. Anti-patrones a evitar

1. **La matriz que nadie mantiene.** Una planilla de 40 cursos × 200 personas con celdas pintadas a mano. Por eso el estado se **calcula** (puesto, tareas, registros) y el cliente solo mantiene los **requisitos** y los **registros**.
2. **Certificados sueltos.** Un PDF en una carpeta sin persona, curso ni fecha. Por eso cada archivo cuelga de un registro o de una sesión, y se lista "registros sin evidencia".
3. **Eficacia de papel.** Una casilla "eficaz" tildada para 40 personas sin método ni nota. Por eso método y nota son obligatorios, la evaluación es por sesión con excepciones y un "no eficaz" tiene consecuencias.
4. **Asistencia como competencia.** Tratar el certificado de asistencia como prueba de que sabe hacer la tarea.
5. **Un aviso por celda.** 10.000 celdas generan miles de mails el primer día. Por eso un `DueItem` por persona y alta silenciosa del histórico.
6. **Tarea crítica sin cursos exigidos.** El sistema dice "habilitado" porque nadie cargó los requisitos.
7. **Borrar para corregir.** Un error de carga se anula con motivo; nunca se borra el historial.
8. **Datos de más.** Notas médicas, aptitud física o sanciones disciplinarias dentro del módulo: fuera de alcance.

---

## 9. Fuentes

| # | Fuente | URL | Se usó para | Conf. |
|---|---|---|---|---|
| 1 | DNV, 7.2 competence management | https://www.dnv.com/siteassets/images/pdf-documents/espresso-the-new-iso-9001-14001-and-45001-requirements---7.2-competence-management.pdf | Estructura de 7.2 | A- (secundaria) |
| 2 | Ecesis, Competence and Awareness (9001) | https://www.ecesis.net/ISO-9001/Competence-and-Awareness.aspx | 7.2 / 7.3, "where applicable" | A- |
| 3 | Quality Magazine | https://qualitymag.com/articles/print/97406-competence-awareness-and-training-oh-my | 7.2 | A- |
| 4 | Fabrico, ISO 9001 7.2 | https://www.fabrico.io/blog/iso-9001-clause-7-2-competence/ | Métodos de evaluación | B |
| 5 | Ecesis, Competence and Awareness (14001) | https://www.ecesis.net/ISO-14001/Competence-and-Awareness.aspx | 14001 7.2/7.3 | A- |
| 6 | Presencis 14001 7.2 y 7.3 | https://cdn.presencis.com/regulations/iso-14001/article-7.2/ | 14001 | A- |
| 7 | Auditor Training Online, 45001 7.3 | https://blog.auditortrainingonline.com/blog/iso-45001-clause-7-3 | 45001 7.3 | A- |
| 8 | Presencis 45001 5.4 | https://cdn.presencis.com/regulations/iso-45001/article-5.4/ | 5.4 | B |
| 9 | Ecesis 45001 checklist | https://www.ecesis.net/documents/ISO-45001-OHS-Internal-Audit-Checklist.docx | 5.4 participación | B |
| 10 | ISO 10015:2019 | https://www.iso.org/standard/69459.html | Alcance e historia | A |
| 11 | Advisera, 9001:2015 vs 2026 | https://advisera.com/articles/iso-9001-2015-vs-9001-2026-main-differences/ | Cambios en 7.3 | B |
| 12 | DQS, cronograma 9001:2026 | https://www.dqsglobal.com/en/explore/blog/iso-9001-2026-changes-timeline-transition | Fechas de transición | B |
| 13 | Devlin Peck, Kirkpatrick | https://devlinpeck.com/content/kirkpatrick-model-evaluation | Niveles de evaluación | B |
| 14 | Open Exam Prep, guía de auditor líder 9001 | https://open-exam-prep.com/study-guides/iso-9001-lead-auditor/chapter-2a/planning-support | Evidencia que piden auditores | B |
| 15 | Biblioteca AFIP, Ley 19.587 | https://biblioteca.afip.gob.ar/dcp/LEY_C_019587_1972_04_21 | Art. 9 inc. k y art. 10 | A |
| 16 | Infoleg, Decreto 351/79 Anexo I | https://servicios.infoleg.gob.ar/infolegInternet/anexos/30000-34999/32030/dto351-1979-anexo1.htm | Cap. 21, arts. 208-213 | A |
| 17 | argentina.gob.ar, Res. SRT 905/2015 | https://www.argentina.gob.ar/normativa/nacional/246509/texto | Funciones, programa anual, registros | A |
| 18 | Boletín Oficial, Res. SRT 61/2023 | https://www.boletinoficial.gob.ar/detalleAviso/primera/300086/20231206 | Trabajo en altura | A (existencia) |
| 19 | argentina.gob.ar, Res. SRT 801/2015 | https://www.argentina.gob.ar/normativa/nacional/norma-245850/texto | SGA/GHS | A |
| 20 | Infoleg, Decreto 831/93 | https://servicios.infoleg.gob.ar/infolegInternet/anexos/10000-14999/12830/norma.htm | Residuos peligrosos | A- |
| 21 | 3M, guía de espacios confinados | https://multimedia.3m.com/mws/media/1829972O/compliance-guide-confined-spaces-arg.pdf | Res. 953/2010 (comercial) | C |
| 22 | Boletín Oficial ANSV 2017 | https://www.boletinoficial.gob.ar/pdf/aviso/primera/161670/20170406 | Cursos registrados | B |
| 23 | argentina.gob.ar, Res. SRT 37/2010 | https://www.argentina.gob.ar/normativa/nacional/163171/texto | Aclarar que es de exámenes médicos | A |
| 24 | SureFire CPR | https://surefirecpr.com/bls/how-to-renew-american-heart-association-bls-certification/ | RCP, 2 años | B |

---

## 10. Pendiente de validación por un profesional de HyS

1. Contenido y periodicidad de la capacitación exigida por la **Res. SRT 61/2023** (Anexo I), por la **Res. SRT 953/2010** y por el reglamento de **trabajos con tensión**.
2. Plazo de la capacitación básica en obra (Res. SRT 231/96) y si aplica al cliente.
3. Si hay normas de **izaje**, **autoelevadores** o **manejo defensivo** que fijen vigencia para la actividad del cliente (cargas peligrosas, minería, petróleo, etc.), incluidas las provinciales.
4. Identificar las resoluciones **592/2004** y **84/2012** citadas en el encargo.
5. Texto exacto de los arts. 208 a 213 del Decreto 351/79 y de los ítems 13 y 15 de la Res. 905/15 (la lectura fue asistida).
6. Texto oficial final de **ISO 9001:2026** §7.2 y §7.3.
