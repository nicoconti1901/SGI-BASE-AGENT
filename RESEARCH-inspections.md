# Research: inspecciones (Task 15)

Fecha: 2026-10-21. Insumo del `SPEC-inspections.md`. Es una investigación funcional y normativa, **no asesoramiento profesional**: todo lo marcado [C] debe validarlo un profesional de Higiene y Seguridad (HyS) matriculado antes de usarlo como plantilla de producción.

## 0. Cómo leer este documento

| Marca | Significado |
|---|---|
| **[A]** | Confirmado en fuente: leí el texto (oficial, o una guía que cita la norma textualmente). La fuente figura en la sección 7. |
| **[B]** | Práctica habitual no normada: la usan las empresas o la recomiendan guías, pero ninguna norma argentina que haya leído la exige. |
| **[C]** | No pude verificar: no encontré la fuente o no pude abrirla. Validar con un profesional de HyS. |

Límites de la investigación:
- Las normas **IRAM** e **ISO** son pagas. Para IRAM 3517-2:2020 usé una guía secundaria (Botta / Red Proteger, 4.ª ed., nov-2025) que transcribe los puntos de la norma. El folleto de IRAM no se pudo abrir. Para ISO 45001 usé una copia alojada por un tercero. **Para ISO 14001 y 9001 no pude acceder al texto**: lo que digo de ellas es la estructura de la norma, no una cita [C].
- Leí el texto oficial de: Decreto 351/79 (arts. 109, 114–118, 134, 183–187), Decreto 911/96 (arts. 90, 91, 257–278, 342), Resolución SRT 61/2023 (resolución y Anexo I), Ley 24.449 (arts. 30, 34, 39, 40). **No leí** el Anexo III de la Res. SRT 61/2023 (las planillas de verificación), ni la Res. SRT 900/2015 completa, ni el Decreto 779/95.
- No encontré una resolución de la SRT específica de **izaje** (la Res. SRT 550/2011 trata demolición, excavación y submuraciones, no izaje).

## 1. Hallazgos que cambian el diseño

1. **Frecuencia de extintores.** IRAM 3517-2:2020 §8.2 exige un control **mínimo trimestral** (4 por año), y **mensual** solo si las condiciones de la propiedad lo requieren [A]. La frecuencia **mensual** es obligatoria por ley solo en obras de construcción (Decreto 911/96 art. 90) [A]. El default "mensual" de `tasks/todo.md` es una buena práctica, no el mínimo normado.
2. **"Carga anual" no es el término de la norma.** IRAM pide **mantenimiento anual** como mínimo; la **recarga** se hace después de usar el extintor o cuando el control o el mantenimiento lo indican [A]. En los extintores a base de agua y espuma (AFFF) se reemplaza el agente cada año [A].
3. **Prueba hidráulica.** Cada **5 años** para todos los recipientes, salvo los a base de agua: cada **2 años** (resumen del Anexo E de IRAM 3517-2:2020) [A, secundaria]. El default "cada 5 años" de `todo.md` es correcto para el caso general, no para el agua.
4. **Decreto 351/79 sí dice algo.** La guía de Botta afirma que el 351 "no dice nada"; el texto oficial dice que quien controla sus propios equipos contra incendios **debe llevar un registro de inspecciones y tarjetas individuales por equipo** (art. 184), y que los terceros deben estar inscriptos (art. 185) [A]. Eso es exactamente lo que el motor debe producir.
5. **Izaje.** El Decreto 351/79 art. 116 fija **verificación diaria** por quien maneja el aparato y **revisión general trimestral** por personal especializado [A]. Es lo único normado que encontré sobre frecuencia de izaje. La "certificación de izaje" anual de `todo.md` es práctica habitual [B/C].
6. **Altura: la Res. SRT 84/12 NO es la de altura.** La 84/2012 es el protocolo de medición de **iluminación** (y la 85/2012, de ruido) [A]. La norma vigente de altura es la **Res. SRT 61/2023** (industria de la construcción): control **diario** de los elementos del sistema y sus anclajes con las planillas del Anexo III, dentro del permiso de trabajo seguro (PTS) [A]. **No fija frecuencia de inspección periódica ni vida útil de arneses** [C]. Lo que se usa son las guías del fabricante y referencias extranjeras (HSE del Reino Unido: inspección detallada al menos cada 6 meses) [B].
7. **Un arnés que frenó una caída no se reutiliza** (HSE INDG367) [B]; la Res. 61/2023 pide retirar el arnés tras una caída [A, según resumen de búsqueda; no leí la planilla].
8. **Control previo al uso de vehículos.** La Ley 24.449 art. 39 obliga al conductor a verificar, antes de salir a la vía pública, que su vehículo esté en condiciones de seguridad, bajo su responsabilidad [A]. Es la base legal del control previo al uso; no fija ítems.

## 2. Qué piden las normas ISO

Las normas ISO **no fijan frecuencias ni listas de control**: la organización las define. Lo que exigen es un proceso controlado, con criterios, y registros.

| Cláusula | Qué exige (parafraseado) | Qué debe dar la plataforma | Conf. |
|---|---|---|---|
| ISO 45001 §8.1.1 | Planificar, implementar, controlar y mantener los procesos con **criterios** definidos, controlarlos según esos criterios y conservar información documentada suficiente para confiar en que se hicieron como se planificó | Plantilla versionada = criterio; inspección cerrada = registro | [A] (copia alojada) |
| ISO 45001 Anexo A.8.1.1 | Ejemplos de control operacional: "programas de mantenimiento e inspección preventivos o predictivos" y aplicar los requisitos legales **o las instrucciones del fabricante** | Programa de inspección por activo con vencimientos; vencimientos documentales | [A] |
| ISO 45001 §9.1.1 | Determinar qué se monitorea y mide (incluye el cumplimiento de requisitos legales y la **eficacia de los controles operacionales**), con qué métodos, con qué criterios y cuándo; asegurar que los equipos de medición estén calibrados o verificados | Contadores y resultados; lista por tipo/sede; la calibración va en la Task 16 | [A] |
| ISO 45001 §6.1.2 | Identificación de peligros continua y proactiva | Las NC de inspección alimentan hallazgos; no se modela el registro de peligros acá | [B] |
| ISO 45001 §8.1.4.2 | Coordinar con contratistas | Activos y personas de contratistas se marcan como tales | [A] (índice) |
| ISO 14001 §8.1 y §9.1.1 | Controlar operacionalmente los aspectos ambientales significativos y hacer seguimiento y medición | Ítems ambientales (residuos, derrames, sustancias) en la plantilla del obrador | [C] |
| ISO 9001 §7.1.3 | Determinar, proveer y mantener la infraestructura (edificios, equipos, recursos de transporte) | Mantenimiento y estado de equipos y vehículos | [C] |

Cláusulas para la entrada del catálogo de módulos (existen en el catálogo sembrado, verificado con el comando del encargo): `ISO45001:8.1`, `ISO45001:9.1.1`, `ISO14001:9.1.1` (las actuales), más `ISO45001:6.1.2`, `ISO14001:8.1` y `ISO9001:7.1.3`. Ver `SPEC-inspections.md`.

## 3. Marco legal argentino transversal

| Norma | Qué dice (lo que leí) | Conf. |
|---|---|---|
| Ley 19.587 art. 9.b (citada por Botta) | El empleador debe mantener en buen estado de conservación y funcionamiento las máquinas, instalaciones y útiles de trabajo | [A, secundaria] |
| Decreto 351/79 art. 109 | Toda máquina averiada o de funcionamiento riesgoso se señaliza con la prohibición de manejo; se bloquea el interruptor o llave principal con candados | [A] |
| Decreto 351/79 arts. 114–118 | Aparatos para izar: carga máxima marcada y visible; prohibido exceder; verificación **diaria** por el operador; revisión general **trimestral** por personal especializado (cables, cadenas, fin de carrera, límites de izaje, poleas, frenos, controles); frenado para 1,5 veces la carga; coeficientes de seguridad (ganchos 3/4/5, cables 6) | [A] |
| Decreto 351/79 art. 134 | Autoelevadores y transporte automotor: carga máxima visible, mandos que eviten accionamiento involuntario, luces, frenos, aviso acústico, matafuegos, solo conductores capacitados | [A] |
| Decreto 351/79 arts. 183–187 | Certificaciones de normas por entidades reconocidas; registro de inspecciones y tarjeta individual por equipo contra incendios; controladores de terceros inscriptos; brigadas entrenadas con registro | [A] |
| Decreto 351/79 Anexo VII (resumen de Ecofield) | Potencial extintor mínimo por carga de fuego y riesgo (tablas A y B); mínimo 1 A y 5 BC por piso, "a razón de 1 cada 200 m² de superficie cubierta"; ubicación accesible; la clase corresponde al fuego probable | [A, secundaria] |
| Decreto 911/96 arts. 90–91 (construcción) | El responsable de HyS inspecciona **al menos una vez al mes** instalaciones, equipos y materiales de prevención y extinción de incendios; deben estar libres de obstáculos, accesibles, señalizados y visibles | [A] |
| Decreto 911/96 arts. 257–278 (construcción) | Cinturón de seguridad inercial en todo vehículo y maquinaria, de uso permanente (257); trabajo bajo un vehículo con calzas (259); visera en camiones volcadores (261); datos técnicos y tablas de carga de grúas (266); examen **periódico** por personal competente de armazón, mecanismo y fijaciones de grúas y dispositivos de elevación (267); código de señales y área señalizada (268); protección del operador contra caída de objetos y vuelco (274); estabilizadores sobre bases firmes (278); personal adiestrado (265) | [A] |
| Decreto 911/96 arts. 125 y 342 | Espacios confinados: oxígeno mínimo 18,5 % antes de autorizar; cinturón y cable de vida con asistencia desde el exterior | [A] |
| Res. SRT 61/2023 (construcción, altura) | Control diario de los elementos del sistema y sus anclajes con las planillas del Anexo III, dentro del PTS; PTS rubricado a diario por la mañana y después del almuerzo; charla diaria de 5 minutos; capacitación anual y simulacro de rescate semestral; piezas identificadas con trazabilidad, testeos e inspecciones periódicas (ítem 34); cabo de vida doble si se cambia de anclaje (ítem 35); dispositivo antitrauma desde 6 m; en vigencia desde 90 días después del 06/12/2023 | [A] (Anexo III no leído) |
| Res. SRT 900/2015 | Protocolo de medición de puesta a tierra y continuidad de masas; los valores medidos valen 12 meses | [A, resumen del Boletín Oficial] |
| Res. SRT 84/2012 y 85/2012 | Protocolos de medición de iluminación y de ruido | [A] |
| Res. SRT 299/2011 | EPP certificado y constancia de entrega por trabajador (no se modela entrega de EPP: fuera de alcance) | [A, resumen] |
| Ley 24.449 arts. 30, 34, 39, 40 | Dispositivos mínimos de seguridad del automotor (correajes, limpiaparabrisas, retrovisores, bocina, vidrios, etc.); revisión técnica periódica (qué se revisa y cada cuánto lo fija la reglamentación); conductor verifica el vehículo antes de ingresar a la vía; para circular: licencia, cédula, **seguro vigente**, patentes, **matafuego y balizas normalizados** (excepto motos) | [A] |
| Decreto 779/95 (RTO) | La periodicidad de la RTO depende de antigüedad y tipo de vehículo; no pude leer la tabla | [C] |

La legislación **provincial y municipal** (registros de recargadores, habilitaciones, RTO local) varía y no se investigó [C].

## 4. Por tipo de inspección

En cada tipo: lo exigido [A], la práctica [B] y lo que hay que validar [C]. Los ítems y su criticidad propuesta están en el anexo del SPEC. Criterio de criticidad usado: **crítico** = el activo no es seguro de usar ahora o falta un requisito legal bloqueante; **mayor** = degrada la función o es un incumplimiento corregible en días sin peligro inmediato; **menor** = orden, legibilidad, mantenimiento cosmético.

### 4.1 Extintores (IRAM 3517-1/-2, Dec. 351/79, Dec. 911/96)

**Frecuencias**
- Control: mínimo trimestral (IRAM 3517-2 §8.2); mensual si hay alta frecuencia de incendios, riesgos graves, riesgo de daño mecánico, temperaturas extremas o atmósferas corrosivas, o alto riesgo; mensual por ley en obras (Dec. 911 art. 90) [A].
- Mantenimiento: mínimo anual, o antes si el control lo indica (IRAM §9.2.1). En extintores de polvo químico ubicados en **vehículos** (vibración compacta el polvo) se recomienda **semestral** [A].
- Recarga: después de cada uso, o cuando lo indique un control o el mantenimiento (§9.2.2) [A].
- Prueba hidráulica: 5 años; base agua 2 años; mangueras con lanza de corte o válvula de control y mangueras de CO₂: **anual** (§9.7.1.4) [A, secundaria].
- Vida útil: no hay límite legal fijo; IRAM remite al máximo de la IRAM de fabricación; sin fecha de fabricación legible o adulterada = **obsoleto**, no se mantiene ni recarga (§9.11) [A, secundaria].

**Qué se controla** (guía de Botta sobre IRAM): presencia en su puesto, acceso y visibilidad libres, señalización, instrucciones legibles y de cara al usuario, altura de montaje, presión en zona verde (manómetro), peso del CO₂, precinto y pasador, manguera, tobera o difusor, daño físico (corrosión, golpes, abolladuras), fechas de mantenimiento y de prueba hidráulica, correspondencia con el puesto de extinción [A, secundaria].

**No apto / retiro de servicio** (IRAM §8.3.3.2 y guía) [A, secundaria]:
- precinto roto o faltante (se asume usado: va a mantenimiento; no se repone el precinto sin mantenimiento);
- manómetro fuera de la zona verde (bajo: no descarga; **alto: peligro**, vaciar de inmediato);
- descargado, sobrecargado, intervención de inexpertos;
- corrosión, golpes, "globos", "panza", fisuras, soldaduras;
- prueba hidráulica vencida: **retiro inmediato** (integridad del recipiente);
- mantenimiento vencido: se evalúa caso por caso, salvo vencimiento muy amplio;
- agente o potencial inadecuado al riesgo (p. ej. agua con riesgo eléctrico), o capacidad inadecuada al usuario.

**Procedimiento**: etiqueta celeste de control tras cada control (35 × 50 mm) sobre el extintor, no sobre el vidrio ni el gabinete; el extintor retirado se reemplaza por uno de la **dotación de reserva** de igual clasificación y capacidad al menos (§9.4.5, §3.33); señalizar el equipo fuera de servicio (Dec. 351 art. 109 e IRAM §8.3.3.2) [A].

**Práctica [B]**: ronda por sede con listado de pendientes; el mantenimiento y la recarga los hace un tercero inscripto (Dec. 351 art. 185); el cliente registra fecha y comprobante.
**Validar [C]**: registro de recargadores de la jurisdicción (en CABA lo administra la AGC), exigencias municipales de tarjeta.

### 4.2 Zona de obradores (Dec. 911/96; ISO 45001 §8.1; ISO 14001 §8.1)

- Fuego: arts. 90–91 del Decreto 911/96 (mensual, libre de obstáculos, señalizado) [A]. Cruce con el registro de extintores.
- **Frecuencia semanal**: no hay norma que la fije; es práctica de programa de HyS [B]. Lo normado en obra es la presencia y la inspección del responsable de HyS (Res. SRT 231/96 y 51/97, cuyo texto no leí) [C].
- Instalación eléctrica: tablero con tapa y disyuntor, puesta a tierra, sin empalmes precarios. La medición de puesta a tierra tiene protocolo oficial (Res. SRT 900/2015, vigencia de 12 meses) [A, resumen]; los ítems visuales son práctica [B]; el criterio técnico (AEA 90364) [C].
- Orden y limpieza, sanitarios, agua potable, botiquín, plan de emergencia: son requisitos de condiciones generales de los reglamentos; **no ubiqué el artículo exacto** [C].
- Sustancias, residuos y derrames: ISO 14001 §8.1 como control operacional [C]; normativa ambiental nacional y provincial de residuos y sustancias peligrosas: **no investigada** [C].
- Espacio confinado y bloqueo: Dec. 911 arts. 125 y 342, Dec. 351 art. 109 [A] (se usan en la auditoría de campo, no en el obrador).

### 4.3 Equipos y vehículos pesados (grúa, hidrogrúa, retroexcavadora, pala, camión, autoelevador)

- **Control previo al uso diario** por el operador: Dec. 351 art. 116 (aparatos para izar, diario) [A]; para el resto de los vehículos, Ley 24.449 art. 39 (si circula) [A]; para maquinaria sin norma específica es práctica [B].
- **Revisión periódica**: trimestral por personal especializado para aparatos de izar (Dec. 351 art. 116) [A]; examen periódico por personal competente en obras (Dec. 911 art. 267) [A]. La **inspección mensual de SST** de `todo.md` es práctica [B]; para aparatos de izar la norma es más exigente (trimestral especializada).
- Ítems con respaldo legal [A]: cinturón inercial (Dec. 911 art. 257), carga máxima visible (Dec. 351 arts. 114 y 134), tablas de carga de grúas (Dec. 911 art. 266), frenos y aviso acústico y luces y matafuego (Dec. 351 art. 134), visera de camión volcador (Dec. 911 art. 261), protección del operador contra caída de objetos y vuelco (Dec. 911 art. 274), estabilizadores (art. 278), código de señales (art. 268), calzas (art. 259), cables y ganchos con coeficientes de seguridad (Dec. 351 art. 118).
- **Alarma de retroceso, balizas, espejos, neumáticos, extintor, kit de derrames**: no encontré artículo; son práctica [B] (el matafuego sí figura en Dec. 351 art. 134 [A]).
- **ROPS/FOPS**: el Dec. 911 art. 274 exige la protección del operador contra caída de objetos y vuelco [A]; la sigla y la certificación son práctica [B].
- **Operador habilitado**: capacitado (Dec. 351 art. 134; Dec. 911 art. 265) [A]; la licencia/habilitación específica y su vigencia [C]. El cruce con la Task 20 queda para después.
- **Certificación de izaje** (peritaje anual de grúas): práctica habitual [B]; frecuencia normada [C].
- Seguro, RTO y patentes: Ley 24.449 arts. 34 y 40 si circula por vía pública; maquinaria especial según su categoría (art. 40.e) [A]; frecuencia de la RTO [C].

### 4.4 Vehículos livianos

- Para circular (Ley 24.449 art. 40) [A]: licencia, cédula, seguro vigente, placas legibles, **matafuego y balizas normalizados**. Control previo por el conductor (art. 39) [A]. Dispositivos mínimos de seguridad (art. 30): correajes, limpia y lavaparabrisas, retrovisores, bocina de sonoridad reglamentada, vidrios de seguridad, etc. [A]. RTO: obligación general (art. 34) [A], periodicidad [C].
- Neumáticos (profundidad mínima), apoyacabezas, gato y llave de rueda, botiquín, chaleco reflectivo, barra antivuelco: **no figuran en lo que leí**; son práctica o dependen de la RTO [B/C]. La profundidad mínima de 1,6 mm es lo que suele aplicarse [B]; **validar**.
- Inspección mensual: práctica [B].
- Lectura de odómetro en cada control: para la Task 18 [B].
- Monitoreo satelital: práctica empresarial [B]; sin integración (fuera de alcance de la fase).

### 4.5 Auditoría de seguridad en campo

- No hay norma que fije una lista; es una auditoría de comportamiento y de condiciones sobre un frente de trabajo [B]. Respaldo para los ítems que se auditan [A]: PTS y charla diaria (Res. SRT 61/2023); espacio confinado (Dec. 911 arts. 125 y 342); bloqueo de energías (Dec. 351 art. 109); altura (Res. 61/2023); izaje (Dec. 351 arts. 114–118; Dec. 911 arts. 265–268). ISO 45001 §9.1.1 pide evaluar la eficacia de los controles operacionales [A].
- **Meta mensual de auditorías por sede**: práctica de programa de HyS [B]; no hay mínimo normado.
- **Plan de izaje y rigger, ATS/AST como documento**: práctica [B]; el PTS sí está normado en altura de construcción [A].

### 4.6 Arneses y cabos de vida

- **Normado en Argentina [A]**: control diario de los elementos y sus anclajes, con las planillas del Anexo III de la Res. SRT 61/2023, en construcción; identificación y trazabilidad de las piezas, con registro de testeos e inspecciones periódicas (ítem 34); cabo doble cuando se cambia de anclaje (ítem 35); antitrauma desde 6 m; equipos "aptos y certificados".
- **No encontré [C]**: frecuencia de inspección periódica ni vida útil máxima en una norma argentina. La certificación de EPP (Res. SRT 299/2011 y normas IRAM) obliga a que el equipo sea certificado; las instrucciones del fabricante mandan.
- **Referencia extranjera [B]**: HSE (Reino Unido), INDG367: control antes de cada uso por el usuario; **inspección detallada por persona competente al menos cada 6 meses** (cada 3 en uso frecuente o ambientes severos), registrada; retirar de uso si no hay evidencia de inspección en los últimos 6 meses, si no se puede identificar, si hay duda sobre su seguridad; **un cabo que detuvo una caída no se reutiliza**; no existe una "vida útil" definida por el HSE, y recomienda consultar al fabricante. EN 365 cita "al menos cada 12 meses". Guías comerciales mencionan 5 años como regla general de reemplazo (fuente de baja confianza).
- Consecuencia para el diseño: el default de **6 meses** de `todo.md` coincide con la referencia del HSE; la **vida útil** debe ser un dato **por activo** (fecha de fin) con un default **configurable** por tenant, y debe prevalecer lo que diga el fabricante [B].
- Baja definitiva con evidencia de destrucción: práctica recomendada para impedir el reuso [B].

## 5. Anti-patrones

| Anti-patrón | Por qué es un problema | Cómo lo evita el diseño |
|---|---|---|
| **Inspección solo de papel**: todo "conforme" en un minuto, sin fotos | Es evidencia falsa; el auditor externo la detecta | Foto obligatoria en NC; hora de inicio y de cierre guardadas; reporte de "inspectores con 100 % conforme"; los ítems críticos no se marcan en bloque |
| **Checklist inmanejable** (60 o más ítems) | Se rellena sin mirar; se abandona | Tope de ítems por plantilla (aviso a los 25, bloqueo a los 40); control previo al uso corto (hasta 15 ítems; 20 con izaje) |
| **El mismo checklist para el operador y para SST** | Mezcla controles de naturaleza distinta | Dos plantillas por tipo de equipo: previo al uso (corto, operador) y mensual (SST) |
| **NC sin responsable ni fecha** | No se cierra nunca | Toda NC genera una `Action` con responsable y plazo |
| **Cada NC es un hallazgo** | Ruido: miles de hallazgos por un precinto faltante | Hallazgo solo si la plantilla lo pide o se escala a mano; una `Action` por inspección |
| **Alertas por todo** | Fatiga de alarma: nadie lee los avisos | Un `DueItem` por programa; resumen diario por sede; el control previo al uso no genera vencimientos |
| **Frecuencias imposibles de cumplir** | Todo vencido, siempre | Frecuencias configurables, con aviso si se pasa del máximo normado |
| **Plantilla editada con efecto retroactivo** | Cambia el resultado de inspecciones pasadas | Versiones inmutables; la inspección guarda su versión |
| **Registro de activos desactualizado** | Se inspecciona lo que se conoce y se ignora el resto | Reporte "activos sin inspección en el período"; alta rápida por CSV |
| **El sistema dice "fuera de servicio" pero el equipo sigue en campo** | El software no retira el equipo | La baja crea una acción "retirar y señalizar" con responsable |
| **Medir al inspector por cantidad de NC** | Incentiva ocultar NC | No se rankea a inspectores por NC |

## 6. Contraste con los defaults de `tasks/todo.md`

| Default | Qué dice la investigación |
|---|---|
| Extintor: control mensual (IRAM 3517-2) | IRAM: mínimo trimestral; mensual si las condiciones lo requieren; mensual por ley solo en obras (Dec. 911 art. 90). Se mantiene mensual como default de la plataforma, con piso trimestral configurable |
| Carga anual | IRAM: **mantenimiento** anual; recarga tras uso o cuando lo indique el control. Se renombra el vencimiento |
| PH cada 5 años | Correcto, salvo agua: 2 años; mangueras de CO₂ o con válvula de control: anual |
| "Res. SRT 84/12 u otras" para altura | La 84/12 es iluminación. Altura: Res. SRT 61/2023 (solo construcción) |
| Arnés: inspección cada 6 meses | Sin norma argentina verificada; coincide con HSE. Configurable |
| Arnés: vida útil del fabricante | Correcto; sin límite legal verificado |
| Izaje: inspección mensual de SST + certificación | Dec. 351 art. 116: diaria del operador + trimestral por especializado. La mensual no alcanza para grúas |
| Obrador semanal | Sin norma; práctica. El mensual de incendio sí es legal en obras |
| NC crítica crea hallazgo | Para extintores y arneses genera ruido; se hace configurable por plantilla |
| Pesados: operador habilitado | Normado como "capacitado/adiestrado"; la habilitación específica no verificada |

## 7. Fuentes

| # | Fuente | URL | Conf. | Para qué |
|---|---|---|---|---|
| 1 | Botta, *Control de extintores portátiles*, 4.ª ed. nov-2025 (Red Proteger). Transcribe IRAM 3517-2:2020 | https://www.redproteger.com.ar/wp-content/uploads/2025/10/27.4-Control-de-Extintores-Portatiles-4a-edicion-Noviembre-2025.pdf | Alta (secundaria) | Frecuencias, retiro, etiquetas, PH, vida útil |
| 2 | Decreto 351/79 (texto, alojado por el Ministerio de Agricultura) | https://www.magyp.gob.ar/sitio/areas/d_recursos_humanos/concurso/normativa/_archivos/000002_Decretos/000000_DECRETO%20351-1979%20De%20Higiene%20y%20Seguridad.pdf | Alta | Arts. 109, 114–118, 134, 183–187 |
| 3 | Decreto 351/79 Anexo VII (comentado) | https://www.ecofield.net/Legales/HyS/dec351-79_anexovii.html | Media | Potencial extintor, 1 cada 200 m² |
| 4 | Decreto 911/96 (texto oficial) | https://www.argentina.gob.ar/normativa/nacional/38568/texto | Alta | Arts. 90, 91, 125, 257–278, 342 |
| 5 | Res. SRT 61/2023 (Boletín Oficial) | https://www.boletinoficial.gob.ar/detalleAviso/primera/300086/20231206 | Alta | Resolución |
| 6 | Res. SRT 61/2023, Anexo I (nota: el archivo `res_srt_62-23.pdf` del mismo sitio contiene la Res. 61/2023) | https://www.argentina.gob.ar/sites/default/files/2023/12/res_srt_61-23_-_anexo_1.pdf | Alta | Altura: PTS, control diario, antitrauma, trazabilidad |
| 7 | Res. SRT 900/2015 (Boletín Oficial) y guía práctica | https://www.boletinoficial.gob.ar/detalleAviso/primera/124220/20150428 · https://argentina.gob.ar/sites/default/files/res_srt_900_15-guia-practica_0.pdf | Media (resumen) | Puesta a tierra, vigencia 12 meses |
| 8 | Res. SRT 84/2012 (iluminación) y 85/2012 (ruido) | https://www.argentina.gob.ar/normativa/nacional/193616/texto · https://www.argentina.gob.ar/normativa/nacional/193617/texto | Alta | Aclarar que no son de altura |
| 9 | Ley 24.449 (texto) | https://www.argentina.gob.ar/normativa/nacional/ley-24449-818/texto | Alta | Arts. 30, 34, 39, 40 |
| 10 | Decreto 779/95 y RTO (marco) | https://www.argentina.gob.ar/normativa/nacional/315423/texto | Baja | Solo el marco; periodicidad sin verificar |
| 11 | Res. SRT 299/2011 (EPP) | https://www.fio.unicen.edu.ar/extension/seh/images/pdf/cap19/res299-11.pdf | Media (resumen) | Certificación de EPP |
| 12 | HSE, *Inspecting fall arrest equipment made from webbing or rope* (INDG367) | https://www.hse.gov.uk/pubns/indg367.pdf | Alta como referencia extranjera | 6 meses, retiro, caída |
| 13 | ISO 45001:2018 (copia alojada por IHMM) | https://ihmm.org/wp-content/uploads/2023/05/ISO-45001-2018-PDF.pdf | Media (copia no oficial) | §8.1.1, §9.1.1, A.8.1.1 |
| 14 | Guía comercial sobre vencimiento de arneses (regla de 5 años) | https://syscom.mx/blog/asegure-su-seguridad-consideraciones-importantes-sobre-la-caducidad-de-un-arnes-de-proteccion | Baja (solo el resumen del buscador) | Contraste de vida útil |
| — | ISO 14001:2015 e ISO 9001:2015 | (no accesibles) | [C] | Estructura de la norma |
| — | Folleto de IRAM sobre mantenimiento de extintores | https://iramtest.iram.org.ar/wp-content/uploads/2020/09/folleto_extintores_mantenimiento.pdf | No se pudo abrir | — |

## 8. Pendiente de validar con un profesional de HyS

1. Frecuencias de inspección que se cargan por defecto (extintores, obrador, pesados, livianos, arneses) y los pisos normados por jurisdicción.
2. Criticidad de cada ítem de las plantillas (anexo del SPEC) y qué ítems llevan al estado "no apto".
3. Vida útil máxima de arneses y cabos, y qué se hace con un absorbedor activado, según el fabricante.
4. Periodicidad de RTO por tipo de vehículo y jurisdicción; profundidad mínima de neumáticos.
5. Frecuencia y alcance de la certificación de izaje; habilitación del operador de cada tipo de equipo.
6. Contenido del Anexo III de la Res. SRT 61/2023 (planillas de verificación) y su aplicabilidad fuera de la construcción.
7. Requisitos de registro de recargadores y de tarjetas de control de extintores en cada provincia o municipio.
8. Requisitos ambientales de residuos, derrames y sustancias para las plantillas del obrador (ISO 14001 §8.1).
