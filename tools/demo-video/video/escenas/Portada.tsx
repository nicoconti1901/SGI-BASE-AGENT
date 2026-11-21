// Portada de la app: una foto de milonga con zoom lento, el filete que se dibuja, "Milongas" en Bodoni itálica dorada y
// "La agenda del tango"; con "palma", "en la palma de tu mano".
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import type { PistaAudio } from "../linea";
import { Filete } from "../piezas/Filete";
import { tema } from "../tema";
import { cuadroDePalabra, FotoDeFondo, Fundido, limitar } from "./comun";

export const Portada: React.FC<{ cuadros: number; voz?: PistaAudio; desde: number }> = ({ cuadros, voz, desde }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enAgenda = cuadroDePalabra(voz, desde, fps, "agenda", Math.round(1.6 * fps));
  const enPalma = cuadroDePalabra(voz, desde, fps, "palma", Math.round(3.6 * fps));
  const titulo = spring({ frame: f - 4, fps, config: { damping: 22, stiffness: 70 } });
  const filete = interpolate(f, [10, 40], [0, 1], { ...limitar, easing: Easing.inOut(Easing.cubic) });
  const lema = interpolate(f, [enAgenda - 6, enAgenda + 12], [0, 1], { ...limitar, easing: Easing.out(Easing.cubic) });
  const palma = interpolate(f, [enPalma - 6, enPalma + 14], [0, 1], { ...limitar, easing: Easing.out(Easing.cubic) });
  const brillo = interpolate(f, [0, cuadros], [-40, 140]);

  return (
    <AbsoluteFill>
      <FotoDeFondo src="fotos/portada.jpg" cuadros={cuadros} oscuridad={0.62} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: "translateY(-40px)" }}>
          <Filete ancho={560} progreso={filete} />
          <div
            style={{
              marginTop: 26,
              fontFamily: fuentes.display,
              fontWeight: 600,
              fontSize: 210,
              lineHeight: 1.05,
              paddingRight: 20,
              backgroundImage: `linear-gradient(100deg, ${tema.oro} ${brillo - 30}%, #fff3d6 ${brillo}%, ${tema.oroClaro} ${brillo + 18}%, ${tema.oro} ${brillo + 40}%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              opacity: titulo,
              transform: `translateY(${(1 - titulo) * 40}px) scale(${0.94 + 0.06 * titulo})`,
              textShadow: "0 8px 40px rgba(0,0,0,0.35)",
            }}
          >
            Milongas
          </div>
          <div style={{ marginTop: 18, transform: "scaleX(-1)" }}>
            <Filete ancho={560} progreso={filete} />
          </div>
          <div
            style={{
              marginTop: 46,
              fontFamily: fuentes.texto,
              fontWeight: 500,
              fontSize: 40,
              letterSpacing: "0.34em",
              textTransform: "uppercase",
              color: tema.tinta,
              opacity: lema,
              transform: `translateY(${(1 - lema) * 16}px)`,
            }}
          >
            La agenda del tango
          </div>
          <div
            style={{
              marginTop: 26,
              fontFamily: fuentes.display,
              fontWeight: 500,
              fontSize: 58,
              color: tema.oroClaro,
              opacity: palma,
              transform: `translateY(${(1 - palma) * 16}px)`,
            }}
          >
            en la palma de tu mano
          </div>
        </div>
      </AbsoluteFill>
      <Fundido cuadros={cuadros} entrada={14} salida={12} />
    </AbsoluteFill>
  );
};
