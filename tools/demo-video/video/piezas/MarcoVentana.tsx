// Ventana de navegador de 1600 × 900 (sin barra de dirección): borde, sombra suave, radio de 12 px y los tres puntos.
import { VENTANA } from "../tema";

export type Rect = { x: number; y: number; w: number; h: number };
const BARRA = 30;

/** Dónde queda el contenido de la captura (1600 × 900) dentro del lienzo, y a qué escala se dibuja. */
export function rectVentana(anchoCaptura: number, altoCaptura: number): Rect & { escala: number } {
  return { ...VENTANA, escala: Math.min(VENTANA.w / anchoCaptura, VENTANA.h / altoCaptura) };
}

export const MarcoVentana: React.FC<{ rect: Rect; children: React.ReactNode }> = ({ rect, children }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: rect.x - 1,
        top: rect.y - BARRA - 1,
        width: rect.w + 2,
        height: rect.h + BARRA + 2,
        borderRadius: 12,
        border: "1px solid #2a3342",
        backgroundColor: "#141a23",
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55), 0 4px 14px rgba(0, 0, 0, 0.35)",
      }}
    >
      <div style={{ display: "flex", gap: 8, padding: "9px 14px" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: c }} />
        ))}
      </div>
    </div>
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: "hidden", borderRadius: "0 0 11px 11px", backgroundColor: "#06080b" }}>
      {children}
    </div>
  </>
);
