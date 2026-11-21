// El guion es la única fuente de textos, voz y destacados de la demo. Acá se valida al cargarlo.
import { readFileSync } from "node:fs";
import path from "node:path";

const TIPOS = new Set(["titulo", "captura"]);
const TONOS = new Set(["acento", "alerta"]);

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(`Guion: ${mensaje}`);
}

function validarEscena(escena) {
  exigir(typeof escena.id === "string" && escena.id, "hay una escena sin id");
  exigir(TIPOS.has(escena.tipo), `la escena "${escena.id}" tiene un tipo inválido (${escena.tipo})`);
  exigir(escena.voz === undefined || (typeof escena.voz === "string" && escena.voz.trim()), `la escena "${escena.id}" tiene una voz vacía`);
  exigir(escena.respiro === undefined || escena.respiro >= 0, `la escena "${escena.id}" tiene un respiro inválido`);
  exigir(escena.vozDesde === undefined || escena.vozDesde >= 0, `la escena "${escena.id}" tiene un vozDesde inválido`);
  if (escena.tipo === "titulo") exigir(escena.voz || escena.segundos > 0, `el título "${escena.id}" necesita voz o segundos`);
  if (escena.tipo === "captura") exigir(escena.voz && typeof escena.ruta === "string", `la captura "${escena.id}" necesita voz y ruta`);
  exigir(escena.norma === undefined || typeof escena.norma === "string", `la escena "${escena.id}" tiene una norma inválida`);
  exigir(escena.opcional === undefined || typeof escena.opcional === "boolean", `la escena "${escena.id}" tiene un opcional inválido`);
  for (const c of escena.chips ?? []) exigir(c.texto && c.en, `un chip de "${escena.id}" no tiene texto o en`);
  const ids = new Set();
  for (const d of escena.destacados ?? []) {
    exigir(typeof d.id === "string" && d.id && typeof d.texto === "string" && d.texto, `un destacado de "${escena.id}" no tiene id o texto`);
    exigir(TONOS.has(d.tono), `el destacado "${d.id}" de "${escena.id}" tiene un tono inválido (${d.tono})`);
    exigir(d.zoom === undefined || d.zoom >= 1, `el destacado "${d.id}" de "${escena.id}" tiene un zoom inválido`);
    exigir(!ids.has(d.id), `el destacado "${d.id}" está repetido en "${escena.id}"`);
    ids.add(d.id);
  }
}

/** Devuelve el mismo objeto si es un guion válido; si no, falla nombrando la escena y el campo. */
export function validarGuion(guion) {
  exigir(guion?.voz?.nombre && guion.voz.rate && guion.voz.pitch, "falta la voz (nombre, rate y pitch)");
  exigir(Number.isInteger(guion.fps) && guion.fps > 0, "fps inválido");
  exigir(guion.formato?.ancho > 0 && guion.formato?.alto > 0, "falta el formato (ancho y alto)");
  exigir(Array.isArray(guion.escenas) && guion.escenas.length > 0, "no hay escenas");
  const ids = new Set();
  for (const escena of guion.escenas) {
    validarEscena(escena);
    exigir(!ids.has(escena.id), `la escena "${escena.id}" está repetida`);
    ids.add(escena.id);
  }
  exigir(ids.has("apertura") && ids.has("cierre"), 'faltan las escenas "apertura" o "cierre" (la presentación de DEVCEN)');
  return guion;
}

export function cargarGuion(ruta = path.join(import.meta.dirname, "guion.json")) {
  return validarGuion(JSON.parse(readFileSync(ruta, "utf8")));
}
