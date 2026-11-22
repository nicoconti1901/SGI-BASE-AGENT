// Audio: la voz al frente; la música de DEVCEN entera en la presentación y el cierre, y la misma pista en bucle a −24 dB en
// el medio, que baja cuando habla la voz. Entre una y otra hay un fundido cruzado.
import { Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import type { Linea } from "../linea";

const DEVCEN = 0.34;
const DEVCEN_BAJO = 0.16;
/** En el medio, la misma pista en bucle a −24 dB, y más baja todavía cuando habla la voz. */
const MEDIO = 0.063;
const MEDIO_BAJO = 0.03;
const RAMPA = 8;
const CRUCE = 24; // cuadros del fundido cruzado entre la música de la apertura, la del medio y la del cierre
/** Segundos de "Talent in the Air" (1:54): el cierre usa su final, así la música termina con el video. */
const DURACION_DEVCEN = 114;
const limitar = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function tramosDeMedio(total: number, fps: number) {
  const largo = Math.round((DURACION_DEVCEN - 1) * fps);
  const paso = largo - 3 * fps;
  const tramos: { desde: number; cuadros: number; ultimo: boolean }[] = [];
  for (let desde = 0; desde < total; desde += paso) {
    const cuadros = Math.min(largo, total - desde);
    tramos.push({ desde, cuadros, ultimo: desde + cuadros >= total });
    if (desde + cuadros >= total) break;
  }
  return tramos;
}

/** Factor de la música en el cuadro absoluto `f`: baja en cada intervalo de `silenciarMusica`. */
function ducking(linea: Linea, f: number, alto: number, bajo: number) {
  let volumen = alto;
  for (const { desde, hasta } of linea.silenciarMusica) {
    if (f < desde - RAMPA || f > hasta + RAMPA) continue;
    volumen = Math.min(volumen, interpolate(f, [desde - RAMPA, desde, hasta, hasta + RAMPA], [alto, bajo, bajo, alto], limitar));
  }
  return volumen;
}

export const Pistas: React.FC<{ linea: Linea }> = ({ linea }) => {
  const { fps } = useVideoConfig();
  const apertura = linea.escenas.find((e) => e.id === "apertura")!;
  const cierre = linea.escenas.find((e) => e.id === "cierre")!;
  const finApertura = apertura.desde + apertura.cuadros;
  const total = linea.duracionCuadros;
  const medioDesde = finApertura - CRUCE;
  const medioCuadros = cierre.desde + CRUCE - medioDesde;
  const cierreDesde = cierre.desde - CRUCE;
  const cierreCuadros = total - cierreDesde;

  return (
    <>
      {linea.audio.map((pista) => (
        <Sequence key={`${pista.tipo}-${pista.desdeCuadro}`} from={pista.desdeCuadro} durationInFrames={Math.max(1, pista.cuadros)} layout="none">
          <Audio src={staticFile(pista.archivo)} />
        </Sequence>
      ))}
      <Sequence from={0} durationInFrames={finApertura + CRUCE} layout="none">
        <Audio
          src={staticFile("musica-devcen.mp3")}
          volume={(f) =>
            ducking(linea, f, DEVCEN, DEVCEN_BAJO) *
            interpolate(f, [0, 12], [0, 1], limitar) *
            interpolate(f, [finApertura - CRUCE, finApertura + CRUCE], [1, 0], limitar)
          }
        />
      </Sequence>
      {tramosDeMedio(medioCuadros, fps).map((t) => (
        <Sequence key={t.desde} from={medioDesde + t.desde} durationInFrames={t.cuadros} layout="none">
          <Audio
            src={staticFile("musica-devcen.mp3")}
            volume={(f) =>
              ducking(linea, medioDesde + t.desde + f, MEDIO, MEDIO_BAJO) *
              interpolate(f, [0, t.desde === 0 ? 2 * CRUCE : 3 * fps], [0, 1], limitar) *
              interpolate(f, [t.cuadros - (t.ultimo ? 2 * CRUCE : 3 * fps), t.cuadros], [1, 0], limitar)
            }
          />
        </Sequence>
      ))}
      <Sequence from={cierreDesde} durationInFrames={cierreCuadros} layout="none">
        <Audio
          src={staticFile("musica-devcen.mp3")}
          trimBefore={Math.max(0, Math.round((DURACION_DEVCEN - cierreCuadros / fps) * fps))}
          volume={(f) =>
            ducking(linea, cierreDesde + f, DEVCEN, DEVCEN_BAJO) *
            interpolate(f, [0, 2 * CRUCE], [0, 1], limitar) *
            interpolate(f, [cierreCuadros - 30, cierreCuadros], [1, 0], limitar)
          }
        />
      </Sequence>
    </>
  );
};
