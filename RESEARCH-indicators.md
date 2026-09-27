# Investigación: objetivos e indicadores del SGI (ISO 9001 / 14001 / 45001)

**Estado:** Fase 1 — investigación (Task 11c)
**Fecha:** 2026-09-27
**Alcance:** objetivos del sistema (§6.2) y seguimiento, medición, análisis y evaluación mediante indicadores (§9.1), integrado para las tres normas.

---

## 0. Pregunta central

> ¿Estamos logrando lo que nos propusimos? ¿Cómo lo sabemos, y qué hacemos cuando no?

---

## A. Qué piden las normas

| Requisito (paráfrasis) | Implicación en producto | Fuente |
|---|---|---|
| §6.2.1: objetivos coherentes con la política, **medibles**, pertinentes, **con seguimiento**, comunicados y actualizados | Objetivo con meta medible y vínculo a indicadores | ISO 9001/14001/45001 §6.2.1; [David Barker — 6.2](https://davidbarker.consulting/iso9001/clause-6-2-quality-objectives-and-planning-to-achieve-them/) |
| §6.2.2: qué se va a hacer, recursos, **responsable**, **cuándo** se finaliza y **cómo se evalúan** los resultados | Plan del objetivo: responsable, fecha, acciones | Idem; [ISMS.online — 6.2](https://www.isms.online/iso-9001/clause-6-2-quality-objectives-and-planning-to-achieve-them/) |
| ISO 14001 y 45001 §6.2.2: **indicadores para el seguimiento del avance** | Cada objetivo tiene uno o más indicadores | [ISO 45001 6.2.2](https://www.iso-9001-checklist.co.uk/iso-45001/6.2.2-planning-actions-to-achieve-ohs-objectives.htm); [iso-docs — 45001 6.2.2](https://iso-docs.com/blogs/iso-45001-standard/iso-45001-clause-6-2-2-planning-to-achieve-oh-s-objectives) |
| §9.1.1: determinar **qué** medir, **métodos**, **cuándo** medir y **cuándo** analizar y evaluar | Indicador con fórmula/método, frecuencia y fecha de carga | ISO 9001/14001/45001 §9.1.1 |
| §9.1.3 (9001): analizar y evaluar datos; los resultados alimentan la revisión por la dirección | Tendencia y estado por período; exportable a revisión por la dirección (futuro) | ISO 9001 §9.1.3 |
| 9001:2026: 6.2 **sin requisitos nuevos**; refuerzo de objetivos medibles y alineados con la estrategia | Sin cambios de diseño por la edición 2026 | [Oxebridge — FDIS 9001:2026](https://www.oxebridge.com/emma/iso-fdis-90012026-full-review/); [NQA — cambios 2026](https://www.nqa.com/en-us/resources/videos/iso-9001-2026-understanding-the-emerging-changes) |
| 9001:2026: validación del software usado para seguimiento y medición | El cálculo del estado de un indicador debe ser determinista y testeado | Oxebridge (FDIS) — contrastar con texto oficial |

---

## B. Práctica

| Práctica | Fuente |
|---|---|
| Combinar indicadores **proactivos** (inspecciones realizadas, capacitaciones) y **reactivos** (accidentes, reclamos); no solo tasas de lesiones | [iso-9001-checklist — 45001 6.2](https://www.iso-9001-checklist.co.uk/iso-45001/6.2-ohs-objectives-and-planning-to-achieve-them.htm) |
| Elegir indicadores importantes, no los fáciles de cumplir | Idem |
| Definir dirección (mayor es mejor / menor es mejor) y una **banda de alerta** antes de la meta | Práctica habitual de tableros de gestión |
| Un desvío requiere **análisis** (por qué) y, si corresponde, acción: vínculo con NC/acción correctiva (§10.2) y con riesgos (§6.1) | ISO 9001 §9.1.3, §10.2 |

---

## C. Anti-patrones

| Anti-patrón | Por qué |
|---|---|
| Indicador sin meta ni responsable | No se puede evaluar ni actuar |
| Cargar valores sin fecha ni período | No hay tendencia comparable |
| Desvío marcado en rojo sin análisis | La norma pide analizar y evaluar, no solo medir |
| Crear un hallazgo automático por cada desvío | Ruido: muchos desvíos son puntuales; el análisis decide |
| Solo indicadores reactivos en SST | Llegan tarde (45001) |

---

## D. Modelo lógico

```text
OBJETIVO (norma/s, meta cualitativa, responsable, fecha, plan)
  └─ INDICADOR (fórmula, unidad, dirección, meta, banda de alerta, frecuencia, proactivo/reactivo)
       └─ MEDICIÓN por período (valor, cargado por, fecha)
            └─ estado: en meta · alerta · fuera de meta
                 └─ fuera de meta → ANÁLISIS obligatorio → opcional: Hallazgo / Explorar riesgo
```
