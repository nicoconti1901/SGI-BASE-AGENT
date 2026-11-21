// Graba la app (build web con el Supabase simulado) en un teléfono de 390 × 844 al ritmo de la voz: una sola toma
// continua, con las marcas de cada escena para que la edición corte y destaque.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright-core";
import { TRABAJO } from "../entorno/constantes.mjs";
import { estadoDemo, instalarDemo } from "../entorno/datos.mts";
import { servirWeb } from "../entorno/web.mjs";
import { cargarGuion } from "../guion/guion.mjs";
import { armarVideo } from "./armar.mjs";
import { crearCursor } from "./cursor.mjs";
import { crearEscena } from "./escena.mjs";
import { ESCENAS, precalentar } from "./escenas.mts";
import { crearMarcas } from "./marcas.mjs";
import { iniciarScreencast } from "./screencast.mjs";

export const TELEFONO = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["Pixel 7"].userAgent,
  locale: "es-AR",
  timezoneId: "America/Argentina/Buenos_Aires",
  colorScheme: "dark" as const,
};

/** Ancho del MP4 que va a Remotion: el teléfono ocupa ~630 px del cuadro (hasta ~850 con zoom). A escala 3 el screencast daba 15-25 cuadros/s en los scroll; a escala 2, el doble. */
export const ANCHO_VIDEO = 780;

export async function grabar() {
  const guion = cargarGuion();
  const archivoVoces = path.join(TRABAJO, "voces.json");
  if (!existsSync(archivoVoces)) throw new Error('Falta la locución: corré "node demo.mjs voz" primero.');
  const voces = JSON.parse(readFileSync(archivoVoces, "utf8"));
  const capturas = guion.escenas.filter((e: { tipo: string }) => e.tipo === "captura");
  for (const e of capturas) if (!ESCENAS[e.id]) throw new Error(`No hay acciones para la escena "${e.id}" en grabar/escenas.mts`);

  const servidor = await servirWeb();
  // Sin ventana y con la escala forzada: el screencast toma la escala de la "pantalla" del navegador, no la del contexto.
  const navegador = await chromium.launch({
    headless: true,
    args: [`--force-device-scale-factor=${TELEFONO.deviceScaleFactor}`, "--disable-renderer-backgrounding", "--disable-background-timer-throttling"],
  });
  try {
    const contexto = await navegador.newContext(TELEFONO);
    const page = await contexto.newPage();
    const estado = await instalarDemo(page, estadoDemo(), null);
    console.log("Precalentando (fotos en caché)…");
    await precalentar(page);

    const marcas = crearMarcas();
    const dir = path.join(TRABAJO, "capturas", "telefono");
    mkdirSync(dir, { recursive: true });
    const screencast = await iniciarScreencast(page, dir);
    const cursor = crearCursor(page, marcas);
    let info;
    try {
      for (const escena of capturas) {
        console.log(`grabando ${escena.id}…`);
        const esc = crearEscena({ id: escena.id, page, marcas, voz: voces[escena.id], respiro: escena.respiro });
        await ESCENAS[escena.id]!(esc, { page, cursor, estado });
      }
    } finally {
      info = await screencast.detener();
    }
    console.log(`${info.cuadros} cuadros de ${info.ancho} × ${info.alto}; armando el video…`);
    armarVideo(dir, path.join(TRABAJO, "capturas", "telefono.mp4"), { ancho: ANCHO_VIDEO });
    const { width, height } = TELEFONO.viewport;
    writeFileSync(
      path.join(TRABAJO, "marcas.json"),
      JSON.stringify({ capturas: { telefono: { archivo: "telefono.mp4", primerCuadro: info.primerCuadro, ancho: width, alto: height } }, eventos: marcas.eventos }, null, 2),
    );
    console.log(`Listo: ${path.join(TRABAJO, "marcas.json")}`);
  } finally {
    await navegador.close();
    await servidor.cerrar();
  }
}
