# Investigación: Riesgos y oportunidades ISO 9001 (SGI Base)

**Estado:** Fase 1 — investigación normativa y de práctica (sin modelo de datos ni UI)  
**Fecha:** 2026-09-26  
**Alcance:** ISO 9001 (calidad). ISO 45001 (OH&S) queda fuera; solo se reutilizan abstracciones técnicas compartidas (acciones, evidencia, due, effectiveness).  
**Skill:** `riegos-oportunidades` / ISO 9001 risk-opportunity management  

---

## 0. Pregunta central

> ¿Qué puede impedir o ayudar a que el SGC alcance sus resultados previstos, y qué debe hacer la organización deliberadamente al respecto?

El producto no es “una matriz de riesgos”. Es un ciclo de **determinar → analizar → evaluar → decidir → actuar → integrar → medir efectividad → revisar → aprender**.

---

## A. Edición vigente

| Hecho | Clasificación | Fuente |
|---|---|---|
| **ISO 9001:2026** publicada el **16 de septiembre de 2026** (6.ª edición); reemplaza ISO 9001:2015 + Amendment 1:2024 | OFFICIAL GUIDANCE / NATIONAL AB | [UKAS Technical Bulletin](https://www.ukas.com/resources/technical-bulletins/qms-iso-9001-2026-transition/); [NSF](https://www.nsf.org/knowledge-library/iso-90012026-published-on-september-16-2026-what-quality-leaders-need-to-know); página ISO 9001:2026 (landing) |
| Transición típica ~3 años; hitos de acreditación/certificación hacia **30 Sep 2029** (sin nuevas certificaciones acreditadas a 2015 desde ~31 Mar 2028 según Global ACI / UKAS) | OFFICIAL GUIDANCE | UKAS bulletin; resúmenes de transición |
| AS/NZS ISO 9001:2026 adoptada idéntica (Sep 2026) | NATIONAL STANDARDS BODY | Reportes de transición AU/NZ |
| **ISO 9001:2015** queda como material histórico / transición | OFFICIAL GUIDANCE | UKAS |

**Baseline de diseño para SGI Base:** ISO 9001:**2026**.  
Soportar tenants en transición desde 2015, pero **no** diseñar el módulo como si 2015 fuera la norma vigente.

**Incertidumbre documentada:** no se dispone aquí del texto licenciado de ISO 9001:2026. Las afirmaciones de subcláusulas se basan en fuentes Tier 2–3 y deben **contrastarse con el estándar oficial** antes de codificar gates “normativos” duros.

---

## B. Interpretación de 6.1 (síntesis)

### Estructura (consenso amplio Tier 2–3)

| Subcláusula | Intención (paráfrasis) | Clasificación |
|---|---|---|
| **6.1.1** | Determinar riesgos y oportunidades a abordar (contexto, resultados del SGC, efectos deseables/indeseables, mejora) | CERTIFICATION-BODY / CONSULTING GUIDANCE (alineado a landing ISO: “mayor claridad riesgos y oportunidades”) |
| **6.1.2** | Acciones sobre **riesgos** (efectos no deseados): determinar / analizar y evaluar / planificar acciones / integrar / evaluar efectividad; acciones **proporcionadas** al impacto | Idem |
| **6.1.3** | Acciones sobre **oportunidades** (ciclo propio, separado de riesgos) | Idem |

### Separación Riesgo ≠ Oportunidad

- En 2015, “risks and opportunities” viajaban juntos → en la práctica, columna de oportunidades débil.  
- En 2026, la separación estructural obliga a **criterios y evidencia distintos**.  
- **9.1.3** y **9.3.2** (según guías CB) piden analizar/revisar efectividad de acciones de riesgos y de oportunidades **por separado**.

**Implicación de producto (no es “ISO exige dos Excel”):**

- Objetos de dominio **Risk** y **Opportunity** separados.  
- Criterios de evaluación distintos (p. ej. probabilidad×impacto vs valor/factibilidad/beneficio).  
- Un solo workbook con dos hojas puede bastar operativamente; un CRUD con `type=positive|negative` **no**.

Fuentes: NQA (slides transición), Ideagen, EAS, ASC Food Safety, eLeaP, GovernanceDocs.

### Qué **no** exige ISO (anti-patrones)

| No es requisito normativo (según APG 2015 + guías 2026) | Clasificación |
|---|---|
| Matriz 5×5 obligatoria | OFFICIAL GUIDANCE (APG) + CB |
| FMEA / RPN obligatorio | OFFICIAL GUIDANCE / ACADEMIC (método organizacional) |
| Documento llamado “Risk Matrix” | OFFICIAL GUIDANCE |
| Método formal documentado siempre (Annex A 2026, según Ideagen: no implica enfoque formal/documentado obligatorio) | CERTIFICATION-BODY GUIDANCE — **verificar en Annex A oficial** |
| Que Oportunidad = “riesgo positivo” | Consenso de interpretación 2026 |

APG (ISO/IAF, 2015, *Risk Based Thinking*): el auditor no audita “el registro” como actividad aislada; busca evidencia de pensamiento basado en riesgo a lo largo del SGC. La organización determina la extensión de la información documentada.

---

## C. Ledger de fuentes (resumen)

| Source | Country | Type | Edition | Relevant | Use |
|---|---|---|---|---|---|
| UKAS Technical Bulletin QMS ISO 9001:2026 | UK | Accreditation body | 2026-09-16 | Transición; cambios significativos incluyen R&O | Confirmar vigencia y transición |
| ISO landing 9001:2026 | INT | ISO marketing/authority page | 2026 | Claridad R&O; Annex A; liderazgo/cultura | Baseline de producto |
| NQA webinar slides / video | UK | Certification body | 2026 | 6.1.1 / 6.1.2 / 6.1.3 | Estructura de cláusulas |
| Ideagen blog | UK | Software/CB-adjacent | 2026 | Separación R&O; 9.1.3 / 9.3.2; Annex A | Interpretación práctica |
| EAS / ASC Food Safety | US/INT | Certification/consulting | 2026 | Separación; ciclo oportunidad | Diseño de lifecycle |
| eLeaP | US | Software guidance | 2026 | Criterios distintos; no exige 2 archivos físicos | UX/registro |
| ISO APG Risk Based Thinking PDF | INT | ISO/IAF APG | 2015 | Evidencia; no método único | Anti-patrones de auditoría |
| PT XYZ / DIJEFA | ID | Academic case | 2015 era | FMEA operacionaliza RBT | COMPANY/ACADEMIC practice |
| Production (Brazil) risk model paper | BR | Academic | 2021 | Niveles estratégico/operativo; FMEA/matriz opcionales | COMPANY/ACADEMIC practice |

---

## D. Modelo lógico de gestión (previo al dominio físico)

### Flujo común (obligatorio conceptualmente)

```text
CONTEXTO / FUENTE
    → DETERMINACIÓN (¿riesgo? ¿oportunidad? ¿ambos? ¿ninguno?)
        → ANÁLISIS
            → EVALUACIÓN / DECISIÓN
                → PLAN DE ACCIÓN (si aplica)
                    → INTEGRACIÓN EN PROCESOS DEL SGC
                        → IMPLEMENTACIÓN
                            → EFECTIVIDAD (≠ “acción completada”)
                                → REVISIÓN (tiempo / evento / desempeño)
                                    → APRENDIZAJE / REEVALUACIÓN
```

### Riesgo — semántica

- Incertidumbre con **efecto no deseado** sobre resultados del SGC.  
- Captura útil: **causa → evento/incertidumbre → efecto** + controles existentes ≠ acciones planificadas.  
- Decisiones de respuesta tipicas (vocabulario configurable): evitar, reducir, compartir/transferir, aceptar con decisión informada, etc.  
- **Acción completada ≠ acción efectiva ≠ riesgo cerrado.**

### Oportunidad — semántica (canvas distinto)

- Circunstancia favorable / potencial beneficio — **no** “riesgo en verde”.  
- Hipótesis: condición actual → circunstancia favorable → beneficio potencial.  
- Decisiones: perseguir ahora / más tarde / monitorear / investigar / no perseguir / cerrar — **preservar racional del “no perseguir”**.  
- Beneficio esperado vs observado.

### Fuente ≠ ítem

Una misma fuente (proveedor único, hallazgo, cambio, contexto) puede generar:

- un riesgo,  
- una oportunidad,  
- ambos,  
- o ninguno (solo información).

### Acciones

Reutilizar el modelo de **acciones/medidas** del producto (owners, due, evidencia, efectividad) — no un universo paralelo `RiskAction` aislado. Un acción puede servir a varios contextos justificados.

### Relación con Hallazgos

- Hallazgo ≠ Riesgo.  
- Enlace explícito permitido; **sin** conversión automática.

### ISO 45001

- Hazard / riesgo OH&S = dominio separado.  
- Compartido: Action, Evidence, Owner, Due, Effectiveness, Review, Process, Site.

---

## E. Patrones de benchmark (práctica, no norma)

| Patrón observado | Origen tipificado | Uso en producto |
|---|---|---|
| FMEA en planta manufacturera para RBT | PT XYZ (académico ID); papers BR/EU SME | Método **opcional** tenant, no default obligatorio |
| Identificación desde procesos + SWOT/PESTLE | Guías CB / papers | Flujo “Explorar contexto” |
| Dependencia de proveedor único | Casos industria / guías | Escenario canónico de UX test |
| Oportunidad débil en registros 2015 | Consenso CB 2026 | Motivo de objetos separados |
| Evidencia en actas, objetivos, instrucciones — no solo Excel | APG | Outputs de registro, no la app = matriz |

---

## F. Comparación método

| Método | ¿ISO lo exige? | Uso recomendado |
|---|---|---|
| Cualitativo (Bajo/Medio/Alto) | No | PyMEs / madurez baja |
| Probabilidad × impacto | No | Operativo general |
| FMEA (S/O/D) | No (sí en IATF/sector) | Procesos repetitivos manufactura |
| Escenarios | No | Estratégico / baja cuantificación |
| Método custom tenant | No | Con criterios versionados + historial |

**Nunca** normalizar FMEA RPN con score 5×5 como si fueran la misma magnitud.

---

## G. Implicaciones para SGI Base (sin implementar aún)

1. **Dos agregados de dominio:** `Risk` y `Opportunity`.  
2. **Motor de evaluación agnóstico** + versionado de assessments.  
3. **Workspace:** Discovery → Decisions → Execution → Learning (no heat map como home).  
4. **Revisiones** por tiempo, evento y desempeño — no solo “próxima fecha anual”.  
5. **Efectividad** explícita y separada de cierre de acción (alineable a hallazgos/medidas).  
6. **Madurez progresiva** (simple → integrado) sin forzar ERM corporativo.  
7. **IA** solo como asistente (candidatos, duplicados, resúmenes) — nunca decide materialidad.

### Anti-patrones a rechazar en el diseño

CRUD genérico · un solo tipo positive/negative · auto-crear Finding desde riesgo alto · auto-crear Risk desde todo Finding · FMEA/5×5 obligatorio · Close = action done · Review = editar fecha · dashboard de 25 KPIs · mezclar 9001 con 45001.

---

## H. Quality gate de investigación

| Pregunta | Respuesta |
|---|---|
| ¿Edición actual confirmada? | Sí — ISO 9001:2026 (16 Sep 2026), vía UKAS/NSF/ISO landing |
| ¿Texto normativo literal citado? | No — solo paráfrasis; requiere contraste con estándar licenciado |
| ¿Métodos (FMEA/matriz) tratados como obligatorios? | No |
| ¿Riesgo y Oportunidad separados? | Sí (requisito de diseño alineado a 2026) |
| ¿45001 mezclado? | No |

---

## Decisión de producto (2026-09-26)

**Madurez MVP = Nivel 2 — Controlado** (confirmado por product owner).

Incluye: discovery desde fuente/proceso, canvas riesgo y oportunidad separados, evaluación cualitativa y/o P×I, assessments versionados, decisión + acciones con evidencia/efectividad, revisión básica por tiempo/evento.

Excluye del primer corte: heat map como home, FMEA obligatorio, multi-sede avanzada, portfolio ERM, AI que decide.

Borrador de SPEC: `SPEC-risks-opportunities.md`.
