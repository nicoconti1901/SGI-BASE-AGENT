// Solo comprueba que la app responde; no levanta nada. Si no responde, dice cómo levantarla.
import { PUERTO, URL_APP } from "./constantes.mjs";

export async function comprobarServidor() {
  try {
    const r = await fetch(`${URL_APP}/login`);
    if (r.ok) return;
    throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    throw new Error(`La app no responde en ${URL_APP} (${e.message}). Desde la raíz: npm run build && npx next start -p ${PUERTO}`);
  }
}
