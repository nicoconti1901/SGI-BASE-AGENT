---
name: evaluar-documentacion-cliente
description: "Criterios para evaluar cada documento o registro que entrega un cliente (identificación, contenido, vigencia, requisito ISO que cubre y solapamiento con los módulos de la plataforma) y dictaminar conservar, ajustar, recrear, modulo o descartar. Usar al analizar clientes/<slug>/origen o al revisar un dictamen."
---

# Evaluar la documentación del cliente

## Modelo
Sonnet, esfuerzo medio. Alto para procedimientos núcleo: información documentada, no conformidad y acción correctiva, auditoría interna, revisión por la dirección y el proceso operativo principal.

## Entrada y salida
- Leé `clientes/<slug>/trabajo/texto/<archivo>.md`, no el original. Los PDF se leen con Read.
- Normas aplicables: la tabla de `trabajo/ficha.md`. Evaluá solo contra esas.
- Escribí una fila por archivo en `trabajo/evaluacion/lote-NN.md`.

## Qué mirar, en orden
1. **Qué es**: manual, política, procedimiento, instructivo, registro (planilla), plan, o externo (ley, norma del cliente, manual de equipo). A qué proceso pertenece.
2. **Identificación y control** (ISO 9001 7.5.2 y 7.5.3): código, revisión, fecha, elaboró/revisó/aprobó, paginación. Si falta, el formato está flojo.
3. **Contenido**
   - Procedimiento: objetivo, alcance, responsables por cargo, pasos verificables (quién, qué, cuándo, cómo), registros que genera, referencias. Está flojo si es genérico o copiado, si no tiene responsables ni registros, si repite la norma en vez de describir el proceso o si nombra a otra empresa.
   - Registro: campos que dejan evidencia (fecha, responsable, resultado, validación) y vínculo con su procedimiento. Una planilla en blanco no prueba cumplimiento.
4. **Vigencia y terminología**: citas a ISO 9001:2008/2015 u OHSAS 18001, «acción preventiva», «representante de la dirección», manual «obligatorio», leyes derogadas, o última revisión de hace más de 3 años. Marcalo como desactualizado.
5. **Requisitos ISO** que cubre: cláusulas (códigos de `src/domain/ims/seed-data.ts`), con cobertura total o parcial. No copies texto de la norma.
6. **Plataforma**: si un módulo ya lleva ese registro (`src/domain/modules/catalog.ts`, solo `status: "available"`), el dictamen es `modulo`. Equivalencias habituales (verificá contra el catálogo):

   | Registro típico del cliente | Módulo |
   |---|---|
   | Seguimiento de hallazgos, NC, acciones correctivas, reclamos | Hallazgos |
   | Matriz de riesgos y oportunidades | Riesgos y oportunidades |
   | Objetivos e indicadores | Objetivos |
   | Programa e informes de auditoría interna | Auditorías |
   | Listado de documentos y registros | Documentos (más el listado maestro) |
   | Check lists e inspecciones (extintores, vehículos, herramientas, izaje, seguridad) | Inspecciones (plantillas) |
   | Listado de equipos de medición y calibraciones | Instrumentos |
   | Estadísticas e informes de accidentes | Estadísticas SST |
   | Seguridad vial | Seguridad vial |
   | Listado y evaluación de proveedores, documentación de subcontratistas | Proveedores |
   | Plan de capacitación, asistencia, eficacia | Capacitaciones |
   | Datos del personal, perfiles de puesto, sitios u obras | Datos maestros |

   El registro que pasa a un módulo conserva su código: sigue siendo información documentada.
7. **Datos personales** (DNI, salud, legajos): anotá «contiene datos personales» y no los copies a la evaluación.

## Dictamen (uno por archivo)

| Dictamen | Cuándo | En la plataforma |
|---|---|---|
| `conservar` | identificación y contenido correctos y reflejan el proceso | destino `keep`; el requisito es `compliant` solo si además hay evidencia de uso |
| `ajustar` | el contenido sirve pero el formato es flojo (sin código, revisión o aprobación; plantilla vieja): se pasa a nuestro formato preservando el contenido | destino `replace` |
| `recrear` | contenido insuficiente, genérico o desactualizado: se reescribe en nuestro formato | destino `replace` |
| `modulo` | el registro lo lleva un módulo; la planilla queda como antecedente | requisito `automated` o `compliant` según la evidencia |
| `descartar` | duplicado, obsoleto, fuera de alcance o externo sin control | no se carga; en el listado queda `obsoleto` |

`crear` (requisito sin documento) no sale de esta evaluación: lo decide la cobertura en la fase 3.

Si dudás entre dos dictámenes, poné el más probable, completá «A confirmar» con la pregunta concreta para el usuario y no lo resuelvas en silencio.

## Formato de `lote-NN.md`

| # | Archivo | Tipo | Proceso | Código / Rev. actual | Cláusulas | Identificación (ok / flojo) | Contenido (ok / flojo / insuficiente) | Dictamen | Módulo | Motivo (≤ 20 palabras) | A confirmar |
|---|---|---|---|---|---|---|---|---|---|---|---|

Debajo, «Observaciones del lote»: hasta 5 viñetas con patrones (por ejemplo, «ningún registro tiene campo de aprobación»).
