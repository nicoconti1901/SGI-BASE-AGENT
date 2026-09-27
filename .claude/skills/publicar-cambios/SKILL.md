---
name: publicar-cambios
description: "Publica los cambios sin commitear: crea una rama con nombre adecuado, hace commits atómicos en español (Conventional Commits), actualiza el README de forma profesional si los cambios lo requieren, hace push y mergea a main. Usar cuando el usuario pida 'publicar cambios', 'subir cambios', 'crear rama y commitear', 'commit, push y merge'."
disable-model-invocation: true
---

# Publicar cambios: rama → commits → README → push → merge

Invocar esta skill es autorización explícita para crear rama, commitear, pushear y mergear a `main`. Ejecutar de punta a punta sin pedir confirmación, **salvo** en los puntos de parada indicados. Todo mensaje (commits, rama, README, reporte) en **español**.

## 0. Preflight

```bash
git status --porcelain=v1
git branch --show-current
git fetch origin --prune
```

Parar y avisar si:
- No hay cambios (nada que publicar).
- Hay un merge/rebase/cherry-pick en curso.
- La rama actual no es `main` y tiene commits propios sin mergear (preguntar si se publica desde esa rama).
- `main` local está detrás de `origin/main` y el fast-forward chocaría con los cambios locales.

**Nunca commitear:** `.env`, `.env.local`, credenciales, claves, dumps de DB, `node_modules/`, artefactos de build (`.next/`, `coverage/`, `test-results/`, `playwright-report/`). Si aparecen sin ignorar, dejarlos fuera y mencionarlo en el reporte. Revisar archivos `??` (sin trackear) uno por uno antes de incluirlos: si no es obvio que pertenecen al proyecto, dejarlos fuera y reportarlo.

## 1. Analizar los cambios

```bash
git diff --stat
git diff --cached --stat
git status --porcelain=v1 --untracked-files=all
```

Leer los diffs necesarios (dirigido, no todo) para entender **qué** cambió y **por qué**. Agrupar los archivos en unidades lógicas (una feature, un fix, docs, config/tooling, tests de una misma feature van con esa feature).

## 2. Crear la rama

Formato: `<tipo>/<descripcion-en-kebab-case>`
- `tipo` según el cambio dominante: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`, `ci`.
- Descripción en español, minúsculas, sin tildes ni ñ (`n`), máximo ~50 caracteres, que describa el conjunto. Ej.: `feat/login-y-shell-de-plataforma`, `fix/aislamiento-tenant-en-riesgos`.
- Si ya existe (local o remota), agregar un sufijo `-2`, `-3`.

```bash
git switch -c <rama>   # los cambios sin commitear viajan a la rama nueva
```

## 3. Verificar antes de commitear

Correr lo que aplique a los archivos tocados (en paralelo si se puede):

```bash
npm run lint
npx tsc --noEmit
npm test
```

Si algo falla: **parar**, reportar la salida y no commitear ni pushear. No usar `--no-verify`, no desactivar reglas ni saltear tests para llegar a verde. Si fallaba ya en `main` antes de estos cambios, indicarlo y preguntar si se sigue igual.

## 4. Commits atómicos en español

Un commit por unidad lógica del paso 1, en orden de dependencia (dominio/schema → persistencia → UI → tests → docs).

- Stagear rutas explícitas: `git add <rutas>`. Nunca `git add -A` / `git add .` a ciegas.
- Formato Conventional Commits, descripción en español, en minúscula, sin punto final, ≤ 72 caracteres, siguiendo el estilo del historial (`git log --oneline -10`). Ej.: `feat: workspace y UI de riesgos y oportunidades Nivel 2`.
- Cuerpo (opcional, recomendado si no es trivial): el **porqué** y efectos relevantes, en español.
- Terminar cada mensaje con la línea de atribución vigente del sistema (ej. `Co-Authored-By: ...`).
- Usar heredoc para mensajes multilínea.

```bash
git commit -F - <<'EOF'
feat: login con formulario propio y shell de plataforma

Reemplaza el layout de tenant por el AppShell compartido para unificar
la navegación entre portal y plataforma.

Co-Authored-By: ...
EOF
```

## 5. README (solo si existe y los cambios lo ameritan)

Actualizar `README.md` cuando los cambios afecten algo que el README documenta o debería documentar: funcionalidades/módulos nuevos, scripts de `package.json`, variables de entorno (`.env.example`), pasos de instalación, arquitectura, comandos de DB/tests. No tocarlo por cambios internos sin impacto para quien lee.

Estilo profesional:
- Español técnico claro, sin relleno ni marketing, sin emojis.
- Respetar la estructura y el tono existentes; editar la sección que corresponde en vez de agregar secciones duplicadas.
- Datos verificables: comandos, variables y rutas deben existir en el repo.
- Nada de fechas relativas ("recientemente") ni referencias a la conversación.

Commitearlo aparte: `docs: actualiza README con <tema>`.

## 6. Push

```bash
git push -u origin <rama>
```

Si falla por auth/red: parar y reportar. Nunca `--force` sobre ramas compartidas.

## 7. Merge a main

Preferir PR con `gh` (deja registro):

```bash
gh pr create --base main --head <rama> --title "<título en español>" --body-file <archivo>
gh pr merge <rama> --merge --delete-branch=false
```

- Cuerpo del PR en español: resumen en viñetas de los cambios, cómo se verificó (comandos corridos y resultado), y la línea de atribución de PR vigente del sistema.
- Si `gh` no está autenticado o no hay PR posible, merge local:

```bash
git switch main
git pull --ff-only origin main
git merge --no-ff <rama> -m "merge: <rama>"
git push origin main
```

**Parar** ante conflictos de merge o checks de CI requeridos en rojo: no resolver a ciegas ni forzar; reportar los archivos en conflicto.

Al terminar, dejar el working tree en `main` actualizado. No borrar la rama (local ni remota) salvo que el usuario lo pida.

## 8. Reporte final (breve)

- Rama creada.
- Lista de commits (`git log --oneline main~N..main` o del PR).
- Si se actualizó el README y qué sección.
- Link del PR (si hubo) y confirmación del merge.
- Archivos que quedaron fuera y por qué.
