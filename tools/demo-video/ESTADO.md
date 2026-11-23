# Estado del video demo
Worktree demo-video · PORT 3124 · base sgi_wt_demo_video · app: `next start -p 3124` (producción, build ya hecho).
Pasar a Sonnet 5.5 desde la sesión 2 (F5 a F7).

- F0 ✔  F1 ✔ (herramienta adaptada, tools excluido de tsc/eslint)
- F2 ✔ `entorno/datos-extra.mts` (idempotente, se re-corre después de cada `--reset`): 8 documentos (15 versiones),
  4 riesgos, 1 oportunidad, 3 objetivos con 18 mediciones, 2 auditorías (1 cerrada con 1 hallazgo, 1 planificada) con
  programa aprobado, choferes con licencia, y activa el módulo road_safety (el seed no lo activaba: daba 404).
- F3 ✔ relevamiento en `trabajo/relevamiento/*.yml|png` (vial se relevó de nuevo, ya activado).
- F4 ✔ voz (Mateo; ~193 s + transiciones, sin cortes extra)  · F5 ✔ grabación (`npm run demo -- grabar`, 13 escenas, todas las marcas; ~165 s de toma)  · F6 ✔ edición (1920×1080, tema claro de la plataforma, `video/` adaptado)  · F7 ◐ control hecho; falta que Nico escuche la voz y publicar

## Cambios al guion (plan §5)
- documentos: la pantalla no muestra «quién lo aprobó» (solo título con código, `vN` y archivo): se cambió por «listo para descargar».
- riesgos/objetivos/inspecciones/hallazgos/accidentabilidad/vial/equipos/capacitaciones/proveedores/auditorías: frases y
  destacados reescritos con lo que la pantalla muestra (sin «certificado adjunto», «eficacia verificada», «seguimiento»,
  «lista de verificación» ni «habilitado»). Panel: áreas + próximos vencimientos.
- avisos: CORTADA (no hay campana de avisos; corte previsto n.º 2 del plan §4). La escena «vial» se mantiene.
- Datos: no hizo falta cargar vehículos (el seed ya trae VL-01..05) ni generar PDF con Playwright (`demoPdf` de kit.ts).

## Notas para F5
- Los tableros son la pestaña por defecto de cada módulo: no hay que navegar a «Tablero».
- Login: `input[type=email]`, `input[type=password]`, `button[type=submit]` (grabar/relevar.mts → `ingresar`).
- Detalles reales: riesgos y objetivos se abren haciendo clic en el nombre (los `/guia` NO son detalle); hallazgos → «Editar».
- Pantallas tardan en cargar en producción local: usar `waitUntil: "networkidle"` y precalentar las rutas.
## Notas F5 (hecho)
- datos-extra suma: horas del último mes (índices de accidentabilidad ya no dicen «sin datos») y km de la flota de 12 meses (tasas viales).
- Escenas: panel/riesgos/proveedores/accidentabilidad/vial se desplazan; hallazgos abre «Ver» de uno «En curso» (causa raíz 5 porqués);
  vial pasa a la pestaña Conductores; capacitaciones se queda en Resumen. marcas.json: `capturas.ventana` + `evento.captura` (regrabar
  con `--escena` suma `ventana-xxxx`; linea.ts debe leer `evento.captura`).
- Servidor: si el login da 500, matar el node del puerto 3124 y `npx next start -p 3124` (log en trabajo/logs/server2.log).
## Problemas
- Consola: solo un 404 en vial (antes de activar el módulo).
- Panel muestra «Vencido hace 1411 d» y «Cumplimiento 0 %» (datos del seed, no se tocan): ver docs/demo/observaciones.md.

## Entrega (F7)
- salida/demo-sgi-base.mp4 · 3:25 · -14,0 LUFS · pico -1,3 dBTP (se quitó el alimiter del paso `final`: subía el pico a -0,1).
- Render: `npm run demo -- render` tarda ~35 min en esta máquina (8 GB); el blob OOM de Chrome se resuelve solo con el reintento.
- Pendiente: Nico escucha «Dev Cen» / «Ese ge i»; publicar con /publicar-cambios en demo/video-sgi-base (no se publicó).
- Desajustes guion/pantalla a decidir: vial dice «cada hecho de tránsito» (hay 0) y «licencia al día» (una sale por vencer, no habilitado).

## Correcciones v2 (23/11) — en curso
Pedido de Nico: nombre «SGI DevCen» alternado con «sistema de gestión integrado»; sacar «evidencia de todo»; tema OSCURO y home
ACTUAL (main ya trae el hub compacto: se hizo `git merge main` y build nuevo); otra forma de mostrar el punto 3; mejorar el
arranque de seguridad vial; no mostrar las ISO una por una.
- ✔ guion.json: nombres, problema sin chips ni «evidencia de todo», camino con 3 tarjetas, vial en una sola frase, `norma` quitada
  de todas las capturas (ya no hay chip de norma en el rótulo). Voz regenerada (solo cambiaron portada, problema, camino, ingreso, vial, final).
- ✔ video/: tema oscuro (tema.ts, MarcoVentana), `Titulo` con variante `pasos` (3 tarjetas con lista; la 3.ª = evidencia con checks).
- ✔ grabar.mts y relevar.mts fuerzan tema oscuro (`colorScheme: "dark"` + localStorage `sgi-theme`).
- ☐ BLOQUEO: Docker Desktop con el motor trabado (500 en `_ping`), Postgres caído → login da 500. Abrir/reiniciar Docker Desktop y
  `docker compose up -d` desde la RAÍZ del repo principal (no desde la worktree: crearía otro proyecto/volumen).
- ☐ Reiniciar `next start -p 3124` (matar el node del 3124) cuando Postgres esté arriba; probar login (200).
- ☐ `ESCENAS=panel,documentos npm run demo -- relevar` y revisar: el hub compacto cambió; los localizadores de `panel`
  (`navigation "Principal"`, `heading "Próximos vencimientos"`, `region "Estado del sistema"`) y `documentos` (ahora hay carpetas) pueden no existir.
- ☐ `npm run demo -- grabar` (todo, tema oscuro) → `linea` → `render` (~35 min) → `final` → copiar a Escritorio\Demo-SGI-Base.
