# Consulta del índice de ISO 39001 (decisión del PO, 2026-10-30: pedírselo a un auditor o consultor)

Objetivo: confirmar las subcláusulas de ISO 39001:2012 (con la enmienda Amd 1:2024) para retirar el tag `sin-verificar` de `ISO39001_ROWS` en `src/domain/ims/seed-data.ts`.

## Mensaje para enviar

> Hola, ¿podés pasarme el **índice (solo números y títulos de cláusulas y subcláusulas)** de la ISO 39001:2012 con la enmienda 1:2024? No necesito el texto de los requisitos, solo la numeración y los títulos hasta el último nivel. Es para verificar la estructura de un software de gestión. Si tu edición es otra, decime cuál es.

## Qué tiene cargado hoy el sistema (a verificar)

| Cláusula | Título cargado |
|---|---|
| 4, 4.1, 4.2 | Contexto; comprender la organización; partes interesadas |
| 5, 5.1 | Liderazgo; liderazgo y compromiso |
| 6 | Planificación (sin subcláusulas) |
| 7 | Apoyo (sin subcláusulas) |
| 8, 8.1, 8.2 | Operación; planificación y control operacional; preparación y respuesta ante emergencias |
| 9, 9.1 | Evaluación del desempeño; seguimiento, medición, análisis y evaluación |
| 10, 10.1, 10.2 | Mejora; no conformidad y acción correctiva; mejora continua |

Faltan casi seguro subcláusulas de 5, 6, 7 y 9 (por ejemplo política, roles, riesgos y objetivos, competencia, auditoría interna, revisión por la dirección). No las agrego sin confirmarlas.

## Cuando llegue la respuesta

1. Pegarla en esta conversación (alcanza con la lista de números y títulos).
2. Comparar con la tabla de arriba; corregir títulos, agregar las subcláusulas que falten y quitar las que no existan.
3. Retirar `UNVERIFIED_TAG` de las filas confirmadas y la nota de `seed-data.ts`.
4. Un PR chico con el test del catálogo actualizado; los clientes que ya activaron ISO 39001 reciben el cambio por el seed.

No se copia el texto de los requisitos de la norma (tiene derechos de autor): solo numeración y títulos.
