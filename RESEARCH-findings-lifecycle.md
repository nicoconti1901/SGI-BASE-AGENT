# Investigación: ciclo de vida del hallazgo (ISO 9001 / 14001 / 45001 §10.2)

**Estado:** Fase 1 — investigación (Task 10d)
**Fecha:** 2026-09-27
**Alcance:** reglas de estado del `Finding` (NC, observación, incidente, oportunidad de mejora) y de sus medidas, desde la publicación hasta el cierre verificado.

---

## 0. Pregunta central

> ¿Cuándo un hallazgo está realmente resuelto? ¿Qué evidencia lo demuestra y quién lo decide?

Hoy el producto cierra **medidas** con evidencia, pero el **hallazgo** nunca cambia de "Publicado". No existe verificación de eficacia, anulación ni reapertura.

---

## A. Qué pide la norma (§10.2, estructura armonizada)

| Requisito (paráfrasis) | Implicación en producto | Fuente |
|---|---|---|
| a) **Reaccionar**: controlar y corregir, hacer frente a las consecuencias | Distinguir **corrección** inmediata de acción correctiva | ISO 9001/14001/45001 §10.2.1; [ISO 9001 Help — 10.2](https://www.iso9001help.co.uk/10.2-Nonconformity-and-Corrective-Action.html) |
| b) Evaluar la necesidad de eliminar las causas: revisar, **determinar causas**, determinar si existen **NC similares** o podrían ocurrir | Ya existe 5 Porqués; falta registrar la extensión ("¿ocurre en otro lado?") | Idem; [ISO/TC 176 APG — Nonconformity](https://committee.iso.org/files/live/sites/tc176/files/PDF%20APG%20New%20Disclaimer%2012-2023/ISO-TC%20176-TF_APG-ReviewNonconformity.pdf) |
| c) Implementar las acciones necesarias | Medidas con responsable, vencimiento y evidencia (existe) | Idem |
| d) **Revisar la eficacia** de las acciones correctivas | Paso explícito y registrado **antes** de cerrar | Idem; [David Barker — 10.2](https://davidbarker.consulting/iso9001/clause-10-2-nonconformity-and-corrective-action/) |
| e) Actualizar **riesgos y oportunidades** si es necesario | Invitación a revisar riesgos al cerrar (enlace a riesgos, ya existe vínculo Finding → Risk) | ISO 9001 §10.2.1 e) |
| f) Hacer cambios en el SGC si es necesario | Nota de cambios del sistema en la verificación | ISO 9001 §10.2.1 f) |
| Acciones **apropiadas a los efectos** | Proporcionalidad: exigencia distinta por tipo/severidad | ISO 9001 §10.2.1 |
| §10.2.2 conservar información documentada de la naturaleza de la NC, acciones y **resultados** | Historial de estados con actor, fecha y motivo | ISO 9001 §10.2.2 |
| ISO 45001 §10.2: participación de trabajadores; incidentes incluidos | Los incidentes siguen el mismo rigor que las NC | ISO 45001:2018 §10.2 |

**Nota 2026:** no se encontraron cambios sustantivos en §10.2 para ISO 9001:2026 en las fuentes consultadas (los cambios destacados de la edición están en contexto, 6.1 y 9.2). Contrastar con el texto licenciado.

---

## B. Práctica de auditoría (ISO/TC 176 APG y organismos)

| Hecho | Fuente |
|---|---|
| Dos verificaciones distintas: **implementación** (se hizo lo planificado) y **eficacia** (no vuelve a ocurrir en condiciones similares) | [APG — Review of Nonconformity](https://committee.iso.org/files/live/sites/tc176/files/PDF%20APG%20New%20Disclaimer%2012-2023/ISO-TC%20176-TF_APG-ReviewNonconformity.pdf) |
| Cerrar solo con **evidencia objetiva** de eficacia; "completé los pasos" no es eficacia | APG; [CQI/IRCA — corrective action responses](https://www.quality.org/article/corrective-action-responses-following-internal-audits); [QCSL — closing NCs](https://qcsl.co.uk/closure-on-non-conformities/) |
| Debe pasar **tiempo suficiente** (p. ej. 30–90 días, un ciclo del proceso) antes de verificar | APG; [The Auditor — when to verify](https://www.theauditoronline.com/conducting-the-audit-follow-up-when-to-verify/) |
| Si la acción no fue eficaz: **reabrir** e investigar de nuevo | APG |
| El seguimiento de NC anteriores es parte de la auditoría siguiente | APG; CQI/IRCA |

---

## C. Anti-patrones a evitar

| Anti-patrón | Por qué |
|---|---|
| Cerrar el hallazgo al cerrar la última medida | Confunde implementación con eficacia (APG) |
| Verificar el mismo día que se implementó | No hay tiempo para observar recurrencia |
| Que verifique solo quien ejecutó las medidas | Falta de objetividad |
| Anular sin motivo / borrar | Pérdida de información documentada (§10.2.2) |
| Estados que el usuario mueve a mano sin reglas | El estado deja de significar algo |

---

## D. Modelo lógico propuesto

```text
BORRADOR ──publicar──▶ PUBLICADO ──(primera medida en curso o cerrada)──▶ EN CURSO
EN CURSO ──(todas las medidas cerradas con evidencia)──▶ EN VERIFICACIÓN
EN VERIFICACIÓN ──(verificación eficaz, tras el plazo)──▶ CERRADO
EN VERIFICACIÓN ──(no eficaz)──▶ EN CURSO  (exige nueva medida correctiva)
CERRADO ──(recurrencia, con motivo)──▶ EN CURSO   (reapertura)
BORRADOR/PUBLICADO/EN CURSO/EN VERIFICACIÓN ──(motivo)──▶ ANULADO
```

- Estados **derivados** de las medidas donde corresponde (el usuario no "arrastra" estados).
- Estados **explícitos con motivo** para verificar, anular y reabrir.
- **Historial** de cada transición (quién, cuándo, por qué).
