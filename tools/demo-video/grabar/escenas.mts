// Lo que pasa en la ventana en cada escena, al ritmo de su frase. Las palabras de `enPalabra` tienen que estar en la voz
// del guion: si se cambia una, cambiala también acá. Lo que pasa antes de `lista()` no se ve en el video.
import type { Locator, Page } from "playwright-core";
import { URL_APP, USUARIO } from "../entorno/constantes.mjs";
import { esperarLista } from "./escena.mjs";

type Escena = {
  lista(): Promise<void>;
  empezarVoz(): void;
  enPalabra(palabra: string): Promise<void>;
  hasta(fraccion: number): Promise<void>;
  finDeVoz(extra?: number): Promise<void>;
  terminar(): Promise<void>;
  destacar(id: string, locator: Locator | Locator[]): Promise<void>;
  soltar(): void;
};
type Cursor = {
  tocar(locator: Locator, pausa?: number): Promise<void>;
  escribir(locator: Locator, texto: string, opciones?: { demora?: number }): Promise<void>;
  deslizar(dy: number, segundos?: number): Promise<void>;
  deslizarHasta(locator: Locator, y: number, segundos?: number): Promise<void>;
};
export type Contexto = { page: Page; cursor: Cursor };

const T = "/t/demo-patagonia";
const ir = (page: Page, ruta: string) => page.goto(`${URL_APP}${ruta}`, { waitUntil: "networkidle" });
const tablaFilas = (page: Page) => page.locator("table tbody tr");

/** Rutas que se visitan antes de grabar para que el build de producción las tenga calientes. */
export const RUTAS = [
  T, `${T}/documents`, `${T}/risks`, `${T}/indicators`, `${T}/inspections`, `${T}/findings`, `${T}/safety/stats`,
  `${T}/road-safety`, `${T}/road-safety/conductores`, `${T}/instruments`, `${T}/training`, `${T}/suppliers`, `${T}/audits`,
];

export const ESCENAS: Record<string, (esc: Escena, ctx: Contexto) => Promise<void>> = {
  async ingreso(esc, { page, cursor }) {
    await ir(page, "/login");
    await esc.lista();
    esc.empezarVoz();
    await cursor.escribir(page.locator('input[type="email"]'), USUARIO.email, { demora: 45 });
    await cursor.escribir(page.locator('input[type="password"]'), USUARIO.clave, { demora: 45 });
    await esc.enPalabra("entra");
    await cursor.tocar(page.locator('button[type="submit"]'));
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
    await esperarLista(page);
    await esc.finDeVoz(0.2);
    await esc.terminar();
  },

  async panel(esc, { page, cursor }) {
    await ir(page, T);
    await esc.lista();
    esc.empezarVoz();
    await cursor.deslizar(160, 0.9);
    await esc.enPalabra("áreas");
    await esc.destacar("areas", page.getByRole("navigation", { name: "Principal" }));
    await esc.enPalabra("vencimientos");
    esc.soltar();
    const vence = page.getByRole("heading", { name: "Próximos vencimientos" });
    await cursor.deslizarHasta(vence, 130, 0.9);
    await esc.destacar("vence", [vence, page.getByRole("region", { name: "Estado del sistema" }).getByRole("list").last()]);
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async documentos(esc, { page }) {
    await ir(page, `${T}/documents`);
    await esc.lista();
    esc.empezarVoz();
    const fila = page.getByRole("listitem").filter({ has: page.getByText("PE 02 · Trabajo en altura", { exact: true }) }).last();
    await esc.enPalabra("código");
    await esc.destacar("codigo", fila.locator("p").nth(0));
    await esc.enPalabra("revisión");
    await esc.destacar("revision", fila.locator("p").nth(1));
    await esc.enPalabra("descargar");
    await esc.destacar("descargar", fila.getByRole("link", { name: "Descargar" }));
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async riesgos(esc, { page, cursor }) {
    await ir(page, `${T}/risks`);
    await esc.lista();
    esc.empezarVoz();
    const tarjeta = page.getByRole("list", { name: "Riesgos abiertos" }).getByRole("listitem").filter({ hasText: "Siniestro vial" });
    await cursor.deslizar(360, 0.9);
    await esc.enPalabra("nivel");
    await esc.destacar("nivel", [tarjeta.getByRole("term").nth(0), tarjeta.getByRole("definition").nth(0)]);
    await esc.enPalabra("próximo");
    await esc.destacar("proximo", [tarjeta.getByRole("term").nth(1), tarjeta.getByRole("definition").nth(1), tarjeta.getByRole("term").nth(2), tarjeta.getByRole("definition").nth(2)]);
    await esc.enPalabra("acá");
    esc.soltar();
    const oportunidades = page.getByRole("heading", { name: "Oportunidades", exact: true });
    await cursor.deslizarHasta(oportunidades, 140, 1);
    await esc.destacar("oportunidad", [oportunidades, page.getByRole("list", { name: "Oportunidades abiertas" }).getByRole("listitem").first()]);
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async objetivos(esc, { page }) {
    await ir(page, `${T}/indicators`);
    await esc.lista();
    esc.empezarVoz();
    const tarjeta = page.getByRole("list", { name: /ISO 9001: objetivos vigentes/ }).getByRole("listitem").first();
    await esc.enPalabra("indicador");
    await esc.destacar("indicador", tarjeta.getByRole("list").first());
    await esc.enPalabra("estado");
    esc.soltar();
    await esc.destacar("estado", tarjeta.getByText("En meta", { exact: true }).first());
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async inspecciones(esc, { page }) {
    await ir(page, `${T}/inspections`);
    await esc.lista();
    esc.empezarVoz();
    const resumen = page.getByRole("region", { name: "Resumen de inspecciones" });
    await esc.enPalabra("inspecciona");
    await esc.destacar("proximas", resumen.getByRole("link", { name: /^Próximas/ }));
    await esc.enPalabra("vehículos");
    await esc.destacar("fuera", resumen.getByRole("link", { name: /fuera de servicio/ }));
    await esc.enPalabra("cumple");
    await esc.destacar("noaptas", resumen.getByRole("link", { name: /^No aptas/ }));
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async hallazgos(esc, { page, cursor }) {
    await ir(page, `${T}/findings`);
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("estado");
    const celdas = [page.getByRole("columnheader", { name: "Estado" })];
    for (let i = 0; i < 5; i += 1) celdas.push(tablaFilas(page).nth(i).locator("td").nth(6));
    await esc.destacar("estado", celdas);
    await esc.enPalabra("hallazgo");
    esc.soltar();
    const fila = tablaFilas(page).filter({ hasText: "En curso" }).first();
    await cursor.tocar(fila.getByRole("link", { name: "Ver" }));
    await page.waitForURL((u) => /\/findings\/[^/]+$/.test(u.pathname), { timeout: 30_000 });
    await esperarLista(page);
    const causa = page.getByRole("heading", { name: "Causa raíz (5 Porqués)" });
    await cursor.deslizarHasta(causa, 150, 0.9);
    await esc.enPalabra("causa");
    await esc.destacar("causa", [causa, page.getByText(/Causa inmediata/).first()]);
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async accidentabilidad(esc, { page, cursor }) {
    await ir(page, `${T}/safety/stats`);
    await esc.lista();
    esc.empezarVoz();
    await cursor.deslizar(330, 0.9);
    await esc.enPalabra("índices");
    await esc.destacar("indices", page.getByRole("group", { name: "Índices del período" }));
    await esc.enPalabra("sede");
    esc.soltar();
    await cursor.deslizarHasta(page.getByRole("heading", { name: "Días sin accidentes con baja" }), 160, 1);
    await esc.destacar("sede", [page.getByRole("heading", { name: "Días sin accidentes con baja" }), page.getByRole("heading", { name: "Días sin accidentes con baja" }).locator("xpath=following::ul[1]")]);
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async vial(esc, { page, cursor }) {
    await ir(page, `${T}/road-safety`);
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("tasa");
    await cursor.deslizarHasta(page.getByRole("heading", { name: /Tasas por millón de km/ }), 120, 1);
    await esc.destacar("tasa", [page.getByRole("heading", { name: /Tasas por millón de km/ }), page.locator("article").filter({ has: page.getByRole("heading", { name: "Mes", exact: true }) })]);
    await esc.enPalabra("conductores");
    esc.soltar();
    await cursor.tocar(page.getByRole("navigation", { name: "Accidentabilidad" }).getByRole("link", { name: "Conductores" }));
    await page.waitForURL((u) => u.pathname.endsWith("/conductores"), { timeout: 30_000 });
    await esperarLista(page);
    const tabla = page.getByRole("table", { name: "Conductores y su habilitación" });
    await cursor.deslizarHasta(tabla, 240, 0.8);
    await esc.destacar("conductores", tabla);
    await esc.enPalabra("licencia");
    await esc.destacar("licencia", page.getByRole("textbox", { name: /Vencimiento de la licencia de Florencia/ }));
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async equipos(esc, { page }) {
    await ir(page, `${T}/instruments`);
    await esc.lista();
    esc.empezarVoz();
    const estado = page.getByRole("region", { name: "Estado de los equipos" });
    await esc.enPalabra("calibración");
    await esc.destacar("calibracion", estado.getByRole("link", { name: /^Vigentes/ }));
    await esc.enPalabra("vencer");
    await esc.destacar("porvencer", estado.getByRole("link", { name: /^Por vencer/ }));
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async capacitaciones(esc, { page }) {
    await ir(page, `${T}/training`);
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("matriz");
    await esc.destacar("matriz", [page.getByRole("heading", { name: "Cumplimiento por sede" }), page.getByText(/Se calcula solo con la matriz/)]);
    await esc.enPalabra("vence");
    await esc.destacar("vence", page.getByRole("region", { name: /^Estados en/ }).first());
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async proveedores(esc, { page, cursor }) {
    await ir(page, `${T}/suppliers`);
    await esc.lista();
    esc.empezarVoz();
    await cursor.deslizar(600, 0.9);
    await esc.enPalabra("documentación");
    await esc.destacar("documentacion", tablaFilas(page).first().locator("td").nth(1));
    await esc.enPalabra("aprobados");
    esc.soltar();
    await cursor.deslizar(-600, 0.8);
    await esc.destacar("aprobado", page.getByRole("region", { name: "Estado de los proveedores" }).getByRole("link", { name: /^Aprobados vigentes/ }));
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },

  async auditorias(esc, { page }) {
    await ir(page, `${T}/audits`);
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("programa");
    await esc.destacar("programa", page.getByRole("region", { name: /^Programa/ }));
    await esc.enPalabra("cobertura");
    await esc.destacar("cobertura", [page.getByRole("heading", { name: /^Cobertura/ }), page.getByRole("region", { name: /^Cobertura/ })]);
    await esc.enPalabra("circuito");
    await esc.destacar("circuito", page.getByRole("list", { name: "Auditorías planificadas" }).getByRole("listitem").first());
    await esc.finDeVoz(0.3);
    await esc.terminar();
  },
};
