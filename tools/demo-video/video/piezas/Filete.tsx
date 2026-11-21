// Filete porteño de la app (src/components/ui/FileteDivider.tsx): dos líneas con un rombo y volutas al centro.
// `progreso` de 0 a 1 lo dibuja desde el centro hacia afuera.
import { tema } from "../tema";

export const Filete: React.FC<{ ancho: number; progreso?: number; color?: string }> = ({ ancho, progreso = 1, color = tema.oro }) => {
  const largo = 124 * progreso;
  return (
    <svg width={ancho} height={(ancho * 14) / 320} viewBox="0 0 320 14" style={{ overflow: "visible" }}>
      <line x1={132} y1={7} x2={132 - largo} y2={7} stroke={color} strokeWidth={1} strokeLinecap="round" />
      <line x1={188} y1={7} x2={188 + largo} y2={7} stroke={color} strokeWidth={1} strokeLinecap="round" />
      <g style={{ opacity: Math.min(1, progreso * 2), transformOrigin: "160px 7px", transform: `scale(${0.4 + 0.6 * Math.min(1, progreso * 2)})` }}>
        <path d="M160 1.5l5.5 5.5-5.5 5.5-5.5-5.5z" fill={color} />
        <path d="M150 7c-3 0-4-3-7-3s-3 3 0 3M170 7c3 0 4-3 7-3s3 3 0 3" stroke={color} strokeWidth={1} fill="none" strokeLinecap="round" />
      </g>
      {progreso >= 0.98 ? (
        <>
          <circle cx={8} cy={7} r={1.8} fill={color} />
          <circle cx={312} cy={7} r={1.8} fill={color} />
        </>
      ) : null}
    </svg>
  );
};
