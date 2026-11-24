// Arriba a la izquierda de la ventana: el nombre de la pantalla y, a su derecha, el chip con las cláusulas de la norma.
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import { tema, VENTANA } from "../tema";

export const Rotulo: React.FC<{ texto: string; norma?: string }> = ({ texto, norma }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame: f - 2, fps, config: { damping: 20, stiffness: 120 } });
  return (
    <div
      style={{
        position: "absolute",
        left: VENTANA.x,
        top: 26,
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 20,
        opacity: entrada,
        transform: `translateY(${(1 - entrada) * -14}px)`,
      }}
    >
      <div style={{ fontFamily: fuentes.display, fontWeight: 700, fontSize: 42, lineHeight: 1, color: tema.tinta }}>{texto}</div>
      {norma ? (
        <div
          style={{
            padding: "7px 16px",
            borderRadius: 999,
            border: `1.5px solid ${tema.acento}`,
            color: tema.acento,
            fontFamily: fuentes.texto,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {norma}
        </div>
      ) : null}
    </div>
  );
};
