// Clics, tipeo y desplazamientos de la grabación en el navegador de escritorio. Cada clic queda marcado: Remotion dibuja el cursor.

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Anima el scroll del contenedor desplazable que está en (x, y), o el de la página, con requestAnimationFrame: todo el
 * movimiento va en una sola llamada para que sea parejo.
 */
async function animarScroll(page, { x, y, dy, ms }) {
  await page.evaluate(
    ({ x, y, dy, ms }) =>
      new Promise((ok) => {
        let el = document.elementFromPoint(x, y);
        while (el && el !== document.body && el !== document.documentElement) {
          const estilo = getComputedStyle(el);
          if (/(auto|scroll)/.test(estilo.overflowY) && el.scrollHeight > el.clientHeight + 1) break;
          el = el.parentElement;
        }
        const propio = el && el !== document.body && el !== document.documentElement;
        const objetivo = propio ? el : document.scrollingElement;
        const y0 = objetivo.scrollTop;
        const maximo = objetivo.scrollHeight - (propio ? objetivo.clientHeight : innerHeight);
        const destino = Math.max(0, Math.min(maximo, y0 + dy));
        const total = destino - y0;
        const inicio = performance.now();
        const paso = (ahora) => {
          const p = Math.min(1, (ahora - inicio) / ms);
          const suave = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
          objetivo.scrollTop = y0 + total * suave;
          if (p < 1) requestAnimationFrame(paso);
          else ok();
        };
        requestAnimationFrame(paso);
      }),
    { x, y, dy, ms },
  );
}

export function crearCursor(page, marcas) {
  const viewport = page.viewportSize() ?? { width: 1600, height: 900 };

  async function centroDe(locator) {
    await locator.scrollIntoViewIfNeeded();
    const caja = await locator.boundingBox();
    if (!caja) throw new Error(`El elemento no está visible: ${locator}`);
    return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
  }

  /** Lleva el mouse al elemento, lo marca y hace clic; deja un respiro corto para que se vea la respuesta. */
  async function tocar(locator, pausa = 150) {
    const { x, y } = await centroDe(locator);
    await page.mouse.move(x, y, { steps: 12 });
    marcas.registrar({ tipo: "cursor", x, y, accion: "toque" });
    await page.mouse.click(x, y);
    await dormir(pausa);
  }

  /** Escribe como una persona: clic en el campo y tipeo letra por letra. */
  async function escribir(locator, texto, { demora = 50 } = {}) {
    await tocar(locator, 60);
    await locator.pressSequentially(texto, { delay: demora });
  }

  /** Desplaza `dy` px CSS en `segundos` el contenedor que está en el centro de la ventana (o en `punto`). */
  async function deslizar(dy, segundos = 0.9, punto = { x: viewport.width / 2, y: viewport.height * 0.55 }) {
    marcas.registrar({ tipo: "cursor", ...punto, accion: "scroll" });
    await animarScroll(page, { ...punto, dy, ms: segundos * 1000 });
    await dormir(60);
  }

  /** Desplaza hasta que el borde de arriba de `locator` quede en `y` (px CSS desde arriba de la ventana). */
  async function deslizarHasta(locator, y, segundos = 0.9) {
    const caja = await locator.boundingBox();
    if (!caja) throw new Error(`El elemento no está en la página: ${locator}`);
    await deslizar(caja.y - y, segundos);
  }

  return { tocar, escribir, deslizar, deslizarHasta };
}
