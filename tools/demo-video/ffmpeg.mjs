// ffmpeg: el mismo binario que usa tools/produccion-video (imageio_ffmpeg), sin sumar dependencias.
import { execFileSync } from "node:child_process";

let ruta = null;

export function rutaFfmpeg() {
  ruta ??= execFileSync("python", ["-I", "-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).trim();
  return ruta;
}

/** Corre ffmpeg y falla con el final de su salida si termina mal. */
export function ffmpeg(args, opciones = {}) {
  try {
    return execFileSync(rutaFfmpeg(), ["-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opciones });
  } catch (error) {
    const detalle = `${error.stderr ?? ""}`.trim().split("\n").slice(-5).join("\n");
    throw new Error(`ffmpeg falló: ${detalle || error.message}`);
  }
}
