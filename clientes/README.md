# Clientes

Documentación de cada empresa que se incorpora a la plataforma. **Es confidencial y no se versiona**: `.gitignore` excluye todo lo que hay acá salvo este README (el repo es público).

## Cómo empezar

1. Creá `clientes/<slug>/origen/` y copiá ahí la documentación del cliente tal como la entregó, con sus carpetas. `<slug>` es el mismo que va a tener el tenant.
2. En Claude Code: `/incorporar-cliente <slug>` e indicá las normas ISO que aplican.
3. Para sumar una norma más adelante: `/incorporar-cliente <slug> ampliar ISO 14001`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `origen/` | Lo que entregó el cliente. Solo lectura (lo protege un hook). |
| `trabajo/` | Ficha, decisiones, texto extraído, evaluaciones, cobertura, listado maestro, pendientes y plan de carga. |
| `entregables/` | Procedimientos, registros y Manual del SGI en nuestro formato (.md fuente y .docx/.xlsx aprobados). |

Las fases, los modelos recomendados y los criterios están en `.claude/skills/incorporar-cliente/SKILL.md`.
