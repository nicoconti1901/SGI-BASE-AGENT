// Línea de tiempo de la demo: traduce guion, voces y marcas de grabación a cuadros de salida. Es pura: Remotion solo la dibuja.

export type Caja = { x: number; y: number; w: number; h: number };
export type Tono = "acento" | "alerta";

/** `mantener`: sigue visible cuando aparece el siguiente destacado, hasta un `soltar` o el fin de la escena. */
export type DestacadoGuion = { id: string; texto: string; icono?: string; tono: Tono; zoom?: number; mantener?: boolean };
export type EscenaGuion = {
  id: string;
  tipo: "titulo" | "captura";
  pantalla?: string;
  /** Nombre de la pantalla, arriba a la izquierda de la ventana. */
  rotulo?: string;
  /** Cláusulas de las normas que cubre la pantalla (chip a la derecha del rótulo). */
  norma?: string;
  /** Ideas de una escena de título: cada una entra con su palabra (`en`) en la voz. */
  chips?: { texto: string; en: string }[];
  llamado?: string;
  voz?: string;
  /** Segundos de la escena en que arranca la voz de un título (por defecto 0,3). */
  vozDesde?: number;
  segundos?: number;
  /** Segundos extra después de la frase, para leer la pantalla. */
  respiro?: number;
  texto?: string[];
  contacto?: string;
  destacados?: DestacadoGuion[];
};
export type Guion = { voz: { nombre: string; rate: string; pitch: string }; fps: number; escenas: EscenaGuion[] };
export type Voz = { archivo: string; segundos: number; texto?: string; palabras: [number, number, string][] };
export type EventoMarca = {
  escena: string;
  captura?: string;
  tipo: "inicio" | "lista" | "voz" | "fin" | "velocidad" | "destacar" | "soltar" | "cursor" | "evento";
  t: number;
  valor?: number | "ajustar";
  id?: string;
  caja?: Caja;
  x?: number;
  y?: number;
  accion?: string;
  nombre?: string;
};
export type CapturaMarcas = { archivo: string; primerCuadro: number; ancho: number; alto: number };
export type Marcas = { capturas: Record<string, CapturaMarcas>; eventos: EventoMarca[] };
export type EntradaLinea = { guion: Guion; voces: Record<string, Voz>; marcas: Marcas; solo?: string[] };

/** Dentro de una escena, todos los cuadros son relativos a su inicio. */
export type Tramo = { desdeCuadro: number; cuadros: number; origenSeg: number; velocidad: number };
export type ClaveCamara = { cuadro: number; escala: number; cx: number; cy: number };
export type DestacadoLinea = { id: string; texto: string; icono?: string; tono: Tono; desdeCuadro: number; hastaCuadro: number; caja?: Caja };
export type PuntoCursor = { cuadro: number; x: number; y: number; accion: string };
export type EscenaLinea = {
  id: string;
  tipo: "titulo" | "captura";
  desde: number;
  cuadros: number;
  captura?: { archivo: string; pantalla: string; ancho: number; alto: number; tramos: Tramo[] };
  etiqueta?: string;
  camara: ClaveCamara[];
  destacados: DestacadoLinea[];
  cursor: PuntoCursor[];
  rotulo?: { texto: string; desdeCuadro: number; cuadros: number };
  texto?: string[];
  contacto?: string;
  norma?: string;
  chips?: { texto: string; en: string }[];
  llamado?: string;
  textoVoz?: string;
};
/** En las pistas de audio y en silenciarMusica los cuadros son absolutos. */
export type PistaAudio = {
  tipo: "voz" | "curso";
  archivo: string;
  desdeCuadro: number;
  cuadros: number;
  origenSeg: number;
  /** De la voz: escena, texto visible y tiempos de cada palabra (para los subtítulos). */
  escena?: string;
  texto?: string;
  palabras?: [number, number, string][];
};
export type Linea = {
  fps: number;
  duracionCuadros: number;
  escenas: EscenaLinea[];
  audio: PistaAudio[];
  silenciarMusica: { desde: number; hasta: number }[];
};

const PAUSA_VOZ = 0.4; // lo que se graba después de que termina la frase
const TOLERANCIA = 0.1;
const AJUSTE_MAXIMO = 20;
const AJUSTE_MINIMO = 12;
const MARGEN_MUSICA = 6;
const CUADROS_VUELTA_CAMARA = 15;
const ENCUADRE = 0.9; // fracción de la vista que puede ocupar una caja con zoom
const ARCHIVO_CURSO = "curso.mp4";

type Segmento = { inicio: number; fin: number; valor: number | "ajustar" };

function exigir(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(mensaje);
}

/** Tramos de origen [inicio, fin) con su velocidad, desde `lista` hasta `fin`. */
function segmentosDe(id: string, eventos: EventoMarca[]): { segmentos: Segmento[]; lista: number; fin: number } {
  const lista = eventos.find((e) => e.tipo === "lista")?.t;
  const fin = eventos.find((e) => e.tipo === "fin")?.t;
  exigir(lista !== undefined, `La escena ${id} no tiene la marca "lista": volvé a grabarla con node demo.mjs grabar --solo ${id}`);
  exigir(fin !== undefined && fin > lista, `La escena ${id} no tiene una marca "fin" válida: volvé a grabarla con node demo.mjs grabar --solo ${id}`);
  const cortes = eventos.filter((e) => e.tipo === "velocidad");
  const segmentos: Segmento[] = [];
  let inicio = lista;
  let valor: number | "ajustar" = 1;
  for (const corte of cortes) {
    const t = Math.min(Math.max(corte.t, lista), fin);
    if (t > inicio) segmentos.push({ inicio, fin: t, valor });
    inicio = Math.max(inicio, t);
    valor = corte.valor ?? 1;
  }
  if (fin > inicio) segmentos.push({ inicio, fin, valor });
  return { segmentos, lista, fin };
}

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(Math.max(valor, minimo), maximo);
}

function armarCaptura(escena: EscenaGuion, desde: number, entrada: EntradaLinea, audio: PistaAudio[]): EscenaLinea {
  const { guion, voces, marcas } = entrada;
  const fps = guion.fps;
  const eventos = marcas.eventos.filter((e) => e.escena === escena.id).sort((a, b) => a.t - b.t);
  const pantalla = eventos.find((e) => e.captura)?.captura ?? "ventana";
  const captura = marcas.capturas[pantalla];
  exigir(captura && eventos.length > 0, `No hay marcas de la escena ${escena.id}: grabala con node demo.mjs grabar`);
  const voz = voces[escena.id];
  exigir(voz, `No hay voz para la escena ${escena.id}: corré node demo.mjs voz`);
  const marcaVoz = eventos.find((e) => e.tipo === "voz")?.t;
  exigir(marcaVoz !== undefined, `La escena ${escena.id} no marcó el inicio de la voz: volvé a grabarla`);

  const { segmentos, fin } = segmentosDe(escena.id, eventos);
  if (fin - marcaVoz < voz.segundos + PAUSA_VOZ - TOLERANCIA) {
    throw new Error(`La captura corta la voz de la escena ${escena.id}: la frase dura ${voz.segundos} s y lo grabado después de empezar dura ${(fin - marcaVoz).toFixed(2)} s`);
  }

  const finVoz = marcaVoz + voz.segundos;
  const videoFin = eventos.find((e) => e.tipo === "evento" && e.nombre === "videoFin")?.t;
  const tramos: Tramo[] = [];
  let rotulo: EscenaLinea["rotulo"];
  let cuadro = 0;
  for (const s of segmentos) {
    let velocidad: number;
    if (s.valor === "ajustar") {
      exigir(videoFin !== undefined, `La escena ${escena.id} acelera sin la marca videoFin`);
      const restante = videoFin - s.inicio;
      velocidad = Math.min(AJUSTE_MAXIMO, restante / (voz.segundos + 1));
      if (velocidad < AJUSTE_MINIMO) {
        throw new Error(`La frase de la escena ${escena.id} es larga para el tramo acelerado: quedaría a x${velocidad.toFixed(1)} (mínimo x${AJUSTE_MINIMO}). Acortala en guion.json.`);
      }
    } else {
      velocidad = s.valor;
      const pisaLaVoz = s.inicio < finVoz && s.fin > marcaVoz;
      if (velocidad !== 1 && pisaLaVoz) {
        throw new Error(`La escena ${escena.id} cambia la velocidad (x${velocidad}) mientras habla la voz: acelerá solo antes o después de la frase`);
      }
    }
    const cuadros = Math.round(((s.fin - s.inicio) / velocidad) * fps);
    if (cuadros === 0) continue; // dos marcas casi juntas: no llega a un cuadro
    const tramo = { desdeCuadro: cuadro, cuadros, origenSeg: s.inicio - captura.primerCuadro, velocidad };
    if (s.valor === "ajustar") rotulo = { texto: `⏩ x${Math.round(velocidad)} · acelerado para la demo`, desdeCuadro: cuadro, cuadros };
    tramos.push(tramo);
    cuadro += cuadros;
  }
  const total = cuadro;

  /** Cuadro de salida (relativo a la escena) de un instante de la grabación. */
  const mapear = (t: number) => {
    for (const tramo of tramos) {
      const inicio = tramo.origenSeg + captura.primerCuadro;
      const finTramo = inicio + (tramo.cuadros / fps) * tramo.velocidad;
      if (t <= finTramo + 1e-9) return tramo.desdeCuadro + Math.round((Math.max(t, inicio) - inicio) / tramo.velocidad * fps);
    }
    return total;
  };

  audio.push({ tipo: "voz", archivo: voz.archivo, desdeCuadro: desde + mapear(marcaVoz), cuadros: Math.round(voz.segundos * fps), origenSeg: 0, escena: escena.id, texto: voz.texto, palabras: voz.palabras });
  const videoInicio = eventos.find((e) => e.tipo === "evento" && e.nombre === "videoInicio")?.t;
  const ajuste = eventos.find((e) => e.tipo === "velocidad" && e.valor === "ajustar")?.t;
  if (videoInicio !== undefined && ajuste !== undefined) {
    const desdeCurso = mapear(videoInicio);
    audio.push({ tipo: "curso", archivo: ARCHIVO_CURSO, desdeCuadro: desde + desdeCurso, cuadros: mapear(ajuste) - desdeCurso, origenSeg: 0 });
  }

  const centro = { cx: captura.ancho / 2, cy: captura.alto / 2 };
  const camara: ClaveCamara[] = [{ cuadro: 0, escala: 1, ...centro }];
  const destacadosGuion = escena.destacados ?? [];
  const marcasDestacado = eventos.filter((e) => e.tipo === "destacar");
  // `soltar` cierra el destacado activo (antes de un scroll, para que el contorno no quede corrido) y vuelve la cámara.
  const cortes = eventos.filter((e) => e.tipo === "destacar" || e.tipo === "soltar");
  for (const soltar of eventos.filter((e) => e.tipo === "soltar")) camara.push({ cuadro: mapear(soltar.t), escala: 1, ...centro });
  const destacados: DestacadoLinea[] = marcasDestacado.map((marca) => {
    const d = destacadosGuion.find((g) => g.id === marca.id);
    exigir(d, `La escena ${escena.id} destacó "${marca.id}", que no está en guion.json`);
    const desdeCuadro = mapear(marca.t);
    const siguiente = cortes.find((e) => e.t > marca.t && (!d.mantener || e.tipo === "soltar"));
    const hastaCuadro = siguiente ? mapear(siguiente.t) : total;
    // El zoom pedido, salvo que corte la caja: entonces lo justo para que entre con un 10 % de aire (nunca menos de 1).
    const escala = d.zoom && marca.caja ? Math.max(1, Math.min(d.zoom, (ENCUADRE * captura.ancho) / marca.caja.w, (ENCUADRE * captura.alto) / marca.caja.h)) : 1;
    if (escala > 1 && marca.caja) {
      const anchoVista = captura.ancho / escala;
      const altoVista = captura.alto / escala;
      camara.push({
        cuadro: desdeCuadro,
        escala,
        cx: limitar(marca.caja.x + marca.caja.w / 2, anchoVista / 2, captura.ancho - anchoVista / 2),
        cy: limitar(marca.caja.y + marca.caja.h / 2, altoVista / 2, captura.alto - altoVista / 2),
      });
    } else {
      camara.push({ cuadro: desdeCuadro, escala: 1, ...centro });
    }
    return { id: d.id, texto: d.texto, icono: d.icono, tono: d.tono, desdeCuadro, hastaCuadro, caja: marca.caja };
  });
  camara.push({ cuadro: Math.max(0, total - CUADROS_VUELTA_CAMARA), escala: 1, ...centro });
  camara.sort((a, b) => a.cuadro - b.cuadro);

  const cursor: PuntoCursor[] = eventos
    .filter((e) => e.tipo === "cursor")
    .map((e) => ({ cuadro: mapear(e.t), x: e.x ?? 0, y: e.y ?? 0, accion: e.accion ?? "mover" }));

  return {
    id: escena.id,
    tipo: "captura",
    desde,
    cuadros: total,
    captura: { archivo: captura.archivo, pantalla, ancho: captura.ancho, alto: captura.alto, tramos },
    camara,
    destacados,
    cursor,
    rotulo,
    etiqueta: escena.rotulo,
    norma: escena.norma,
  };
}

function armarTitulo(escena: EscenaGuion, desde: number, entrada: EntradaLinea, audio: PistaAudio[]): EscenaLinea {
  const fps = entrada.guion.fps;
  const voz = escena.voz ? entrada.voces[escena.id] : undefined;
  exigir(!escena.voz || voz, `No hay voz para la escena ${escena.id}: corré node demo.mjs voz`);
  const vozDesde = escena.vozDesde ?? 0.3;
  const segundos = Math.max(escena.segundos ?? 0, voz ? vozDesde + voz.segundos + 0.5 + (escena.respiro ?? 0) : 0);
  if (voz) {
    audio.push({
      tipo: "voz", archivo: voz.archivo, desdeCuadro: desde + Math.round(vozDesde * fps), cuadros: Math.round(voz.segundos * fps), origenSeg: 0,
      escena: escena.id, texto: voz.texto, palabras: voz.palabras,
    });
  }
  return {
    id: escena.id,
    tipo: escena.tipo,
    desde,
    cuadros: Math.round(segundos * fps),
    camara: [],
    destacados: [],
    cursor: [],
    texto: escena.texto,
    contacto: escena.contacto,
    chips: escena.chips,
    llamado: escena.llamado,
    textoVoz: voz?.texto,
  };
}

function silencios(audio: PistaAudio[]) {
  const intervalos = audio
    .map((a) => ({ desde: a.desdeCuadro - MARGEN_MUSICA, hasta: a.desdeCuadro + a.cuadros + MARGEN_MUSICA }))
    .sort((a, b) => a.desde - b.desde);
  const unidos: { desde: number; hasta: number }[] = [];
  for (const intervalo of intervalos) {
    const ultimo = unidos.at(-1);
    if (ultimo && intervalo.desde <= ultimo.hasta) ultimo.hasta = Math.max(ultimo.hasta, intervalo.hasta);
    else unidos.push({ ...intervalo });
  }
  return unidos;
}

export function armarLinea(entrada: EntradaLinea): Linea {
  const { guion, solo } = entrada;
  const escenasGuion = solo ? guion.escenas.filter((e) => solo.includes(e.id)) : guion.escenas;
  exigir(escenasGuion.length > 0, "No quedó ninguna escena para armar");
  const audio: PistaAudio[] = [];
  const escenas: EscenaLinea[] = [];
  let desde = 0;
  for (const escena of escenasGuion) {
    const armada = escena.tipo === "captura" ? armarCaptura(escena, desde, entrada, audio) : armarTitulo(escena, desde, entrada, audio);
    escenas.push(armada);
    desde += armada.cuadros;
  }
  return { fps: guion.fps, duracionCuadros: desde, escenas, audio, silenciarMusica: silencios(audio) };
}
