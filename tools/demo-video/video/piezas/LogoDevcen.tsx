// El ícono de DEVCEN (apps/web/public/brand/mark.svg) dibujándose trazo por trazo.
// Sobre el fondo oscuro, los grises del ícono se aclaran para que se lean; los naranjas quedan iguales.
import { Easing, interpolate } from "remotion";
import { devcen as tema } from "../tema";

const GRIS = "#8b939e";
const GRIS_OSCURO = "#6f7782";

const TRAZOS = [
  { d: "M18 48 L36 14 L54 48 L36 58 Z", color: GRIS, ancho: 1.6 },
  { d: "M18 48 L36 38 L54 48", color: tema.naranjaOscuro, ancho: 1.8 },
  { d: "M36 14 L36 38 L36 58", color: GRIS_OSCURO, ancho: 1.4 },
  { d: "M24 32 L36 38 L48 32", color: tema.naranja, ancho: 1.4 },
];

const NODOS = [
  { cx: 36, cy: 14, r: 4.2, color: tema.naranjaOscuro },
  { cx: 18, cy: 48, r: 3.6, color: GRIS },
  { cx: 54, cy: 48, r: 3.6, color: GRIS },
  { cx: 36, cy: 38, r: 4.6, color: tema.naranja },
  { cx: 36, cy: 58, r: 3.2, color: GRIS_OSCURO },
  { cx: 24, cy: 32, r: 2.4, color: tema.naranjaOscuro },
  { cx: 48, cy: 32, r: 2.4, color: GRIS },
];

const limitar = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** `progreso` de 0 a 1: los trazos se dibujan escalonados y al final aparecen los nodos. */
export const LogoDevcen: React.FC<{ progreso: number; tamano: number }> = ({ progreso, tamano }) => (
  <svg viewBox="0 0 72 72" width={tamano} height={tamano} fill="none" style={{ overflow: "visible" }}>
    <g strokeLinecap="round" strokeLinejoin="round">
      {TRAZOS.map((t, i) => {
        const p = interpolate(progreso, [i * 0.14, i * 0.14 + 0.45], [0, 1], { ...limitar, easing: Easing.inOut(Easing.cubic) });
        return <path key={t.d} d={t.d} stroke={t.color} strokeWidth={t.ancho} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />;
      })}
    </g>
    {NODOS.map((n, i) => {
      const escala = interpolate(progreso, [0.62 + i * 0.04, 0.78 + i * 0.04], [0, 1], { ...limitar, easing: Easing.out(Easing.back(2.2)) });
      return <circle key={`${n.cx}-${n.cy}`} cx={n.cx} cy={n.cy} r={n.r * escala} fill={n.color} />;
    })}
  </svg>
);
