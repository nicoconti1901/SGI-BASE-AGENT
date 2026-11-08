# Pendientes (2026-10-29)

## PRs abiertos para integrar (`/integrar <PR>`)
- Ninguno.

## Por construir
- [x] Inspecciones S10 — equipos y vehículos pesados (PR #38)
- [x] Inspecciones S11 — auditoría de seguridad en campo (PR #39)
- [x] Seguridad vial 18.0 a 18.4 (PR #44 y #46; cierre en PR #47)
- [ ] Módulo de registros de ensayo (protocolos de obra RE 04 a RE 09 PE 02): el PO pidió empezar con `/spec` (2026-11-08); sin especificar todavía
- [x] Plantillas de inspección adecuadas a los registros base de `src/5. Registros en blanco/` (PR #43 y #50; detalle en `docs/specs/SPEC-inspections.md`, «Planillas del PO incorporadas»). Quedan sin convertir, a propósito, los protocolos de medición y ensayo de obra (RE 04 a RE 09 PE 02): son un módulo propio de registros de ensayo, a decidir
- [ ] Checkpoint E — guía paso a paso en `tasks/checkpoint-e.md` (partes A y B las corre un agente; C, D y E las hace el administrador en la demo)

- [x] Color y borde de formularios: elegida la opción 4 (riel lateral verde azulado, 2026-11-02). Clase `.sgi-form` aplicada a pasos guiados, fichas de riesgo, «Nueva acción» y edición de objetivos; extendida a todos los formularios (editor de hallazgos, auditorías, activos, instrumentos, proveedores, capacitación, seguridad, vial, importadores, alta de cliente y login), 2026-11-02
- [ ] Quitar archivos adjuntos (2026-11-02): hecho en hallazgos, acciones de riesgos, auditorías, capacitaciones e inspecciones (seguimiento); calibración e inspección en borrador ya lo tenían. Fuera a propósito: documentos de proveedores (se anulan con motivo), comunicaciones de proveedores (son un registro) y documentos controlados de la plataforma (versionados). Todos los selectores de adjuntos usan `FilePicker` (2026-11-08); solo los importadores CSV (nómina, capacitaciones, exposición, proveedores, activos) siguen con input nativo

## Cierre
- [x] PR de docs: `tasks/todo.md`, `tasks/sesiones-fase-5.md` y README con lo entregado (PR #47)

## Decisiones del PO
- [x] Estilo de formularios: elegida la alternativa B (pasos guiados, 2026-11-02). Aplicada a alta de objetivo, indicador, riesgo y oportunidad; el contenedor `.sgi-form` ya está en todos los módulos
- [x] Aprobar SPEC de seguridad vial (2026-10-28)
- [x] Índice de cláusulas de ISO 39001 confirmado (2026-11-04) contra la edición UNE-ISO 39001:2012 de `src/lib/iso`; retirado el tag `sin-verificar`. Enmienda Amd 1:2024 («Climate action changes»): agrega texto en 4.1 y no agrega, quita ni renumera cláusulas (confirmado el 2026-11-08 por fichas públicas; el texto completo no se leyó)
- [x] Etiquetas de confianza de capacitaciones (aprobadas 2026-10-29)
- [x] Anulación de hallazgo vs. vencimiento de seguimiento: anular cierra el vencimiento (2026-10-29)
- [x] Seguridad vial D8, D12, D16, D21, D24 y D26 como defaults (2026-10-29)
- [x] «Aprobados vigentes» de proveedores: solo aprobados (2026-10-29)
- [x] Defaults de inspecciones de los PR #33 y #34 (2026-10-29)
- [x] Revisión profesional antes de activar en clientes: las 5 actas (accidentabilidad, seguridad vial, inspecciones, capacitaciones, proveedores) quedaron firmadas y aprobadas por Nico Conti el 2026-11-08 (`tasks/revisiones-profesionales.md`). Los módulos pueden activarse en clientes reales; antes de cargar datos personales reales sigue valiendo el aviso de retención D26
- [x] D26 retención de datos personales: se conserva todo; sin consulta legal, riesgo aceptado por el PO (2026-10-30)
