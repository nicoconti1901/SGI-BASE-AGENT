import { Composition } from "remotion";
import { Demo, type PropsDemo } from "./Demo";
import { ALTO, ANCHO } from "./tema";

const VACIA: PropsDemo = {
  linea: { fps: 30, duracionCuadros: 195, escenas: [{ id: "apertura", tipo: "titulo", desde: 0, cuadros: 195, camara: [], destacados: [], cursor: [] }], audio: [], silenciarMusica: [] },
};

export const Root: React.FC = () => (
  <Composition
    id="Demo"
    component={Demo}
    width={ANCHO}
    height={ALTO}
    fps={30}
    durationInFrames={VACIA.linea.duracionCuadros}
    defaultProps={VACIA}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.linea.duracionCuadros), fps: props.linea.fps })}
  />
);
