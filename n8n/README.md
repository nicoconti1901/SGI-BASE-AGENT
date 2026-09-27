# n8n — orquestación de automatizaciones

n8n solo **dispara** endpoints de la app; nunca accede a la DB ni replica reglas de dominio.

## `due-reminders-scan.json`

Schedule diario (07:00 ART) → `POST {SGI_BASE_URL}/api/automation/scan` con `Authorization: Bearer <secreto>`.
Reintenta 3 veces; el endpoint es idempotente (claim atómico por `DueItem`), así que los reintentos no duplican avisos.

Variables de entorno en n8n:

| Variable | Valor |
|---|---|
| `SGI_BASE_URL` | URL pública de la app, sin `/` final |
| `SGI_AUTOMATION_WEBHOOK_SECRET` | Igual a `AUTOMATION_WEBHOOK_SECRET` de la app |

Importar: *Workflows → Import from file*. Respuestas: `200` resumen del run, `401` secreto inválido, `503` secreto no configurado en la app, `500` falló el scan (ver `AutomationRun`).
