---
name: instruccion-corta
description: "Responde en pocas líneas cuál es la próxima tarea del plan del proyecto, con el comando de Claude para ejecutarla si existe, y qué hacer con Git después (solo guardar, commitear, no mergear, PR). Usar cuando el usuario pida 'qué sigue', 'próxima tarea', 'siguiente paso', 'instrucción corta'."
disable-model-invocation: true
---

# Siguiente instrucción, corta

Misión: decir qué sigue y cómo ejecutarlo, con el menor gasto de tokens y sin perder precisión. Es solo lectura: no implementa, no commitea, no despacha agentes.

## Cómo buscar (barato)

Parar en cuanto aparezca la respuesta. No leer planes, specs ni diffs enteros.

1. Estado del plan, en este orden y solo hasta encontrarlo:
   - Registro de ejecución: `.superpowers/sdd/*/progress.md` (git-ignored; leer las últimas ~30 líneas con `tail`).
   - Plan: `docs/superpowers/plans/*.md`. Con Grep, la primera tarea sin tildar (`- [ ]`) o la primera `## Task N` sin commit; leer solo ese tramo.
   - Sin plan: `PRODUCT.md` o la última conversación del usuario.
2. Git, en un solo comando: `git status -sb` y `git log --oneline -3`.

## Qué responder

Máximo 6 líneas, en es-AR con voseo, sin introducción ni resumen de lo hecho:

1. **Sigue:** la tarea en una línea (número y nombre).
2. **Comando:** el slash command o la frase exacta para ejecutarla, si existe (`/nombre args`). Si no hay comando, escribir "sin comando" y el pedido listo para pegar.
3. **Git:** una sola recomendación, según el estado:
   - cambios sin commitear de la tarea hecha → commitear (mensaje sugerido `tipo(ámbito): resumen`);
   - tarea hecha y verde, plan sin terminar → solo guardar el commit, sin push ni merge;
   - plan completo → recomendar PR a `develop` (`/publicar-cambios`), nunca merge directo;
   - rama equivocada o cambios ajenos mezclados → avisar antes de tocar nada.
4. **Aviso** (solo si existe): un bloqueo o una decisión pendiente del usuario, en una línea.

## Reglas

- Nunca ejecutar la tarea, el commit ni el push: solo indicarlos.
- Si el plan terminó, decirlo y dar el paso de cierre (PR, revisión visual pendiente).
- Si hay dos caminos igual de válidos, elegir uno y decir cuál recomendás; no listar opciones.
- Sin tablas, sin encabezados, sin repetir lo que el usuario ya sabe.
