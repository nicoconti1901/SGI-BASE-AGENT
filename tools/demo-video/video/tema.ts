// Colores: los de la app ("Salón de gala", src/theme/tokens.ts) y, para la presentación y el cierre de DEVCEN, los de la
// demo de DEVCEN Campus (fondo oscuro, naranjas del ícono y cian).
import type { Tono } from "./linea";

export const tema = {
  fondo: "#110d0e",
  superficie: "#1a1415",
  elevado: "#251c1d",
  linea: "#3a2d2b",
  tinta: "#f3e8d6",
  tinta2: "#bfae94",
  oro: "#d1ae6c",
  oroClaro: "#ecd29a",
  vino: "#7a1e32",
  vinoClaro: "#9c2a43",
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
  oro: { fondo: tema.oro, texto: tema.fondo },
  vino: { fondo: tema.vinoClaro, texto: tema.tinta },
};

export const ANCHO = 1080;
export const ALTO = 1920;
