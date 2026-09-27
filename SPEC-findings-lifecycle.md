# Spec: `findings-lifecycle` — Ciclo de vida del hallazgo (Task 10d)

**Estado:** Aprobado (PO 2026-09-27)
**Fecha:** 2026-09-27
**Normas:** ISO 9001 / 14001 / 45001 §10.2 · guía ISO/TC 176 APG (ver `RESEARCH-findings-lifecycle.md`)
**Complementa:** `SPEC-findings.md` (alta, 5 Porqués, medidas, adjuntos)

---

## Objective

Que el estado de cada hallazgo **signifique algo verificable**: en curso cuando se está trabajando, en verificación cuando las medidas terminaron, y cerrado **solo** cuando hay evidencia de eficacia. Anular y reabrir quedan registrados con motivo.

### Success criteria

- [ ] Transiciones gobernadas por reglas de dominio con tests (no se mueve el estado "a mano").
- [ ] `Publicado → En curso` automático al iniciar o cerrar la primera medida.
- [ ] `En curso → En verificación` automático cuando todas las medidas están cerradas con evidencia.
- [ ] **Verificación de eficacia** registrada (resultado, evidencia, quién, cuándo) antes de cerrar.
- [ ] Verificación **no eficaz** vuelve a *En curso* y exige una nueva medida correctiva.
- [ ] Anular con motivo y permiso; cierra vencimientos de sus medidas.
- [ ] Reabrir un cerrado ante recurrencia, con motivo y permiso.
- [ ] **Historial** de estados visible en la ficha (§10.2.2).
- [ ] Vencimiento (`DueItem`) para la verificación de eficacia.
- [ ] Bandeja y ficha muestran estado, "qué falta" y la próxima acción posible según rol.

---

## Estados

| Estado | Significa | Entra por |
|---|---|---|
| Borrador | Se está cargando | Alta |
| Publicado | Aprobado el análisis; medidas asignadas, ninguna empezada | Publicar (gate existente) |
| En curso | Al menos una medida en curso o cerrada | **Automático** |
| **En verificación** *(nuevo)* | Medidas terminadas; esperando comprobar eficacia | **Automático** al cerrar la última medida |
| Cerrado | Eficacia verificada | Verificación eficaz |
| Anulado | Registrado por error, duplicado o fuera de alcance | Acción explícita con motivo |

### Medidas

`Abierta → En curso → Cerrada`. Hoy "En curso" existe pero no se usa: el responsable podrá **iniciar** la medida. Cerrar sigue exigiendo evidencia (regla existente).

---

## Reglas

| # | Regla |
|---|---|
| R1 | Publicar deja el hallazgo en *Publicado* (existente). |
| R2 | Iniciar o cerrar una medida de un hallazgo *Publicado* lo pasa a *En curso*. |
| R3 | Cerrar la **última** medida abierta pasa a *En verificación* y programa la verificación: `verificationDueAt = hoy + plazo` (ver P2) con `DueItem`. |
| R4 | **Verificar** requiere estado *En verificación*, resultado (eficaz / no eficaz), **evidencia** en texto (adjunto opcional) y permiso (ver P3). |
| R5 | Eficaz → *Cerrado* (`closedAt`), cierra el `DueItem` de verificación. |
| R6 | No eficaz → *En curso*; el hallazgo exige **al menos una nueva medida correctiva** abierta antes de volver a verificación (la agrega quien verifica o el responsable). |
| R7 | **Anular** desde cualquier estado salvo *Cerrado*/*Anulado*: motivo obligatorio, permiso (ver P4); cierra `DueItem` de medidas y verificación. Un borrador se puede anular igual (no se borra: queda registro). |
| R8 | **Reabrir** un *Cerrado*: motivo obligatorio (recurrencia), permiso (ver P4); vuelve a *En curso* y exige nueva medida correctiva (como R6). |
| R9 | Cada transición crea un **evento de historial** (de, a, actor, fecha, motivo). |
| R10 | Al cerrar un hallazgo se ofrece revisar **riesgos** relacionados (§10.2.1 e): enlace a "Explorar una fuente" con el hallazgo como fuente. Sin obligación. |
| R11 | Un hallazgo que viene de auditoría (`auditId`) sigue las mismas reglas; su ítem de auditoría ya bloquea cambios una vez publicado (existente). |

---

## Modelo de datos (cambios)

```text
FindingStatus += verification

Finding
  + verificationDueAt   DateTime?
  + closedAt            DateTime?
  + cancelledAt / cancelledByUserId / cancelReason
FindingMeasure
  + startedAt / closedAt / closedByUserId
FindingVerification (nuevo, historial de intentos)
  id, tenantId, findingId, result (effective | not_effective),
  evidence, verifiedByUserId, verifiedAt
FindingStatusEvent (nuevo)
  id, tenantId, findingId, fromStatus, toStatus, actorUserId, reason?, createdAt
```

Migración aditiva; los hallazgos existentes se recalculan una vez (publicados con medidas cerradas → *En curso* o *En verificación* según corresponda).

---

## UX

- **Ficha:** línea de estado con los pasos (Publicado · En curso · En verificación · Cerrado) y un recuadro **"Qué falta"** según estado:
  - En curso: "Faltan cerrar 2 medidas (1 vencida)".
  - En verificación: "Verificar eficacia a partir del 12/11" + formulario de verificación.
  - No eficaz: "Agregá una nueva medida correctiva".
- **Historial** plegable al pie de la ficha.
- **Acciones según rol:** Iniciar medida (responsable), Verificar (P3), Anular / Reabrir (P4). Consulta: solo lectura.
- **Bandeja:** filtro por "En verificación" y marca de verificación vencida.
- Textos con vocabulario ISO: eficacia, corrección, acción correctiva.

---

## Fuera de alcance

Migrar `FindingMeasure` al modelo `Action` compartido · medidas de "corrección inmediata" como tipo aparte · firma electrónica · reapertura automática por hallazgo repetido (se evalúa en indicadores).

---

## Acceptance tests (ejemplos)

1. Publicar → *Publicado*; iniciar una medida → *En curso*.
2. Cerrar la última medida con evidencia → *En verificación* con `DueItem` a hoy + plazo.
3. Verificar sin evidencia → error. Eficaz → *Cerrado*.
4. No eficaz → *En curso*; no puede volver a verificación sin una nueva medida correctiva cerrada.
5. Anular sin motivo → error; con motivo → *Anulado*, vencimientos cerrados.
6. Reabrir un cerrado sin permiso → error; con permiso y motivo → *En curso*.
7. Cada paso deja un evento en el historial.
8. Consulta no ve acciones de estado.

---

## Decisiones del PO (2026-09-27)

| # | Pregunta | Decisión |
|---|---|---|
| P1 | ¿Qué tipos exigen verificación de eficacia? | **NC e incidente: obligatoria.** Observación y oportunidad de mejora pasan directo a *Cerrado* al cerrar su última medida (R3 no aplica). |
| P2 | ¿Plazo antes de verificar? | **30 días por defecto, editable.** Verificar antes de la fecha programada exige motivo (mismo patrón que iniciar una auditoría antes de tiempo). |
| P3 | ¿Quién verifica? | **Administrador o responsable de proceso, independiente:** no puede ser el único responsable de todas las medidas; si no hay otra persona, excepción con justificación. |
| P4 | ¿Quién anula y reabre? | **Solo administrador de la empresa** (y superusuario). |

## Aprobación

Aprobado por PO el 2026-09-27.
