// Escena de título sobre el fondo de la plataforma: rótulo corto, título grande, subtítulo y, si el guion las trae, las
// ideas (cada una entra con su palabra en la voz) y el llamado final.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import type { PistaAudio } from "../linea";
import { tema } from "../tema";
import { cuadroDePalabra, Fundido, limitar } from "./comun";

export type TextosTitulo = { kicker?: string; titulo: string; subtitulo?: string; palabraSubtitulo?: string };
type Props = TextosTitulo & {
  chips?: { texto: string; en: string }[];
  llamado?: string;
  voz?: PistaAudio;
  desde: number;
  cuadros: number;
};

export const Titulo: React.FC<Props> = ({ kicker, titulo, subtitulo, palabraSubtitulo, chips, llamado, voz, desde, cuadros }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame: f - 4, fps, config: { damping: 22, stiffness: 90 } });
  const barra = interpolate(f, [0, 24], [0, 1], limitar);
  const enSub = palabraSubtitulo ? cuadroDePalabra(voz, desde, fps, palabraSubtitulo, Math.round(1.4 * fps)) : 0;
  const sub = subtitulo ? interpolate(f, [enSub - 6, enSub + 14], [0, 1], limitar) : 0;
  const enLlamado = Math.max(0, cuadros - Math.round(2.4 * fps));
  const llam = llamado ? spring({ frame: f - enLlamado, fps, config: { damping: 18, stiffness: 120 } }) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: tema.fondo, backgroundImage: "radial-gradient(ellipse 60% 70% at 88% 6%, rgba(15,110,106,0.12), transparent 70%)" }}>
      <AbsoluteFill style={{ padding: "0 190px", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 44, alignItems: "stretch" }}>
          <div style={{ width: 10, borderRadius: 5, backgroundColor: tema.acento, transform: `scaleY(${barra})`, transformOrigin: "top" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 26, opacity: entrada, transform: `translateY(${(1 - entrada) * 26}px)` }}>
            {kicker ? (
              <div style={{ fontFamily: fuentes.texto, fontWeight: 600, fontSize: 28, letterSpacing: "0.2em", textTransform: "uppercase", color: tema.acento }}>{kicker}</div>
            ) : null}
            <div style={{ fontFamily: fuentes.display, fontWeight: 700, fontSize: 124, lineHeight: 1.04, letterSpacing: "-0.02em", color: tema.tinta, maxWidth: 1380 }}>{titulo}</div>
            {subtitulo ? (
              <div style={{ fontFamily: fuentes.texto, fontWeight: 400, fontSize: 46, lineHeight: 1.3, color: tema.tinta2, maxWidth: 1250, opacity: sub, transform: `translateY(${(1 - sub) * 14}px)` }}>{subtitulo}</div>
            ) : null}
            {chips?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 14, maxWidth: 1380 }}>
                {chips.map((chip, i) => {
                  const en = cuadroDePalabra(voz, desde, fps, chip.en, Math.round((1.5 + i * 1.6) * fps));
                  const p = spring({ frame: f - en + 3, fps, config: { damping: 18, stiffness: 130 } });
                  return (
                    <div
                      key={chip.texto}
                      style={{
                        padding: "16px 30px",
                        borderRadius: 14,
                        backgroundColor: tema.superficie,
                        border: `2px solid ${tema.acento}`,
                        color: tema.tinta,
                        fontFamily: fuentes.texto,
                        fontWeight: 600,
                        fontSize: 40,
                        opacity: p,
                        transform: `translateY(${(1 - p) * 22}px) scale(${0.96 + 0.04 * p})`,
                      }}
                    >
                      {chip.texto}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </AbsoluteFill>
      {llamado ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 120, display: "flex", justifyContent: "center", opacity: llam, transform: `translateY(${(1 - llam) * 24}px)` }}>
          <div style={{ padding: "22px 56px", borderRadius: 16, backgroundColor: tema.acento, color: "#fff", fontFamily: fuentes.display, fontWeight: 700, fontSize: 56 }}>{llamado}</div>
        </div>
      ) : null}
      <Fundido cuadros={cuadros} entrada={10} salida={10} />
    </AbsoluteFill>
  );
};
