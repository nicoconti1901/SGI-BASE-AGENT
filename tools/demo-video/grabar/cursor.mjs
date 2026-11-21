// Toques y desplazamientos de la grabación en el teléfono. Cada toque queda marcado: Remotion dibuja la onda del dedo.

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Anima el scroll del contenedor desplazable que está en (x, y) dentro de la página, con requestAnimationFrame: en el
 * contexto móvil cada page.evaluate cuesta, así que todo el movimiento va en una sola llamada. La app (React Native Web)
 * desplaza divs con overflow, no la ventana.
 */
async function animarScroll(page, { x, y, dy, ms }) {
  await page.evaluate(
    ({ x, y, dy, ms }) =>
      new Promise((ok) => {
        let el = document.elementFromPoint(x, y);
        while (el && el !== document.body) {
          const estilo = getComputedStyle(el);
          if (/(auto|scroll)/.test(estilo.overflowY) && el.scrollHeight > el.clientHeight + 1) break;
          el = el.parentElement;
        }
        const objetivo = el && el !== document.body ? el : document.scrollingElement;
        const y0 = objetivo.scrollTop;
        const destino = Math.max(0, Math.min(objetivo.scrollHeight - objetivo.clientHeight, y0 + dy));
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
  const viewport = page.viewportSize() ?? { width: 390, height: 844 };

  async function centroDe(locator) {
    await locator.scrollIntoViewIfNeeded();
    const caja = await locator.boundingBox();
    if (!caja) throw new Error(`El elemento no está visible: ${locator}`);
    return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
  }

  /** Toca el elemento (con la onda marcada) y deja un respiro corto para que se vea la respuesta. */
  async function tocar(locator, pausa = 120) {
    const { x, y } = await centroDe(locator);
    marcas.registrar({ tipo: "cursor", x, y, accion: "toque" });
    await locator.tap();
    await dormir(pausa);
  }

  /** Escribe como una persona en el teclado del teléfono: toca el campo y tipea letra por letra. */
  async function escribir(locator, texto, { demora = 55 } = {}) {
    await tocar(locator, 60);
    await locator.pressSequentially(texto, { delay: demora });
  }

  /** Desplaza `dy` px CSS en `segundos` el contenedor que está en el centro de la pantalla (o en `punto`). */
  async function deslizar(dy, segundos = 0.9, punto = { x: viewport.width / 2, y: viewport.height * 0.55 }) {
    marcas.registrar({ tipo: "cursor", ...punto, accion: "scroll" });
    await animarScroll(page, { ...punto, dy, ms: segundos * 1000 });
    await dormir(60);
  }

  /** Desplaza hasta que el borde de arriba de `locator` quede en `y` (px CSS desde arriba del viewport). */
  async function deslizarHasta(locator, y, segundos = 0.9) {
    const caja = await locator.boundingBox();
    if (!caja) throw new Error(`El elemento no está en la página: ${locator}`);
    await deslizar(caja.y - y, segundos);
  }

  return { tocar, escribir, deslizar, deslizarHasta };
}
