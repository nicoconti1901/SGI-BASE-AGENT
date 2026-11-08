# Pendientes (2026-10-29)

## PRs abiertos para integrar (`/integrar <PR>`)
- Ninguno.

## Por construir
- [x] Inspecciones S10 — equipos y vehículos pesados (PR #38)
- [x] Inspecciones S11 — auditoría de seguridad en campo (PR #39)
- [x] Seguridad vial 18.0 a 18.4 (PR #44 y #46; cierre en PR #47)
- [ ] Adecuar las plantillas de inspección a los registros base (planillas) que pegue el PO: esperar la carpeta
- [ ] Checkpoint E — flujo completo, privacidad y permisos por rol, revisión humana (sesión en el worktree `checkpoint-e`)

- [x] Color y borde de formularios: elegida la opción 4 (riel lateral verde azulado, 2026-11-02). Clase `.sgi-form` aplicada a pasos guiados, fichas de riesgo, «Nueva acción» y edición de objetivos; extendida a todos los formularios (editor de hallazgos, auditorías, activos, instrumentos, proveedores, capacitación, seguridad, vial, importadores, alta de cliente y login), 2026-11-02
- [ ] Quitar archivos adjuntos (2026-11-02): hecho en hallazgos, acciones de riesgos, auditorías, capacitaciones e inspecciones (seguimiento); calibración e inspección en borrador ya lo tenían. Fuera a propósito: documentos de proveedores (se anulan con motivo), comunicaciones de proveedores (son un registro) y documentos controlados de la plataforma (versionados). Todos los selectores de adjuntos usan `FilePicker` (2026-11-08); solo los importadores CSV (nómina, capacitaciones, exposición, proveedores, activos) siguen con input nativo

## Cierre
- [x] PR de docs: `tasks/todo.md`, `tasks/sesiones-fase-5.md` y README con lo entregado (PR #47)

## Decisiones del PO
- [x] Estilo de formularios: elegida la alternativa B (pasos guiados, 2026-11-02). Aplicada a alta de objetivo, indicador, riesgo y oportunidad; el contenedor `.sgi-form` ya está en todos los módulos
- [x] Aprobar SPEC de seguridad vial (2026-10-28)
- [x] Índice de cláusulas de ISO 39001 confirmado (2026-11-04) contra la edición UNE-ISO 39001:2012 de `src/lib/iso`; retirado el tag `sin-verificar`. Falta solo confirmar que la enmienda Amd 1:2024 no cambia la numeración
- [x] Etiquetas de confianza de capacitaciones (aprobadas 2026-10-29)
- [x] Anulación de hallazgo vs. vencimiento de seguimiento: anular cierra el vencimiento (2026-10-29)
- [x] Seguridad vial D8, D12, D16, D21, D24 y D26 como defaults (2026-10-29)
- [x] «Aprobados vigentes» de proveedores: solo aprobados (2026-10-29)
- [x] Defaults de inspecciones de los PR #33 y #34 (2026-10-29)
- [ ] Revisión profesional antes de activar en clientes: la hace el administrador y queda en un acta por módulo (`tasks/revisiones-profesionales.md`, 5 actas pendientes)
- [x] D26 retención de datos personales: se conserva todo; sin consulta legal, riesgo aceptado por el PO (2026-10-30)
