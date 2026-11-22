// Composición completa (horizontal 1920 × 1080): cada escena de la línea en su Sequence según su tipo, los subtítulos de la
// voz en las capturas y las pistas de audio.
import { AbsoluteFill, Sequence } from "remotion";
import { Apertura } from "./escenas/Apertura";
import { Captura } from "./escenas/Captura";
import { Cierre } from "./escenas/Cierre";
import { Titulo, type TextosTitulo } from "./escenas/Titulo";
import type { EscenaLinea, Linea } from "./linea";
import { Pistas } from "./piezas/Pistas";
import { Subtitulos } from "./piezas/Subtitulos";
import { tema, VENTANA } from "./tema";

export type PropsDemo = { linea: Linea };

const TITULOS: Record<string, TextosTitulo> = {
  portada: { kicker: "ISO 9001 · 14001 · 45001 · 39001", titulo: "SGI Base", subtitulo: "Tu sistema de gestión ISO, listo para trabajar con las grandes empresas.", palabraSubtitulo: "sistema" },
  problema: { kicker: "El desafío", titulo: "Hacerlo bien no alcanza: hay que demostrarlo" },
  camino: { kicker: "El camino", titulo: "SGI Base ordena, ejecuta y deja la evidencia" },
  final: { kicker: "SGI Base", titulo: "Demostralo con evidencia", subtitulo: "Calificá para trabajar con las grandes empresas.", palabraSubtitulo: "calificá" },
};
const TANDAS: Record<string, string> = { tanda1: "Parte 1 de 3", tanda2: "Parte 2 de 3", tanda3: "Parte 3 de 3" };

export const Demo: React.FC<PropsDemo> = ({ linea }) => {
  const vozDe = (id: string) => linea.audio.find((a) => a.tipo === "voz" && a.escena === id);
  const capturas = new Set(linea.escenas.filter((e) => e.tipo === "captura").map((e) => e.id));

  const escenas = linea.escenas.map((escena: EscenaLinea) => {
    let contenido: React.ReactNode;
    if (escena.tipo === "captura") {
      contenido = <Captura escena={escena} />;
    } else if (escena.id === "apertura") {
      contenido = <Apertura cuadros={escena.cuadros} voz={vozDe(escena.id)} desde={escena.desde} />;
    } else if (escena.id === "cierre") {
      contenido = <Cierre contacto={escena.contacto ?? "www.dev-cen.com"} cuadros={escena.cuadros} voz={vozDe(escena.id)} desde={escena.desde} />;
    } else if (TANDAS[escena.id]) {
      contenido = <Titulo kicker={TANDAS[escena.id]} titulo={(escena.textoVoz ?? "").replace(/\.$/, "")} cuadros={escena.cuadros} desde={escena.desde} voz={vozDe(escena.id)} />;
    } else if (TITULOS[escena.id]) {
      contenido = <Titulo {...TITULOS[escena.id]!} chips={escena.chips} llamado={escena.llamado} cuadros={escena.cuadros} desde={escena.desde} voz={vozDe(escena.id)} />;
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
      <Subtitulos pistas={vocesDeCapturas} y={VENTANA.y + VENTANA.h - 118} />
      <Pistas linea={linea} />
    </AbsoluteFill>
  );
};
