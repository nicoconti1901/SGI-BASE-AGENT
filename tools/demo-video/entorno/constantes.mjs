import { readFileSync } from "node:fs";
import path from "node:path";

export const HERRAMIENTA = path.resolve(import.meta.dirname, "..");
export const REPO = path.resolve(HERRAMIENTA, "../..");

/** El puerto sale del .env de la raíz (el de la worktree); la app corre en modo producción (npm run build + next start). */
const env = readFileSync(path.join(REPO, ".env"), "utf8");
export const PUERTO = Number(/^PORT="?(\d+)"?/m.exec(env)?.[1] ?? 3124);
export const URL_APP = `http://localhost:${PUERTO}`;

/** Usuario ficticio de la demo: Ana Paredes, administradora de Constructora Patagonia Demo. */
export const EMPRESA = "demo-patagonia";
export const USUARIO = { email: "admin.patagonia@demo.sgi.test", clave: "Demo123!demo" };

export const TRABAJO = path.join(HERRAMIENTA, "trabajo");
export const SALIDA = path.join(HERRAMIENTA, "salida");
