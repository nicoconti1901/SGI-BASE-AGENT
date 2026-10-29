/**
 * Guía breve de seguridad vial (SPEC-road-safety.md § Qué ve el cliente). Las cláusulas de ISO 39001 del
 * catálogo figuran «sin verificar» hasta que el PO las confirme contra la norma licenciada (D1).
 */
export type RoadGuideSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: { term: string; text: string }[];
};

export const ROAD_GUIDE_SECTIONS: RoadGuideSection[] = [
  {
    id: "para-que",
    title: "Para qué sirve",
    paragraphs: [
      "Un hecho de tránsito se registra una sola vez, como un incidente con su detalle vial: qué vehículo, quién manejaba, cómo ocurrió y cuántas personas resultaron lesionadas. Las investigaciones, las medidas y su eficacia son las mismas que las de cualquier incidente.",
      "Con los kilómetros de cada vehículo, el tablero calcula cuántos hechos hubo por cada millón de km recorridos y muestra qué factores mirar primero: el resultado final, la exposición y las medidas intermedias.",
    ],
  },
  {
    id: "que-se-cuenta",
    title: "Qué se cuenta",
    items: [
      { term: "Entra en las tasas", text: "Todo hecho de la flota en misión, con un vehículo de la empresa o de un contratista cargado, que no sea un casi accidente. Cuenta con o sin lesionados, con solo daño material o con muertes." },
      { term: "Sin daño", text: "Un casi accidente vial se muestra aparte: no entra en las tasas." },
      { term: "Fuera del control de la empresa", text: "Los hechos in itinere y los de vehículos particulares o sin vehículo se cuentan como hechos, pero no entran en las tasas por km." },
      { term: "Sin vehículo cargado", text: "Un hecho en misión sin vehículo cuenta como hecho, pero no en las tasas." },
      { term: "Muertes y lesionados graves", text: "Se muestran como cantidad, no como tasa. Un lesionado grave es una persona que requirió internación." },
      { term: "Con la accidentabilidad", text: "Un hecho con solo daño material no entra en los índices laborales. Uno con lesión en jornada aparece en los dos tableros. Uno in itinere, solo en el vial." },
    ],
  },
  {
    id: "km",
    title: "De dónde salen los km y por qué pueden estar «sin dato»",
    paragraphs: [
      "Los km de un mes son la lectura de odómetro de cierre menos la del mes anterior, tomadas de las inspecciones. Si entre dos lecturas pasaron meses sin lectura, los km se reparten en proporción a los días de cada mes.",
      "Un mes queda «sin dato» cuando no hay lectura utilizable, cuando el odómetro bajó sin un reinicio marcado, o cuando el vehículo tiene 0 km y a la vez hechos cargados. Ese vehículo y mes salen del cálculo completo —hechos y km—, y la tasa se muestra como «parcial» con el detalle de qué falta.",
      "Quien gestiona la seguridad vial puede confirmar los km calculados o cargarlos a mano con el motivo. Si el odómetro se reinició o se cambió el tablero, se marca el reinicio para que no se calcule una resta imposible.",
      "Sin km no hay tasa: el tablero dice «sin datos», nunca 0. Bajo 100.000 km en el período avisa «poca exposición»: conviene mirar el número absoluto.",
    ],
  },
  {
    id: "habilitados",
    title: "Conductores habilitados",
    paragraphs: [
      "Un conductor es una persona que el administrador o el responsable de proceso marca como tal en la pestaña Conductores. Está habilitado cuando tiene la licencia vigente y el curso de manejo defensivo vigente. La fecha de vencimiento de la licencia la carga la empresa; el sistema no la valida contra ninguna jurisdicción. El curso sale de la tarea de conducción que la empresa elige en los ajustes, con sus cursos obligatorios en Capacitaciones; si no se eligió ninguna tarea, o la tarea no exige ningún curso, nadie queda habilitado.",
    ],
  },
  {
    id: "datos-personales",
    title: "Datos personales",
    paragraphs: [
      "Los nombres de los conductores solo los ven el administrador y el responsable de proceso. El resto ve totales. La lista «para revisar» marca a quienes tuvieron varios hechos en el período: es para conversar y revisar, sin puntaje. El número no se usa para sancionar.",
      "Consultar al conductor de un hecho, la lista para revisar y la descarga de casos con nombre dejan un registro de quién lo hizo.",
    ],
  },
  {
    id: "norma",
    title: "Qué cláusulas cubre",
    paragraphs: [
      "El módulo ayuda con la operación, la evaluación del desempeño y la mejora de ISO 39001. Las cláusulas de esa norma en el catálogo figuran «sin verificar»: se cargaron a partir de fuentes secundarias y se confirman contra el texto oficial antes de usarlas como referencia de una auditoría.",
    ],
  },
];

export const ROAD_GUIDE_REFERENCES: string[] = [
  "ISO 39001: sistemas de gestión de la seguridad vial (índice de cláusulas sin verificar).",
  "Ley 24.449 de Tránsito y Seguridad Vial (licencias, art. 11 y 20; denuncia del siniestro, art. 65).",
  "Ley 25.326 de Protección de Datos Personales.",
];
