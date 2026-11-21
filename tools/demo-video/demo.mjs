#!/usr/bin/env node
// Video demo de SGI Base (horizontal 1920x1080, voz de Mateo). Uso: npm run demo -- <comando>. Ver README.md.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HERRAMIENTA, SALIDA, TRABAJO } from "./entorno/constantes.mjs";
import { comprobarServidor } from "./entorno/servidor.mjs";
import { ffmpeg, rutaFfmpeg } from "./ffmpeg.mjs";
import { cargarGuion } from "./guion/guion.mjs";

const PUBLICO = path.join(TRABAJO, "publico");
/** Una sola pista: la de la presentación y el cierre de DEVCEN (la misma de las otras demos). */
const MUSICA = { devcen: "devcen-talent-in-the-air.mp3" };

const leerJson = (archivo) => JSON.parse(readFileSync(archivo, "utf8"));

function voz() {
  cargarGuion(); // falla antes de sintetizar si el guion no es válido
  const r = spawnSync("python", ["-I", path.join(HERRAMIENTA, "voz/locutor.py"), path.join(HERRAMIENTA, "guion/guion.json"), TRABAJO], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("La locución falló.");
}

/** Pone `origen` en la carpeta pública de Remotion: enlace duro si se puede (la captura pesa), si no copia. */
function publicar(origen, destino) {
  const final = path.join(PUBLICO, destino);
  mkdirSync(path.dirname(final), { recursive: true });
  rmSync(final, { force: true });
  try {
    linkSync(origen, final);
  } catch {
    copyFileSync(origen, final);
  }
}

/** Arma trabajo/linea.json con la línea de tiempo y deja en trabajo/publico lo que Remotion necesita. */
async function linea() {
  const { armarLinea } = await import("./video/linea.ts");
  const guion = cargarGuion();
  const voces = leerJson(path.join(TRABAJO, "voces.json"));
  const marcas = leerJson(path.join(TRABAJO, "marcas.json"));
  const resultado = armarLinea({ guion, voces, marcas });
  for (const captura of Object.values(marcas.capturas)) publicar(path.join(TRABAJO, "capturas", captura.archivo), captura.archivo);
  for (const id of Object.keys(voces)) publicar(path.join(TRABAJO, voces[id].archivo), voces[id].archivo);
  for (const [clave, archivo] of Object.entries(MUSICA)) {
    const origen = path.join(HERRAMIENTA, "musica", archivo);
    if (!existsSync(origen)) throw new Error(`Falta la música ${archivo}: ver musica/LICENCIA.md`);
    publicar(origen, `musica-${clave}.mp3`);
  }
  writeFileSync(path.join(TRABAJO, "linea.json"), JSON.stringify({ linea: resultado }));
  console.log(`linea.json: ${resultado.escenas.length} escenas, ${(resultado.duracionCuadros / resultado.fps).toFixed(1)} s`);
}

/** Corre la CLI de Remotion con node, sin depender de npx. */
function remotion(args, { exigir = true } = {}) {
  const cli = path.join(HERRAMIENTA, "node_modules/@remotion/cli/remotion-cli.js");
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: HERRAMIENTA, stdio: "inherit" });
  if (r.status !== 0 && exigir) throw new Error("Remotion falló.");
  return r.status === 0;
}

// Partes chicas: el caché de OffthreadVideo se degrada con los cuadros acumulados en el proceso ("No frame found").
const CUADROS_POR_PARTE = 150;
const REINTENTOS = 3;

/**
 * Renderiza por partes (como la demo de DEVCEN Campus): un bundle, el video en tramos de CUADROS_POR_PARTE (cada uno en
 * un proceso nuevo, con un reintento), el audio aparte, y ffmpeg une todo sin recodificar. Con `--cuadro N` saca solo
 * una imagen de ese cuadro (salida/cuadro-N.png), para revisar la composición sin renderizar.
 */
async function render(args) {
  const props = path.join(TRABAJO, "linea.json");
  if (!existsSync(props)) throw new Error('Falta la línea de tiempo: corré "node demo.mjs linea".');
  mkdirSync(SALIDA, { recursive: true });
  const bundle = path.join(TRABAJO, "bundle");
  console.log("Armando el bundle de Remotion…");
  remotion(["bundle", "video/index.ts", `--public-dir=${PUBLICO}`, `--out-dir=${bundle}`, "--log=error"]);
  const comunes = [`--props=${props}`, "--concurrency=1", "--offthreadvideo-cache-size-in-bytes=2000000000", "--offthreadvideo-video-threads=1", "--log=error"];

  const i = args.indexOf("--cuadro");
  if (i >= 0) {
    for (const n of args[i + 1].split(",")) remotion(["still", bundle, "Demo", path.join(SALIDA, `cuadro-${n}.png`), `--frame=${n}`, ...comunes]);
    return;
  }

  const salida = path.join(SALIDA, "demo-crudo.mp4");
  const total = leerJson(props).linea.duracionCuadros;
  const partes = path.join(TRABAJO, "partes");
  // Con --retomar se conservan las partes ya renderizadas (si el render se cortó a la mitad).
  if (!args.includes("--retomar")) rmSync(partes, { recursive: true, force: true });
  mkdirSync(partes, { recursive: true });
  const archivos = [];
  for (let desde = 0; desde < total; desde += CUADROS_POR_PARTE) {
    const hasta = Math.min(total, desde + CUADROS_POR_PARTE) - 1;
    const parte = path.join(partes, `parte-${String(archivos.length + 1).padStart(2, "0")}-${desde}-${hasta}.mp4`);
    archivos.push(parte);
    if (existsSync(parte)) {
      console.log(`Video: cuadros ${desde}-${hasta} ya renderizados.`);
      continue;
    }
    console.log(`Video: cuadros ${desde}-${hasta} de ${total}…`);
    const renderizar = () => remotion(["render", bundle, "Demo", parte, `--frames=${desde}-${hasta}`, "--muted", "--crf=18", ...comunes], { exigir: false });
    let listo = renderizar();
    for (let intento = 2; !listo && intento <= REINTENTOS; intento += 1) {
      console.log(`Falló: reintento ${intento} de ${REINTENTOS}.`);
      rmSync(parte, { force: true });
      listo = renderizar();
    }
    if (!listo) throw new Error(`Remotion falló en los cuadros ${desde}-${hasta}. Volvé a correr con --retomar.`);
  }
  console.log("Audio…");
  const audio = path.join(partes, "audio.wav");
  remotion(["render", bundle, "Demo", audio, "--codec=wav", ...comunes]);
  const lista = path.join(partes, "partes.txt");
  writeFileSync(lista, archivos.map((a) => `file '${a.replaceAll("\\", "/")}'`).join("\n"));
  ffmpeg(["-y", "-f", "concat", "-safe", "0", "-i", lista, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", salida]);
  console.log(`Listo: ${salida}`);
}

// -14 LUFS (lo que piden WhatsApp, Instagram y YouTube) y pico verdadero por debajo de -1,5 dBTP.
const LOUDNESS = "I=-14:TP=-2:LRA=11";

function medirLoudness(entrada) {
  const r = spawnSync(rutaFfmpeg(), ["-hide_banner", "-i", entrada, "-af", `loudnorm=${LOUDNESS}:print_format=json`, "-vn", "-f", "null", "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const json = r.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (r.status !== 0 || !json) throw new Error(`No se pudo medir el audio de ${entrada}.`);
  return JSON.parse(json[0]);
}

/** Normaliza el audio de demo-crudo.mp4 (dos pasadas) y arma una hoja de contacto con un cuadro por escena. */
function final() {
  const crudo = path.join(SALIDA, "demo-crudo.mp4");
  if (!existsSync(crudo)) throw new Error('Falta el video crudo: corré "node demo.mjs render".');
  const { linea: l } = leerJson(path.join(TRABAJO, "linea.json"));
  const m = medirLoudness(crudo);
  const segunda = `loudnorm=${LOUDNESS}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const destino = path.join(SALIDA, "demo-sgi-base.mp4");
  const cadena = `${segunda},aresample=48000,alimiter=limit=${10 ** (-3 / 20)}:attack=1:release=50:level=disabled`;
  ffmpeg(["-y", "-i", crudo, "-af", cadena, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", destino]);

  const cuadros = l.escenas.map((e) => e.desde + Math.floor(e.cuadros / 2));
  const filas = Math.ceil(cuadros.length / 6);
  const seleccion = cuadros.map((n) => `eq(n\\,${n})`).join("+");
  const hoja = path.join(SALIDA, "hoja-de-contacto.jpg");
  ffmpeg(["-y", "-i", destino, "-vf", `select='${seleccion}',scale=270:-1,tile=6x${filas}:padding=8:color=0xf4f1ea`, "-frames:v", "1", "-fps_mode", "vfr", "-q:v", "3", hoja]);
  console.log(`Listo: ${destino}\nHoja de contacto: ${hoja}`);
}

const COMANDOS = {
  servidor: () => comprobarServidor(),
  relevar: async () => (await import("./grabar/relevar.mts")).relevar(),
  voz: () => voz(),
  grabar: async () => (await import("./grabar/grabar.mts")).grabar(),
  linea: () => linea(),
  render: (args) => render(args),
  final: () => final(),
};

const USO = `Uso: npm run demo -- <comando>

  servidor  comprueba que la app (build de producción) responde
  relevar   recorre las pantallas y guarda su estructura en trabajo/relevamiento
  voz       genera la locución de cada escena (trabajo/voz y trabajo/voces.json)
  grabar    graba la app en el navegador al ritmo de la voz; --escena id[,id]: solo esas (trabajo/capturas y trabajo/marcas.json)
  linea     arma la línea de tiempo (trabajo/linea.json) y la carpeta pública de Remotion
  render    renderiza el video (salida/demo-crudo.mp4); --cuadro N[,M]: solo esas imágenes
  final     normaliza el audio a -14 LUFS (salida/demo-sgi-base.mp4) y arma la hoja de contacto`;

const [comando, ...args] = process.argv.slice(2);
const accion = COMANDOS[comando];
if (!accion) {
  console.error(USO);
  process.exit(1);
}
try {
  await accion(args);
} catch (error) {
  console.error(`\n${error.stack ?? error.message}`);
  process.exit(1);
}
