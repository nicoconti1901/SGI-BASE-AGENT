// Una escena grabada: el teléfono con la captura y su cámara (zoom), los toques y los destacados encima,
// el encabezado arriba. Los subtítulos los dibuja Demo (siguen a la voz, no a la escena).
import { AbsoluteFill, Easing, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Caja, ClaveCamara, EscenaLinea } from "../linea";
import { Cursor } from "../piezas/Cursor";
import { Destacado } from "../piezas/Destacado";
import { Encabezado } from "../piezas/Encabezado";
import { Fondo } from "../piezas/Fondo";
import { MarcoTelefono, rectTelefono } from "../piezas/MarcoTelefono";
import { Rotulo } from "../piezas/Rotulo";

const TRANSICION = 15;
const suave = Easing.inOut(Easing.cubic);

/** Cámara en el cuadro `f`: cada clave se alcanza en TRANSICION cuadros, partiendo de donde estaba en ese momento. */
export function estadoCamara(claves: ClaveCamara[], f: number) {
  let desde = claves[0]!;
  let objetivo = claves[0]!;
  const mezclar = (a: ClaveCamara, b: ClaveCamara, p: number) => ({
    cuadro: b.cuadro,
    escala: a.escala + (b.escala - a.escala) * p,
    cx: a.cx + (b.cx - a.cx) * p,
    cy: a.cy + (b.cy - a.cy) * p,
  });
  for (const clave of claves.slice(1)) {
    if (clave.cuadro > f) break;
    desde = mezclar(desde, objetivo, suave(Math.min(1, (clave.cuadro - objetivo.cuadro) / TRANSICION)));
    objetivo = clave;
  }
  return mezclar(desde, objetivo, suave(Math.min(1, Math.max(0, f - objetivo.cuadro) / TRANSICION)));
}

export const Captura: React.FC<{ escena: EscenaLinea; tanda?: string; entrada: boolean; animarTanda: boolean }> = ({ escena, tanda, entrada, animarTanda }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cap = escena.captura!;
  const rect = rectTelefono(cap.ancho, cap.alto);
  const cam = estadoCamara(escena.camara, f);
  const k = rect.escala * cam.escala;
  const aPantalla = (caja: Caja): Caja => ({
    x: rect.x + rect.w / 2 + (caja.x - cam.cx) * k,
    y: rect.y + rect.h / 2 + (caja.y - cam.cy) * k,
    w: caja.w * k,
    h: caja.h * k,
  });
  // El teléfono sube desde abajo en la primera escena después de un título.
  const sube = entrada ? spring({ frame: f, fps, config: { damping: 20, stiffness: 90 } }) : 1;
  const limites = { x: 40, y: rect.y, w: 1000, h: rect.h };

  return (
    <AbsoluteFill>
      <Fondo />
      <Encabezado tanda={tanda} etiqueta={escena.etiqueta} animarTanda={animarTanda} />
      <AbsoluteFill style={{ transform: `translateY(${(1 - sube) * 900}px)` }}>
        <MarcoTelefono rect={rect}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: cap.ancho,
              height: cap.alto,
              transformOrigin: "0 0",
              transform: `translate(${rect.w / 2}px, ${rect.h / 2}px) scale(${k}) translate(${-cam.cx}px, ${-cam.cy}px)`,
            }}
          >
            {cap.tramos.map((tramo) => (
              <Sequence key={tramo.desdeCuadro} from={tramo.desdeCuadro} durationInFrames={Math.max(1, tramo.cuadros)} layout="none">
                <OffthreadVideo
                  src={staticFile(cap.archivo)}
                  trimBefore={Math.round(tramo.origenSeg * fps)}
                  playbackRate={tramo.velocidad}
                  muted
                  style={{ position: "absolute", left: 0, top: 0, width: cap.ancho, height: cap.alto }}
                />
              </Sequence>
            ))}
          </div>
        </MarcoTelefono>
        <Cursor puntos={escena.cursor} aPantalla={aPantalla} tactil />
        {escena.destacados.map((d) => (
          <Destacado key={d.id} d={d} aPantalla={aPantalla} limites={limites} />
        ))}
      </AbsoluteFill>
      {escena.rotulo ? <Rotulo rotulo={escena.rotulo} /> : null}
    </AbsoluteFill>
  );
};
