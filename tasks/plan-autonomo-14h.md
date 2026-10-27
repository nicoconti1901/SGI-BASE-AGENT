# Plan autónomo de 14 horas (2026-10-26)

Objetivo: avanzar la Fase 5 sin intervención humana, dentro del cupo (ventanas de ~5 h, máximo 2 sesiones por ventana, ver `sesiones-fase-5.md`). Todo lo que requiere una decisión del PO queda afuera.

## Estado de partida (verificado en git/gh)

- En `main`: 17.1–17.4 (#13, #24), 16.1–16.5 (#20, #25), 19.1–19.3, 20.1–20.6, S1–S5. La tabla de `sesiones-fase-5.md` quedó desactualizada (aún lista 17.3/17.4 y 16.3–16.5 como pendientes); la corrige el PR de docs de cierre.
- PR abierto: **#28** accidentabilidad 17.5 (rama `feat/accidentabilidad-17-5`, worktree `acc-175`, limpio).
- **Inspecciones S6** en curso: rama `feat/inspecciones-s6` (pushed), worktree `insp-s6` bloqueado y **con cambios sin commitear** (`edit.ts`, `assets/*`, `inspections/access.ts`, layouts). Retomar desde ahí; no descartar nada.
- Sin empezar: proveedores 19.4–19.5, inspecciones S7–S11.

## Cola de trabajo (en orden)

| # | Bloque | Sesión (una conversación nueva cada una) | Depende de | Tamaño |
|---|---|---|---|---|
| 0 | V1 | `/integrar 28` (17.5) | CI de #28 en verde | XS |
| 1 | V1 | `claude --worktree prov-194 --model sonnet` → `/modulo proveedores 19.4 19.5` | 19.3 (hecho) | M |
| 2 | V1 | En `insp-s6`: `claude --model sonnet` → `/modulo inspecciones S6` (retomar: revisar `git status`/`git diff`, commitear lo verde, completar editor de plantillas, guía y e2e del extintor no apto, abrir PR) | S4–S5 | S |
| 3 | V2 | `/integrar <PR S6>` y luego `/integrar <PR 19.4–19.5>` (de a uno, en ese orden) | PRs con CI verde | XS + XS |
| 4 | V2 | `--worktree insp-s7` → `/modulo inspecciones S7 S9` | S6 en `main` | S + S |
| 5 | V2 | Investigación Task 18: `RESEARCH-road-safety.md` + `SPEC-road-safety.md` (solo documentos, sin código; el SPEC queda **"para aprobar"**) | 17.x, S4–S5 | M |
| 6 | V3 | `/integrar <PR S7/S9>` | CI verde | XS |
| 7 | V3 | `--worktree insp-s8` → `/modulo inspecciones S8` (S10 solo si queda cupo; si no, queda para mañana) | S6 en `main` | S (+M) |
| 8 | V3 | `/integrar <PR S8>` + PR de docs que actualiza `tasks/todo.md`, README y la tabla de `sesiones-fase-5.md` | todo lo anterior | XS |

V1/V2/V3 = ventanas de cupo consecutivas (~5 h). En cada ventana corren como máximo las filas 1 y 2 (o 4 y 5) en paralelo, en worktrees distintos; las integraciones van antes o después, nunca como tercera sesión simultánea.

## Reglas de operación sin supervisión

1. Decisiones de producto: se toma el default del SPEC y se anota en la descripción del PR. No se pregunta.
2. Commit y push después de cada pieza verde; push de la rama tras el primer slice. Si el cupo se agota, el trabajo queda en el remoto y la sesión siguiente retoma del commit.
3. Cada sesión corre solo su spec e2e; la suite completa la corre CI. Los hooks `verify-on-stop` (tsc, eslint, vitest) siguen activos.
4. Si algo falla 2 veces con contexto completo: dejar la rama commiteada y pusheada, escribir una nota en el PR (borrador) con el bloqueo y pasar al siguiente ítem de la cola. No escalar a Opus ni reintentar en bucle.
5. `/integrar` solo con CI verde. Ante conflicto no aditivo, migración fuera de orden o drift de Prisma: parar, dejar el PR sin mergear y anotarlo.
6. Prohibido sin el PO: activar módulos en clientes, `git push --force`, `migrate reset`, borrar worktrees con cambios, mergear PRs con CI rojo, aprobar el SPEC de seguridad vial.
7. Modelo: Sonnet en todo. Investigación de la fila 5 también en Sonnet.

## Fuera de alcance (esperan al PO)

- Aprobar `SPEC-road-safety.md` → bloquea `/modulo seguridad-vial` (ventana 10).
- S10 completo y S11 (auditoría de seguridad en campo) si el cupo no alcanza; Checkpoint E (revisión humana de flujo, privacidad y permisos por rol).
- Las preguntas abiertas de `sesiones-fase-5.md` (hallazgo anulado, etiquetas de confianza, revisión profesional previa a activar).

## Al volver: qué revisar (en este orden)

1. `gh pr list --state all --limit 15`: qué PRs se abrieron, cuáles se mergearon y cuáles quedaron con nota de bloqueo.
2. `git worktree list` y `git status` en cada worktree: cambios sin commitear = trabajo interrumpido por cupo.
3. `tasks/todo.md` y la tabla de `sesiones-fase-5.md`: deben reflejar lo entregado.
4. Leer `SPEC-road-safety.md` y decidir la aprobación.
5. Revisar las decisiones por default anotadas en cada PR.
