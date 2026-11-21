// Los cuadros del screencast llegan a ritmo variable (solo cuando la pantalla cambia): se arman a 30 fps constantes.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ffmpeg } from "../ffmpeg.mjs";

/** Lista para el demuxer concat de ffmpeg: cada cuadro dura hasta el siguiente; el último hasta `tFinal`. */
export function listaConcat(cuadros, tFinal) {
  if (cuadros.length === 0) throw new Error("La captura no tiene cuadros");
  let lista = "";
  for (let i = 0; i < cuadros.length; i += 1) {
    const actual = cuadros[i];
    const siguiente = i + 1 < cuadros.length ? cuadros[i + 1].t : tFinal;
    if (siguiente < actual.t) throw new Error(`Cuadros fuera de orden en ${actual.archivo}`);
    lista += `file '${actual.archivo}'\nduration ${(siguiente - actual.t).toFixed(6)}\n`;
  }
  return `${lista}file '${cuadros.at(-1).archivo}'\n`;
}

/** `dirCaptura/cuadros.json` ({ cuadros, tFinal }) y sus JPG → MP4 H.264 a 30 fps. */
/**
 * `ancho`: ancho final en px. Cada cuadro decodificado ocupa ancho × alto × 4 bytes en el caché de Remotion; con 8 GB de
 * RAM, a 3200 × 1800 (~23 MB) el compositor descartaba cuadros antes de usarlos ("No frame found at position").
 */
export function armarVideo(dirCaptura, salida, { ancho } = {}) {
  const { cuadros, tFinal } = JSON.parse(readFileSync(path.join(dirCaptura, "cuadros.json"), "utf8"));
  const concat = path.join(dirCaptura, "cuadros", "concat.txt");
  writeFileSync(concat, listaConcat(cuadros, tFinal));
  // Cuadros constantes, sin B-frames y con keyframe cada medio segundo: Remotion busca cuadros sueltos y a velocidades altas.
  ffmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concat,
    "-vf", `fps=30,scale=${ancho ? `${ancho}:-2:flags=lanczos` : "trunc(iw/2)*2:trunc(ih/2)*2"}:out_range=tv,format=yuv420p`,
    "-fps_mode", "cfr",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "16",
    "-bf", "0",
    "-g", "15",
    "-color_range", "tv",
    "-movflags", "+faststart",
    salida,
  ]);
}
