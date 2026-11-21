// Subtítulos de la voz debajo del teléfono, frase por frase y con la palabra que suena en dorado (el video se mira
// mucho sin sonido en el celular). El texto visible es el del guion; los tiempos, los de cada palabra de la voz.
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fuentes } from "../fuentes";
import type { PistaAudio } from "../linea";
import { tema } from "../tema";

const MAX_LINEA = 30;
const limitar = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");

type Palabra = { texto: string; desde: number };
type Pagina = { lineas: Palabra[][]; desde: number };

/** Le da a cada palabra visible el cuadro (absoluto) en que la dice la voz. */
function alinear(pista: PistaAudio, fps: number): Palabra[] {
  const habladas = pista.palabras ?? [];
  const visibles = (pista.texto ?? "").split(/\s+/).filter(Boolean);
  const salida: Palabra[] = [];
  let p = 0;
  let ultimo = 0;
  for (const texto of visibles) {
    const buscada = normalizar(texto);
    let inicio: number | undefined;
    if (buscada && p < habladas.length) {
      let acumulado = "";
      const desdeP = p;
      while (p < habladas.length && acumulado.length < buscada.length) {
        acumulado += normalizar(habladas[p]![2]);
        p += 1;
      }
      if (acumulado.startsWith(buscada) || buscada.startsWith(acumulado)) inicio = habladas[desdeP]![0];
      else p = desdeP; // no coincide: la palabra toma el tiempo de la anterior
    }
    ultimo = inicio ?? ultimo;
    salida.push({ texto, desde: pista.desdeCuadro + Math.round(ultimo * fps) });
  }
  return salida;
}

/** Arma páginas de hasta dos líneas; una frase que termina (. ? : …) cierra la página. */
function paginar(palabras: Palabra[]): Pagina[] {
  const paginas: Pagina[] = [];
  let lineas: Palabra[][] = [[]];
  const cerrar = () => {
    const llenas = lineas.filter((l) => l.length);
    if (llenas.length) paginas.push({ lineas: llenas, desde: llenas[0]![0]!.desde });
    lineas = [[]];
  };
  for (const palabra of palabras) {
    let actual = lineas.at(-1)!;
    const largo = actual.map((w) => w.texto).join(" ").length;
    if (actual.length && largo + 1 + palabra.texto.length > MAX_LINEA) {
      if (lineas.length === 2) cerrar();
      else lineas.push([]);
      actual = lineas.at(-1)!;
    }
    actual.push(palabra);
    if (/[.?!:…]$/.test(palabra.texto)) cerrar();
  }
  cerrar();
  return paginas;
}

export const Subtitulos: React.FC<{ pistas: PistaAudio[]; y: number }> = ({ pistas, y }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pista = pistas.find((a) => f >= a.desdeCuadro - 4 && f < a.desdeCuadro + a.cuadros + 10);
  if (!pista) return null;
  const paginas = paginar(alinear(pista, fps));
  const fin = pista.desdeCuadro + pista.cuadros + 10;
  const i = paginas.findLastIndex((p) => p.desde <= f);
  const pagina = paginas[Math.max(0, i)];
  if (!pagina) return null;
  const hasta = paginas[i + 1]?.desde ?? fin;
  const opacidad = Math.min(interpolate(f, [pagina.desde - 4, pagina.desde + 2], [0, 1], limitar), interpolate(f, [hasta - 4, hasta], [1, 0], limitar));
  const palabraActual = pagina.lineas.flat().findLast((w) => w.desde <= f);

  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: y, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: opacidad }}>
      {pagina.lineas.map((linea, n) => (
        <div key={n} style={{ fontFamily: fuentes.texto, fontWeight: 500, fontSize: 44, lineHeight: 1.25, textAlign: "center", whiteSpace: "nowrap" }}>
          {linea.map((w, k) => {
            const dicha = w.desde <= f;
            const color = w === palabraActual ? tema.oroClaro : dicha ? tema.tinta : "rgba(191, 174, 148, 0.55)";
            return (
              <span key={k} style={{ color }}>
                {k > 0 ? " " : ""}
                {w.texto}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
