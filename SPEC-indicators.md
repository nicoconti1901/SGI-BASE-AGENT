# Spec: `indicators` — Objetivos e indicadores del SGI (Task 11c)

**Estado:** Aprobado (PO 2026-09-27)
**Fecha:** 2026-09-27
**Normas:** ISO 9001:2026 / 14001:2015 / 45001:2018 §6.2 y §9.1 (ver `RESEARCH-indicators.md`)
**Fuera de alcance:** importación CSV · API para n8n · fórmulas calculadas automáticamente desde otros módulos · revisión por la dirección (se alimenta después)

---

## Objective

Que cada empresa defina sus **objetivos** (calidad, ambiente, SST), los siga con **indicadores** medibles cargados por período, vea de un vistazo si van en camino y **analice cada desvío**, con un camino directo a Hallazgos o Riesgos cuando haga falta.

### Success criteria

- [ ] Objetivos con norma/s, descripción, responsable, fecha de cumplimiento y plan breve (§6.2.2).
- [ ] Cada objetivo tiene uno o más indicadores; un indicador pertenece a un objetivo.
- [ ] Indicador: fórmula/método, unidad, dirección, meta, banda de alerta, frecuencia, proactivo/reactivo, responsable de carga.
- [ ] Carga **manual por período**; un período no se carga dos veces (se corrige con registro).
- [ ] Estado calculado de forma determinista: **En meta · Alerta · Fuera de meta · Sin datos**.
- [ ] **Fuera de meta exige un análisis** escrito del desvío; desde ahí, un clic crea un Hallazgo o abre "Explorar una fuente" en Riesgos con el indicador como fuente.
- [ ] Vencimiento (`DueItem`) de la próxima carga de cada indicador; aviso si no se cargó.
- [ ] Tablero: objetivos con estado agregado y tendencia de cada indicador.
- [ ] Guía breve (cómo formular objetivos e indicadores; proactivos y reactivos).

---

## Decisiones del PO (2026-09-27)

1. **Objetivos con sus indicadores** (§6.2 y §9.1 juntos).
2. **Carga manual por período** (integraciones después).
3. Fuera de meta: **análisis obligatorio + ofrecer hallazgo o riesgo** (sin creación automática).
4. **Integrado 9001/14001/45001.**

## Supuestos (aprobados por PO 2026-09-27)

1. Frecuencias: mensual, trimestral, semestral, anual.
2. Dirección: **mayor es mejor** o **menor es mejor**. Banda de alerta opcional expresada como valor umbral (p. ej. meta ≥ 95 %, alerta < 97 %).
3. La carga de un período vence **10 días después del fin del período**.
4. Crean y editan objetivos e indicadores: **administrador y responsable de proceso**. Cargan valores: el **responsable del indicador**, el administrador o un responsable de proceso. Consulta: solo lectura.
5. Corregir un valor ya cargado deja registro (valor anterior, quién, motivo).
6. El estado del objetivo es el **peor** estado de sus indicadores con datos (Sin datos si ninguno tiene).
7. Un objetivo se cierra al llegar su fecha con resultado **cumplido / no cumplido** y comentario.

---

## Domain model (conceptual)

```text
Objective     (tenantId, code, title, description, standards[], ownerUserId,
               dueDate, plan, status: active|achieved|not_achieved|cancelled,
               closingNote?)
  └─ Indicator (tenantId, objectiveId, name, formula, unit, direction: higher|lower,
                target, alertThreshold?, frequency: monthly|quarterly|semiannual|annual,
                kind: leading|lagging, ownerUserId, active)
       └─ Measurement (tenantId, indicatorId, periodStart, periodKey "2026-09",
                       value, status(calculado), analysis?, findingId?, riskSourceUsed?,
                       recordedByUserId, recordedAt)
            └─ MeasurementCorrection (previousValue, newValue, reason, byUserId, at)
```

Reglas de estado de una medición (determinista, testeada):

| Dirección | En meta | Alerta | Fuera de meta |
|---|---|---|---|
| Mayor es mejor | valor ≥ umbral de alerta (o ≥ meta si no hay alerta) | meta ≤ valor < alerta | valor < meta |
| Menor es mejor | valor ≤ umbral de alerta (o ≤ meta si no hay alerta) | alerta < valor ≤ meta | valor > meta |

---

## UX

- **Tablero `/t/[slug]/indicators`:** eyebrow `ISO 9001 · 14001 · 45001 · §6.2 · §9.1`; objetivos agrupados por norma, cada uno con su estado y sus indicadores (último valor, meta, estado, mini tendencia de los últimos períodos, próxima carga). Métricas: objetivos en meta / en alerta / fuera de meta, cargas vencidas.
- **Ficha del objetivo:** plan, indicadores, cierre del objetivo.
- **Ficha del indicador:** definición, gráfico de tendencia con meta y alerta, tabla de mediciones, formulario "Cargar período" (propone el próximo período pendiente).
- **Desvío:** al guardar un valor fuera de meta se pide el análisis en el mismo formulario; luego aparecen "Crear hallazgo" y "Explorar riesgo".
- **Guía** `/indicators/guia`.
- Menú: ítem **Indicadores**.

---

## Integraciones

| Con | Cómo |
|---|---|
| Hallazgos | "Crear hallazgo" crea un borrador (tipo NC u oportunidad) con el desvío y el análisis; la medición guarda el vínculo |
| Riesgos | "Explorar riesgo" abre Explorar una fuente con tipo **Indicador** y el nombre del indicador precargados |
| Vencimientos | `DueItem` `indicator_measurement` por indicador activo, recalculado al cargar |
| Auditorías | (futuro) los indicadores sirven de evidencia de eficacia |

---

## Acceptance tests (ejemplos)

1. Indicador "mayor es mejor", meta 95, alerta 97: 98 → En meta; 96 → Alerta; 90 → Fuera de meta.
2. Guardar 90 sin análisis → error; con análisis → guardado y aparecen "Crear hallazgo" / "Explorar riesgo".
3. Cargar dos veces el mismo período → error; corregir deja registro.
4. Al cargar, el vencimiento pasa al período siguiente.
5. Estado del objetivo = peor estado de sus indicadores.
6. Consulta no ve formularios; un colaborador que no es responsable del indicador no puede cargar.
7. Aislamiento entre empresas.

---

## Plan vertical propuesto (Task 11c)

1. **11c.1** Dominio + Prisma + tests (estado, períodos, vencimientos, agregación).
2. **11c.2** Objetivos e indicadores: alta, edición, permisos, vencimientos.
3. **11c.3** Carga por período, correcciones, análisis de desvío, vínculo a Hallazgos y Riesgos.
4. **11c.4** Tablero con tendencias, guía, menú, e2e, README.

## Aprobación

Aprobado por PO el 2026-09-27.
