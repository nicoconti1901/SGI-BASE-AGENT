# Plan — Video demo de SGI Base

**Qué es:** un video demo de unos 3:15 min, horizontal (1920 × 1080, 30 fps), con la presentación y el cierre de DEVCEN de
siempre, la voz de Mateo (`es-UY-MateoNeural`) y subtítulos palabra por palabra. Se graba con Playwright sobre la
plataforma real (datos de demo ficticios) y se edita con Remotion.

**Cómo se ejecuta:** paso a paso en [PROCEDIMIENTO-demo-video.md](PROCEDIMIENTO-demo-video.md). Este archivo dice qué se
muestra y qué se dice; el procedimiento dice cómo.

**Base técnica:** la herramienta de la demo de Milongas (`C:\Users\nicoc\Proyectos\milongas-app\tools\demo-video`), que
ya trae la apertura y el cierre de DEVCEN (logo que se dibuja, DEVCEN, CONNECTED SYSTEMS, `www.dev-cen.com`), la música
`devcen-talent-in-the-air.mp3`, el locutor con `edge-tts`, la grabación por escenas sincronizada con la voz y el render
por partes a −14 LUFS. Se copia a `tools/demo-video/` y se adapta: escritorio en lugar de celular, servidor Next en lugar
de web estática con mocks, y voz masculina.

---

## 1. Mensaje

> **Para venderle a una gran empresa no alcanza con hacer bien el trabajo: hay que demostrarlo. SGI Base es el camino
> para calificar: el sistema ISO ordenado, funcionando todos los días y con la evidencia lista para la auditoría del
> cliente.**

- **Para quién es el video:** dueños, gerentes y responsables de calidad/HSE de pymes contratistas y proveedoras (obra,
  servicios, industria) que quieren entrar o quedarse en la cartera de proveedores de una operadora o de una gran
  empresa.
- **El hilo:** cada pantalla responde a un requisito que la gran empresa audita, y lleva un chip con la norma y la
  cláusula (por ejemplo `ISO 9001 · 14001 · 45001 — 7.5`).
- **Dónde aparece el mensaje:** en la portada, en «problema» y en «camino» (al principio), en «proveedores» (la gran
  empresa te evalúa a vos y vos evaluás a tus contratistas) y en el final (`calificá para trabajar con las grandes
  empresas`).

### Lo que no se dice

- **No prometemos la certificación.** La certificación la otorga un organismo certificador. Decimos «cumplís con los
  requisitos», «lo demostrás con evidencia», «llegás a la auditoría preparado» y «calificás como proveedor».
- **No nombramos empresas reales** (operadoras, clientes ni certificadoras). Decimos «una gran empresa» o «la
  operadora».
- **Todo lo que dice la voz se tiene que ver en la pantalla de esa escena.** Si la plataforma no muestra algo (por
  ejemplo «quién lo aprobó»), se cambia la frase y no se inventa. Ver §5.

## 2. Formato

| Aspecto | Decisión |
|---|---|
| Lienzo | 1920 × 1080, 30 fps, H.264 + AAC, −14 LUFS integrado y pico verdadero ≤ −1 dBTP |
| Duración | Entre 3:00 y 3:30 (máximo 3:40). Si se pasa, se aplican los cortes de §4, en orden. |
| Grabación | Chromium de Playwright, viewport de 1600 × 900, `deviceScaleFactor` de 1.25 (si el screencast baja de 30 cuadros/s en los scroll, se usa 1) |
| Marco | `MarcoVentana`: ventana de navegador de 1600 × 900 centrada, con los tres puntos y sin barra de dirección (no se muestra `localhost`). Reemplaza a `MarcoTelefono`. |
| Arriba | Rótulo de la escena y, a su derecha, el chip de norma (`norma`) |
| Abajo | Subtítulos palabra por palabra en una píldora sobre el borde inferior de la ventana |
| Destacados | Los de Milongas: recuadro, ícono lucide, texto y zoom ≤ 1.3 sobre el elemento, sincronizados con una palabra de la frase |
| Tonos | `acento`, con `--color-form-rail` de `src/app/globals.css` (tema claro), y `alerta`, con el rojo de estado de la plataforma. Reemplazan a `oro` y `vino`. |
| Títulos | Fondo `--color-canvas`, tinta `--color-ink` y las fuentes de la plataforma (`--font-display`, `--font-sans`). Las escenas `titulo` con `chips` los muestran de a uno, sincronizados con la palabra `en`. |
| DEVCEN | La apertura y el cierre son los de Milongas sin cambios de estilo, adaptados a horizontal. El cierre dice «Una plataforma desarrollada por» (no «Una app…»), y el contacto es `www.dev-cen.com`. |
| Música | `devcen-talent-in-the-air.mp3` en la apertura y el cierre, como en las otras demos. En el medio, la misma pista en bucle con fundido cruzado, a −24 dB debajo de la voz. No se usa el tango. Antes de publicar, confirmar la licencia de Mixkit (ver `musica/LICENCIA.md`). |
| Voz | `es-UY-MateoNeural`, rate `-3%`, pitch `+0Hz`, con cadena masculina (§3) |

## 3. Voz (Mateo)

- **Voz:** `es-UY-MateoNeural`. Es la muestra `3-mateo-UY-masculina.mp3` de
  `milongas-app/tools/demo-video/salida/voces-muestra/`.
- **Cadena de ffmpeg** (reemplaza la femenina en `voz/locutor.py`):
  `highpass=f=75,equalizer=f=160:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=-18dB:ratio=3:attack=5:release=120:makeup=2.5`
- **Pronunciación** (marcas `{visible|hablado}` del locutor):
  - `{DEVCEN|Dev Cen}`
  - `{SGI|Ese ge i}`
  - Si «ISO» suena mal, `{ISO|iso}`.
  - Las normas no se nombran con número en la voz. Los números van en los chips, porque «cuarenta y cinco mil uno»
    cansa.
- **Registro:** voseo rioplatense, frases cortas, sin jerga técnica (nada de «tenant», «módulo» ni «HSE»).

## 4. Escenas y guion

Orden del video. Las rutas son de la empresa `demo-patagonia` («Constructora Patagonia Demo»). Toda la grabación se hace
con **Ana Paredes**, la administradora (`admin.patagonia@demo.sgi.test`, contraseña `Demo123!demo`). El texto del chip
`norma` se toma de `clauses` en `src/domain/modules/catalog.ts`, que es la única fuente; los valores de la tabla son los
esperados.

| # | id | Tipo | Ruta | Chip `norma` | Qué se ve y se hace |
|---|---|---|---|---|---|
| 0 | apertura | título | — | — | Presentación de DEVCEN |
| 1 | portada | título | — | — | «SGI Base», y debajo «El camino para calificar con las grandes empresas» |
| 2 | problema | título | — | — | Entran los 4 chips de norma |
| 3 | camino | título | — | — | Entran los 3 chips del camino |
| 4 | tanda1 | título | — | — | Separador «Cumplimiento y mejora» |
| 5 | ingreso | captura | `/login` | — | Ana escribe su mail y su contraseña y entra |
| 6 | panel | captura | `/t/demo-patagonia` | — | El panel: vencimientos, abiertos y áreas |
| 7 | documentos | captura | `…/documents` | 7.5 | Lista codificada; se abre «PE 02 Trabajo en altura» |
| 8 | riesgos | captura | `…/risks` | 6.1 | Matriz por proceso; se abre el riesgo alto de obra y la oportunidad comercial |
| 9 | objetivos | captura | `…/indicators` | 6.2 · 9.1 | Indicadores con meta y tendencia |
| 10 | tanda2 | título | — | — | Separador «En la obra, todos los días» |
| 11 | inspecciones | captura | `…/inspections` | catálogo | Una inspección de andamio con un ítem «No cumple» y su hallazgo |
| 12 | hallazgos | captura | `…/findings` | 10.2 | Un hallazgo con los cinco porqués, las acciones y la eficacia |
| 13 | accidentabilidad | captura | `…/safety` | catálogo | Índices de frecuencia y gravedad por sede y por mes |
| 14 | vial *(cortable 1)* | captura | `…/road-safety` | catálogo (39001) | Choferes, licencias y vehículos |
| 15 | equipos | captura | `…/instruments` | 7.1.5 | Calibraciones y certificado |
| 16 | tanda3 | título | — | — | Separador «Personas y contratistas» |
| 17 | capacitaciones | captura | `…/training` | 7.2 · 7.3 | La matriz por puesto y tarea crítica |
| 18 | proveedores | captura | `…/suppliers` | 8.4 | La evaluación de un contratista |
| 19 | auditorias | captura | `…/audits` | 9.2 | El programa y una auditoría cerrada con sus hallazgos |
| 20 | avisos *(cortable 2)* | captura | `/t/demo-patagonia` | — | La campana de avisos abierta |
| 21 | final | título | — | — | El cierre del mensaje y «Pedí una demo» |
| 22 | cierre | título | — | — | Cierre de DEVCEN y `www.dev-cen.com` |

**Cortes, en orden, si la duración se pasa de 3:40:** 1) vial, 2) avisos, 3) tanda1 (se pasa directo a ingreso),
4) objetivos.

### `guion/guion.json` (texto final de la voz)

Va tal cual. El validador (`guion/guion.mjs`) tiene que aceptar los campos nuevos: `formato`, `ruta`, `norma` (texto
del chip, en las capturas), `chips` (en los títulos: `texto` y `en`, la palabra de la voz que lo hace entrar),
`opcional`, `llamado` y los tonos `acento` y `alerta`. Los `id` de los destacados son los que usa `grabar/escenas.mts`.

```json
{
  "voz": { "nombre": "es-UY-MateoNeural", "rate": "-3%", "pitch": "+0Hz" },
  "fps": 30,
  "formato": { "ancho": 1920, "alto": 1080 },
  "escenas": [
    { "id": "apertura", "tipo": "titulo", "segundos": 6.5, "voz": "{DEVCEN|Dev Cen} presenta.", "vozDesde": 3.6 },
    { "id": "portada", "tipo": "titulo", "voz": "{SGI|Ese ge i} Base. Tu sistema de gestión ISO, listo para trabajar con las grandes empresas.", "respiro": 0.6 },
    {
      "id": "problema", "tipo": "titulo", "respiro": 0.8,
      "voz": "Para entrar como proveedor de una gran empresa no alcanza con hacer bien el trabajo: hay que demostrarlo. Calidad, ambiente, seguridad y salud, seguridad vial… y evidencia de todo.",
      "chips": [
        { "texto": "ISO 9001 · Calidad", "en": "Calidad" },
        { "texto": "ISO 14001 · Ambiente", "en": "ambiente" },
        { "texto": "ISO 45001 · Seguridad y salud", "en": "salud" },
        { "texto": "ISO 39001 · Seguridad vial", "en": "vial" }
      ]
    },
    {
      "id": "camino", "tipo": "titulo", "respiro": 0.8,
      "voz": "{SGI|Ese ge i} Base es el camino: ordena tu sistema, lo pone a funcionar todos los días y deja la evidencia lista para la auditoría del cliente.",
      "chips": [
        { "texto": "1 · Sistema ordenado", "en": "ordena" },
        { "texto": "2 · Gestión de todos los días", "en": "funcionar" },
        { "texto": "3 · Evidencia para auditar", "en": "evidencia" }
      ]
    },
    { "id": "tanda1", "tipo": "titulo", "opcional": true, "voz": "Cumplimiento y mejora." },
    {
      "id": "ingreso", "tipo": "captura", "ruta": "/login", "rotulo": "Ingreso", "respiro": 0.5,
      "voz": "Ana, gerente de operaciones de Constructora Patagonia, entra a su espacio. Ve solo los datos de su empresa.",
      "destacados": []
    },
    {
      "id": "panel", "tipo": "captura", "ruta": "/t/demo-patagonia", "rotulo": "Panel de la empresa", "respiro": 0.6,
      "voz": "En el panel está el pulso del sistema: lo que vence, lo que quedó abierto, y cada área de la norma, en un solo lugar.",
      "destacados": [
        { "id": "vence", "texto": "Lo que vence", "icono": "calendar-clock", "tono": "alerta", "zoom": 1.25 },
        { "id": "abierto", "texto": "Lo que quedó abierto", "icono": "circle-alert", "tono": "acento", "zoom": 1.25 },
        { "id": "areas", "texto": "Áreas de la norma", "icono": "layout-grid", "tono": "acento" }
      ]
    },
    {
      "id": "documentos", "tipo": "captura", "ruta": "/t/demo-patagonia/documents", "rotulo": "Documentos controlados", "norma": "ISO 9001 · 14001 · 45001 — 7.5", "respiro": 0.6,
      "voz": "Los documentos están controlados: cada uno con su código, su revisión vigente y quién lo aprobó. El auditor pide un procedimiento… y está. Sin versiones sueltas por mail.",
      "destacados": [
        { "id": "codigo", "texto": "Código único", "icono": "hash", "tono": "acento", "zoom": 1.3 },
        { "id": "revision", "texto": "Revisión vigente", "icono": "file-check", "tono": "acento", "zoom": 1.3 },
        { "id": "aprobo", "texto": "Quién lo aprobó", "icono": "user-check", "tono": "acento", "zoom": 1.3 }
      ]
    },
    {
      "id": "riesgos", "tipo": "captura", "ruta": "/t/demo-patagonia/risks", "rotulo": "Riesgos y oportunidades", "norma": "ISO 9001 · 14001 · 45001 — 6.1", "respiro": 0.6,
      "voz": "Riesgos y oportunidades por proceso, evaluados y con sus acciones. Es lo primero que mira un auditor, y acá está a la vista.",
      "destacados": [
        { "id": "nivel", "texto": "Nivel de riesgo", "icono": "gauge", "tono": "alerta", "zoom": 1.25 },
        { "id": "oportunidad", "texto": "Oportunidad", "icono": "trending-up", "tono": "acento", "zoom": 1.25 },
        { "id": "accion", "texto": "Acción asignada", "icono": "list-checks", "tono": "acento", "zoom": 1.25 }
      ]
    },
    {
      "id": "objetivos", "tipo": "captura", "ruta": "/t/demo-patagonia/indicators", "rotulo": "Objetivos e indicadores", "norma": "ISO 9001 · 14001 · 45001 — 6.2 · 9.1", "opcional": true, "respiro": 0.6,
      "voz": "Los objetivos se miden: cada indicador con su meta y su resultado mes a mes. Así se demuestra que el sistema mejora.",
      "destacados": [
        { "id": "meta", "texto": "Meta", "icono": "target", "tono": "acento", "zoom": 1.25 },
        { "id": "resultado", "texto": "Resultado mes a mes", "icono": "chart-line", "tono": "acento", "zoom": 1.25 }
      ]
    },
    { "id": "tanda2", "tipo": "titulo", "voz": "En la obra, todos los días." },
    {
      "id": "inspecciones", "tipo": "captura", "ruta": "/t/demo-patagonia/inspections", "rotulo": "Inspecciones en obra", "norma": "DEL CATÁLOGO", "respiro": 0.6,
      "voz": "El supervisor inspecciona el andamio en la obra. Si algo no cumple, no queda en un papel: se convierte en un hallazgo con responsable.",
      "destacados": [
        { "id": "lista", "texto": "Lista de verificación", "icono": "clipboard-check", "tono": "acento", "zoom": 1.25 },
        { "id": "nocumple", "texto": "No cumple", "icono": "circle-x", "tono": "alerta", "zoom": 1.3 },
        { "id": "hallazgo", "texto": "Hallazgo con responsable", "icono": "flag", "tono": "acento", "zoom": 1.25 }
      ]
    },
    {
      "id": "hallazgos", "tipo": "captura", "ruta": "/t/demo-patagonia/findings", "rotulo": "Hallazgos y acciones", "norma": "ISO 9001 · 14001 · 45001 — 10.2", "respiro": 0.7,
      "voz": "Cada hallazgo tiene su análisis de causa con los cinco porqués, sus acciones con fecha y responsable, y la verificación de eficacia antes de cerrarlo.",
      "destacados": [
        { "id": "causa", "texto": "Causa raíz", "icono": "git-branch", "tono": "acento", "zoom": 1.25 },
        { "id": "acciones", "texto": "Acciones con responsable", "icono": "list-checks", "tono": "acento", "zoom": 1.25 },
        { "id": "eficacia", "texto": "Eficacia verificada", "icono": "badge-check", "tono": "acento", "zoom": 1.3 }
      ]
    },
    {
      "id": "accidentabilidad", "tipo": "captura", "ruta": "/t/demo-patagonia/safety", "rotulo": "Accidentabilidad", "norma": "DEL CATÁLOGO", "respiro": 0.6,
      "voz": "Los índices de frecuencia y de gravedad se calculan solos, por sede y por mes. Son los números que una gran empresa pide antes de dejarte entrar.",
      "destacados": [
        { "id": "frecuencia", "texto": "Índice de frecuencia", "icono": "activity", "tono": "acento", "zoom": 1.25 },
        { "id": "gravedad", "texto": "Índice de gravedad", "icono": "activity", "tono": "alerta", "zoom": 1.25 },
        { "id": "sede", "texto": "Por sede", "icono": "map-pin", "tono": "acento" }
      ]
    },
    {
      "id": "vial", "tipo": "captura", "ruta": "/t/demo-patagonia/road-safety", "rotulo": "Seguridad vial", "norma": "DEL CATÁLOGO", "opcional": true, "respiro": 0.6,
      "voz": "La seguridad vial también: choferes con licencia vigente, vehículos con su documentación, y alertas antes de que algo venza.",
      "destacados": [
        { "id": "licencia", "texto": "Licencia vigente", "icono": "id-card", "tono": "acento", "zoom": 1.25 },
        { "id": "vehiculo", "texto": "Vehículo y documentación", "icono": "truck", "tono": "acento", "zoom": 1.25 },
        { "id": "alerta", "texto": "Por vencer", "icono": "bell", "tono": "alerta", "zoom": 1.25 }
      ]
    },
    {
      "id": "equipos", "tipo": "captura", "ruta": "/t/demo-patagonia/instruments", "rotulo": "Equipos de medición", "norma": "ISO 9001 — 7.1.5", "respiro": 0.6,
      "voz": "Los equipos de medición, con su calibración al día y el certificado adjunto. Si uno está por vencer, el sistema avisa.",
      "destacados": [
        { "id": "calibracion", "texto": "Calibración al día", "icono": "ruler", "tono": "acento", "zoom": 1.25 },
        { "id": "certificado", "texto": "Certificado adjunto", "icono": "paperclip", "tono": "acento", "zoom": 1.3 },
        { "id": "porvencer", "texto": "Por vencer", "icono": "bell", "tono": "alerta", "zoom": 1.25 }
      ]
    },
    { "id": "tanda3", "tipo": "titulo", "voz": "Personas y contratistas." },
    {
      "id": "capacitaciones", "tipo": "captura", "ruta": "/t/demo-patagonia/training", "rotulo": "Capacitaciones", "norma": "ISO 9001 · 14001 · 45001 — 7.2 · 7.3", "respiro": 0.6,
      "voz": "La matriz de capacitación cruza puesto y tarea crítica: trabajo en altura, espacios confinados, izaje de cargas. Se ve quién está habilitado y a quién le vence.",
      "destacados": [
        { "id": "matriz", "texto": "Puesto × tarea crítica", "icono": "grid-3x3", "tono": "acento", "zoom": 1.2 },
        { "id": "habilitado", "texto": "Habilitado", "icono": "badge-check", "tono": "acento", "zoom": 1.3 },
        { "id": "vence", "texto": "Por vencer", "icono": "calendar-clock", "tono": "alerta", "zoom": 1.3 }
      ]
    },
    {
      "id": "proveedores", "tipo": "captura", "ruta": "/t/demo-patagonia/suppliers", "rotulo": "Proveedores y contratistas", "norma": "ISO 9001 — 8.4", "respiro": 0.6,
      "voz": "Y así como la gran empresa te evalúa a vos, vos evaluás a tus contratistas: criterios, documentación y seguimiento, con el mismo rigor.",
      "destacados": [
        { "id": "criterios", "texto": "Criterios", "icono": "list-checks", "tono": "acento", "zoom": 1.25 },
        { "id": "documentacion", "texto": "Documentación al día", "icono": "folder-check", "tono": "acento", "zoom": 1.25 },
        { "id": "seguimiento", "texto": "Seguimiento", "icono": "repeat", "tono": "acento", "zoom": 1.25 }
      ]
    },
    {
      "id": "auditorias", "tipo": "captura", "ruta": "/t/demo-patagonia/audits", "rotulo": "Auditorías", "norma": "ISO 9001 · 14001 · 45001 — 9.2", "respiro": 0.8,
      "voz": "Las auditorías internas se planifican y se ejecutan con su lista de verificación, y lo que encuentran entra al mismo circuito de mejora. Cuando llega el auditor del cliente, la evidencia ya está.",
      "destacados": [
        { "id": "programa", "texto": "Programa de auditorías", "icono": "calendar-range", "tono": "acento", "zoom": 1.2 },
        { "id": "lista", "texto": "Lista de verificación", "icono": "clipboard-check", "tono": "acento", "zoom": 1.25 },
        { "id": "circuito", "texto": "Hallazgos al circuito", "icono": "flag", "tono": "acento", "zoom": 1.25 }
      ]
    },
    {
      "id": "avisos", "tipo": "captura", "ruta": "/t/demo-patagonia", "rotulo": "Avisos", "opcional": true, "respiro": 0.6,
      "voz": "Y los vencimientos avisan solos, por correo y en la plataforma. Nadie se entera tarde.",
      "destacados": [ { "id": "campana", "texto": "Avisos", "icono": "bell", "tono": "alerta", "zoom": 1.3 } ]
    },
    {
      "id": "final", "tipo": "titulo", "llamado": "Pedí una demo", "respiro": 1.0,
      "voz": "{SGI|Ese ge i} Base. Cumplí con los requisitos ISO, demostralo con evidencia… y calificá para trabajar con las grandes empresas."
    },
    { "id": "cierre", "tipo": "titulo", "segundos": 7.5, "voz": "Una plataforma desarrollada por {DEVCEN|Dev Cen}.", "contacto": "www.dev-cen.com" }
  ]
}
```

`"norma": "DEL CATÁLOGO"` es un marcador. Se reemplaza por las cláusulas de ese módulo en `catalog.ts`, con el mismo
formato (`ISO 45001 — 9.1` o `ISO 39001 — …`). Si un módulo no tiene cláusulas, se borra el campo.

## 5. Ajustes permitidos al guion

El ejecutor puede tocar el guion solo en estos casos, y anota cada cambio en `tools/demo-video/ESTADO.md`:

1. **Una frase dice algo que la pantalla no muestra.** Se reescribe con una extensión parecida y se mantiene el
   sentido. Ejemplo: si los documentos no muestran el aprobador, «…su revisión vigente y su historial de cambios».
2. **Una palabra de sincronía no aparece en los tiempos** (`enPalabra` o `chips[].en`, porque el TTS la partió o la
   cambió). Se elige otra palabra de la misma frase.
3. **Cortes de §4** por duración.

El mensaje (§1), la apertura, el cierre y el final no se tocan.

## 6. Datos de la demo

La base es el seed de revisión (`npm run db:seed:revision -- --reset`), que ya carga para `demo-patagonia` usuarios,
sedes, personas, inspecciones, equipos de medición, capacitaciones, proveedores, hallazgos y accidentabilidad, y corre
el scan de vencimientos. **No trae** documentos, riesgos y oportunidades, objetivos, auditorías ni seguridad vial: esos
datos los carga `tools/demo-video/entorno/datos-extra.mts` (ver el procedimiento, F2), con las funciones de `src/lib`.
Los datos son ficticios. Las fechas son relativas a hoy, así que la grabación se hace el mismo día que el seed.

**Documentos** (cada uno con un PDF de una página que muestra el código y el título):

| Código | Título | Rev. | Estado | Responsable |
|---|---|---|---|---|
| MS 01 | Manual del Sistema de Gestión Integrado | 2 | Vigente | Ana Paredes |
| POL 01 | Política de calidad, ambiente, seguridad y salud | 1 | Vigente | Ana Paredes |
| PG 01 | Control de documentos y registros | 3 | Vigente | Marcela Ledesma |
| PG 05 | Auditorías internas | 1 | Vigente | Marcela Ledesma |
| PE 02 | Trabajo en altura | 4 | Vigente | Bruno Sosa |
| IT 01 PE 02 | Armado e inspección de andamios | 2 | Vigente | Bruno Sosa |
| RE 01 PE 02 | Permiso de trabajo en altura | 1 | Vigente | Bruno Sosa |
| PE 05 | Izaje de cargas | 1 | En revisión | Bruno Sosa |

**Riesgos y oportunidades:**

| Proceso | Tipo | Descripción | Nivel | Acción (responsable) |
|---|---|---|---|---|
| Obra | Riesgo | Caída de altura durante el montaje de andamios | Alto | Inspección diaria de andamios y reentrenamiento (Bruno Sosa) |
| Compras | Riesgo | Contratista que ingresa a obra sin la documentación de seguridad vigente | Medio | Control del legajo antes del ingreso (Marcela Ledesma) |
| Logística | Riesgo | Siniestro vial en los traslados Añelo–Neuquén | Alto | Plan de manejo defensivo (Bruno Sosa) |
| Ambiente | Riesgo | Derrame de hidrocarburos en obra | Medio | Kit antiderrame y simulacro semestral (Lucía Herrera) |
| Comercial | Oportunidad | Calificar como contratista de una operadora que exige ISO 9001 y 45001 | — | Auditoría interna completa antes de la auditoría del cliente (Ana Paredes) |

**Objetivos** (seis mediciones mensuales, de la más vieja a la más nueva):

| Objetivo | Indicador | Meta | Mediciones |
|---|---|---|---|
| Mejorar la satisfacción del cliente | Encuesta de satisfacción (1 a 5) | ≥ 4,2 | 3,9 · 4,0 · 4,0 · 4,1 · 4,3 · 4,4 |
| Cumplir el plan de capacitación | Capacitaciones realizadas (%) | ≥ 90 % | 72 · 78 · 81 · 86 · 90 · 93 |
| Cerrar los hallazgos en término | Acciones cerradas en plazo (%) | ≥ 85 % | 60 · 68 · 74 · 79 · 84 · 88 |

**Auditorías:**

| Auditoría | Tipo | Fecha | Estado |
|---|---|---|---|
| Interna 2026 – Obra Loma Campana (ISO 9001 · 45001; procesos Obra y Compras) | Interna | Hace 2 meses | Cerrada, con 2 hallazgos vinculados a hallazgos existentes del seed |
| Interna 2026 – Base Añelo (ISO 9001 · 14001 · 45001) | Interna | En 3 semanas | Planificada |
| Auditoría del cliente (segunda parte) | Externa | En 6 semanas | Planificada. Solo si el módulo admite auditorías externas; si no, se omite. |

**Seguridad vial** (solo si la escena «vial» queda):

- **Choferes:** Matías Aguirre y Florencia Suárez (propios) y Ramón Escobar (contratista). La licencia de Florencia vence
  en 20 días.
- **Vehículos:** 3 camionetas 4×4 con patentes ficticias en formato `AA 123 BB`. Uno tiene el seguro por vencer.

## 7. Criterios de aceptación

- [ ] `tools/demo-video/salida/demo-sgi-base.mp4`, 1920 × 1080, 30 fps, con una duración de entre 3:00 y 3:40.
- [ ] La apertura y el cierre de DEVCEN son iguales en estilo a los de Milongas y Campus (logo que se dibuja, DEVCEN,
      CONNECTED SYSTEMS, `www.dev-cen.com`) y llevan la pista «Talent in the Air».
- [ ] La voz es Mateo en todas las escenas, y «Dev Cen» y «Ese ge i» suenan bien.
- [ ] El mensaje de §1 está en la portada, en «problema», en «camino», en «proveedores» y en el final. No se promete la
      certificación ni se nombran empresas reales.
- [ ] Cada captura tiene su rótulo y el chip de norma que corresponde al catálogo.
- [ ] Cada frase se corresponde con lo que se ve, y los destacados caen sobre el elemento justo cuando se dice la
      palabra.
- [ ] No se ven overlays de desarrollo, errores, `localhost`, pantallas de carga largas ni datos reales.
- [ ] El audio está a −14 LUFS integrado, con pico verdadero ≤ −1 dBTP, y la voz se entiende por encima de la música.
- [ ] Los subtítulos van palabra por palabra, sincronizados y sin errores de ortografía.
- [ ] Hay una hoja de contacto en `salida/hoja-de-contacto.jpg`, revisada.
