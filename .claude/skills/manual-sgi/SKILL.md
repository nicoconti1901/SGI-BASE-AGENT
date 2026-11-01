---
name: manual-sgi
description: "Arma el Manual del Sistema de Gestión Integrado (MS 01) de un cliente con todo lo que resuelve la plataforma: alcance, contexto, procesos, política, roles, matriz de correlación norma–proceso–documento–módulo y listado maestro. Usar en la fase 5 de /incorporar-cliente, al revisar el manual o al ampliar el SGI a otra norma."
---

# Manual del SGI

## Modelo
Opus, esfuerzo alto, en la sesión principal. Es lo primero que lee el auditor e integra todo lo demás: un alcance, una exclusión o una cobertura mal planteados se notan en toda la auditoría. Maquetar y exportar: Sonnet o Haiku, esfuerzo bajo.

## Antes de empezar (si falta algo, decí qué y pará)
- Fases 3 y 4 terminadas: `cobertura.md`, listado maestro con códigos y procedimientos al menos `para revisión`.
- En la ficha: normas, alcance y sitios. Política del cliente o un borrador aprobado por el usuario.
- Requisitos no aplicables confirmados por el usuario. En ISO 9001 se justifican (4.3); en ISO 14001 y 45001 no se excluyen requisitos: se define el alcance.

## Qué leer (solo esto)
1. `ficha.md`, `decisiones.md`, `cobertura.md`, `listado-maestro.md`.
2. De cada procedimiento, las secciones 1, 2, 5 y 7 (objetivo, alcance, responsabilidades, registros), no el texto completo.
3. De la plataforma: `src/domain/modules/catalog.ts` (módulos y cláusulas, solo los activados para el cliente) y, de cada módulo activado, la sección «Qué ve el cliente» de su `SPEC-<módulo>.md` (ubicarla con `grep -n "^## "`). Se describe lo que la plataforma hace por el cliente, en su idioma; nada de tablas ni endpoints.
4. Las automatizaciones activadas (vencimientos, recordatorios), desde `plan-de-carga.md` o la ficha.

## Estructura
La de `plantillas/manual.md`. Van solo las cláusulas de las normas que aplican; si una sección es común a varias normas, se escribe una vez y se separa por norma solo donde difiere.

## Reglas
- Cada sección dice qué hace la organización (de 2 a 6 frases) y dónde está la información documentada (código o módulo). No copia la norma ni repite los procedimientos.
- Todo código citado existe en el listado (el hook lo valida) y toda cláusula aplicable aparece en el Anexo A (lo controla `auditor-sgi`).
- Sin datos inventados: `[[A COMPLETAR: …]]` y una línea en `pendientes-cliente.md`.
- Extensión de 15 a 30 páginas: el detalle vive en los procedimientos.
- Código `MS 01` (o el que corresponda en el esquema del cliente), revisión 00 al emitirse. Cada ampliación a otra norma es una revisión nueva, con el cambio en el historial.
- Salida: `entregables/manual/<código> Manual del Sistema de Gestión Integrado R<NN>.md`, con su fila en el listado. Se exporta a .docx (skill `anthropic-skills:docx`) solo cuando el usuario lo aprueba.
- Antes de entregarlo: `auditor-sgi`.
