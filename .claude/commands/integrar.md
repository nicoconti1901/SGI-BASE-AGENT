---
description: Integra a main un PR de módulo (rebase, conflictos aditivos, orden de migraciones, suite, CI, merge). Uso - /integrar <número del PR>
---

`$ARGUMENTS` = número del PR (por ejemplo `16`). Integrá **un solo PR** por sesión. Mergear un PR de módulo ya está autorizado por el flujo del proyecto; no mergees nada que no sea el PR pedido.

## 0. Preflight

- `gh pr view <PR> --json state,headRefName,mergeable,statusCheckRollup` y `git fetch origin`. Si el PR no está abierto o su CI está en rojo, detenete y reportalo.
- Trabajá en un worktree propio de la rama del PR (`git worktree add ../SGI-wt-integrar <rama>` si no existe) o dentro del worktree del agente que la creó; nunca en `main`.
- Docker debe estar arriba (`docker info`); si no, arrancá Docker Desktop y esperá a Postgres.

## 1. Rebase sobre main

`git rebase --autostash origin/main`. Los conflictos conocidos son siempre **aditivos**: dos módulos agregaron cosas en el mismo lugar. Resolvelos conservando ambos lados, con estas particularidades:

- **`src/domain/identity/authz.ts`**: la unión de tipos `AuthzAction` termina en `;` (sacalo del lado que queda antes), y hay listas por rol y un comentario. Cuando git duplique el cierre del comentario o la cabecera de `ROLE_PERMISSIONS`, dejalos una sola vez. Verificá con `npx tsc --noEmit`.
- **`src/domain/modules/catalog.ts`**: cada módulo toca solo su entrada; conservá ambas.
- **`src/domain/dashboard/summary.ts`** (`DUE_ROUTES`): conservá todas las rutas.
- **`prisma/schema.prisma`**: lo más delicado.
  - Las relaciones inversas en `Tenant`, `Site`, `Person`, `Finding`… se conservan todas.
  - Los modelos nuevos de cada módulo se agregan al final del archivo y comparten la última llave `}`: al juntarlos, la llave del primer bloque se pierde. Insertá la `}` que falta.
  - Si hay varios bloques en conflicto, es más seguro **tomar el schema de `origin/main` y reaplicar solo lo que agrega el módulo** (sus relaciones inversas y su bloque de modelos) que resolver bloque por bloque.
  - Después de resolver: `npx prisma format` y **`npx prisma validate` antes de `git add` y de `git rebase --continue`**. No sigas con un schema inválido.
- Cualquier conflicto que no sea aditivo (la misma línea con intenciones distintas): detenete y reportalo.

Si quedó un arreglo para un commit anterior de la rama, incorporalo con `git commit --fixup=<hash>` y `GIT_SEQUENCE_EDITOR=true git rebase --autosquash origin/main`, para no dejar commits intermedios rotos.

## 2. Orden de las migraciones

`ls prisma/migrations`. Las del PR deben tener un sello **posterior** al de todas las que ya están en `main` (si no, una base de desarrollo que ya aplicó las otras se queda desfasada). Renombrá con `git mv` y un commit propio (`chore: reordena las migraciones de <módulo> después de las de otros módulos`).

## 3. Verificar sobre el resultado integrado

1. `npm run wt:setup -- <entorno>` (si la base del entorno ya existía con nombres viejos de migración, primero `npm run wt:setup -- <entorno> --drop`: una base con migraciones renombradas falla con "already exists").
2. `npx next typegen && npx tsc --noEmit`, `npx vitest run` (todo verde; los tests de integración usan la base real) y `npx eslint` de los archivos del módulo.
3. `npm run wt:setup -- <entorno> --drop`.

## 4. Push, CI y merge

1. `git push --force-with-lease origin <rama>` (reescribe solo la rama del PR; el hook pedirá confirmación).
2. `gh pr checks <PR> --watch`. Si falla, leé el log (`gh run view --log-failed`), arreglá y repetí. Si falla un e2e que no es del módulo y también falla en `main`, reportalo en vez de taparlo.
3. Con CI en verde: `gh pr merge <PR> --merge --delete-branch=false`. Actualizá `main` local con `git -C <raíz del repo> pull --ff-only origin main`.

## 5. Cierre

Si es el último PR de la ventana, abrí un PR chico de documentación que actualice `tasks/todo.md` (sub-tareas hechas con su PR), la tabla "Lo que ya está en `main`" de `tasks/sesiones-fase-5.md` y la sección Módulos del README.

Devolvé en pocas líneas: PR integrado, conflictos que hubo y cómo se resolvieron, migraciones renombradas, resultado de CI, y qué sigue en la tabla de `tasks/sesiones-fase-5.md`.
