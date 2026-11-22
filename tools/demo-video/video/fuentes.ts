// Las de la plataforma (Instrument Sans para títulos, Geist para texto) y las de la presentación de DEVCEN
// (Big Shoulders, Hanken Grotesk y DM Mono, como en la demo de DEVCEN Campus).
import { loadFont as cargarBigShoulders } from "@remotion/google-fonts/BigShoulders";
import { loadFont as cargarMono } from "@remotion/google-fonts/DMMono";
import { loadFont as cargarGeist } from "@remotion/google-fonts/Geist";
import { loadFont as cargarHanken } from "@remotion/google-fonts/HankenGrotesk";
import { loadFont as cargarInstrument } from "@remotion/google-fonts/InstrumentSans";

export const fuentes = {
  display: cargarInstrument("normal", { weights: ["600", "700"], subsets: ["latin"] }).fontFamily,
  texto: cargarGeist("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily,
  devcenTitulo: cargarBigShoulders("normal", { weights: ["800"], subsets: ["latin"] }).fontFamily,
  devcenTexto: cargarHanken("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily,
  devcenMono: cargarMono("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
};
