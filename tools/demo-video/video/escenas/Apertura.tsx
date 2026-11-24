// Presentación de DEVCEN (la apertura de la demo de DEVCEN Campus, en horizontal): el ícono se dibuja, entran "DEVCEN" y
// "CONNECTED SYSTEMS", y con la voz "presenta". Funde al fondo claro de la plataforma.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import type { PistaAudio } from "../linea";
import { LogoDevcen } from "../piezas/LogoDevcen";
import { devcen, tema } from "../tema";
import { cuadroDePalabra, limitar } from "./comun";

export const Apertura: React.FC<{ cuadros: number; voz?: PistaAudio; desde: number }> = ({ cuadros, voz, desde }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dibujo = interpolate(f, [0, 2 * fps], [0, 1], limitar);
  const subida = interpolate(f, [1.6 * fps, 2.4 * fps], [0, -40], { ...limitar, easing: Easing.inOut(Easing.cubic) });
  const titulo = interpolate(f, [1.9 * fps, 2.6 * fps], [0, 1], { ...limitar, easing: Easing.out(Easing.cubic) });
  const lema = interpolate(f, [2.4 * fps, 3.2 * fps], [0, 1], { ...limitar, easing: Easing.out(Easing.cubic) });
  const raya = interpolate(f, [2.6 * fps, 3.4 * fps], [0, 1], { ...limitar, easing: Easing.inOut(Easing.cubic) });
  const enPresenta = cuadroDePalabra(voz, desde, fps, "presenta", Math.round(3.9 * fps));
  const presenta = interpolate(f, [enPresenta - 4, enPresenta + 14], [0, 1], { ...limitar, easing: Easing.out(Easing.cubic) });
  const salida = interpolate(f, [cuadros - 16, cuadros], [0, 1], limitar);

  return (
    <AbsoluteFill style={{ backgroundColor: devcen.fondo, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${subida + 30}px)` }}>
        <LogoDevcen progreso={dibujo} tamano={230} />
        <div
          style={{
            marginTop: 22,
            fontFamily: fuentes.devcenTitulo,
            fontWeight: 800,
            fontSize: 136,
            lineHeight: 1,
            letterSpacing: "0.04em",
            color: devcen.titulo,
            opacity: titulo,
            transform: `translateY(${(1 - titulo) * 24}px)`,
          }}
        >
          DEV<span style={{ color: devcen.naranja }}>CEN</span>
        </div>
        <div style={{ marginTop: 16, fontFamily: fuentes.devcenMono, fontSize: 32, color: devcen.secundario, letterSpacing: `${0.6 - lema * 0.28}em`, opacity: lema }}>
          CONNECTED SYSTEMS
        </div>
        <div style={{ marginTop: 24, height: 3, width: 560 * raya, backgroundColor: devcen.acento }} />
        <div
          style={{
            marginTop: 40,
            fontFamily: fuentes.devcenTexto,
            fontWeight: 500,
            fontSize: 42,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: devcen.tinta,
            opacity: presenta,
            transform: `translateY(${(1 - presenta) * 20}px)`,
          }}
        >
          presenta
        </div>
      </div>
      <AbsoluteFill style={{ backgroundColor: tema.fondo, opacity: salida }} />
    </AbsoluteFill>
  );
};
