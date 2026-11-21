// Separador de capítulo, como las tandas de una milonga: "Primera tanda" / "Para quienes bailan", sobre una foto.
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import { Filete } from "../piezas/Filete";
import { tema } from "../tema";
import { FotoDeFondo, Fundido, limitar } from "./comun";

export const Tanda: React.FC<{ texto: string[]; cuadros: number; foto: string; numero: string }> = ({ texto, cuadros, foto, numero }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [kicker, titulo] = texto;
  const entrada = spring({ frame: f - 6, fps, config: { damping: 20, stiffness: 90 } });
  const filete = interpolate(f, [4, 30], [0, 1], { ...limitar, easing: Easing.inOut(Easing.cubic) });
  const numeral = interpolate(f, [0, cuadros], [0.94, 1.04]);

  return (
    <AbsoluteFill>
      <FotoDeFondo src={foto} cuadros={cuadros} oscuridad={0.74} desenfoque={2} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "absolute",
            top: 330,
            fontFamily: fuentes.display,
            fontWeight: 500,
            fontSize: 560,
            lineHeight: 1,
            color: "transparent",
            WebkitTextStroke: `2px rgba(209, 174, 108, 0.35)`,
            transform: `scale(${numeral})`,
          }}
        >
          {numero}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: "translateY(120px)" }}>
          <div
            style={{
              fontFamily: fuentes.texto,
              fontWeight: 500,
              fontSize: 40,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: tema.oro,
              opacity: entrada,
            }}
          >
            {kicker}
          </div>
          <div style={{ marginTop: 26 }}>
            <Filete ancho={460} progreso={filete} />
          </div>
          <div
            style={{
              marginTop: 30,
              fontFamily: fuentes.display,
              fontWeight: 500,
              fontSize: 104,
              lineHeight: 1.08,
              textAlign: "center",
              maxWidth: 900,
              color: tema.tinta,
              opacity: entrada,
              transform: `translateY(${(1 - entrada) * 36}px)`,
            }}
          >
            {titulo}
          </div>
        </div>
      </AbsoluteFill>
      <Fundido cuadros={cuadros} entrada={10} salida={8} />
    </AbsoluteFill>
  );
};
