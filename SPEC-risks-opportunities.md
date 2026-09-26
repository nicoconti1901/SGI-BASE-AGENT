# Spec: `risks-opportunities` — Riesgos y oportunidades ISO 9001:2026

**Estado:** Aprobado (madurez MVP = **Nivel 2 Controlado** — PO 2026-09-26)  
**Fecha:** 2026-09-26  
**Norma baseline:** ISO 9001:2026 §6.1 (paráfrasis; ver `RESEARCH-risks-opportunities.md`)  
**Fuera de alcance:** ISO 45001 hazard/OH&S risk · ERM genérico · heat map como pantalla principal · FMEA obligatorio  

---

## Objective

Dar a cada tenant una capacidad operable para **determinar, analizar, evaluar, decidir, actuar, integrar, evaluar efectividad y revisar** riesgos y oportunidades del SGC — como objetos **semánticamente separados** — alineada a ISO 9001:2026 y usable por organizaciones pequeñas/medianas sin burocracia ERM.

Pregunta central:

> ¿Qué puede impedir o ayudar a que el SGC alcance sus resultados previstos, y qué haremos deliberadamente?

### Success criteria (Nivel 2)

- [ ] Riesgo y Oportunidad son entidades distintas (no `type=positive|negative`).
- [ ] Flujo de descubrimiento desde **fuente/contexto** (no solo “Agregar riesgo”).
- [ ] Canvas de riesgo (causa → evento → efecto + controles existentes) y canvas de oportunidad (hipótesis de beneficio).
- [ ] Evaluación con método configurable (cualitativo y/o P×I); assessments **versionados** (no sobrescribir historial).
- [ ] Decisión de respuesta / de persecución con racional y owner.
- [ ] Acciones con owner, due, evidencia y **efectividad ≠ completado**; DueItem + notificaciones.
- [ ] Revisión mínima: fecha programada + disparadores por evento (cambio, hallazgo, vencimiento).
- [ ] Enlace opcional a hallazgos/procesos/objetivos sin auto-conversión.
- [ ] Vista de trabajo: Discovery · Decisions · Execution · Learning (no matriz como home).

---

## ASSUMPTIONS (corregir ahora o se dan por válidas)

1. **Madurez MVP = Nivel 2 Controlado** (confirmado PO 2026-09-26).
2. Stack y multi-tenant iguales al resto de SGI Base (Next.js, Prisma, Better Auth).
3. **Acciones = modelo común** (confirmado PO 2026-09-26): owner usuario del tenant, due → DueItem, evidencia de archivo, efectividad ≠ completado. Una misma acción puede vincularse a **riesgo y/o oportunidad** (y opcionalmente a hallazgo) sin duplicarse. No hay silos `RiskAction` / `OpportunityAction`.
4. **Método default = cualitativo** (confirmado PO 2026-09-26): Bajo / Medio / Alto / Crítico; P×I = opción configurable del tenant; FMEA = fase posterior.
5. Un tenant puede estar en transición 2015→2026; la UI habla el lenguaje 2026 (riesgo y oportunidad separados).
6. ISO 45001 no se mezcla en este módulo.
7. **Entrada principal = Explorar fuente/contexto** (confirmado PO 2026-09-26): el usuario parte de una fuente (proceso, hallazgo, proveedor, cambio, etc.) y decide si nace riesgo, oportunidad, ambos o ninguno. El alta directa de riesgo/oportunidad queda como **atajo secundario**.

---

## Terminology (es)

| Término | Significado en producto |
|---|---|
| **Fuente** | Situación de contexto (proceso, parte interesada, hallazgo, cambio, indicador, proveedor, etc.) que se explora |
| **Riesgo** | Incertidumbre con efecto **no deseado** sobre resultados del SGC |
| **Oportunidad** | Circunstancia favorable / potencial de beneficio — **no** “riesgo positivo” |
| **Control existente** | Lo que ya se hace hoy |
| **Acción** | Lo que se planifica para responder o perseguir |
| **Evaluación / assessment** | Versión fechada del análisis (método + resultado + racional) |
| **Exposición actual** | Resultado de la última evaluación (terminología configurable; no forzar “inherente/residual”) |
| **Efectividad** | ¿La acción logró el efecto esperado? Distinto de “acción cerrada” |
| **Revisión** | Evento de reevaluación (por tiempo, evento o desempeño) |
| **Stale** | Ítem abierto cuya evaluación/acciones/revisión están obsoletas |

---

## Lifecycles (Nivel 2)

### Riesgo

```text
Identificado → Analizando → Evaluado → Respuesta planificada
    → Implementando → Revisión de efectividad → Monitoreado → Cerrado
```

**Cerrado** puede significar: ya no es relevante · absorbido · retenido bajo condiciones · transferido — siempre con racional histórico.

### Oportunidad

```text
Descubierta → Analizando → Evaluada → Decisión
    → Persiguiendo → Implementando → Revisión de beneficio → Realizada / Cerrada
```

Decisiones de oportunidad: perseguir ahora · más tarde · monitorear · investigar · **no perseguir** (con racional) · cerrar.

### Dimensiones visibles (no un solo color)

| Dimensión | Pregunta |
|---|---|
| Ciclo de vida | ¿Dónde estoy? |
| Evaluación / prioridad | ¿Qué tan significativo? |
| Salud de acciones | ¿Avanza la respuesta? |
| Efectividad | ¿Funcionó? |
| Salud de revisión | ¿La evaluación está vigente? |

---

## Actors

| Actor | Puede |
|---|---|
| Consulta | Ver riesgos/oportunidades del tenant |
| Colaborador / Resp. proceso | Descubrir, analizar, proponer acciones |
| Admin org | Configurar método/escalas básicas, cerrar/anular con permiso |
| Owner de acción | Ejecutar, adjuntar evidencia, declarar completado |
| Quien revisa efectividad | Registrar efectividad (puede ser owner o rol write) |

---

## Domain model (conceptual)

```text
SourceExploration (opcional, guiado)
  └── puede originar → Risk | Opportunity | ambos | ninguno

Risk
  ├── sourceRefs (proceso, hallazgo, proveedor, objetivo, …)
  ├── statement: cause → event → effect
  ├── existingControls[]
  ├── assessments[] (versionados)
  ├── responseDecision + rationale + owner
  ├── actionRefs[]  → Action (compartida)
  ├── reviews[]
  └── status + health signals (stale, overdue actions)

Opportunity
  ├── sourceRefs
  ├── hypothesis: condition → circumstance → benefit
  ├── analyses[] / assessments[] (criterios distintos: valor / factibilidad)
  ├── pursuitDecision + rationale
  ├── actionRefs[] → Action
  ├── benefitExpected / benefitObserved
  └── status + health signals

Action (compartida con operaciones)
  ├── ownerUserId, dueAt → DueItem
  ├── linked to Risk and/or Opportunity (y opcionalmente Finding)
  ├── evidence attachments
  ├── completion ≠ effectiveness
  └── effectivenessReview
```

---

## Assessment engine (Nivel 2)

- Métodos MVP: **Qualitative** (default), **Probability×Impact** (opción de tenant; escalas configurables).
- Cada assessment guarda: fecha, evaluador, método+versión, inputs, resultado, racional, evidencia.
- Nunca sobrescribir; nueva versión = nuevo registro.
- Portfolio: prioridad organizacional derivada **sin** fingir equivalencia FMEA↔5×5.

---

## Review engine (mínimo Nivel 2)

Disparadores:

- Tiempo (trimestral/semestral/anual/custom).
- Evento: cambio relevante, hallazgo vinculado, acción vencida, falla de efectividad.
- Señal de **stale** si evaluación antigua + sin revisión post-cambio.

---

## UX (Nivel 2)

### Workspace principal (4 capas)

1. **Discovery** — qué cambió / fuentes a explorar  
2. **Decisions** — qué falta evaluar o decidir  
3. **Execution** — acciones en curso / vencidas  
4. **Learning** — efectividad y revisiones  

### Flujos

1. Explorar fuente → ¿riesgo? ¿oportunidad? ¿ambos?  
2. Canvas → assessment → decisión → acciones  
3. Cerrar acción con evidencia → evaluar efectividad  
4. Sala de revisión guiada (keep / update / reassess / close / escalate)

### Anti-UX

Formulario de 40 campos · heat map home · oportunidad = riesgo verde · auto-crear Finding desde riesgo.

---

## Integraciones

| Sistema | Relación |
|---|---|
| Hallazgos | Link explícito fuente/evidencia; sin auto-conversión |
| DueItem / notificaciones | Acciones con vencimiento |
| Documentos controlados | No mezclar; evidencia operativa como adjuntos (patrón findings) |
| Indicadores / auditorías | Fase posterior (disparadores de review) |

---

## Out of scope (post Nivel 2)

- FMEA nativo · multi-sede avanzada · portfolio normalizado avanzado · AI decisión · mapa de procesos interactivo completo · 45001 · ROI financiero obligatorio.

---

## Acceptance tests (ejemplos)

1. Crear riesgo desde “proveedor único” con causa→evento→efecto; assessment v1; plan de acción; DueItem.  
2. Misma fuente genera oportunidad “segundo proveedor”; decisión “perseguir” o “no perseguir” con racional.  
3. Completar acción ≠ marca efectividad; sin efectividad el ítem no “aprendió”.  
4. Assessment v2 no borra v1.  
5. Viewer no publica/cierra.  
6. No existe un único modelo `RiskOpportunity` con dirección +/-.

---

## Technical notes

- Spec de investigación: `RESEARCH-risks-opportunities.md`  
- Dominio previsto: `src/domain/risks/`, `src/domain/opportunities/`, acciones compartidas  
- Implementación solo tras **aprobación** de esta SPEC  

---

## Aprobación

- [x] Madurez Nivel 2 (PO)  
- [x] Acciones compartidas DueItem/evidencia/efectividad; vínculo N:M a riesgo/oportunidad (PO)  
- [x] Entrada principal “Explorar contexto”; alta directa = atajo (PO)  
- [x] Método default cualitativo + P×I opcional (PO)  
- [x] SPEC aprobado para `/plan` + implementación (PO 2026-09-26)  

