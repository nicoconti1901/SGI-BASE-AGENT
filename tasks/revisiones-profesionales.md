# Revisiones profesionales antes de activar un módulo en clientes

Decisión del PO (2026-10-30): la revisión la hace **el administrador** y queda registrada en un acta por módulo, en este archivo. Mientras el acta diga «Pendiente», el módulo no se activa en clientes reales (sí en demo y pruebas).

## Cómo se completa un acta

1. El administrador recorre el checklist del módulo en un ambiente de demo.
2. Marca cada punto como `[x]` conforme o lo deja `[ ]` con una nota de qué cambiar.
3. Completa **Revisor**, **Fecha** y **Resultado** (`Aprobado`, `Aprobado con cambios` o `Rechazado`).
4. Los cambios pedidos se registran como tarea y se vuelven a revisar. Se guarda con un PR de docs.

Orden sugerido: primero los módulos que tratan datos de personas (accidentabilidad, seguridad vial).

---

## Accidentabilidad
**Estado:** Pendiente · **Revisor:** — · **Fecha:** — · **Resultado:** —
- [ ] Qué datos de personas se guardan (nombre, lesión, días perdidos) y quién los ve por rol.
- [ ] Los índices (frecuencia, gravedad, incidencia) coinciden con lo que usa la empresa.
- [ ] Los hallazgos anulados salen de los conteos y cierran su vencimiento (decisión 2026-10-29).
- [ ] Datos de salud: ver «Retención de datos personales» al final.

## Seguridad vial
**Estado:** Pendiente · **Revisor:** — · **Fecha:** — · **Resultado:** —
- [ ] D8: criterio de lesión grave.
- [ ] D12: reparto de km por días.
- [ ] D16: tratamiento de poca exposición (pocos km).
- [ ] D21, D24: nombres de conductores visibles solo para `tenant_admin` y `process_owner`.
- [ ] Índice de cláusulas de ISO 39001: ver `tasks/consulta-indice-iso-39001.md` (el tag `sin-verificar` sigue hasta confirmarlo).
- [ ] Datos de conductores: ver «Retención de datos personales» al final.

## Inspecciones
**Estado:** Pendiente · **Revisor:** — · **Fecha:** — · **Resultado:** —
- [ ] Las plantillas y qué ítems son críticos: matafuegos, obrador, protección contra caídas, vehículos livianos y pesados, control funcional, auditoría de campo, segregación de residuos.
- [ ] Las tres plantillas armadas sobre formularios en blanco del PO: máquinas y herramientas, equipos de izaje y simulacro de emergencia.
- [ ] Frecuencias de inspección y de vencimiento por defecto.
- [ ] Qué estados dan de baja o rehabilitan un activo.

## Capacitaciones
**Estado:** Pendiente · **Revisor:** — · **Fecha:** — · **Resultado:** —
- [ ] Vigencias del catálogo sugerido.
- [ ] Etiquetas de confianza (aprobadas por el PO el 2026-10-29).

## Proveedores
**Estado:** Pendiente · **Revisor:** — · **Fecha:** — · **Resultado:** —
- [ ] Pesos de los criterios de evaluación.
- [ ] Documentos exigidos y sus vencimientos.
- [ ] «Aprobados vigentes» = solo aprobados; los «con condiciones» no figuran (decisión 2026-10-29).

---

## Retención de datos personales (D26)

Decisión del PO (2026-10-30): **se conserva todo el historial** (los datos de conductores y accidentes no se borran ni se anonimizan). No se consultó a un abogado; las preguntas de plazo, consentimiento, registro de la base y supresión quedan sin respuesta profesional.

Riesgo aceptado por el PO. Para el revisor: antes de cargar datos reales de personas en un cliente, conviene confirmar esos puntos con un profesional, porque el sistema hoy no ofrece borrado ni anonimización. Si más adelante se decide cambiar la retención, se hace como un cambio de diseño aparte.
