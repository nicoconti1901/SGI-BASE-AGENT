# Capability Map: SGI Base (ISO 9001 / 14001 / 45001)

Plataforma empresarial de Sistema de Gestión Integrada. El desarrollador (superusuario) analiza el SGI del cliente en fase de desarrollo, provisiona un tenant y entrega una URL lista. El cliente opera con múltiples usuarios.

| Module id | Responsibility | Depends on |
|---|---|---|
| `ims-catalog` | Catálogo de requisitos ISO 9001, 14001 y 45001 + mapeo integrado | — |
| `tenant-provisioning` | Alta de empresa, tamaño/actividad, plantilla inicial, URL/entorno listo | `ims-catalog` |
| `identity-access` | Usuarios del tenant, roles, sesiones; superusuario de plataforma | `tenant-provisioning` |
| `assessment-gap` | Carga (por superusuario) del SGI existente, gaps, qué respetar vs. reemplazar | `ims-catalog`, `tenant-provisioning` |
| `document-control` | Procedimientos, registros, versiones, vigencia; conservar docs válidos del cliente | `assessment-gap`, `identity-access` |
| `automation-offers` | Ofertas nativas + integraciones; seguimiento, indicadores y todo con vencimiento | `assessment-gap`, `ims-catalog` |
| `operations-core` | Flujos esenciales: NC/acciones, riesgos, auditorías internas, indicadores | `document-control`, `identity-access` |
| `client-portal` | UI moderna para operar el SGI ya configurado | `identity-access`, `document-control`, `operations-core`, `automation-offers` |

**Build order:** `ims-catalog` → `tenant-provisioning` → `identity-access` → `assessment-gap` → `document-control` → `automation-offers` → `operations-core` → `client-portal`

**Status:** Approved by product owner (2026-09-25).
