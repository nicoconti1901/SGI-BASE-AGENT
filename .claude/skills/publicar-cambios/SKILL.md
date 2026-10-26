---
name: publicar-cambios
description: "Publica los cambios sin commitear: crea una rama con nombre adecuado, hace commits atómicos en español (Conventional Commits), actualiza el README de forma profesional si los cambios lo requieren, hace push, abre un PR y mergea a main. Usar cuando el usuario pida 'publicar cambios', 'subir cambios', 'crear rama y commitear', 'commit, push y merge'."
disable-model-invocation: true
---

## Modelo

Correr en **Sonnet**. Haiku solo si el cambio es chico (pocos archivos, un solo tema) y respetando las reglas de abajo sin excepción. No escalar a Opus para publicar.

# Publicar cambios: rama → commits → README → push → PR → merge

Invocar esta skill autoriza crear la rama, commitear, pushear, abrir el PR y mergear a `main`. Se ejecuta de punta a punta sin pedir confirmación, **salvo** en los puntos de parada. Todo mensaje (commits, rama, PR, README, reporte) va en **español**.

Esta skill es la excepción a la regla de `CLAUDE.md` «no commitear ni subir a git»: invocarla levanta esa regla para la publicación. Los permisos necesarios (`git push`, `git merge`, `gh pr create`, `gh pr merge`) tienen que estar en el allowlist de Bash de la configuración de Claude Code (los agrega el usuario); si una herramienta igual los bloquea, **parar y avisar** en vez de esquivar el bloqueo.

En Windows, correr git con la herramienta **Bash** (Git Bash): los heredocs funcionan y se evitan los problemas de comillas de PowerShell.

## Reglas que no se negocian

1. **Nunca descartar cambios del usuario.** Prohibido `git checkout -- …`, `git restore` (sin `--staged`), `git reset --hard`, `git clean`, `git stash drop`. Un archivo que no va en el commit simplemente no se stagea y se reporta. Un archivo trackeado que aparece borrado (` D`) es un cambio del usuario: se incluye en un commit propio o se pregunta, nunca se restaura.
2. **El mensaje describe solo lo que está en el diff.** Antes de escribir cada mensaje, leer el diff de ese grupo. No nombrar funciones, tablas, archivos ni comportamientos que no aparezcan en el diff; si se nombra un identificador, tiene que existir (`grep`).
3. **No inventar un PR.** El merge solo se titula como PR si hubo PR.

## 0. Preflight

```bash
git status --porcelain=v1
git branch --show-current
git fetch origin --prune
git log --oneline origin/main..HEAD
```

**Parar y preguntar** (con AskUserQuestion) si:
- No hay cambios ni commits sin publicar (nada que hacer: avisar y terminar).
- Hay un merge, rebase o cherry-pick en curso.
- La rama actual no es `main` y tiene commits propios sin mergear: preguntar si se publica desde esa rama (incluyendo esos commits) o si se crea una rama nueva desde `main`.
- `main` local está detrás de `origin/main` y el fast-forward chocaría con los cambios locales.

**Nunca commitear:** `.env*` (salvo `.env.example`), credenciales, claves, dumps de DB, `node_modules/`, artefactos de build o de tests (`.next/`, `coverage/`, `test-results/`, `playwright-report/`). Si aparecen sin ignorar, dejarlos fuera y mencionarlos en el reporte.

## 1. Analizar los cambios

```bash
git diff --stat
git diff --cached --stat
git status --porcelain=v1 --untracked-files=all
```

- Leer los diffs para entender **qué** cambió y **por qué**. Agrupar en unidades lógicas: una feature, un fix, docs, config/tooling. Los tests van con la feature que prueban.
- **Archivos nuevos (`??`):** abrir cada uno (al menos el comienzo) antes de incluirlo. Si no es obvio que pertenece al proyecto, o es un ejemplo o un andamiaje generado por una herramienta (por ejemplo `e2e/example.spec.ts` de Playwright), dejarlo fuera y reportarlo.
- Si dos funcionalidades distintas tocan el mismo archivo, no mezclarlas bajo un mensaje que describe solo una: separar con `git add -p` o describir ambas.

## 2. Crear la rama

Formato `<tipo>/<descripcion-en-kebab-case>`:
- `tipo` según el cambio dominante: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`, `ci`.
- Descripción en español, minúsculas, sin tildes ni ñ (`n`), de 50 caracteres como máximo, que describa el conjunto. Ej.: `feat/login-y-shell-de-plataforma`, `fix/aislamiento-tenant-en-riesgos`.
- Si ya existe (local o remota), agregar el sufijo `-2`, `-3`.

```bash
git switch -c <rama>   # los cambios sin commitear viajan a la rama nueva
```

## 3. Verificar antes de commitear

```bash
npm run lint
npx tsc --noEmit
npm test
```

Si hubo cambios en `e2e/` o en `playwright.config.ts`, además `npx playwright test --list`.

Si algo falla: **parar**, reportar la salida y no commitear ni pushear. No usar `--no-verify`, no desactivar reglas ni saltear tests para llegar a verde. Si ya fallaba en `main`, indicarlo y preguntar si se sigue.

## 4. Commits atómicos en español

Un commit por unidad lógica, en orden de dependencia (dominio/schema → persistencia → UI → tests → docs). Para cada grupo:

1. `git add <rutas explícitas>` (nunca `git add -A` ni `git add .`).
2. `git diff --cached` y escribir el mensaje **a partir de ese diff**.
3. Commitear.

Formato:
- Conventional Commits; descripción en español, en minúscula, sin punto final, de 72 caracteres como máximo, siguiendo el estilo de `git log --oneline -10`.
- Cuerpo (recomendado si el cambio no es trivial): el **porqué** y los efectos relevantes.
- Terminar con la línea de atribución vigente del sistema (`Co-Authored-By: …`).

```bash
git commit -F - <<'EOF'
feat: login con formulario propio y shell de plataforma

Reemplaza el layout de tenant por el AppShell compartido para unificar
la navegación entre portal y plataforma.

Co-Authored-By: ...
EOF
```

## 5. README (solo si existe y los cambios lo ameritan)

Actualizarlo cuando los cambios afecten algo que el README documenta o debería documentar: módulos nuevos, scripts de `package.json`, variables de `.env.example`, instalación, arquitectura, comandos de DB o de tests. No tocarlo por cambios internos sin impacto para quien lo lee.

- Español técnico claro, sin relleno, marketing ni emojis.
- Respetar la estructura y el tono: editar la sección que corresponde en vez de duplicar.
- Datos verificables: los comandos, variables y rutas tienen que existir en el repo.
- Nada de fechas relativas ni referencias a la conversación.

Commit aparte: `docs: actualiza README con <tema>`.

## 6. Push

```bash
git push -u origin <rama>
```

Si falla por autenticación o red: parar y reportar. Nunca `--force` sobre ramas compartidas.

## 7. PR y merge a main

1. Escribir el cuerpo del PR en un archivo del scratchpad (herramienta Write, no heredoc de PowerShell): resumen en viñetas de los cambios, cómo se verificó (comandos y resultado) y la línea de atribución de PR vigente del sistema.
2. Abrir y mergear:

```bash
gh pr create --base main --head <rama> --title "<título en español>" --body-file <archivo>
gh pr merge <rama> --merge --delete-branch=false
git switch main && git pull --ff-only origin main
```

3. Si `gh` falla, **mostrar el error** y correr `gh auth status`. Recién si `gh` no está autenticado o no hay remoto en GitHub, hacer el merge local:

```bash
git switch main
git pull --ff-only origin main
git merge --no-ff <rama> -m "merge: <rama>"
git push origin main
```

**Parar** ante conflictos de merge o checks de CI requeridos en rojo: no resolver a ciegas ni forzar; reportar los archivos en conflicto o el check que falla.

Al terminar, dejar el working tree en `main` actualizado. No borrar la rama (local ni remota) salvo que el usuario lo pida.

## 8. Reporte final (breve)

- Rama creada.
- Commits (`git log --oneline main~N..main` o los del PR).
- Si se actualizó el README y en qué sección.
- Link del PR y confirmación del merge (o por qué fue merge local).
- Archivos que quedaron fuera y por qué.
