// Las de la app (Bodoni Moda itálica para títulos, Jost para texto) y las de la presentación de DEVCEN
// (Big Shoulders, Hanken Grotesk y DM Mono, como en la demo de DEVCEN Campus).
import { loadFont as cargarBigShoulders } from "@remotion/google-fonts/BigShoulders";
import { loadFont as cargarBodoni } from "@remotion/google-fonts/BodoniModa";
import { loadFont as cargarMono } from "@remotion/google-fonts/DMMono";
import { loadFont as cargarHanken } from "@remotion/google-fonts/HankenGrotesk";
import { loadFont as cargarJost } from "@remotion/google-fonts/Jost";

export const fuentes = {
  display: cargarBodoni("italic", { weights: ["500", "600"], subsets: ["latin"] }).fontFamily,
  texto: cargarJost("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily,
  devcenTitulo: cargarBigShoulders("normal", { weights: ["800"], subsets: ["latin"] }).fontFamily,
  devcenTexto: cargarHanken("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily,
  devcenMono: cargarMono("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
};
