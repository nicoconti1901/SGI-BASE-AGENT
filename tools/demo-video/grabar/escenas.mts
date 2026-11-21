// Lo que pasa en el teléfono en cada escena, al ritmo de su frase. Las palabras de `enPalabra` tienen que estar en la voz
// del guion: si se cambia una, cambiala también acá. Entre escenas hay un corte: lo que pasa antes de `lista()` no se ve.
import type { Locator, Page } from "playwright-core";
import { fechaAR, type Estado } from "../../../e2e/mock-supabase.ts";
import { WEB } from "../entorno/constantes.mjs";
import { comoOrganizadora, FOTO_NUEVA, NUEVO, ORGANIZADORA } from "../entorno/datos.mts";

type Escena = {
  lista(): Promise<void>;
  empezarVoz(): void;
  enPalabra(palabra: string): Promise<void>;
  hasta(fraccion: number): Promise<void>;
  finDeVoz(extra?: number): Promise<void>;
  terminar(): Promise<void>;
  destacar(id: string, locator: Locator | Locator[]): Promise<void>;
  soltar(): void;
  velocidad(valor: number): void;
};
type Cursor = {
  tocar(locator: Locator, pausa?: number): Promise<void>;
  escribir(locator: Locator, texto: string, opciones?: { demora?: number }): Promise<void>;
  deslizar(dy: number, segundos?: number): Promise<void>;
  deslizarHasta(locator: Locator, y: number, segundos?: number): Promise<void>;
};
export type Contexto = { page: Page; cursor: Cursor; estado: Estado };

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const tarjetas = (page: Page) => page.getByTestId("flyer-tarjeta");
const siguiente = (page: Page) => page.getByRole("button", { name: "Siguiente" });
/**
 * De los elementos que coinciden, el que se ve al frente: las pestañas de la web dejan montadas las otras pantallas
 * detrás (p. ej. la Agenda debajo de Mis milongas), así que `first()` puede medir una tarjeta tapada.
 */
async function alFrente(locator: Locator): Promise<Locator> {
  const n = await locator.count();
  for (let i = 0; i < n; i += 1) {
    const candidato = locator.nth(i);
    const visible = await candidato
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        const y = Math.min(window.innerHeight - 80, Math.max(0, r.top) + 60);
        const arriba = document.elementFromPoint(r.left + r.width / 2, y);
        return !!arriba && el.contains(arriba);
      })
      .catch(() => false);
    if (visible) return candidato;
  }
  return locator.first();
}

/** 'dd/mm/aaaa' de hoy en Buenos Aires, tipeado sin barras (la máscara las pone). */
const hoyTipeado = () => fechaAR(0).split("-").reverse().join("");

export const ESCENAS: Record<string, (esc: Escena, ctx: Contexto) => Promise<void>> = {
  async bienvenida(esc, { page, cursor }) {
    await page.goto(WEB);
    await page.getByRole("button", { name: "Soy milonguero/a" }).waitFor();
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("elegís");
    await esc.destacar("opciones", [page.getByRole("button", { name: "Soy milonguero/a" }), page.getByRole("button", { name: "Soy organizador/a" })]);
    await esc.enPalabra("milonguera");
    await esc.destacar("milonguero", page.getByRole("button", { name: "Soy milonguero/a" }));
    await esc.enPalabra("cuenta");
    await esc.finDeVoz(0.3);
    await cursor.tocar(page.getByRole("button", { name: "Soy milonguero/a" }));
    await esc.terminar();
  },

  async agenda(esc, { page, cursor }) {
    await tarjetas(page).first().waitFor();
    await esc.lista();
    esc.empezarVoz();
    const primera = tarjetas(page).first();
    await esc.enPalabra("flyer");
    await esc.destacar("flyer", primera.getByTestId("flyer-foto").locator(".."));
    await esc.enPalabra("fecha");
    await esc.destacar("encabezado", [primera.getByText(/\b\d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/i).first(), primera.getByText("Milonga del Farol"), primera.getByText(/Salón Los Faroles/)]);
    await esc.enPalabra("hora");
    esc.soltar();
    await cursor.deslizar(330, 0.8);
    await esc.destacar("horarios", [primera.getByText("Clase", { exact: true }), primera.getByText("21:30", { exact: true })]);
    await esc.enPalabra("música");
    await esc.destacar("dj", [primera.getByText("DJ", { exact: true }), primera.getByText("Tano Ferreyra")]);
    await esc.enPalabra("valor");
    await esc.destacar("precio", primera.getByText(/^Desde \$/));
    await esc.finDeVoz(0.5);
    esc.soltar();
    await cursor.deslizar(560, 1.4);
    await esc.terminar();
  },

  async filtros(esc, { page, cursor }) {
    await cursor.deslizar(-3000, 0.3);
    await esc.lista();
    esc.empezarVoz();
    const finde = page.getByRole("button", { name: "Este finde", exact: true });
    const zona = page.getByRole("button", { name: "City Bell", exact: true });
    await esc.enPalabra("finde");
    await cursor.tocar(finde);
    await esc.destacar("fecha", finde);
    await esc.enPalabra("zona");
    await cursor.tocar(zona);
    await page.waitForTimeout(250);
    await esc.destacar("zona", zona);
    await esc.finDeVoz(0.5);
    esc.soltar();
    await tarjetas(page).first().getByText("Sábado de Orquesta").waitFor();
    await cursor.tocar(tarjetas(page).first().getByTestId("flyer-foto").locator(".."));
    await esc.terminar();
  },

  async detalle(esc, { page, cursor }) {
    const flyer = page.getByTestId("flyer-completo");
    await flyer.waitFor();
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("clase");
    await esc.destacar("clase", [flyer.getByText(/^Clase · /), flyer.getByText("Marcos Aguirre"), flyer.getByText("21:00", { exact: true })]);
    await esc.enPalabra("show");
    await esc.destacar("show", [flyer.getByText(/^Show · /), flyer.getByText("Orquesta Típica La Madrugada"), flyer.getByText("00:30", { exact: true })]);
    await esc.enPalabra("música");
    await esc.destacar("dj", [flyer.getByText("DJ", { exact: true }), flyer.getByText("Mariela Sosa")]);
    await esc.enPalabra("precios");
    esc.soltar();
    await cursor.deslizar(240, 0.6);
    await esc.destacar("precio", [flyer.getByText("Milonga/Clase", { exact: true }), flyer.getByText("$ 8.000", { exact: true })]);
    await esc.terminar();
  },

  async voy(esc, { page, cursor }) {
    const voy = page.getByRole("button", { name: "Voy", exact: true });
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("Tocás");
    await cursor.deslizarHasta(voy, 430, 0.6);
    await esc.destacar("boton", voy);
    await esc.enPalabra("Voy");
    esc.soltar();
    await cursor.tocar(voy, 400);
    await esc.enPalabra("nombre");
    await cursor.escribir(page.getByLabel("Nombre y apellido"), "Carmen Ríos", { demora: 50 });
    await esc.enPalabra("cuántos");
    await cursor.tocar(page.getByRole("button", { name: "Una persona más" }), 200);
    await esc.enPalabra("listo");
    await cursor.tocar(page.getByRole("button", { name: "Confirmar", exact: true }), 150);
    await cursor.deslizar(-3000, 0.5);
    await page.getByText("VOY", { exact: true }).waitFor();
    await dormir(350);
    await esc.destacar("sello", page.getByText("VOY", { exact: true }));
    await esc.terminar();
  },

  async llegar(esc, { page, cursor }) {
    await esc.lista();
    esc.empezarVoz();
    const whatsapp = page.getByRole("button", { name: /WhatsApp/ });
    await esc.enPalabra("horario");
    await cursor.deslizarHasta(whatsapp, 150, 1.1);
    await esc.enPalabra("botón");
    await esc.destacar("direccion", [page.getByText("Camino Centenario 13500, City Bell"), page.getByRole("button", { name: "Cómo llegar" })]);
    await esc.enPalabra("WhatsApp");
    await esc.destacar("whatsapp", whatsapp);
    await esc.enPalabra("compartirla");
    esc.soltar();
    const compartir = page.getByRole("button", { name: "Compartir" });
    await cursor.deslizarHasta(compartir, 500, 0.8);
    await esc.destacar("compartir", compartir);
    await esc.terminar();
  },

  async misMilongas(esc, { page, cursor }) {
    await page.getByRole("button", { name: "Volver" }).first().tap();
    await tarjetas(page).first().waitFor();
    await dormir(300);
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("Mis");
    await cursor.tocar(page.getByRole("tab", { name: /Mis milongas/ }));
    await tarjetas(page).first().waitFor();
    await dormir(900); // la pestaña entra con una animación: se mide cuando quedó quieta
    await esc.enPalabra("escape");
    await esc.destacar("tarjeta", (await alFrente(tarjetas(page))).getByTestId("flyer-foto").locator(".."));
    await esc.terminar();
  },

  async ingreso(esc, { page, cursor, estado }) {
    comoOrganizadora(estado);
    await page.goto(`${WEB}/bienvenida`);
    await page.getByRole("button", { name: "Soy organizador/a" }).waitFor();
    await esc.lista();
    esc.empezarVoz();
    await cursor.tocar(page.getByRole("button", { name: "Soy organizador/a" }));
    const google = page.getByRole("button", { name: "Continuar con Google" });
    await google.waitFor();
    await esc.enPalabra("Google");
    await esc.destacar("google", google);
    await esc.enPalabra("código");
    const email = page.getByLabel("Tu email");
    await esc.destacar("codigo", [email, page.getByRole("button", { name: "Enviarme un código" })]);
    await esc.finDeVoz(0.2);
    esc.soltar();
    esc.velocidad(2);
    await cursor.escribir(email, ORGANIZADORA.email, { demora: 35 });
    await cursor.tocar(page.getByRole("button", { name: "Enviarme un código" }));
    const codigo = page.getByLabel("Código", { exact: true });
    await codigo.waitFor();
    await cursor.escribir(codigo, "123456", { demora: 60 });
    await cursor.tocar(page.getByRole("button", { name: "Confirmar código" }));
    await page.getByRole("button", { name: "Cerrar sesión" }).waitFor();
    await dormir(400);
    esc.velocidad(1);
    await dormir(600);
    await esc.terminar();
  },

  async panel(esc, { page, cursor }) {
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("panel");
    await cursor.tocar(page.getByRole("tab", { name: /Mis milongas/ }));
    const pestanas = ["Publicadas", "Borradores", "Historial"].map((n) => page.getByRole("button", { name: n, exact: true }));
    await pestanas[0]!.waitFor();
    await esc.enPalabra("publicadas");
    await esc.destacar("pestanas", pestanas);
    await esc.enPalabra("borradores");
    await cursor.tocar(pestanas[1]!);
    await esc.enPalabra("historial");
    await cursor.tocar(pestanas[2]!);
    await esc.enPalabra("lista");
    esc.soltar();
    await cursor.tocar(pestanas[0]!, 300);
    await cursor.tocar(page.getByRole("button", { name: "Ver asistentes de Milonga del Farol" }));
    const lista = page.getByTestId("asistentes-lista");
    await lista.waitFor();
    await dormir(500);
    await esc.destacar("asistentes", [lista.getByText("Milonga del Farol", { exact: true }), lista.getByText(/personas van/)]);
    await esc.finDeVoz(0.6);
    esc.soltar();
    await cursor.deslizar(500, 1.6);
    await esc.terminar();
  },

  async nuevo(esc, { page, cursor }) {
    await page.getByRole("button", { name: "Volver" }).first().tap();
    const nuevo = page.getByRole("button", { name: "Nuevo evento" });
    await nuevo.waitFor();
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("Crear");
    await cursor.tocar(nuevo);
    await page.getByText("Paso 1 de 8").waitFor();
    await esc.enPalabra("paso");
    await esc.destacar("pasos", page.getByText(/Paso 1 de 8/));
    await esc.enPalabra("nombre");
    esc.soltar();
    await cursor.escribir(page.getByLabel("Título", { exact: true }), NUEVO.titulo, { demora: 40 });
    await esc.enPalabra("fecha");
    await cursor.escribir(page.getByLabel("Fecha", { exact: true }), hoyTipeado(), { demora: 45 });
    await esc.enPalabra("hora");
    await cursor.escribir(page.getByLabel("Hora de inicio de la milonga"), NUEVO.hora, { demora: 60 });
    await esc.finDeVoz(0.1);
    await cursor.tocar(siguiente(page));
    await esc.terminar();
  },

  async lugarClases(esc, { page, cursor }) {
    await page.getByText("Paso 2 de 8").waitFor();
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("salón");
    await cursor.tocar(page.getByRole("radio", { name: NUEVO.lugar }), 300);
    await cursor.tocar(siguiente(page));
    await page.getByText("Paso 3 de 8").waitFor();
    await esc.enPalabra("clases");
    await cursor.tocar(page.getByRole("button", { name: "Agregar clase" }));
    await esc.enPalabra("nivel");
    await cursor.tocar(page.getByRole("button", { name: "Principiante", exact: true }));
    await esc.enPalabra("profes");
    await cursor.escribir(page.getByLabel("Profesor/a o profesores"), NUEVO.profesores, { demora: 40 });
    await cursor.escribir(page.getByLabel("Hora de la clase"), NUEVO.horaClase, { demora: 50 });
    await cursor.tocar(siguiente(page));
    await esc.terminar();
  },

  async showDj(esc, { page, cursor }) {
    await page.getByText("Paso 4 de 8").waitFor();
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("show");
    await cursor.tocar(page.getByRole("button", { name: "Con show" }));
    await cursor.escribir(page.getByLabel("Nombre del show"), NUEVO.show, { demora: 25 });
    await cursor.escribir(page.getByLabel(/^Hora del show/), NUEVO.horaShow, { demora: 40 });
    await cursor.tocar(siguiente(page));
    await page.getByText("Paso 5 de 8").waitFor();
    await esc.enPalabra("música");
    await cursor.escribir(page.getByLabel("Nombre del DJ"), NUEVO.dj, { demora: 35 });
    await cursor.tocar(siguiente(page));
    await page.getByText("Paso 6 de 8").waitFor();
    await esc.enPalabra("precios");
    await cursor.escribir(page.getByLabel("Precio Milonga/Clase ($)"), NUEVO.precio, { demora: 60 });
    await cursor.escribir(page.getByLabel(/^Cómo se paga/), NUEVO.pago, { demora: 20 });
    await cursor.tocar(siguiente(page));
    await esc.terminar();
  },

  async fotos(esc, { page, cursor }) {
    await page.getByText("Paso 7 de 8").waitFor();
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("Sube");
    const selector = page.waitForEvent("filechooser");
    await cursor.tocar(page.getByRole("button", { name: "Elegir foto: Foto principal" }));
    await (await selector).setFiles(FOTO_NUEVA);
    const reemplazar = page.getByRole("button", { name: "Reemplazar foto: Foto principal" });
    await reemplazar.waitFor({ timeout: 20_000 });
    await dormir(500);
    await esc.destacar("foto", page.getByTestId("foto-principal"));
    await esc.enPalabra("flyer");
    esc.soltar();
    const flyerPropio = page.getByTestId("foto-flyer");
    await cursor.deslizarHasta(flyerPropio, 360, 0.7);
    await esc.destacar("flyerPropio", flyerPropio);
    await esc.enPalabra("cartel");
    esc.soltar();
    await cursor.tocar(siguiente(page));
    await page.getByTestId("flyer-completo").waitFor();
    await dormir(200);
    // El formulario conserva el scroll del paso anterior: se vuelve arriba para ver el flyer armado.
    await cursor.deslizar(-3000, 0.7);
    await esc.terminar();
  },

  async vistaPrevia(esc, { page, cursor }) {
    const flyer = page.getByTestId("flyer-completo");
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("flyer");
    await esc.destacar("flyer", flyer.getByTestId("flyer-foto").locator(".."));
    await esc.enPalabra("gente");
    esc.soltar();
    const publicar = page.getByRole("button", { name: "Publicar", exact: true });
    await cursor.deslizarHasta(publicar, 560, 1.1);
    await esc.enPalabra("Publicar");
    await esc.destacar("publicar", publicar);
    await dormir(500);
    await cursor.tocar(publicar);
    await page.waitForURL(/mis-eventos/);
    await esc.terminar();
  },

  async grilla(esc, { page, cursor }) {
    await page.goto(WEB);
    await tarjetas(page).first().getByText(NUEVO.titulo).waitFor();
    await esc.lista();
    esc.empezarVoz();
    await esc.enPalabra("grilla");
    await esc.destacar("nueva", tarjetas(page).first().getByTestId("flyer-foto").locator(".."));
    await esc.finDeVoz(0.2);
    esc.soltar();
    await cursor.deslizar(380, 1.3);
    await esc.terminar();
  },
};

/** Recorre una vez las pantallas con fotos, para que las imágenes ya estén en caché al grabar. */
export async function precalentar(page: Page) {
  await page.goto(WEB);
  await page.getByRole("button", { name: "Soy milonguero/a" }).tap();
  await tarjetas(page).first().waitFor();
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, 900);
    await dormir(250);
  }
  await page.goto(`${WEB}/evento/${(await import("../../../e2e/mock-supabase.ts")).idEvento(2)}`);
  await page.getByTestId("flyer-completo").waitFor();
  await dormir(800);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
