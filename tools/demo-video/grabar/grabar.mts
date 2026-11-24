// Graba la app (build de producción) en una ventana de 1600 × 900 al ritmo de la voz: una sola toma continua, con las marcas
// de cada escena para que la edición corte y destaque. `--escena id[,id]` graba solo esas y las suma a la toma anterior.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { TRABAJO, URL_APP } from "../entorno/constantes.mjs";
import { comprobarServidor } from "../entorno/servidor.mjs";
import { cargarGuion } from "../guion/guion.mjs";
import { armarVideo } from "./armar.mjs";
import { crearCursor } from "./cursor.mjs";
import { crearEscena } from "./escena.mjs";
import { ESCENAS, RUTAS } from "./escenas.mts";
import { crearMarcas } from "./marcas.mjs";
import { ingresar } from "./relevar.mts";
import { iniciarScreencast } from "./screencast.mjs";

export const VENTANA = { width: 1600, height: 900 };
/** 1.25 da texto nítido sin pasar de ~30 cuadros/s en los scroll; si baja, usar 1. */
const ESCALA = Number(process.env.ESCALA ?? 1.25);
/** Ancho del MP4 que va a Remotion: la ventana ocupa 1600 px del lienzo de 1920 (con zoom hasta ~2000). */
const ANCHO_VIDEO = 2000;

const CSS_SIN_BARRAS = "*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}";

export async function grabar(args: string[] = []) {
  const guion = cargarGuion();
  const archivoVoces = path.join(TRABAJO, "voces.json");
  if (!existsSync(archivoVoces)) throw new Error('Falta la locución: corré "npm run demo -- voz" primero.');
  const voces = JSON.parse(readFileSync(archivoVoces, "utf8"));
  const i = args.indexOf("--escena");
  const solo: string[] | null = i >= 0 ? args[i + 1].split(",") : null;
  const todas = guion.escenas.filter((e: { tipo: string; id: string }) => e.tipo === "captura");
  for (const e of todas) if (!ESCENAS[e.id]) throw new Error(`No hay acciones para la escena "${e.id}" en grabar/escenas.mts`);
  if (solo) for (const id of solo) if (!todas.some((e: { id: string }) => e.id === id)) throw new Error(`La escena "${id}" no es de captura`);
  const capturas = solo ? todas.filter((e: { id: string }) => solo.includes(e.id)) : todas;

  await comprobarServidor();
  const archivoMarcas = path.join(TRABAJO, "marcas.json");
  const previas = solo && existsSync(archivoMarcas) ? JSON.parse(readFileSync(archivoMarcas, "utf8")) : { capturas: {}, eventos: [] };
  const idCaptura = solo ? `ventana-${Date.now().toString(36)}` : "ventana";

  const navegador = await chromium.launch({
    headless: true,
    args: [`--force-device-scale-factor=${ESCALA}`, "--disable-renderer-backgrounding", "--disable-background-timer-throttling"],
  });
  try {
    const contexto = await navegador.newContext({ viewport: VENTANA, deviceScaleFactor: ESCALA, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires", colorScheme: "dark" });
    await contexto.addInitScript(() => { try { localStorage.setItem("sgi-theme", "dark"); } catch { /* sin storage */ } });
    await contexto.addInitScript((css) => {
      const poner = () => {
        const estilo = document.createElement("style");
        estilo.textContent = css;
        document.documentElement.appendChild(estilo);
      };
      if (document.documentElement) poner();
      else document.addEventListener("DOMContentLoaded", poner, { once: true });
    }, CSS_SIN_BARRAS);
    const page = await contexto.newPage();
    console.log("Precalentando…");
    await ingresar(page);
    for (const ruta of RUTAS) await page.goto(`${URL_APP}${ruta}`, { waitUntil: "networkidle" }).catch(() => undefined);
    // Si se graba el ingreso, la sesión empieza limpia: lo demás se graba con la sesión que deja esa escena.
    if (capturas.some((e: { id: string }) => e.id === "ingreso")) {
      await contexto.clearCookies();
      await page.goto(`${URL_APP}/login`, { waitUntil: "networkidle" });
    }

    const marcas = crearMarcas();
    const dir = path.join(TRABAJO, "capturas", idCaptura);
    mkdirSync(dir, { recursive: true });
    const screencast = await iniciarScreencast(page, dir);
    const cursor = crearCursor(page, marcas);
    let info;
    try {
      for (const escena of capturas) {
        console.log(`grabando ${escena.id}…`);
        const esc = crearEscena({ id: escena.id, page, marcas, voz: voces[escena.id], respiro: escena.respiro });
        await ESCENAS[escena.id]!(esc, { page, cursor });
      }
    } finally {
      info = await screencast.detener();
    }
    console.log(`${info.cuadros} cuadros de ${info.ancho} × ${info.alto}; armando el video…`);
    armarVideo(dir, path.join(TRABAJO, "capturas", `${idCaptura}.mp4`), { ancho: ANCHO_VIDEO });
    const eventosNuevos = marcas.eventos.map((e: object) => ({ ...e, captura: idCaptura }));
    const reemplazadas = new Set(capturas.map((e: { id: string }) => e.id));
    writeFileSync(
      archivoMarcas,
      JSON.stringify(
        {
          capturas: { ...previas.capturas, [idCaptura]: { archivo: `${idCaptura}.mp4`, primerCuadro: info.primerCuadro, ancho: VENTANA.width, alto: VENTANA.height } },
          eventos: [...previas.eventos.filter((e: { escena: string }) => !reemplazadas.has(e.escena)), ...eventosNuevos],
        },
        null,
        2,
      ),
    );
    console.log(`Listo: ${archivoMarcas}`);
  } finally {
    await navegador.close();
  }
}
