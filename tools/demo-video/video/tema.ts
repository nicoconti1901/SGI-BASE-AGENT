// Colores de la plataforma (tema oscuro, src/styles/tokens.css) y, para la presentación y el cierre de DEVCEN, los de la
// demo de DEVCEN Campus (fondo oscuro, naranjas del ícono y cian).
import type { Tono } from "./linea";

export const tema = {
  fondo: "#06080b", // --color-canvas (oscuro)
  superficie: "#0a0e13", // --color-surface
  linea: "#64728c", // --color-card-line
  tinta: "#e8edf5", // --color-ink
  tinta2: "#9aa6b8", // --color-ink-muted
  acento: "#3dd6c6", // --color-form-rail
  acentoClaro: "#b8f3ec", // --color-form-ink (subtítulos)
  alerta: "#ff6b7a", // --color-danger
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
  acento: { fondo: tema.acento, texto: "#04201e" },
  alerta: { fondo: tema.alerta, texto: "#2a0509" },
};

export const ANCHO = 1920;
export const ALTO = 1080;
/** La ventana de la app dentro del lienzo: 1600 × 900, centrada, con la barra de puntos encima. */
export const VENTANA = { x: 160, y: 112, w: 1600, h: 900 } as const;
