// Cierre de DEVCEN (el de la demo de DEVCEN Campus, en horizontal): "Una plataforma desarrollada por", el ícono que se dibuja,
// DEVCEN, CONNECTED SYSTEMS y el contacto. Funde a negro.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import type { PistaAudio } from "../linea";
import { LogoDevcen } from "../piezas/LogoDevcen";
import { devcen, tema } from "../tema";
import { cuadroDePalabra, limitar } from "./comun";

const sale = { ...limitar, easing: Easing.out(Easing.cubic) };

export const Cierre: React.FC<{ contacto: string; cuadros: number; voz?: PistaAudio; desde: number }> = ({ contacto, cuadros, voz, desde }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enUna = cuadroDePalabra(voz, desde, fps, "Una", Math.round(1.2 * fps));
  const enDev = cuadroDePalabra(voz, desde, fps, "Dev", Math.round(2.6 * fps));
  const entrada = interpolate(f, [0, 16], [1, 0], limitar);
  const intro = interpolate(f, [enUna - 4, enUna + 14], [0, 1], sale);
  const dibujo = interpolate(f, [enUna, enDev + 18], [0, 1], limitar);
  const titulo = interpolate(f, [enDev - 2, enDev + 16], [0, 1], sale);
  const lema = interpolate(f, [enDev + 14, enDev + 34], [0, 1], sale);
  const contactoVisible = interpolate(f, [enDev + 36, enDev + 56], [0, 1], sale);
  const salida = interpolate(f, [cuadros - 24, cuadros], [0, 1], limitar);

  return (
    <AbsoluteFill style={{ backgroundColor: devcen.fondo, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            marginBottom: 40,
            fontFamily: fuentes.devcenTexto,
            fontWeight: 500,
            fontSize: 42,
            letterSpacing: "0.04em",
            color: devcen.tinta,
            opacity: intro,
            transform: `translateY(${(1 - intro) * 18}px)`,
          }}
        >
          Una plataforma desarrollada por
        </div>
        <LogoDevcen progreso={dibujo} tamano={190} />
        <div
          style={{
            marginTop: 22,
            fontFamily: fuentes.devcenTitulo,
            fontWeight: 800,
            fontSize: 128,
            lineHeight: 1,
            letterSpacing: "0.04em",
            color: devcen.titulo,
            opacity: titulo,
            transform: `translateY(${(1 - titulo) * 24}px)`,
          }}
        >
          DEV<span style={{ color: devcen.naranja }}>CEN</span>
        </div>
        <div style={{ marginTop: 16, fontFamily: fuentes.devcenMono, fontSize: 30, letterSpacing: "0.32em", color: devcen.secundario, opacity: lema }}>
          CONNECTED SYSTEMS
        </div>
        <div
          style={{
            marginTop: 44,
            padding: "14px 36px",
            borderRadius: 12,
            border: `1px solid ${devcen.linea}`,
            fontFamily: fuentes.devcenMono,
            fontSize: 38,
            letterSpacing: "0.04em",
            color: devcen.secundario,
            opacity: contactoVisible,
          }}
        >
          {contacto}
        </div>
      </div>
      <AbsoluteFill style={{ backgroundColor: tema.fondo, opacity: entrada }} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: salida }} />
    </AbsoluteFill>
  );
};
