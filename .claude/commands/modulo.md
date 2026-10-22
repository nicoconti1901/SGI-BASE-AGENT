---
description: Construye uno o dos slices de un módulo de la Fase 5 en esta sesión (worktree propio, un PR). Uso - /modulo <módulo> <slices>
---

`$ARGUMENTS` = `<módulo> <slices>`, por ejemplo `inspecciones S4 S5` o `proveedores 19.3`. La tabla de `tasks/sesiones-fase-5.md` ("Módulos: dónde está cada cosa") dice, para cada módulo, su SPEC, el nombre de entorno, la rama y la clave del catálogo. Si el módulo o los slices no figuran ahí, o faltan, detenete y decilo.

Esta sesión construye **solo esos slices** de **ese módulo** y termina con un PR sin mergear. Es autónoma: no le preguntes al usuario; ante una ambigüedad elegí el default del SPEC y anotalo en el PR.

## 1. Entorno (primero de todo)

- Corré `git branch --show-current` y `git status -sb`. Si no estás en un worktree propio (estás en la raíz del repo o en la rama `main`), detenete: pedí abrir la sesión con `claude --worktree <nombre>`.
- Creá la rama (`git switch -c <rama de la tabla>` con los slices en el nombre, en minúscula y kebab-case, desde `origin/main` actualizado: `git fetch origin`).
- Corré `npm run wt:setup -- <entorno>`. Nunca uses la base `sgi_base` ni el puerto 3000. Servidor: `npm run dev -- -p $PORT` (PORT está en tu `.env`).
- Si Docker no responde (`docker info`), arrancalo (Docker Desktop) y esperá a que Postgres acepte conexiones.
- Windows + Git Bash: editá con las herramientas Edit/Write, no con scripts de shell con barras invertidas dobles (el shell las colapsa).

## 2. Qué leer (y qué no)

Leé, en este orden y nada más:

1. `AGENTS.md` y `CLAUDE.md`. Next.js 16 cambió: antes de escribir código de Next consultá `node_modules/next/dist/docs/`.
2. `SPEC-fase5-fundacion.md` (reglas comunes).
3. **Solo las secciones del SPEC del módulo que hacen falta para tus slices**: Objective, Decisiones, el modelo de dominio de lo que vas a tocar, Permisos, "Qué ve el cliente", los Acceptance tests que citan tus slices y el "Plan vertical". Usá `grep -n "^## \|^### "` para ubicarlas. `RESEARCH-*.md` solo si necesitás una fuente puntual.
4. El código existente del módulo (lo que ya está en `main`) y un módulo de referencia del mismo estilo: `src/domain/masterdata`, `src/lib/masterdata.ts`, `src/app/(tenant)/t/[slug]/master-data`.
5. Para UI: `.claude/skills/sgi-frontend-identity/SKILL.md`, `src/components/ui/` y los tokens de `src/styles/tokens.css`.

## 3. Cómo construir

- **TDD en dominio**: tests unitarios primero (funciones puras con las tablas de casos del SPEC). **Integración con base real** para persistencia y aislamiento entre tenants (patrón de `tests/masterdata.integration.test.ts`).
- Todo modelo lleva `tenantId` y toda consulta lo filtra. Permisos en el servidor (`src/domain/identity/authz.ts`), no solo ocultando botones. El layout del módulo usa `requireModuleForSlug`.
- **Performance**: conteos y agregaciones en la base, listados paginados, índices `[tenantId, …]`. Nunca cargar todo a memoria.
- Simplicidad del cliente: pocas pantallas, lenguaje claro, móvil primero donde el SPEC lo pide. Textos en español rioplatense neutro.
- Una migración propia con solo tus tablas (`npx prisma migrate dev --name <nombre>`); revisá el SQL; backfills y defaults seguros. Tus modelos van en `schema.prisma` bajo un comentario de cabecera, **agregados al final del archivo**.
- Vencimientos con `upsertOpenDueItemForEntity` (`src/lib/automation.ts`, con `ownerUserId`/`siteId`/`personId`); seguimientos con `Action`; hallazgos con `Finding.origin` y la FK del lado del módulo.
- Alcance: tu módulo más lo mínimo compartido (`schema.prisma`: tus modelos; `catalog.ts`: tu entrada; `authz.ts`: solo agregar tus acciones). **No edites** `tasks/todo.md`, `README.md`, `CLAUDE.md` ni los SPEC (lo hace `/integrar`); sí podés corregir una frase de tu SPEC que contradiga una decisión del PO ya tomada, indicándolo en el PR.
- Cambios compartidos más grandes de lo que dice el SPEC: detenete y reportalo.

## 4. Verificación y commits

- Antes de cada commit: `npx next typegen && npx tsc --noEmit`, `npx eslint <archivos tocados>` y `npx vitest run`. Un hook las corre al terminar; si falla, arreglalo (sin desactivar reglas ni saltear tests).
- E2E: escribí tu spec en `e2e/` y corré **solo ese spec** con `npx playwright test <spec> --retries=0`. La suite completa corre en CI.
- Commits atómicos, en español, Conventional Commits (≤72 caracteres, minúscula, sin punto final), con cuerpo que explique el porqué y la línea de atribución vigente. Leé el diff antes de redactar y no nombres nada que no esté en él. Nunca descartes cambios (nada de `checkout --`, `restore`, `reset --hard`).
- **Commiteá apenas una pieza esté verde y pusheá la rama después del primer slice**: si el cupo se agota, lo no commiteado es lo que se pierde.

## 5. Cierre

1. `git fetch origin && git rebase origin/main`. Si hay conflictos aditivos, resolvelos conservando ambos lados (ver `/integrar`, que describe los casos de `schema.prisma`, `authz.ts` y `catalog.ts`). Después del rebase corré `npx prisma validate` y todas las verificaciones.
2. Si tu migración quedó con un sello anterior a las que ya están en `main`, renombrala con uno posterior (`git mv`).
3. Pusheá, abrí el PR con `gh pr create --base main --body-file <archivo>` (cuerpo escrito con Write: resumen en viñetas, migraciones, decisiones y desvíos del SPEC, verificación con comandos y resultados, y la línea `🤖 Generated with [Claude Code](https://claude.com/claude-code)`), esperá CI (`gh pr checks <PR> --watch`) y arreglá lo que falle. **No mergees.**
4. Borrá tu base: `npm run wt:setup -- <entorno> --drop`.

## Qué devolver (máx. 300 palabras, sin narrar pasos)

URL del PR y resultado de CI; slices entregados y qué falta del SPEC; cantidad de tests nuevos; desvíos del SPEC y por qué; decisiones que necesiten al PO; riesgos de integración con otros módulos.
