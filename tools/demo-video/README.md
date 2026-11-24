# Video demo de SGI Base

Video horizontal (1920 × 1080, ~3 min) de la plataforma: presentación y cierre de DEVCEN, voz de Mateo
(`es-UY-MateoNeural`) y subtítulos palabra por palabra. Qué se muestra y qué se dice: `docs/demo/PLAN-demo-video.md`;
cómo se produce: `docs/demo/PROCEDIMIENTO-demo-video.md`. Se graba con Playwright sobre la app real en modo producción
local, con datos ficticios, y se edita con Remotion. No forma parte de la app (excluida de `tsc` y `eslint`).

## Qué necesita

- `npm install` dentro de esta carpeta (tiene su propio `package.json`).
- Chromium de Playwright (`npx playwright install chromium` en la raíz).
- Python 3 con `edge-tts` e `imageio_ffmpeg`.
- La app corriendo: desde la raíz `npm run build && npx next start -p <PORT del .env>`, con los datos de
  `npm run db:seed:revision -- --reset` y `npx tsx tools/demo-video/entorno/datos-extra.mts`.
- La música en `musica/` (ver `musica/LICENCIA.md`; los mp3 no se versionan).

## Secuencia

```bash
npm run demo -- servidor   # comprueba que la app responde
npm run demo -- relevar    # estructura de cada pantalla (trabajo/relevamiento)
npm run demo -- voz        # locución por escena (trabajo/voz, trabajo/voces.json)
npm run demo -- grabar     # graba al ritmo de la voz (trabajo/capturas, trabajo/marcas.json); --escena id[,id]
npm run demo -- linea      # línea de tiempo y carpeta pública de Remotion
npm run demo -- render     # salida/demo-crudo.mp4 (por partes); --cuadro N[,M] saca solo esas imágenes
npm run demo -- final      # salida/demo-sgi-base.mp4 a -14 LUFS y salida/hoja-de-contacto.jpg
```

## Licencias

- **Remotion:** gratis para empresas de hasta 3 personas.
- **Voz:** `edge-tts` usa el servicio de lectura de Microsoft Edge (no oficial). Para uso sostenido, Azure Speech.
- **Música:** ver `musica/LICENCIA.md` (falta confirmar la licencia de Mixkit antes de publicar).
