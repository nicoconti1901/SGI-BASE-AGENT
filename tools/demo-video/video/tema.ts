// Colores de la plataforma (tema claro, src/styles/tokens.css) y, para la presentación y el cierre de DEVCEN, los de la
// demo de DEVCEN Campus (fondo oscuro, naranjas del ícono y cian).
import type { Tono } from "./linea";

export const tema = {
  fondo: "#eaeef4", // --color-canvas
  superficie: "#ffffff",
  linea: "#7a879e", // --color-card-line
  tinta: "#0e1525", // --color-ink
  tinta2: "#4b5568", // --color-ink-muted
  acento: "#0f6e6a", // --color-form-rail
  acentoClaro: "#7ee7df", // sobre fondos oscuros (subtítulos)
  alerta: "#c4202f", // --color-danger
} as const;

export const devcen = {
  fondo: "#0a0d12",
  titulo: "#f1f3f5",
  tinta: "#d6dce4",
  acento: "#5b9dff",
  secundario: "#2fd4e8",
  linea: "rgba(167, 176, 188, 0.18)",
  naranja: "#d94f00",
  naranjaOscuro: "#c44700",
} as const;

export const colorDeTono: Record<Tono, { fondo: string; texto: string }> = {
  acento: { fondo: tema.acento, texto: "#ffffff" },
  alerta: { fondo: tema.alerta, texto: "#ffffff" },
};

export const ANCHO = 1920;
export const ALTO = 1080;
/** La ventana de la app dentro del lienzo: 1600 × 900, centrada, con la barra de puntos encima. */
export const VENTANA = { x: 160, y: 112, w: 1600, h: 900 } as const;
