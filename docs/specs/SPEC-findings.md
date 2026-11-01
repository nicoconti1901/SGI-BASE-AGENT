# Spec: `findings` — Hallazgos unificados (NC / observación / incidente / mejora)

**Estado:** Aprobado por product owner (2026-09-26)  
**Fecha:** 2026-09-26  
**Reemplaza / evoluciona:** el modelo actual `Nonconformity` + `CorrectiveAction` (Task 10) como puerta de entrada.

---

## Objective

Unificar el ingreso operativo del SGI en un único concepto: **Hallazgo**.  
Siempre se crea un hallazgo primero; el **tipo** determina el formulario, los campos obligatorios y el flujo. Cada hallazgo completo incluye:

1. Datos del evento / evidencia  
2. Análisis de causa **interactivo** (MVP: **5 Porqués**) que **debe** concluir en una **causa raíz** explícita y visible en la ficha del hecho  
3. Medidas **correctivas** y/o **preventivas** con **responsable (usuario del tenant)** y **vencimiento**  
4. **Destinatarios de notificación** explícitos (quién recibe el aviso de creación y de sus responsabilidades)  
5. Integración con el motor de vencimientos (`DueItem`) y notificaciones in-app + email stub

### Success criteria

- [ ] No se puede crear una NC/incidente/observación/mejora “suelta”: siempre hay un `Finding`.
- [ ] Al elegir tipo, el formulario aplica reglas y secciones propias de ese tipo.
- [ ] El análisis 5 Porqués es **interactivo** (paso a paso + cadena visual); no un textarea libre.
- [ ] **No se puede publicar** sin **causa raíz** confirmada (campo `rootCause` + paso marcado como raíz).
- [ ] En la vista de detalle del hallazgo, la **causa raíz aparece destacada** junto al hecho (no enterrada solo en el wizard).
- [ ] Antes de **cerrar/publicar** el alta, cada medida tiene responsable (membership del tenant) y, si aplica, fecha de vencimiento.
- [ ] Antes de publicar, se asignan **notificados** (usuarios del tenant); solo ellos reciben el aviso de creación + resumen de responsabilidades.
- [ ] Al publicar: se crean `DueItem` por medida con vencimiento; se emiten notificaciones in-app (+ email stub) a notificados y a responsables de medidas.
- [ ] Migración: NCs existentes de Task 10 se convierten a hallazgos tipo `nonconformity` (o truncate en entornos solo-dev).

---

## Actors

| Actor | Puede |
|---|---|
| Consulta (`viewer`) | Ver hallazgos del tenant (lectura) |
| Colaborador / Responsable de proceso / Admin org | Crear borrador, completar, publicar (según write) |
| Admin org / platform superuser | Reabrir, reasignar, forzar cierre |
| Destinatario notificado | Recibe aviso al publicar |
| Responsable de medida | Recibe aviso de su acción + aparece en DueItem |

---

## Domain model (conceptual)

```text
Finding (Hallazgo)
├── type: nonconformity | observation | incident | opportunity
├── status: draft → published → in_progress → closed  (+ cancelled)
├── common fields: title, description, detectedAt, source, location?, linkedRequirementId?
├── typePayload (JSON o columnas tipadas por tipo — ver abajo)
├── RootCauseAnalysis (method = five_whys)
│   ├── problemStatement
│   ├── WhyStep[] (orden, question, answer, evidenceNote?, isRootCause, warningFlags?)
│   ├── rootCause (obligatorio al confirmar)
│   ├── rootCauseConfirmedAt / confirmedByUserId
│   └── status: incomplete | confirmed
├── FindingMeasure[] (corrective | preventive)
│   ├── ownerUserId (User del tenant, obligatorio al publicar)
│   ├── dueAt (obligatorio para corrective; recomendado según tipo)
│   ├── linkedRootCause (bool — la medida ataca la causa raíz)
│   └── → DueItem (entityType = finding_measure)
└── FindingNotificationRecipient[] (userId, roleHint?)
    └── solo estos + owners reciben notificación de publicación
```

### Tipos MVP y énfasis del formulario

| Tipo | Código | Énfasis | Causa raíz |
|---|---|---|---|
| No conformidad | `nonconformity` | Requisito incumplido; ≥1 medida correctiva | **Obligatoria** |
| Observación | `observation` | Desvío menor; medidas preventivas/mejora | **Obligatoria** (mín. 3 niveles) |
| Incidente | `incident` | Evento no deseado; severidad; correctivas + preventivas | **Obligatoria** |
| Oportunidad de mejora | `opportunity` | Mejora; ≥1 medida | **Obligatoria** |

> Sin causa raíz confirmada **no hay publicación**, en ningún tipo.

### Reglas de publicación (gate)

1. Título + descripción + tipo + fecha de detección.  
2. Análisis 5 Porqués con **causa raíz confirmada** (ver sección siguiente).  
3. Medidas según tipo con `ownerUserId` válido.  
4. ≥1 medida con `linkedRootCause = true`.  
5. ≥1 destinatario de notificación.  
6. Permiso `write`.

### Notificaciones

Al publicar:

| Destinatario | Mensaje |
|---|---|
| Cada `FindingNotificationRecipient` | “Se publicó el hallazgo X (tipo). Resumen y link.” |
| Cada `ownerUserId` de medida | “Se te asignó la medida Y, vence el Z.” |

Canales MVP: **in-app** + **email stub**. No broadcast al tenant.

---

## Análisis de causa: experiencia interactiva (5 Porqués)

### Fuentes y métodos de referencia

| Fuente | Qué aplicamos |
|---|---|
| Toyota / Lean (Sakichi Toyoda) | Cadena de “¿por qué?” hasta causa sistémica accionable; 5 es guía |
| [AWS CloudWatch — 5 Whys](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/incident-report-5whys.html) | Guía conversacional, validación progresiva, no culpar personas |
| [Miro — 5 Whys](https://miro.com/root-cause-analysis/what-is-5-whys-framework/) | Evidencia por nivel; cadena reordenable |
| [5xWhys](https://5xwhys.com/tools/) | Wizard + anti-patrones (culpa, vaguedad, solución como causa) |
| [WhyTrace OSS](https://github.com/ryota1986/whytrace-oss) | Árbol visual; marcar causa raíz en el grafo |
| Práctica post-mortem / SRE | Validación hacia atrás: ¿eliminar la raíz elimina el síntoma? |

### UX: “laboratorio de causa” (MVP)

No es un textarea. Es un modo investigación **paso a paso + cadena visual**:

1. **Material de apoyo** — panel colapsable: para qué sirve, secuencia de 10 pasos, cuándo abrir ramas, 3 casos industriales condensados (`why-guidance` + `FiveWhysSupportPanel`).  
2. **Antes de los porqués** — checklist de hechos reunidos + secuencia temporal. Los 5 Porqués **no reemplazan** la investigación de campo.  
3. **Hecho / punto de partida** — `problemStatement` **independiente del título**. Reglas + ejemplos; no se precarga desde el título.  
4. **Árbol con ramas** — una cadena por mecanismo causal independiente; varias causas raíz permitidas (una por rama). Preguntas orientadas a “¿por qué el sistema permitió…?”.  
5. **Orientación por nivel** — inmediata → proceso → control → gestión → raíz sistémica + evidencia por paso.  
6. **Coach anti-patrones** — chips: culpa, vaguedad, síntoma, solución, salto lógico.  
7. **Confirmar causa(s) raíz** — ≥3 niveles en al menos una rama, raíz marcada, checklist mín. 3 ítems, verificación de no recurrencia.

**Reglas:** mín. 3 niveles, recomendado 5, máx. 8. Exactamente un paso `isRootCause` en la cadena principal. MVP: 1 cadena + opcional 2ª contribuyente (árbol React Flow = fase 2). Motion: avance de nodo, highlight de raíz, alerta en anti-patrón.

### Vista en la ficha del hecho (lectura)

La causa raíz es **información de primera clase**:

```text
┌─ Hecho ──────────────────────────────────────┐
│  [tipo] Título · fecha · fuente              │
│  Descripción                                 │
├─ Causa raíz (5 Porqués) ─────────────────────┤
│  ★ <texto de causa raíz destacado>           │
│  [Ver cadena completa ▾] 1→2→3→★             │
│  Confirmada por … el …                       │
└──────────────────────────────────────────────┘
```

### Modelo TypeScript (dominio)

```ts
type WhyStep = {
  order: number;
  question: string;
  answer: string;
  evidenceNote?: string;
  isRootCause: boolean;
  warningFlags?: ("blame" | "vague" | "symptom" | "solution" | "logic_gap")[];
};

type RootCauseAnalysis = {
  method: "five_whys";
  problemStatement: string;
  steps: WhyStep[];
  rootCause: string | null;
  rootCauseConfirmedAt: Date | null;
  rootCauseConfirmedByUserId: string | null;
  status: "incomplete" | "confirmed";
};
```

### Fuera de alcance MVP (análisis)

- AI facilitador (fase 2).  
- Ishikawa / 4M como entrada.  
- Canvas multi-cursor.  
- Árbol multi-rama completo (React Flow).

---

### Relación con Task 10

- `Nonconformity` / `CorrectiveAction` → `Finding` + `FindingMeasure`.  
- `/t/[slug]/operations` → bandeja de hallazgos.  
- `ACTION_ENTITY_TYPE` → `finding_measure`.

### Fuera de alcance MVP (módulo)

- CAPA formal multi-nivel.  
- Alta automática desde auditoría (Task 11).

### Adjuntos operativos (MVP)

- Documentación del hallazgo (`finding_doc`): fotos, registros, etc. en object storage; **no** pasan por Document/fate.  
- Evidencia de cierre de medida (`measure_evidence`): **obligatoria** (≥1 archivo) para cerrar.  
- Tipos: PDF, imagen, Word, texto · máx. 15 MB.

---

## UX (flujos generales)

1. **Nuevo hallazgo** → tipo → wizard.  
2. Datos → **Laboratorio 5 Porqués** → Medidas (responsable + vencimiento + “ataca causa raíz”) → Notificados → Revisar y **Publicar**.  
3. Bandeja de seguimiento (tabla): filtros texto / tipo / estado; columnas Título · Tipo · Detección · Lugar · Próx. venc. · Medidas (estado corr./prev. con color) · Estado hallazgo · Ver/Editar. Anulados ocultos por defecto.  
4. Detalle: causa raíz visible; documentación del hallazgo; cierre de medida **con evidencia obligatoria**.

---

## Technical notes

- Dominio: `src/domain/findings/` (gates, 5 Whys, anti-patrones).  
- UI laboratorio: componente client `FiveWhysLab` (cadena + foco + motion).  
- Lib: `src/lib/findings.ts` + DueItem/notificaciones existentes.  
- Tests: confirmación de raíz, anti-patrones, publish gate, detalle muestra `rootCause`.

---

## Acceptance tests (ejemplos)

1. Borrador sin causa raíz confirmada → **no** publica.  
2. Cadena con &lt; 3 niveles → **no** confirma raíz.  
3. Publicar con raíz + 2 medidas + 2 notificados → DueItems + notifs solo a asignados.  
4. Detalle muestra ★ causa raíz aunque no se abra la cadena.  
5. Cerrar medida → DueItem `closed`.  
6. Viewer no publica.

---

## Open points resueltos

| Tema | Decisión |
|---|---|
| ¿Hallazgo siempre primero? | Sí |
| Tipos MVP | NC, observación, incidente, oportunidad |
| Responsables / notificados | Usuarios del tenant; lista explícita |
| Causa | 5 Porqués interactivo; **causa raíz obligatoria y visible** |
| AI en porqués | Fase 2 |

---

## Approval

- [x] Aprobado para `/plan` + implementación (refactor Task 10 → findings + FiveWhysLab)  
- [ ] Pedir cambios: _______________________
