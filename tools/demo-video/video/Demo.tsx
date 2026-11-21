// Composición completa (vertical): cada escena de la línea en su Sequence según su tipo, los subtítulos de la voz en
// las capturas y las pistas de audio.
import { AbsoluteFill, Sequence } from "remotion";
import { Apertura } from "./escenas/Apertura";
import { Captura } from "./escenas/Captura";
import { Cierre } from "./escenas/Cierre";
import { Final } from "./escenas/Final";
import { Portada } from "./escenas/Portada";
import { Tanda } from "./escenas/Tanda";
import type { EscenaLinea, Linea } from "./linea";
import { Pistas } from "./piezas/Pistas";
import { Subtitulos } from "./piezas/Subtitulos";
import { tema } from "./tema";

export type PropsDemo = { linea: Linea };

const TANDAS: Record<string, { foto: string; numero: string; rotulo: string }> = {
  tanda1: { foto: "fotos/tanda1.jpg", numero: "I", rotulo: "Acceso a milongueros/milongueras" },
  tanda2: { foto: "fotos/tanda2.jpg", numero: "II", rotulo: "Acceso a organizadores" },
};

export const Demo: React.FC<PropsDemo> = ({ linea }) => {
  const vozDe = (id: string) => linea.audio.find((a) => a.tipo === "voz" && a.escena === id);
  const capturas = new Set(linea.escenas.filter((e) => e.tipo === "captura").map((e) => e.id));
  let tanda: string | undefined;

  const escenas = linea.escenas.map((escena: EscenaLinea, i) => {
    const anterior = linea.escenas[i - 1];
    let contenido: React.ReactNode;
    if (escena.tipo === "captura") {
      const entrada = anterior?.tipo !== "captura";
      contenido = <Captura escena={escena} tanda={tanda} entrada={entrada} animarTanda={entrada} />;
    } else if (escena.id === "apertura") {
      contenido = <Apertura cuadros={escena.cuadros} voz={vozDe(escena.id)} desde={escena.desde} />;
    } else if (escena.id === "cierre") {
      contenido = <Cierre contacto={escena.contacto ?? "www.dev-cen.com"} cuadros={escena.cuadros} voz={vozDe(escena.id)} desde={escena.desde} />;
    } else if (escena.id === "portada") {
      contenido = <Portada cuadros={escena.cuadros} voz={vozDe(escena.id)} desde={escena.desde} />;
    } else if (escena.id === "final") {
      contenido = <Final cuadros={escena.cuadros} voz={vozDe(escena.id)} desde={escena.desde} />;
    } else if (TANDAS[escena.id] && escena.texto) {
      tanda = TANDAS[escena.id]!.rotulo;
      contenido = <Tanda texto={escena.texto} cuadros={escena.cuadros} foto={TANDAS[escena.id]!.foto} numero={TANDAS[escena.id]!.numero} />;
    } else {
      contenido = <AbsoluteFill style={{ backgroundColor: tema.fondo }} />;
    }
    return (
      <Sequence key={escena.id} name={escena.id} from={escena.desde} durationInFrames={escena.cuadros}>
        {contenido}
      </Sequence>
    );
  });

  const vocesDeCapturas = linea.audio.filter((a) => a.tipo === "voz" && a.escena && capturas.has(a.escena));
  return (
    <AbsoluteFill style={{ backgroundColor: tema.fondo }}>
      {escenas}
      <Subtitulos pistas={vocesDeCapturas} y={1712} />
      <Pistas linea={linea} />
    </AbsoluteFill>
  );
};
