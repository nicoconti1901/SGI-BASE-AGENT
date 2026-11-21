// Rótulo de los tramos acelerados ("⏩ x16 · acelerado para la demo"), arriba a la derecha.
import { interpolate, useCurrentFrame } from "remotion";
import { fuentes } from "../fuentes";
import type { EscenaLinea } from "../linea";
import { tema } from "../tema";

const limitar = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FUNDIDO = 8;

export const Rotulo: React.FC<{ rotulo: NonNullable<EscenaLinea["rotulo"]> }> = ({ rotulo }) => {
  const f = useCurrentFrame();
  const { desdeCuadro, cuadros } = rotulo;
  if (f < desdeCuadro || f >= desdeCuadro + cuadros) return null;
  const opacidad = Math.min(
    interpolate(f, [desdeCuadro, desdeCuadro + FUNDIDO], [0, 1], limitar),
    interpolate(f, [desdeCuadro + cuadros - FUNDIDO, desdeCuadro + cuadros], [1, 0], limitar),
  );
  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        right: 72,
        padding: "14px 24px",
        borderRadius: 10,
        backgroundColor: tema.tinta,
        color: tema.fondo,
        fontFamily: fuentes.texto,
        fontWeight: 500,
        fontSize: 30,
        letterSpacing: "0.02em",
        opacity: opacidad,
        transform: `translateY(${(1 - opacidad) * -12}px)`,
      }}
    >
      {rotulo.texto}
    </div>
  );
};
