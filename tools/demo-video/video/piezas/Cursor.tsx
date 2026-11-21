// Cursor dibujado a partir de las marcas de la grabación: flecha en escritorio, solo el toque en el teléfono.
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { Caja, PuntoCursor } from "../linea";
import { tema } from "../tema";

const suave = Easing.inOut(Easing.cubic);
const ONDA = 12;

function posicion(puntos: PuntoCursor[], f: number) {
  let i = -1;
  for (let k = 0; k < puntos.length; k += 1) if (puntos[k]!.cuadro <= f) i = k;
  if (i < 0) return puntos[0]!;
  const a = puntos[i]!;
  const b = puntos[i + 1];
  if (!b || b.cuadro <= a.cuadro) return a;
  const p = suave(Math.min(1, (f - a.cuadro) / (b.cuadro - a.cuadro)));
  return { ...a, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}

export const Cursor: React.FC<{ puntos: PuntoCursor[]; aPantalla: (caja: Caja) => Caja; tactil: boolean }> = ({ puntos, aPantalla, tactil }) => {
  const f = useCurrentFrame();
  if (puntos.length === 0) return null;
  const ondas = puntos.filter((p) => (p.accion === "clic" || p.accion === "toque") && f >= p.cuadro && f < p.cuadro + ONDA);
  const actual = aPantalla({ ...posicion(puntos, f), w: 0, h: 0 });

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {ondas.map((p) => {
        const c = aPantalla({ x: p.x, y: p.y, w: 0, h: 0 });
        const avance = (f - p.cuadro) / ONDA;
        const radio = interpolate(avance, [0, 1], [tactil ? 22 : 10, tactil ? 54 : 34]);
        return (
          <div
            key={`${p.cuadro}-${p.x}`}
            style={{
              position: "absolute",
              left: c.x - radio,
              top: c.y - radio,
              width: radio * 2,
              height: radio * 2,
              borderRadius: "50%",
              border: `4px solid ${tema.oroClaro}`,
              backgroundColor: tactil ? "rgba(236, 210, 154, 0.28)" : "transparent",
              opacity: 0.85 * (1 - avance),
            }}
          />
        );
      })}
      {tactil ? null : (
        <svg style={{ position: "absolute", left: actual.x - 3, top: actual.y - 2, overflow: "visible" }} width={34} height={44} viewBox="0 0 17 22">
          <path d="M1 1 L1 17.5 L5.2 13.6 L8.1 20.4 L11 19.1 L8.2 12.5 L13.9 12.5 Z" fill="#0a0d12" stroke="#ffffff" strokeWidth={1.3} strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
};
