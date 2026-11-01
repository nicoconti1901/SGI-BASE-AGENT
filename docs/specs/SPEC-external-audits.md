# Spec: `external-audits` — Auditorías externas e informe del organismo (9001 / 14001 / 45001)

**Estado:** Implementado (11d.1–11d.3); decisiones de alcance del PO 2026-09-29
**Fecha:** 2026-09-29
**Fuera de alcance:** cobertura del programa interno · indicadores · auditorías a proveedores · portal del organismo

---

## Objective

Registrar las auditorías que hace un tercero (certificadora, cliente, autoridad), guardar su informe y **llevar sus hallazgos al circuito de Hallazgos** sin retipear.

## Ya construido (11d.1 y 11d.2)

- `Audit.kind = external` con organismo, tipo (certificación inicial, seguimiento, recertificación, cliente), auditor, resultado y plazo de respuesta a NC (crea `DueItem` `audit_external_response`).
- Sin programa (`programId` nulo por CHECK): no entra en programa, cobertura ni auditorías internas.
- Informe PDF adjunto (`AuditReportAttachment`, storage por empresa, descarga con control de acceso).
- Hallazgos cargados a mano: `Finding` en borrador con `auditId` y origen `Auditoría externa AE-AAAA-NN · organismo`.
- Ciclo: pendiente → realizada | cancelada.

## A construir (11d.3) — extracción asistida

1. El usuario elige un informe adjunto y pulsa "Extraer hallazgos".
2. El PDF se envía a un modelo de Anthropic como documento (lo lee entero, incluidos escaneos; sin parseo propio) con salida estructurada: por hallazgo, `tipo` (NC mayor / NC menor / observación / oportunidad), `cláusula`, `título`, `descripción y evidencia`, `cita textual` con página.
4. **Revisión humana obligatoria:** se muestra una lista de propuestas; el usuario confirma, edita o descarta cada una. Nunca se crea un `Finding` sin confirmación.
5. Confirmadas, se crean como borrador con el mismo origen que la carga manual y la cita textual en la descripción.

### Criterios de éxito

- [ ] Ninguna propuesta se persiste como `Finding` sin acción explícita del usuario.
- [ ] Cada propuesta muestra su cita textual para poder contrastarla con el informe.
- [ ] Si el PDF no tiene texto (escaneado) o el modelo falla, el usuario lo ve y puede seguir con la carga manual.
- [ ] Extraer dos veces el mismo informe no duplica hallazgos ya confirmados.
- [ ] Acceso limitado a quien puede planificar auditorías; el informe solo sale de la empresa hacia el proveedor del modelo.

## ASSUMPTIONS (corregir ahora o se dan por válidas)

1. Proveedor: API de Anthropic con clave en variable de entorno (`ANTHROPIC_API_KEY`); sin clave, el botón no aparece.
2. Solo informes en PDF (hasta 15 MB); el modelo lee el PDF nativamente, sin OCR propio.
3. Límite de tamaño y de páginas por extracción para acotar costo; se registra el uso por empresa.
4. El informe contiene datos sensibles: se envía solo al ejecutar la extracción, no se conserva en el proveedor, y el usuario ve un aviso previo.
5. Los plazos que figuren en el informe **no** se extraen: se cargan a mano en el plan (ya existe el campo).

## Riesgos abiertos

- Formatos muy distintos entre organismos: se valida con informes reales antes de dar la extracción por buena.
- Costo por documento y retención de datos del proveedor: confirmar con el PO antes de habilitar en producción.
