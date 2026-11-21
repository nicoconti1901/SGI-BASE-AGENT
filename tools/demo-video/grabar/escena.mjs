// Ritmo de una escena: las acciones se reparten dentro de lo que dura su frase, y cada momento queda marcado.

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ahora = () => Date.now() / 1000;

const normalizar = (texto) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]/g, "");

/** Segundos desde el inicio de la frase en que empieza `palabra` (la primera vez a partir de `desde`). */
export function momentoDePalabra(palabras, palabra, desde = 0) {
  const buscada = normalizar(palabra);
  const encontrada = palabras.find(([inicio, , texto]) => inicio >= desde && normalizar(texto) === buscada);
  if (!encontrada) throw new Error(`La palabra "${palabra}" no aparece en la frase después de ${desde} s`);
  return encontrada[0];
}

/** La promesa, o un error con `mensaje` si tarda más de `ms`. */
export function esperarCon(promesa, ms, mensaje) {
  let reloj;
  const tope = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(mensaje)), ms);
  });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(reloj));
}

/**
 * La página está lista cuando no hay red pendiente, las fuentes cargaron, nada está marcado como ocupado y cargaron las
 * imágenes que se ven. Las de fuera del viewport no se esperan: con loading="lazy" no cargan nunca sin scroll.
 */
export async function esperarLista(page) {
  await esperarCon(
    (async () => {
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
      await page.evaluate(async () => {
        await document.fonts.ready;
        const visibles = [...document.images].filter((img) => {
          const r = img.getBoundingClientRect();
          return r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
        });
        await Promise.all(
          visibles.map((img) =>
            img.complete
              ? null
              : new Promise((ok) => {
                  img.addEventListener("load", ok, { once: true });
                  img.addEventListener("error", ok, { once: true });
                }),
          ),
        );
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      });
    })(),
    15000,
    `La página ${page.url()} no terminó de cargar en 15 s`,
  );
}

/**
 * Una escena en grabación. `voz` es su entrada de voces.json (o undefined si no habla) y `respiro`, los segundos que se
 * siguen grabando después de la frase (además de la pausa fija). Al crearse marca `inicio`.
 */
export function crearEscena({ id, page, marcas, voz, respiro = 0 }) {
  marcas.enEscena(id);
  marcas.registrar({ tipo: "inicio" });
  let inicioVoz = null;
  let ultimaPalabra = 0;
  let ultimoDestacado = 0;

  const dormirHasta = async (t) => {
    const ms = (t - ahora()) * 1000;
    if (ms > 0) await dormir(ms);
  };
  const exigirVoz = () => {
    if (!voz) throw new Error(`La escena ${id} no tiene voz`);
    if (inicioVoz === null) throw new Error(`La escena ${id} todavía no empezó la voz`);
  };

  return {
    id,
    page,
    async lista() {
      await esperarLista(page);
      marcas.registrar({ tipo: "lista" });
    },
    empezarVoz() {
      if (!voz) throw new Error(`La escena ${id} no tiene voz`);
      inicioVoz = ahora();
      marcas.registrar({ tipo: "voz", t: inicioVoz });
    },
    async hasta(fraccion) {
      exigirVoz();
      await dormirHasta(inicioVoz + fraccion * voz.segundos);
    },
    async enPalabra(palabra) {
      exigirVoz();
      const momento = momentoDePalabra(voz.palabras, palabra, ultimaPalabra);
      ultimaPalabra = momento + 0.01;
      await dormirHasta(inicioVoz + momento - 0.15);
    },
    /** Espera a que termine la frase (más `extra` segundos). */
    async finDeVoz(extra = 0) {
      exigirVoz();
      await dormirHasta(inicioVoz + voz.segundos + extra);
    },
    async terminar() {
      // Lo que dura la frase con su pausa y respiro, y siempre al menos 1,2 s para leer el último destacado.
      const finVoz = voz && inicioVoz !== null ? inicioVoz + voz.segundos + 0.4 + respiro : 0;
      const fin = Math.max(finVoz, ultimoDestacado ? ultimoDestacado + 1.2 : 0);
      if (ahora() < fin) await dormirHasta(fin);
      else await dormir(500);
      marcas.registrar({ tipo: "fin" });
    },
    /** Marca un destacado sobre `locator`, o sobre la caja que encierra a varios (una lista de locators). */
    async destacar(idDestacado, locator) {
      const cajas = [];
      for (const l of Array.isArray(locator) ? locator : [locator]) {
        const caja = await l.boundingBox();
        if (!caja) throw new Error(`El destacado "${idDestacado}" de la escena ${id} no está visible`);
        cajas.push(caja);
      }
      const x = Math.min(...cajas.map((c) => c.x));
      const y = Math.min(...cajas.map((c) => c.y));
      const w = Math.max(...cajas.map((c) => c.x + c.width)) - x;
      const h = Math.max(...cajas.map((c) => c.y + c.height)) - y;
      ultimoDestacado = ahora();
      marcas.registrar({ tipo: "destacar", id: idDestacado, caja: { x, y, w, h }, t: ultimoDestacado });
    },
    /** Cierra el destacado activo: antes de un scroll, para que el contorno no quede corrido. */
    soltar() {
      marcas.registrar({ tipo: "soltar" });
    },
    velocidad(valor) {
      marcas.registrar({ tipo: "velocidad", valor });
    },
    evento(nombre) {
      marcas.registrar({ tipo: "evento", nombre });
    },
  };
}
