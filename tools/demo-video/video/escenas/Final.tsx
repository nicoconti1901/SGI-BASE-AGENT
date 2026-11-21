// Cierre de la app: "Milongas" y las tres ideas, cada una con su palabra en la voz.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import type { PistaAudio } from "../linea";
import { Filete } from "../piezas/Filete";
import { tema } from "../tema";
import { cuadroDePalabra, FotoDeFondo, Fundido, limitar } from "./comun";

const IDEAS = [
  { palabra: "Encontrá", texto: "Encontrá dónde bailar" },
  { palabra: "confirmá", texto: "Confirmá en segundos" },
  { palabra: "vemos", texto: "Nos vemos en la pista" },
];

export const Final: React.FC<{ cuadros: number; voz?: PistaAudio; desde: number }> = ({ cuadros, voz, desde }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titulo = spring({ frame: f - 2, fps, config: { damping: 22, stiffness: 80 } });
  const filete = interpolate(f, [6, 34], [0, 1], limitar);

  return (
    <AbsoluteFill>
      <FotoDeFondo src="fotos/final.jpg" cuadros={cuadros} oscuridad={0.7} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              fontFamily: fuentes.display,
              fontWeight: 600,
              fontSize: 170,
              lineHeight: 1.05,
              color: tema.oroClaro,
              opacity: titulo,
              transform: `translateY(${(1 - titulo) * 30}px)`,
            }}
          >
            Milongas
          </div>
          <div style={{ marginTop: 20, marginBottom: 70 }}>
            <Filete ancho={520} progreso={filete} />
          </div>
          {IDEAS.map((idea, i) => {
            const en = cuadroDePalabra(voz, desde, fps, idea.palabra, Math.round((0.9 + i * 1.8) * fps));
            const p = spring({ frame: f - en + 3, fps, config: { damping: 18, stiffness: 120 } });
            return (
              <div
                key={idea.texto}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  marginTop: i ? 34 : 0,
                  opacity: p,
                  transform: `translateX(${(1 - p) * -40}px)`,
                }}
              >
                <svg width={26} height={26} viewBox="0 0 12 12">
                  <path d="M6 0.5l5.5 5.5-5.5 5.5-5.5-5.5z" fill={tema.oro} />
                </svg>
                <div style={{ fontFamily: fuentes.display, fontWeight: 500, fontSize: 72, color: tema.tinta }}>{idea.texto}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <Fundido cuadros={cuadros} entrada={12} salida={14} color="#0a0d12" />
    </AbsoluteFill>
  );
};
