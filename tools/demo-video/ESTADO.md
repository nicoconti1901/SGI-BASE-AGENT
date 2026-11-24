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

## Correcciones v2 (23/11) — HECHAS
- salida/demo-sgi-base.mp4 · 3:26 · -14,0 LUFS · pico -1,3 · copiado a Escritorio\Demo-SGI-Base.
- Hecho: nombre «SGI DevCen» alternado con «sistema de gestión integrado»; sin «evidencia de todo»; tema oscuro y hub actual
  (merge de main + build nuevo); punto 3 como tarjeta con checks; vial en una sola frase; sin chips de norma ni ISO una por una.
- Panel: ya no se expande «Estado del sistema» (mostraba «Cumplimiento 0 %» y «Vencido hace 1413 d»); se destacan las áreas y
  «Operación SST». Documentos: se entra a la carpeta Procedimientos (`?carpeta=procedimientos`).
- Si Docker/Postgres se cae: abrir Docker Desktop y esperar `docker ps`; luego matar el node del 3124 y `npx next start -p 3124`.
- Pendiente: Nico escucha «Dev Cen» / «Ese ge i»; la app dice «SGI Base» en login y encabezado; publicar (no se publicó).
- Test ajeno: tests/training-followup (plan anual) falla desde ~21/11 porque +40 días cae en otro año; no es de esta rama.
