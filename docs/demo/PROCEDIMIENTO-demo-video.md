# Procedimiento — Video demo de SGI Base

Cómo producir el video de [PLAN-demo-video.md](PLAN-demo-video.md) con el menor consumo de tokens posible y sin perder
calidad. Lo ejecuta un agente, en dos sesiones. El qué (mensaje, guion, escenas y datos) está en el plan. Acá solo va el
cómo.

---

## 0. Modelo y sesiones

| Qué | Decisión | Por qué |
|---|---|---|
| Modelo | **Sonnet 5.5** (`--model sonnet`), con esfuerzo medio | El plan ya está decidido, así que Opus no suma. Haiku se equivoca en los selectores de Playwright y en el layout de Remotion, y cada error es otra grabación u otro render: termina gastando más. |
| Escalar | Solo si un mismo paso falla dos veces con todo el contexto: ese paso pasa a Opus y después se vuelve a Sonnet | Es la regla de calidad de `CLAUDE.md` |
| Sesiones | **Dos sesiones cortas en la misma worktree.** Sesión 1: F0 a F4. Sesión 2: F5 a F7. | Con contexto limpio, cada llamada cuesta menos. El traspaso va por `tools/demo-video/ESTADO.md`. |
| Aislamiento | Worktree `demo-video` con su propia base (`sgi_wt_demo-video`) | No pisa `sgi_base` ni el trabajo sin commitear de `main` |
| Subagentes | Ninguno | Es una tarea lineal y un subagente arranca en frío |

### Cómo arrancar

En una terminal nueva, desde `C:\Users\nicoc\Proyectos\SGI-BASE-AGENT`:

```
claude --worktree demo-video --model sonnet
```

**Prompt de la sesión 1** (pegarlo tal cual):

```
Ejecutá las fases F0 a F4 de C:\Users\nicoc\Proyectos\SGI-BASE-AGENT\docs\demo\PROCEDIMIENTO-demo-video.md.
El qué está en PLAN-demo-video.md, en la misma carpeta. No cambies el guion salvo lo que permite su §5.
Las reglas de tokens del §1 del procedimiento son obligatorias. Sin subagentes.
Al cerrar cada fase, una sola línea de estado. Al final, dejá ESTADO.md al día y hacé un commit wip.
```

**Prompt de la sesión 2** (en una sesión nueva, con el mismo comando):

```
Seguí el video demo: leé tools/demo-video/ESTADO.md y ejecutá las fases F5 a F7 de
docs/demo/PROCEDIMIENTO-demo-video.md (el plan está en docs/demo/PLAN-demo-video.md).
Las reglas de tokens del §1 son obligatorias. Sin subagentes. Una línea de estado por fase.
Al final: la ruta del mp4, la duración, los LUFS y la lista de cambios al guion.
```

## 1. Reglas de tokens (obligatorias)

1. **Copiar, no leer.** La herramienta de Milongas se copia con un solo comando (F1). De ella se leen únicamente los
   archivos que lista F1, cada uno una sola vez, y se edita con `Edit` sobre fragmentos. Después de editar no se relee
   para verificar.
2. **Relevar la UI, no el código.** Para encontrar elementos se usan los YAML de `trabajo/relevamiento/` (F3, con
   `ariaSnapshot`), que son compactos. No se abren las páginas de `src/app`. De `src/` solo se leen las firmas de
   `src/lib/*` que necesita F2: primero `grep "export async function"` y después la función que se va a usar, nada
   más.
3. **Imágenes con cuentagotas.** La revisión visual empieza por la hoja de contacto, que es una sola imagen. Los cuadros
   sueltos (`render --cuadro N`) se miran solo en las escenas con problemas. Las capturas del relevamiento se abren solo
   cuando el YAML no alcanza para decidir.
4. **Lo largo, en segundo plano.** Build, servidor, voz, grabación y render van con `run_in_background`, y se espera la
   notificación. Nada de polling.
5. **Salidas cortas.** Los logs largos se redirigen a un archivo en `trabajo/logs/` y se miran con `tail -20` o con un
   `grep -i "error\|warn"`.
6. **Sin revisiones de más.** Nada de `/review`, `/simplify` ni auditorías: la herramienta está fuera de la app. La
   verificación es la de F7.
7. **No probar a ciegas.** Si un paso falla dos veces con el mismo error, se para, se anota en `ESTADO.md` y se
   pregunta.
8. **`ESTADO.md` corto,** de 30 líneas como máximo: fase, hecho, pendiente, cambios al guion (§5 del plan), problemas y
   frames o escenas a revisar.
9. **Sin tocar la app.** Solo se pueden cambiar `tsconfig.json` y `eslint.config.mjs` (F1). Si una pantalla tiene un
   error o se ve mal, no se arregla en esta tarea: se anota en `docs/demo/observaciones.md`, se evita mostrarlo y se
   avisa al final.

## 2. Fases

### F0 · Preparar el entorno (sesión 1)

1. Traer los documentos de la demo a la worktree, que nace de `origin/main` y no los tiene:
   `mkdir -p docs/demo && cp /c/Users/nicoc/Proyectos/SGI-BASE-AGENT/docs/demo/*.md docs/demo/`.
2. Correr `npm run wt:setup -- demo-video`, en segundo plano. Crea la base, el `.env` con su `PORT`, aplica las
   migraciones y corre los seeds.
3. Cargar la demo: `npm run db:seed:revision -- --reset`. Guardar en `ESTADO.md` el mail de Ana que imprime al final
   (se espera `admin.patagonia@demo.sgi.test`).
4. Revisar en `.env` que la URL de Better Auth y la URL pública de la app (las variables con `URL` en el nombre) apunten
   a `http://localhost:$PORT`. Si no, corregirlas solo en el `.env` de la worktree.
5. Hacer un build de producción (así no aparece el indicador de desarrollo de Next en el video), en segundo plano:
   `npm run build`. Después, `npx next start -p $PORT`, también en segundo plano.
6. Comprobar con `curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/login` que responde `200`.
7. Revisar la voz: `python -m edge_tts --list-voices | grep es-UY-Mateo` tiene que mostrar `es-UY-MateoNeural`. Si
   falta `edge-tts` o `imageio_ffmpeg`, instalarlos con `pip install edge-tts imageio-ffmpeg`.

### F1 · La herramienta (sesión 1)

1. Copiar sin dependencias ni salidas (en PowerShell; los códigos de salida 0 a 7 de robocopy son éxito):

   ```powershell
   robocopy "C:\Users\nicoc\Proyectos\milongas-app\tools\demo-video" "tools\demo-video" /E /XD node_modules trabajo salida /XF tango-an-old-fashioned-hat.mp3
   ```

2. Borrar lo que es de Milongas:
   - `entorno/datos.mts` y `entorno/web.mjs` (el mock y el build de la web).
   - `video/piezas/MarcoTelefono.tsx`.
   - En `musica/LICENCIA.md`, las filas de los tangos.
3. Excluir la herramienta de la app, para que el hook `verify-on-stop` no la compile ni la lintee:
   - `"tools"` en el `exclude` de `tsconfig.json`.
   - `"tools/**"` en el `globalIgnores` de `eslint.config.mjs`.
4. Adaptar, en este orden, leyendo cada archivo una sola vez:

   | Archivo | Cambio |
   |---|---|
   | `package.json` | `name: "sgi-base-demo-video"` y la descripción. Las dependencias quedan iguales. |
   | `entorno/constantes.mjs` | `REPO` (dos niveles arriba), `URL_APP = http://localhost:${PORT}` (el `PORT` se lee del `.env` de la raíz) y las credenciales de Ana |
   | `entorno/servidor.mjs` (nuevo, reemplaza a `web.mjs`) | Solo comprueba que `URL_APP/login` responde `200`. Si no, falla con el comando para levantarlo. No levanta nada. |
   | `demo.mjs` | Se quita el comando `web` y se agregan `servidor` y `relevar`. `MUSICA` queda solo con la pista de DEVCEN. Se borran `FOTOS_TITULOS` (los títulos no llevan foto). La salida final se llama `demo-sgi-base.mp4`. |
   | `voz/locutor.py` | `CADENA` masculina (plan, §3) y el docstring con Mateo |
   | `guion/guion.mjs` | Acepta `formato`, `ruta`, `norma`, `chips[{texto,en}]`, `opcional`, `llamado` y `contacto`. Los tonos válidos son `acento` y `alerta`. |
   | `guion/guion.json` | El JSON del plan (§4), tal cual. Los `DEL CATÁLOGO` se reemplazan por las cláusulas que salen de `grep -A6 'key: "inspections"\|key: "safety_stats"\|key: "road_safety"' src/domain/modules/catalog.ts`. |

5. `npm install` dentro de `tools/demo-video`, en segundo plano.
6. Escribir `tools/demo-video/ESTADO.md` (fase y archivos adaptados) y adaptar el `README.md`. Del README se dejan la
   secuencia de comandos, «Qué necesita» y «Licencias», en 40 líneas como máximo.

### F2 · Los datos que faltan (sesión 1)

1. Crear `tools/demo-video/entorno/datos-extra.mts` con los datos de §6 del plan. Las reglas:
   - Se corre desde la raíz, para que use su `node_modules` y su `.env`:
     `npx tsx tools/demo-video/entorno/datos-extra.mts`.
   - Usa solo las funciones públicas de `src/lib`: `documents.ts`, `risks.ts`, `opportunities.ts`, `objectives.ts`,
     `measurements.ts`, `audits.ts`, `road-safety.ts` y `road-drivers.ts`. El patrón a imitar es el de
     `scripts/demo-seed/findings.ts` (`step`, `db` y `DemoTenant` de `scripts/demo-seed/kit.ts`). No escribe en tablas
     con `db.*.create` si existe una función de `src/lib` que lo haga.
   - Solo toca `demo-patagonia`, es idempotente (si el código o el título ya existe, lo saltea) y usa fechas relativas
     a hoy.
   - Los PDF de los documentos se generan con Playwright: `page.setContent()` con el código y el título y después
     `page.pdf()`. No se agregan dependencias.
   - Si la función de un módulo exige algo que no está en el plan (por ejemplo, un proceso o una sede), se usa el dato
     más parecido del seed y se anota en `ESTADO.md`.
2. Correrlo y comprobar que imprime un resumen por módulo. Si un módulo falla dos veces (seguridad vial o auditoría
   externa), se marca su escena como cortada en `ESTADO.md` y se sigue.
3. Importante: cada `--reset` del seed borra estos datos, así que después de un reset se vuelve a correr
   `datos-extra.mts`.

### F3 · Relevamiento (sesión 1)

1. Crear `grabar/relevar.mts`. Entra como Ana (en la pantalla real de login), usa el viewport y la escala del plan, y por
   cada captura del guion:
   - Va a la `ruta` y espera a que no quede nada cargando.
   - Escribe `trabajo/relevamiento/<id>.yml` con `await page.locator("main").ariaSnapshot()`, recortado a 250 líneas.
   - Guarda `trabajo/relevamiento/<id>.png`.
   - Agrega a `trabajo/relevamiento/consola.txt` los errores de consola de esa ruta.
2. Si una escena abre un detalle (documentos → «PE 02», riesgos, hallazgos, inspecciones, auditorías), hacer una segunda
   pasada solo para esos detalles: el link se saca del YAML de la lista y el archivo se llama `<id>-detalle.yml`.
3. Con los YAML, verificar cada frase del guion contra la pantalla (plan, §1 y §5). Para cada destacado, anotar en
   `ESTADO.md` el localizador elegido (`getByRole` o `getByText`, lo más estable posible). Lo que no exista se resuelve
   con el §5 del plan, y el cambio se anota.
4. Si `consola.txt` tiene errores en una ruta del video, anotarlos en `docs/demo/observaciones.md`.

### F4 · Voz (sesión 1)

1. `npm run demo -- voz`, en segundo plano.
2. Con `trabajo/voces.json`:
   - Sumar los `segundos` y los `respiro` de todas las escenas. Si el total pasa de 3:40, aplicar los cortes del plan
     (§4), en orden, y volver a generar solo la voz.
   - Revisar que cada palabra de sincronía (`chips[].en` y las que va a usar `enPalabra`) aparezca en los tiempos.
3. Escuchar no se puede. En su lugar, se revisa con `grep` en `voces.json` que «Dev Cen» y «Ese ge i» se partieron en
   palabras. La pronunciación la escucha Nico al final (F7).
4. Cerrar la sesión 1: `ESTADO.md` al día y commit `wip: herramienta, datos y voz del video demo`. Sin push.

### F5 · Grabación (sesión 2)

1. Abrir `tools/demo-video/ESTADO.md`, que tiene los localizadores y los cambios. No releer el plan entero: solo §2 y
   §4.
2. Adaptar `grabar/grabar.mts`:
   - Viewport de 1600 × 900, la escala del plan y CSS inyectado que oculta solo las barras de scroll.
   - Agregar `--escena <id>[,<id>]` para regrabar solo esas escenas, si no existe. Esto ahorra grabaciones completas.
3. Adaptar `grabar/cursor.mjs`: comprobar con un YAML o con un `evaluate` si la página desplaza la ventana o un
   contenedor, y animar ese.
4. Reescribir `grabar/escenas.mts`, con una función por captura:
   - Navegar o hacer clic.
   - `cursor.deslizar` cuando haga falta.
   - Cada destacado con `enPalabra("<palabra>")`, usando el localizador de `ESTADO.md`.
   - `ingreso`: completar el mail y la contraseña a velocidad visible y hacer clic en «Ingresar» (o el texto real del
     botón). Las escenas que siguen usan la misma sesión.
   - `avisos`: abrir la campana de avisos.
5. Correr `npm run demo -- servidor` y después `npm run demo -- grabar`, en segundo plano. Revisar `trabajo/marcas.json`:
   cada destacado tiene que tener su marca. Las que falten se regraban con `--escena`.

### F6 · Edición (sesión 2)

Adaptar `video/`, leyendo cada archivo una sola vez:

| Archivo | Cambio |
|---|---|
| `Root.tsx` | 1920 × 1080, con el `formato` del guion |
| `tema.ts` | `tema` con los colores reales de `src/app/globals.css`: `grep -E "^\s*--color-(canvas\|ink\|ink-muted\|form-rail\|card-line):" src/app/globals.css`, y para `alerta`, el token de estado vencido o error. `devcen` sin cambios. |
| `fuentes.ts` | Las fuentes de la app (salen de `grep -n "font" src/app/layout.tsx`) con `@remotion/google-fonts`. Las de DEVCEN sin cambios. |
| `piezas/MarcoVentana.tsx` (nuevo) | Ventana de 1600 × 900 centrada, con borde, sombra suave, radio de 12 px y los tres puntos. Sin URL. |
| `piezas/Rotulo.tsx` | El rótulo arriba a la izquierda y, a su derecha, el chip `norma` |
| `piezas/Subtitulos.tsx` | Píldora sobre el borde inferior de la ventana, de 1200 px de ancho como máximo |
| `piezas/Pistas.tsx` | Solo la pista de DEVCEN: entera en la apertura y el cierre, en bucle con fundido a −24 dB en el medio. Sin tango. |
| `escenas/Captura.tsx` | Usa `MarcoVentana` |
| `escenas/Portada.tsx`, `Tanda.tsx` y `Final.tsx` | Sin foto de fondo, con el fondo `canvas` y los `chips` que entran con su palabra. `Final` muestra el `llamado`. |
| `escenas/Apertura.tsx` y `Cierre.tsx` | Tamaños para horizontal. En `Cierre`, el texto «Una plataforma desarrollada por». Las palabras de sincronía siguen siendo `Una` y `Dev`. |
| `Demo.tsx` | Sacar las escenas de Milongas y usar `contacto` del guion |
| `linea.ts` | Solo si cambian los tipos o los tonos |

Después: `npm run demo -- linea` y `npm run demo -- render`, en segundo plano, y luego `npm run demo -- final`.

### F7 · Control de calidad y entrega (sesión 2)

1. Mirar `salida/hoja-de-contacto.jpg` (una sola imagen) contra los criterios de aceptación del plan (§7).
2. Por cada escena con un problema: corregir, sacar el cuadro con `render --cuadro N` (el `N` sale de
   `trabajo/linea.json`, al 60 % de la escena) y mirar solo ese cuadro. Si el problema es de grabación, regrabar con
   `--escena`.
3. Volver a renderizar con `render` y `final`. Comprobar en la salida de `final` −14 LUFS integrado (±1) y un pico
   verdadero ≤ −1 dBTP. Comprobar la duración con `ffprobe` (de `imageio_ffmpeg`).
4. Revisar la ortografía de los subtítulos en `trabajo/voces.json` (los campos `texto`).
5. Publicar con `/publicar-cambios`, en la rama `demo/video-sgi-base`. Entran `tools/demo-video` (sin `trabajo/`,
   `salida/` ni mp3, que ya excluye su `.gitignore`), `docs/demo/` y los dos cambios de `tsconfig.json` y
   `eslint.config.mjs`. El mp4 no se versiona.
6. Mensaje final a Nico:
   - La ruta absoluta de `salida/demo-sgi-base.mp4` y de la hoja de contacto.
   - La duración y los LUFS.
   - Los cambios al guion.
   - Lo anotado en `observaciones.md`.
   - Lo que falta antes de publicar: escuchar la pronunciación y confirmar la licencia de Mixkit.
7. Si Nico no va a regrabar enseguida, borrar la base con `npm run wt:setup -- demo-video --drop`.

## 3. Si algo sale mal

| Síntoma | Qué hacer |
|---|---|
| El login falla en la grabación | Revisar las URL del `.env` (F0.4) y que el build sea posterior al cambio del `.env` |
| El screencast va a menos de 30 cuadros/s | Bajar `deviceScaleFactor` a 1 y el zoom de los destacados a 1.2 como máximo |
| Un destacado cae en el lugar equivocado | El localizador no es único: usar `.filter({ hasText })` o `alFrente()` (los trucos de Milongas en su README) |
| `enPalabra` no encuentra la palabra | Elegir otra palabra de la frase (plan, §5.2) |
| `datos-extra` falla en un módulo | Saltear ese módulo, cortar su escena y anotarlo |
| El hook `verify-on-stop` falla por `tools/` | Faltan las exclusiones de F1.3 |
| Remotion renderiza escenas viejas | El caché de Remotion: ver «Trampas encontradas» en el README de Milongas |
