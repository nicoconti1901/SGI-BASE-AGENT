// Arriba del teléfono: la tanda (milonguero/a u organizador/a) y el nombre de la pantalla, con un filete.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import { tema } from "../tema";
import { Filete } from "./Filete";

const limitar = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Encabezado: React.FC<{ tanda?: string; etiqueta?: string; animarTanda: boolean }> = ({ tanda, etiqueta, animarTanda }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame: f - 2, fps, config: { damping: 18, stiffness: 120 } });
  const tandaVisible = animarTanda ? interpolate(f, [0, 12], [0, 1], limitar) : 1;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 52, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {tanda ? (
        <div style={{ fontFamily: fuentes.texto, fontWeight: 500, fontSize: 26, letterSpacing: "0.32em", color: tema.oro, textTransform: "uppercase", opacity: tandaVisible }}>
          {tanda}
        </div>
      ) : null}
      <div style={{ marginTop: 14, opacity: tandaVisible }}>
        <Filete ancho={300} />
      </div>
      {etiqueta ? (
        <div
          style={{
            marginTop: 10,
            fontFamily: fuentes.display,
            fontWeight: 500,
            fontSize: 74,
            lineHeight: 1.1,
            color: tema.tinta,
            opacity: entrada,
            transform: `translateY(${(1 - entrada) * 26}px)`,
          }}
        >
          {etiqueta}
        </div>
      ) : null}
    </div>
  );
};
