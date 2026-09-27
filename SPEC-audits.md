# Spec: `audits` — Auditorías internas del SGI (9001 / 14001 / 45001)

**Estado:** Aprobado (PO 2026-09-27)
**Fecha:** 2026-09-27
**Normas:** ISO 9001:2026, ISO 14001:2015, ISO 45001:2018 §9.2 · guía ISO 19011:2026 (ver `RESEARCH-audits.md`)
**Fuera de alcance:** auditorías a proveedores (2.ª parte) · seguimiento de auditorías de certificación (3.ª parte) · registro de competencias/formación de auditores · muestreo estadístico · indicadores (Task 11c)

---

## Objective

Que cada empresa pueda **planificar, ejecutar, informar y cerrar** sus auditorías internas integradas, con evidencia por requisito, y que los hallazgos entren directamente al circuito de **Hallazgos** existente.

Pregunta central:

> ¿El SGI cumple y logra sus resultados? ¿Con qué evidencia, y qué hay que corregir?

### Success criteria

- [ ] **Programa anual** por empresa con auditorías planificadas y justificación de frecuencia (importancia, cambios, resultados previos).
- [ ] Cada auditoría tiene **objetivo, alcance y criterios** obligatorios antes de iniciarse (9001:2026 §9.2.2).
- [ ] Una auditoría puede cubrir **una o varias normas** (9001, 14001, 45001).
- [ ] **Lista de verificación** generada desde los requisitos del catálogo de la empresa + preguntas propias; resultado y evidencia por ítem.
- [ ] Hallazgos clasificados (NC mayor, NC menor, observación, oportunidad de mejora) que **crean un Hallazgo** vinculado a la auditoría.
- [ ] **Imparcialidad:** un auditor no puede ser auditado en la misma auditoría, salvo excepción justificada.
- [ ] **Informe** con conclusión respecto del objetivo, fortalezas y hallazgos; la auditoría se cierra solo con informe emitido.
- [ ] **Cobertura** del programa: qué requisitos/cláusulas se auditaron en el año, por norma.
- [ ] Vencimientos (`DueItem`) para inicio de auditoría e informe pendiente.
- [ ] Guía breve integrada (como en riesgos) para auditores sin experiencia.

---

## ASSUMPTIONS (corregir ahora o se dan por válidas)

1. **Integrada** 9001/14001/45001 (confirmado PO 2026-09-27).
2. **Ciclo completo**: programa → plan → checklist → hallazgos → informe → cierre (confirmado PO 2026-09-27).
3. Los hallazgos de auditoría **se crean como `Finding`** (borrador) y siguen su propio ciclo (5 Porqués, medidas, evidencia). No se duplica el circuito de acción correctiva.
4. **Quién hace qué:** `tenant_admin` crea y aprueba el programa; `tenant_admin` o `process_owner` planifica auditorías; auditores asignados (cualquier integrante con permiso de escritura) ejecutan checklist e informe; `viewer` solo lectura. Superusuario: todo.
5. **Imparcialidad:** bloqueo por defecto; excepción permitida con justificación escrita (empresas chicas).
6. Evidencia por ítem = texto obligatorio para resultados no conformes + adjuntos opcionales (reutiliza object storage).
7. Clasificación mayor/menor es **práctica interna** (no exigida por 9.2); se usa para priorizar y se mapea a `Finding.severity`.
8. Auditoría **remota / híbrida** es solo un atributo del plan (sin herramientas de videoconferencia).

---

## Terminology (es)

| Término | Significado en producto |
|---|---|
| **Programa de auditoría** | Conjunto de auditorías planificadas para un año, con su justificación |
| **Auditoría** | Una auditoría concreta con objetivo, alcance, criterios, fechas y equipo |
| **Objetivo** | Qué busca establecer la auditoría (una frase). Ej.: "Verificar que los cambios en despacho redujeron errores de especificación" |
| **Alcance** | Procesos, áreas, sitios y período cubiertos |
| **Criterios** | Normas y requisitos contra los que se compara la evidencia |
| **Lista de verificación** | Ítems a revisar (requisito o pregunta) con resultado y evidencia |
| **Evidencia** | Registros, declaraciones u observaciones verificables |
| **Hallazgo de auditoría** | Resultado de comparar evidencia con criterio: conformidad, NC mayor, NC menor, observación, oportunidad de mejora |
| **Informe** | Conclusión respecto del objetivo, fortalezas y hallazgos |
| **Cobertura** | Requisitos auditados en el ciclo del programa |

---

## Lifecycles

### Programa

`borrador → aprobado → cerrado` (un programa por año; se puede modificar aprobado dejando registro de la versión).

### Auditoría

```text
planificada ──(plan completo: objetivo+alcance+criterios+equipo+fechas)──▶ preparada
preparada ──(iniciar)──▶ en_curso
en_curso ──(checklist sin ítems pendientes)──▶ informe
informe ──(emitir informe)──▶ cerrada
cualquiera excepto cerrada ──(motivo)──▶ cancelada
```

Gates:

| Transición | Precondición |
|---|---|
| → preparada | objetivo, alcance, ≥1 norma, fechas, auditor líder, checklist con ≥1 ítem, imparcialidad OK o excepción justificada |
| → en_curso | fecha de inicio ≤ hoy (o forzar con motivo) |
| → informe | todos los ítems con resultado ≠ pendiente; cada NC/observación/OM tiene su `Finding` creado |
| → cerrada | informe con conclusión respecto del objetivo |

---

## Actors

| Actor | Puede |
|---|---|
| Administrador de la empresa | Todo: programa, aprobar, planificar, ejecutar, informar |
| Responsable de proceso | Planificar y ejecutar auditorías; ser auditado |
| Auditor asignado (colaborador o superior) | Ejecutar checklist, registrar hallazgos, redactar informe de **sus** auditorías |
| Consulta | Ver programa, auditorías e informes |
| Superusuario | Todo |

---

## Domain model (conceptual)

```text
AuditProgram   (tenantId, year, objectives, status, approvedBy/At)
  └─ Audit     (tenantId, programId?, code, title, objective, scope, standards[],
                plannedStart, plannedEnd, mode: onsite|remote|hybrid,
                status, impartialityException?, cancelReason?,
                reportConclusion?, reportStrengths?, reportIssuedAt?)
       ├─ AuditTeamMember   (userId, role: lead|auditor)
       ├─ AuditAuditee      (userId?, area)            -- a quién/qué se audita
       ├─ AuditChecklistItem(tenantRequirementId?, question, order,
       │                     result: pending|conforming|nc_major|nc_minor|
       │                             observation|improvement|not_applicable,
       │                     evidence?, findingId?)
       │     └─ AuditEvidenceAttachment (storage)
       └─ Finding (existente) ← auditId, auditChecklistItemId (nuevos, opcionales)
```

Mapeo resultado → `Finding`:

| Resultado ítem | `Finding.type` | `Finding.severity` |
|---|---|---|
| nc_major | nonconformity | major |
| nc_minor | nonconformity | minor |
| observation | observation | — |
| improvement | opportunity | — |

---

## Reglas clave

1. **Objetivo obligatorio** y no vacío para pasar a *preparada*.
2. **Checklist desde catálogo:** al elegir normas (y opcionalmente cláusulas) se proponen los `TenantRequirement` correspondientes; se pueden quitar ítems y agregar preguntas libres. 9001 §6.1.2 y §6.1.3 quedan como ítems separados.
3. **Evidencia obligatoria** para NC, observación y OM; opcional para conformidad.
4. **Imparcialidad:** si un integrante está en el equipo auditor y como auditado → bloquea *preparada*, salvo excepción con justificación (queda en el informe).
5. **Hallazgo automático:** marcar un ítem como NC/observación/OM crea un `Finding` en borrador con título, descripción = evidencia, `source = "Auditoría interna <código>"`, vínculo al ítem. Cambiar el resultado de un ítem con `Finding` publicado requiere anular el hallazgo primero.
6. **Cobertura:** requisito cubierto en el año = aparece en un ítem con resultado ≠ pendiente/no aplica en una auditoría *cerrada* del programa.
7. **DueItems:** `audit_start` (inicio planificado, aviso 7 días antes) y `audit_report` (fin + 10 días si no está cerrada).
8. 45001: el informe tiene una marca "comunicado a trabajadores/representantes" (§9.2.2) cuando la auditoría incluye 45001.

---

## UX

### Pantalla principal `/t/[slug]/audits`

- Cabecera: **Programa {año}** con estado, botón aprobar (admin), y **cobertura por norma** (barras 9001 / 14001 / 45001).
- Lista de auditorías del año en orden cronológico con estado, normas, fechas, auditor líder, conteo de hallazgos.
- Botones: **Planificar auditoría**, **Guía de auditoría**.

### Ficha de auditoría — pasos visibles

`1 Plan · 2 Lista de verificación · 3 Hallazgos · 4 Informe`, con el paso actual resaltado y un "qué falta" explícito (mismo patrón que las 4 etapas de riesgos).

1. **Plan:** objetivo (con ejemplo), alcance, normas, fechas, modalidad, equipo, auditados, aviso de imparcialidad.
2. **Lista de verificación:** ítems agrupados por norma/cláusula; resultado con botones (Conforme · NC mayor · NC menor · Observación · OM · N/A); evidencia; adjuntos.
3. **Hallazgos:** los `Finding` generados, con enlace a cada uno y su estado.
4. **Informe:** conclusión respecto del objetivo, fortalezas, resumen automático de hallazgos; **Emitir y cerrar**.

### Guía `/t/[slug]/audits/guia`

Qué es una auditoría interna, cómo escribir un objetivo, cómo obtener evidencia (entrevista, registros, observación), cómo clasificar hallazgos, imparcialidad, errores comunes. Fuentes: ISO 19011:2026, §9.2 de las tres normas.

### Anti-UX

- No mostrar un "% de cumplimiento" como resultado principal de la auditoría.
- No obligar a auditar todas las cláusulas en cada auditoría.

---

## Integraciones

| Con | Cómo |
|---|---|
| Catálogo / `TenantRequirement` | Fuente de ítems del checklist y de la cobertura |
| Hallazgos (`Finding`) | Creación automática desde ítems; vínculo inverso visible en la ficha del hallazgo |
| Riesgos | Un hallazgo de auditoría puede usarse como fuente en "Explorar una fuente" (ya existe vínculo Finding → Risk) |
| Vencimientos (`DueItem`) | Inicio de auditoría e informe pendiente |
| Storage | Adjuntos de evidencia |
| Navegación | Nuevo ítem **Auditorías** en el menú de la empresa |

---

## Out of scope (esta entrega)

Auditorías a proveedores · registro de auditorías de certificación · competencias de auditores · plantillas de checklist por industria · firma electrónica del informe · exportación PDF del informe (candidata a siguiente iteración) · indicadores (Task 11c).

---

## Acceptance tests (ejemplos)

1. No se puede pasar a *preparada* sin objetivo → error "Definí el objetivo de la auditoría".
2. Auditor que también es auditado → bloquea; con justificación → permite y la muestra en el informe.
3. Elegir 9001 + 45001 propone ítems de ambas normas desde el catálogo de la empresa.
4. Marcar un ítem como NC menor sin evidencia → error; con evidencia → crea `Finding` (nonconformity, minor) vinculado.
5. No se puede pasar a *informe* con ítems pendientes.
6. Cerrar sin conclusión → error. Con conclusión → *cerrada*; la cobertura del programa suma esos requisitos.
7. Consulta no ve botones de edición; un colaborador no asignado no puede editar el checklist.
8. Aislamiento: una auditoría de la empresa A no es accesible desde la B.

---

## Technical notes

- Dominio puro en `src/domain/audits/` (lifecycle, gates, imparcialidad, mapeo a Finding, cobertura) con tests unitarios.
- Persistencia en `src/lib/audits.ts`; migración Prisma nueva; `Finding` suma `auditId?` y `auditChecklistItemId?`.
- Rutas `src/app/(tenant)/t/[slug]/audits/**`; server actions con `redirect()` **fuera** del `try`.
- Reutilizar `FormFields`/guía como en riesgos; textos 100 % en español.

---

## Plan vertical propuesto (Task 11b)

1. **11b.1** Dominio + Prisma + tests (lifecycle, gates, imparcialidad, mapeo, cobertura).
2. **11b.2** Programa anual + planificación de auditoría (Plan) + DueItems.
3. **11b.3** Lista de verificación desde catálogo + ejecución con evidencia y adjuntos.
4. **11b.4** Hallazgos automáticos → `Finding` + vínculo inverso.
5. **11b.5** Informe + cierre + cobertura + guía + nav + e2e.

---

## Puntos resueltos (PO 2026-09-27)

1. Imparcialidad: **bloqueo + excepción justificada**.
2. Aprueba el programa: **solo administrador de la empresa** (y superusuario).
3. Aviso de informe pendiente: **10 días** después del fin planificado.
4. `Finding` **automático** al marcar NC / observación / OM.

## Aprobación

Aprobado por PO el 2026-09-27.
