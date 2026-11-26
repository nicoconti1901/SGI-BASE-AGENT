# SGI Base — Informe técnico de la plataforma

**Fecha:** 25 de noviembre de 2026 · **Versión relevada:** rama principal, commit `94545e3`
**Finalidad:** describir alcance, tamaño, complejidad y madurez de la plataforma para estimar su valor de mercado actual. No contiene precios.

Los datos marcados **[medido]** salen del código fuente; los marcados **[estimado]** son juicio técnico y deben tratarse como rangos.

---

## 1. Resumen

SGI Base es una plataforma web SaaS multiempresa para operar un Sistema de Gestión Integrado (calidad, ambiente, seguridad y salud en el trabajo y, opcionalmente, seguridad vial) según **ISO 9001, ISO 14001, ISO 45001 e ISO 39001**. Reemplaza planillas, carpetas compartidas y recordatorios manuales.

| Dimensión | Valor |
|---|---|
| Tipo de producto | SaaS B2B vertical: QMS + EHS (calidad, ambiente, SST) |
| Mercado de diseño | Argentina (CUIT, criterios SRT, normas IRAM), interfaz en español |
| Módulos funcionales | 14, activables por empresa salvo Usuarios |
| Requisitos ISO precargados | 194 (9001: 72 · 14001: 38 · 45001: 49 · 39001: 35) **[medido]** |
| Modelo de datos | 101 tablas, 95 enumeraciones, 202 índices y claves únicas, 38 migraciones **[medido]** |
| Interfaz | 104 pantallas **[medido]** |
| Código de aplicación | ≈ 67.000 líneas no vacías **[medido]** |
| Pruebas automatizadas | 1.475 unitarias y de integración + 50 de punta a punta; ≈ 21.000 líneas **[medido]** |
| Madurez | Funcionalmente completa en su alcance; requiere puesta en producción (sección 8) |
| Esfuerzo de reposición | 7.900 a 11.500 horas **[estimado]** |

---

## 2. Alcance funcional

Tamaño = líneas no vacías de código propias del módulo, aproximadas, sin pruebas **[medido]**. Complejidad = juicio técnico.

| Módulo | Cláusulas | Qué resuelve | Pantallas | Tamaño | Complejidad |
|---|---|---|---|---|---|
| **Documentos y brechas** | §7.5 | Documentos versionados con archivo; evaluación de brechas por requisito ISO | 4 | 1.900 | Media |
| **Auditorías** | §9.2 | Programa anual, plan, equipo e imparcialidad, lista de verificación desde el catálogo, evidencia, informe, cobertura por norma. Auditorías externas con extracción de hallazgos del PDF por IA y revisión humana | 5 | 4.300 | Alta |
| **Hallazgos y acciones** | §10.2 | No conformidades, observaciones, incidentes y mejoras; 5 Porqués, factores causales, medidas con evidencia obligatoria, verificación de eficacia, historial. Es el núcleo al que se conectan los demás módulos | 4 | 5.900 | Muy alta |
| **Riesgos y oportunidades** | §6.1 | Ciclos separados, evaluación cualitativa o P×I versionada, decisión, acciones, eficacia | 8 | 4.200 | Alta |
| **Objetivos e indicadores** | §6.2, §9.1 | Objetivos con plan, mediciones por período, correcciones trazables, desvíos y tendencias | 5 | 3.200 | Media-alta |
| **Inspecciones y activos** | 45001 §8.1, §9.1.1 | Motor de plantillas versionadas con ítems condicionales; 13 plantillas listas (extintores, arneses, vehículos, equipos pesados, izaje, obradores, simulacros y otras); estado del activo y consecuencias automáticas; pensado para celular | 11 | 8.700 | Muy alta |
| **Equipos de medición** | 9001 §7.1.5 | Calibraciones por puntos y canales, incertidumbre, regla de decisión con banda de guarda, evaluación de impacto, bloqueo de uso | 7 | 4.900 | Muy alta |
| **Accidentabilidad** | 45001 §9.1.1, §10.2 | Ficha de accidente, horas trabajadas, índices de frecuencia, gravedad, incidencia y duración (mes, año, 12 meses móviles), registro de acceso a datos de salud | 7 | 5.400 | Muy alta |
| **Seguridad vial** | 39001 §8.1, §9.1, §10.1 | Hechos viales, km por vehículo y odómetro, tasas por millón de km, conductores habilitados | 5 | 3.200 | Alta |
| **Datos maestros** | — | Sedes, personas (propias y contratistas), puestos, tareas; importación con vista previa | 8 | 2.300 | Media |
| **Capacitaciones** | §7.2, §7.3 | Matriz por puesto, tarea o todo el personal; sesiones, vencimientos, eficacia, plan anual, habilitación para tareas críticas; 22 cursos sugeridos | 15 | 7.400 | Muy alta |
| **Proveedores** | 9001 §8.4 | Evaluación ponderada con criterios excluyentes y plantillas versionadas, reevaluación, documentación vencible, lista de aprobados | 9 | 6.700 | Alta |
| **Automatizaciones** | — | Motor de vencimientos sin duplicados, resumen diario por persona, notificaciones en la aplicación | 4 | 1.300 | Media |
| **Usuarios y plataforma** | — | Alta de empresas con plantilla por tamaño y actividad, activación de módulos, roles, panel de administración | 9 | 2.800 | Media-alta |

El tamaño por módulo es orientativo: hay código compartido que se repite o queda fuera, y no suma el total.

### Funciones transversales

- Tablero de empresa con áreas y próximos vencimientos; tableros por módulo.
- Trazabilidad entre módulos: una inspección, auditoría, accidente, calibración o evaluación puede generar hallazgos y acciones vinculadas.
- 7 exportaciones de datos, importadores CSV (personal, activos, capacitaciones, horas trabajadas, proveedores) e informes imprimibles.
- Guías de uso integradas en los módulos principales.
- Versionado e historial: cambiar plantillas, criterios o vigencias no altera los registros pasados.

---

## 3. Elementos diferenciales

1. **Integración en un solo flujo.** Hallazgos, acciones y vencimientos son únicos para cuatro normas y todos los módulos.
2. **Resultados calculados.** Índices, puntajes, aptitudes y estados salen de reglas de negocio probadas.
3. **Profundidad técnica en SST y metrología**, con investigación normativa documentada: 10 informes de investigación y 14 especificaciones.
4. **Adaptación local** a criterios y documentación argentinos.
5. **Dos caminos de implantación:** conservar un SGI existente o arrancar desde una base esencial según tamaño y actividad.
6. **Modularidad comercial:** módulos activables por empresa sin pérdida de datos.
7. **Metodología de incorporación de clientes:** procedimiento interno para evaluar, recodificar y recrear documentación y armar el Manual del SGI.

---

## 4. Arquitectura y tecnología

| Capa | Tecnología |
|---|---|
| Aplicación | Next.js 16, React 19, TypeScript; aplicación única con renderizado en servidor |
| Interfaz | Tailwind CSS 4, sistema de diseño propio, temas claro y oscuro, adaptable a celular |
| Datos | PostgreSQL 16 + Prisma 6 |
| Autenticación | Better Auth (correo y contraseña) |
| Archivos | Almacenamiento compatible con S3 |
| Automatización | n8n como disparador diario, con punto de acceso autenticado y repetible sin duplicar |
| Inteligencia artificial | API de Claude, opcional, solo para extraer hallazgos de informes de auditoría externa |
| Pruebas | Vitest y Playwright |
| Organización | Capas separadas: reglas de dominio (23 áreas), persistencia e interfaz |

La aplicación tiene pocas dependencias externas (7 librerías de ejecución), todas de uso extendido.

---

## 5. Seguridad y control de acceso

- **Aislamiento multiempresa** con denegación por defecto y pruebas específicas.
- **5 roles:** administrador de plataforma, administrador de organización, responsable de proceso, colaborador y consulta; 25 permisos diferenciados.
- **Descarga de adjuntos** mediante rutas controladas por el servidor.
- **Trazabilidad** de cambios, retiro de adjuntos y acceso a fichas de salud.
- **Datos personales:** trata datos de personas, accidentes y conductores. Hoy se conserva todo; no hay función de borrado ni anonimización.

---

## 6. Calidad verificada

| Control | Resultado al 25/11/2026 |
|---|---|
| Verificación de tipos | Sin errores |
| Pruebas unitarias | 980 de 980 aprobadas |
| Pruebas de integración | No ejecutadas para este informe (requieren base de datos activa) |
| Pruebas de punta a punta | Última ejecución en la rama principal aprobada (24/11/2026); las dos anteriores habían fallado |
| Integración continua | Ejecuta las pruebas de punta a punta; no incluye unitarias, integración ni análisis de estilo |
| Revisión funcional | 5 módulos con acta de aprobación interna (accidentabilidad, vial, inspecciones, capacitaciones, proveedores) |
| Auditoría externa de seguridad o de carga | No realizada |

---

## 7. Esfuerzo de reposición [estimado]

Horas para reconstruir lo existente con un equipo profesional convencional: análisis, diseño, desarrollo y pruebas.

| Componente | Mínimo (h) | Máximo (h) |
|---|---:|---:|
| Base multiempresa, accesos, plataforma, sistema de diseño | 700 | 1.000 |
| Catálogo ISO, brechas y documentos | 350 | 500 |
| Hallazgos y acciones | 500 | 700 |
| Riesgos y oportunidades | 450 | 650 |
| Auditorías internas y externas | 450 | 650 |
| Objetivos e indicadores | 300 | 450 |
| Inspecciones y activos | 900 | 1.300 |
| Equipos de medición | 500 | 750 |
| Accidentabilidad | 550 | 800 |
| Seguridad vial | 350 | 500 |
| Datos maestros | 250 | 350 |
| Capacitaciones | 750 | 1.100 |
| Proveedores | 650 | 950 |
| Automatizaciones | 200 | 300 |
| Calidad transversal: punta a punta, integración continua, datos de demostración | 400 | 600 |
| Producto, investigación normativa y especificaciones | 600 | 900 |
| **Total** | **7.900** | **11.500** |

Equivale a unos 49 a 72 meses-persona (160 h por mes). Como referencia superior, COCOMO básico (modo orgánico) sobre 67.000 líneas da unos 198 meses-persona; suele sobrestimar proyectos con marcos de desarrollo modernos.

**Reparto sugerido por perfil:** desarrollo full stack 60 % · especialista ISO/SST y análisis funcional 15 % · pruebas 10 % · diseño de interfaz 8 % · arquitectura y dirección técnica 7 %.

---

## 8. Pendientes y factores que reducen el valor

| Pendiente | Impacto | Horas [estimado] |
|---|---|---:|
| Envío real de correo (hoy simulado; las notificaciones quedan dentro de la aplicación) | Alto | 20–40 |
| Recuperación de contraseña y verificación de correo | Alto | 20–40 |
| Puesta en producción: alojamiento, dominio, copias de respaldo, monitoreo y alertas | Alto | 60–100 |
| Refuerzo de seguridad: segundo factor, restricción del registro público, cabeceras, prueba de penetración | Alto | 80–140 |
| Integración continua completa | Medio | 10–20 |
| Prueba de carga con datos reales | Medio | 30–50 |
| Retención, borrado y anonimización de datos personales, con revisión legal | Alto | 60–100 |
| Facturación y gestión de suscripciones | Medio | 60–120 |
| Checkpoint final de aceptación integral | Medio | 30–50 |
| **Total** | | **370–660** |

Fuera del alcance actual: registros de ensayo de obra (solicitado, sin especificar), aplicación móvil nativa, uso sin conexión, inicio de sesión único corporativo, API pública, firma digital, otros idiomas e integración con ERP.

Otros factores: el código no registra clientes en producción, por lo que no se valoran ingresos recurrentes ni base instalada; el conocimiento depende del equipo actual, mitigado por la documentación y las pruebas.

---

## 9. Variables para presupuestar

### 9.1 Infraestructura recurrente
Aplicación administrada con Node.js, PostgreSQL con respaldos, almacenamiento de archivos (adjuntos de hasta 15 MB), correo transaccional, n8n, monitoreo y dominio. El consumo de IA es opcional y por uso.

### 9.2 Implantación por cliente [estimado]

| Tarea | Pequeño (hasta 30 personas, 1 sede) | Mediano (30–150, 2–4 sedes) | Grande (más de 150, 5+ sedes) |
|---|---:|---:|---:|
| Relevamiento y análisis de brechas | 12–20 h | 25–45 h | 50–90 h |
| Adecuación documental y Manual del SGI | 20–40 h | 50–90 h | 100–180 h |
| Configuración y carga inicial | 10–16 h | 20–40 h | 45–80 h |
| Capacitación de usuarios | 6–10 h | 12–20 h | 24–40 h |
| Acompañamiento inicial | 8–12 h | 15–30 h | 30–60 h |
| **Total** | **56–98 h** | **122–225 h** | **249–450 h** |

### 9.3 Qué define el precio a un cliente
- Cantidad de normas, sedes, usuarios con acceso y personas en nómina (propias y contratistas).
- Módulos activos; los de mayor valor técnico son inspecciones, equipos de medición, accidentabilidad, capacitaciones y proveedores.
- Estado de su documentación y volumen a migrar.
- Nivel de soporte y personalizaciones.

### 9.4 Modalidades comerciales posibles

| Modalidad | Qué se valora | Base de este informe |
|---|---|---|
| Suscripción mensual o anual | Uso por empresa, módulos y usuarios | Secciones 2 y 9.3 |
| Implantación (pago único) | Servicio profesional por horas | Sección 9.2 |
| Licencia perpetua o instalación dedicada | Derecho de uso, instalación y mantenimiento anual | Secciones 2, 4 y 9.1 |
| Venta total del producto | Costo de reposición, menos pendientes, ajustado por mercado | Secciones 7 y 8 |

---

## 10. Guía para la búsqueda de precios

**Categorías comparables:** software QMS, software EHS/SST, gestión de auditorías, inspecciones digitales, gestión de calibraciones, matriz de capacitación, homologación de proveedores.

**Productos para consultar** (nombres de referencia; no se relevaron funciones ni tarifas): ISOTools, Isolución, Kawak, Loyal Solutions, SoftExpert, SafetyCulture, Ideagen, Intelex, ETQ Reliance, Qualio.

**Términos de búsqueda:** «software SGI ISO 9001 14001 45001 precio Argentina», «software gestión SST precio por usuario», «QMS software pricing per user», «EHS software pricing SMB», «tarifa hora desarrollador full stack Argentina 2026», «honorarios consultor ISO implementación Argentina 2026», «honorarios profesionales higiene y seguridad 2026».

**Cuidados al comparar:**
1. Comparar contra la suma de módulos equivalentes, porque muchos competidores los venden por separado.
2. Separar suscripción, implantación y consultoría.
3. Tomar valores de la misma fecha y moneda; distinguir precios locales e internacionales y si incluyen impuestos.
4. No confundir costo de reposición con precio de venta: sin clientes en producción, el mercado suele reconocer solo una parte.

**Consulta lista para usar junto con este informe:**

> Con base en el informe técnico adjunto, estimá a valores actuales de Argentina, en pesos y en dólares: (a) valor de reposición del software según horas y perfiles de la sección 7; (b) valor de venta total del producto, descontando los pendientes de la sección 8 y considerando que no hay clientes en producción acreditados; (c) suscripción mensual para un cliente pequeño, mediano y grande; (d) precio de implantación según la sección 9.2. Citá fuentes con fecha para tarifas horarias y precios de competidores, indicá tipo de cambio, impuestos y supuestos, y entregá un rango mínimo, probable y máximo.

---

## Anexo — Cómo se midió

- **Código de aplicación:** líneas no vacías en TypeScript, TSX y CSS de `src/app`, `src/components`, `src/domain` y `src/lib` (33.477 + 2.848 + 13.604 + 17.031 = 66.960). Incluye textos de interfaz y contenido normativo cargado en código.
- **Pruebas:** 17.988 líneas de unitarias e integración y 3.075 de punta a punta; casos contados por Vitest y Playwright.
- **Base de datos:** modelos, enumeraciones e índices declarados en el esquema Prisma; migraciones versionadas.
- **Horas y complejidad:** estimación por componentes, sin registro de horas reales. Conviene contrastarlas con un segundo estimador.
