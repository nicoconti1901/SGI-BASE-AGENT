// Recorre las pantallas del guion como Ana y guarda de cada una su estructura (ariaSnapshot, compacta), una captura y los
// errores de consola. Sirve para elegir los localizadores de los destacados sin abrir el código de la app.
import { mkdirSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { TRABAJO, URL_APP, USUARIO } from "../entorno/constantes.mjs";
import { cargarGuion } from "../guion/guion.mjs";

export const VENTANA = { width: 1600, height: 900 };
const MAX_LINEAS = 140;

/** Entra por la pantalla real de login. Lo usan el relevamiento y la grabación. */
export async function ingresar(page: import("playwright-core").Page) {
  await page.goto(`${URL_APP}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"], input[name="email"]').first().fill(USUARIO.email);
  await page.locator('input[type="password"]').first().fill(USUARIO.clave);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

export async function relevar() {
  const guion = cargarGuion();
  const dir = path.join(TRABAJO, "relevamiento");
  const solo = process.env.ESCENAS?.split(",");
  if (!solo) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const consola = path.join(dir, "consola.txt");
  const navegador = await chromium.launch({ headless: true });
  try {
    const contexto = await navegador.newContext({ viewport: VENTANA, deviceScaleFactor: 1, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires", colorScheme: "dark" });
    await contexto.addInitScript(() => { try { localStorage.setItem("sgi-theme", "dark"); } catch { /* sin storage */ } });
    const page = await contexto.newPage();
    let actual = "login";
    page.on("console", (m) => m.type() === "error" && appendFileSync(consola, `[${actual}] ${m.text().slice(0, 200)}\n`));
    page.on("pageerror", (e) => appendFileSync(consola, `[${actual}] PAGEERROR ${String(e).slice(0, 200)}\n`));
    await ingresar(page);
    const guardar = async (id: string) => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const yml = (await page.locator("main").first().ariaSnapshot().catch(() => "(sin main)")).split("\n").slice(0, MAX_LINEAS).join("\n");
      writeFileSync(path.join(dir, `${id}.yml`), `# ${page.url()}\n${yml}\n`);
      await page.screenshot({ path: path.join(dir, `${id}.png`) });
    };
    for (const e of guion.escenas.filter((x: { tipo: string }) => x.tipo === "captura" && x.ruta !== "/login" && (!solo || solo.includes(x.id)))) {
      actual = e.id;
      await page.goto(`${URL_APP}${e.ruta}`, { waitUntil: "networkidle" });
      await guardar(e.id);
      // Detalle: el primer enlace que cuelga de la misma ruta (un documento, un riesgo, un hallazgo, etc.).
      const enlaces = await page.locator(`main a[href^="${e.ruta}/"]`).evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")));
      const detalle = enlaces.find((h) => h && h !== `${e.ruta}/` && !/\/(new|nuevo)\b/.test(h));
      if (detalle) {
        await page.goto(`${URL_APP}${detalle}`, { waitUntil: "networkidle" });
        await guardar(`${e.id}-detalle`);
      }
      console.log(`${e.id}: ${detalle ? "con detalle " + detalle : "sin detalle"}`);
    }
  } finally {
    await navegador.close();
  }
}
