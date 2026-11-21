// Utilidades de las escenas de título: el cuadro (relativo a la escena) en que la voz dice una palabra, y la foto de
// fondo con un zoom lento y oscurecida.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { PistaAudio } from "../linea";
import { tema } from "../tema";

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]/g, "");
export const limitar = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Cuadro de la escena en que la voz empieza `palabra` (o `porDefecto` si no hay voz o no la dice). */
export function cuadroDePalabra(voz: PistaAudio | undefined, desdeEscena: number, fps: number, palabra: string, porDefecto: number) {
  const encontrada = voz?.palabras?.find((p) => normalizar(p[2]) === normalizar(palabra));
  if (!voz || !encontrada) return porDefecto;
  return voz.desdeCuadro - desdeEscena + Math.round(encontrada[0] * fps);
}

export const FotoDeFondo: React.FC<{ src: string; cuadros: number; oscuridad?: number; desenfoque?: number }> = ({
  src,
  cuadros,
  oscuridad = 0.72,
  desenfoque = 0,
}) => {
  const f = useCurrentFrame();
  const escala = interpolate(f, [0, cuadros], [1.06, 1.16]);
  return (
    <AbsoluteFill style={{ backgroundColor: tema.fondo, overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${escala})`, filter: `blur(${desenfoque}px) saturate(0.9)` }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(17,13,14,${oscuridad}) 0%, rgba(17,13,14,${Math.min(1, oscuridad + 0.12)}) 45%, rgba(17,13,14,${Math.min(1, oscuridad + 0.2)}) 100%)`,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 110% 80% at 50% 50%, transparent 45%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Fundido de entrada y salida con una capa del color del fondo encima (sin recuadros alrededor del texto). */
export const Fundido: React.FC<{ cuadros: number; entrada?: number; salida?: number; color?: string }> = ({ cuadros, entrada = 10, salida = 12, color = tema.fondo }) => {
  const f = useCurrentFrame();
  const opacidad = Math.max(
    entrada ? interpolate(f, [0, entrada], [1, 0], limitar) : 0,
    salida ? interpolate(f, [cuadros - salida, cuadros], [0, 1], limitar) : 0,
  );
  return <AbsoluteFill style={{ backgroundColor: color, opacity: opacidad }} />;
};
