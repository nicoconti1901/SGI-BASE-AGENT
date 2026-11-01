# Investigación: Auditorías internas del SGI (ISO 9001 / 14001 / 45001)

**Estado:** Fase 1 — investigación normativa y de práctica (sin modelo de datos ni UI)
**Fecha:** 2026-09-27
**Alcance:** auditorías **internas** (primera parte) de un sistema de gestión integrado 9001 + 14001 + 45001. Auditorías a proveedores (segunda parte) y de certificación (tercera parte) quedan fuera.

---

## 0. Pregunta central

> ¿El sistema de gestión cumple lo que la empresa y las normas exigen, y **logra los resultados previstos**? ¿Qué evidencia lo demuestra y qué hay que corregir?

La auditoría no es un checklist para cumplir: es el mecanismo del SGI para obtener **evidencia objetiva** de conformidad y **eficacia**, y alimentar hallazgos, acciones y la revisión por la dirección.

---

## A. Ediciones vigentes

| Hecho | Clasificación | Fuente |
|---|---|---|
| **ISO 19011:2026** (4.ª edición) publicada en **mayo 2026**; revisión técnica, sin período de transición (es guía) | OFFICIAL / ISO TC 176 | [ISO 19011:2026](https://www.iso.org/standard/19011); [ISO/TC 176 — ISO 19011:2026 released](https://committee.iso.org/sites/tc176/home/news/content-left-area/news-and-updates/iso-19011-2026-released.html) |
| 19011:2026 amplía el Anexo A: auditoría **remota** como modo normal (evidencia digital, videoconferencia, registros electrónicos) | CERTIFICATION / TRAINING BODY | [CQI/IRCA](https://knowledge.quality.org/article/iso-190112026-revision-guidance-management-system-auditing); [Complife](https://www.complifegroup.com/2026/06/22/iso-19011-2026-management-system-audit-changes/); [Risk Training Professionals](https://risktrainingprofessionals.com/blog/2026/06/09/whats-changed-in-iso-190112026/) |
| 19011:2026 refuerza el enfoque basado en riesgo del **programa** y el foco en **eficacia** (resultados, tendencias), no solo existencia de procesos | CERTIFICATION / TRAINING BODY | Idem; [USB Certification](https://usbcertification.com/iso-190112026-revision-published-new-era-in-audit-approach/) |
| **ISO 9001:2026 §9.2.2** exige definir **objetivos**, criterios y alcance de **cada** auditoría (2015 solo pedía criterios y alcance) | CONSULTING GUIDANCE (sin texto licenciado) | [ASC Food Safety — checklist 9001:2026](https://ascfoodsafety.com/iso-9001-internal-audit-checklist-2026/); [9001 Simplified](https://www.9001simplified.com/learn/iso-9001-2026-changes.php); [GovernanceDocs](https://governancedocs.com/iso-9001-2026-changes/) |
| 9001:2026: el programa debe considerar **cambios** que afectan a la organización; información documentada "disponible como evidencia" | CONSULTING GUIDANCE | Idem |
| 9001:2026: 6.1.2 (riesgos) y 6.1.3 (oportunidades) se auditan como líneas **separadas** | CONSULTING GUIDANCE | ASC Food Safety |
| ISO 14001:2015 y ISO 45001:2018 §9.2: misma estructura armonizada (9.2.1 intervalos planificados, conformidad y eficacia; 9.2.2 programa, criterios, alcance, auditores objetivos e imparciales, informe a la dirección) | OFFICIAL (estructura armonizada, Anexo SL) | Texto normativo conocido; confirmar con normas licenciadas |
| ISO 45001 §9.2.2: además, informar resultados a **trabajadores y sus representantes** | OFFICIAL | ISO 45001:2018 |
| ISO 14001 §9.2.2: el programa considera la **importancia ambiental** de los procesos | OFFICIAL | ISO 14001:2015 |

**Incertidumbre documentada:** igual que en riesgos, no se dispone del texto licenciado de ISO 9001:2026 ni de ISO 19011:2026. Las subcláusulas se citan por fuentes Tier 2–3; contrastar antes de convertirlas en validaciones "normativas" duras.

---

## B. Proceso de auditoría según ISO 19011 (síntesis)

### Programa de auditoría (cl. 5)

- Objetivos del programa; **riesgos y oportunidades del propio programa**.
- Extensión: cuántas auditorías, qué procesos/normas, con qué frecuencia.
- La frecuencia se justifica por **importancia del proceso, cambios, resultados de auditorías previas y desempeño** (enfoque basado en riesgo).
- Asignación de auditores competentes; recursos; seguimiento y mejora del programa.

### Realización de una auditoría (cl. 6)

| Etapa | Qué produce |
|---|---|
| 6.2 Inicio | Contacto con el auditado; viabilidad; **objetivo, alcance, criterios** |
| 6.3 Preparación | **Plan de auditoría** (fechas, modalidad presencial/remota, equipo, auditados); documentos de trabajo (**lista de verificación**) |
| 6.4 Ejecución | Reunión de apertura; recolección y verificación de **evidencia**; **hallazgos**; conclusiones; reunión de cierre |
| 6.5 Informe | Informe con conclusiones respecto del **objetivo** |
| 6.6 Finalización | Cierre de la auditoría |
| 6.7 Seguimiento | Verificación de correcciones y acciones correctivas (fuera de la auditoría, vía el sistema de NC) |

### Hallazgos (clasificación de práctica)

Los hallazgos comparan evidencia con criterios. Práctica habitual (19011 + organismos de certificación):

| Clasificación | Uso |
|---|---|
| Conformidad | Evidencia de cumplimiento (se registra, no genera acción) |
| No conformidad **mayor** | Ausencia o falla sistémica de un requisito; riesgo alto para resultados |
| No conformidad **menor** | Falla puntual, no sistémica |
| Observación | Aún no incumple, pero puede llegar a hacerlo |
| Oportunidad de mejora | Cumple, pero puede hacerse mejor |

"Mayor/menor" no está en 9001 §9.2; es práctica de certificación. Para uso interno es útil para priorizar.

### Imparcialidad

9.2.2 (las tres normas): los auditores se seleccionan para asegurar **objetividad e imparcialidad** → en la práctica, **nadie audita su propio trabajo**. En PyMEs suele resolverse con auditores cruzados entre áreas o un auditor externo.

---

## C. Qué **no** exige la norma (anti-patrones)

| No es requisito | Nota |
|---|---|
| Auditar todas las cláusulas en cada auditoría | El **programa** cubre el SGI en el ciclo; cada auditoría tiene su alcance |
| Frecuencia anual fija igual para todo | Frecuencia según importancia, cambios y resultados previos |
| Puntaje/porcentaje de cumplimiento | Puede ser útil como indicador, pero no reemplaza hallazgos con evidencia |
| Un formato de checklist particular | La lista de verificación es un documento de trabajo; se adapta |
| Auditor certificado externamente | Competencia (19011 cl. 7) demostrable, no un certificado específico |

---

## D. Modelo lógico (previo al dominio físico)

```text
PROGRAMA ANUAL (objetivos, criterios de frecuencia por riesgo)
    → AUDITORÍA planificada (objetivo, alcance, criterios, fechas, modalidad, equipo, auditados)
        → LISTA DE VERIFICACIÓN (requisitos del catálogo del tenant + preguntas propias)
            → EJECUCIÓN (evidencia por ítem → resultado)
                → HALLAZGOS (NC mayor/menor, observación, OM) → Hallazgo del sistema (Task 10)
                    → INFORME (conclusión vs objetivo, fortalezas, distribución)
                        → CIERRE  →  seguimiento en Hallazgos / Acciones
    → COBERTURA del programa (qué requisitos se auditaron en el ciclo)
```

- **Criterios = normas + requisitos del catálogo del tenant** (ya existe `TenantRequirement` por 9001/14001/45001).
- **Hallazgo de auditoría ≠ nuevo universo:** las NC/observaciones/OM se crean como `Finding` (ya tiene 5 Porqués, medidas, evidencia y vencimientos), vinculadas a la auditoría y al ítem del checklist.
- **Informe** responde al **objetivo** declarado (requisito 9001:2026).

---

## E. Implicaciones para SGI Base

1. Un módulo **integrado** (una auditoría puede cubrir 9001 + 14001 + 45001 a la vez).
2. Objetivo obligatorio por auditoría (gate de planificación).
3. Imparcialidad: impedir por defecto que un auditor figure como auditado de la misma auditoría; permitir excepción con justificación (PyMEs).
4. Checklist generado desde requisitos del tenant filtrados por norma/cláusula + preguntas libres; 6.1.2 y 6.1.3 como líneas separadas.
5. Hallazgos → `Finding` (sin duplicar el ciclo de acción correctiva).
6. Vencimientos (`DueItem`) para inicio de auditoría e informe pendiente.
7. Vista de **cobertura** del programa por norma/cláusula.
8. Modalidad presencial / remota / híbrida (19011:2026).
