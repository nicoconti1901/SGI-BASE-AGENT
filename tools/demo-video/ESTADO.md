# Estado del video demo
Worktree demo-video · PORT 3124 · base sgi_wt_demo_video · app: `next start -p 3124` (producción, build ya hecho).
Pasar a Sonnet 5.5 desde la sesión 2 (F5 a F7).

- F0 ✔  F1 ✔ (herramienta adaptada, tools excluido de tsc/eslint)
- F2 ✔ `entorno/datos-extra.mts` (idempotente, se re-corre después de cada `--reset`): 8 documentos (15 versiones),
  4 riesgos, 1 oportunidad, 3 objetivos con 18 mediciones, 2 auditorías (1 cerrada con 1 hallazgo, 1 planificada) con
  programa aprobado, choferes con licencia, y activa el módulo road_safety (el seed no lo activaba: daba 404).
- F3 ✔ relevamiento en `trabajo/relevamiento/*.yml|png` (vial se relevó de nuevo, ya activado).
- F4 ✔ voz (Mateo; ~193 s + transiciones, sin cortes extra)  · F5 ☐ grabación  · F6 ☐ edición  · F7 ☐ control y entrega

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
## Problemas
- Consola: solo un 404 en vial (antes de activar el módulo).
