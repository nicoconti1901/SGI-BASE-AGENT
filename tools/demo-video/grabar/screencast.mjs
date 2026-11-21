// Captura por CDP: Chrome manda un JPG cada vez que la pantalla cambia, con su hora. Se guardan tal cual llegan.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

/** Ancho y alto de un JPG, leídos del marcador SOF. */
function medidasJpg(buffer) {
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) return null;
    const marcador = buffer[i + 1];
    const largo = buffer.readUInt16BE(i + 2);
    if (marcador >= 0xc0 && marcador <= 0xc3) return { alto: buffer.readUInt16BE(i + 5), ancho: buffer.readUInt16BE(i + 7) };
    i += 2 + largo;
  }
  return null;
}

/**
 * Empieza a capturar `page` en `dir/cuadros/NNNNNN.jpg`. En modo ralo guarda como máximo un cuadro cada 0,25 s
 * (para los minutos del video del curso). `detener` escribe `dir/cuadros.json` ({ cuadros, tFinal }).
 */
export async function iniciarScreencast(page, dir, { calidad = 88 } = {}) {
  const dirCuadros = path.join(dir, "cuadros");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dirCuadros, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const cuadros = [];
  const escrituras = [];
  let ralo = false;
  let detenido = false;
  let ultimoGuardado = -Infinity;
  let medidas = null;

  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    // Un cuadro que llega mientras se detiene quedaría en cuadros.json sin terminar de escribirse.
    if (detenido) return;
    const t = metadata.timestamp ?? Date.now() / 1000;
    if (ralo && t - ultimoGuardado < 0.25) return;
    if (cuadros.length > 0 && t <= cuadros.at(-1).t) return;
    ultimoGuardado = t;
    const buffer = Buffer.from(data, "base64");
    medidas ??= medidasJpg(buffer);
    const archivo = `${String(cuadros.length + 1).padStart(6, "0")}.jpg`;
    cuadros.push({ archivo, t });
    escrituras.push(writeFile(path.join(dirCuadros, archivo), buffer));
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: calidad, everyNthFrame: 1 });

  return {
    modoRalo(activo) {
      ralo = activo;
    },
    async detener() {
      const tFinal = Date.now() / 1000;
      detenido = true;
      await cdp.send("Page.stopScreencast").catch(() => {});
      await Promise.all(escrituras);
      if (cuadros.length === 0) throw new Error("El screencast no recibió ningún cuadro");
      writeFileSync(path.join(dir, "cuadros.json"), JSON.stringify({ cuadros, tFinal }));
      return { cuadros: cuadros.length, primerCuadro: cuadros[0].t, ...medidas };
    },
  };
}
