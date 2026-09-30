/**
 * Guía breve de objetivos e indicadores. Base: ISO 9001:2026 §6.2 y §9.1,
 * ISO 14001:2015 §6.2 y §9.1, ISO 45001:2018 §6.2 y §9.1. Ver RESEARCH-indicators.md.
 */
export type IndicatorGuideSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: { term: string; text: string }[];
};

export const INDICATOR_GUIDE_SECTIONS: IndicatorGuideSection[] = [
  {
    id: "para-que",
    title: "Para qué sirve",
    paragraphs: [
      "Los objetivos dicen qué quiere lograr la empresa; los indicadores muestran, período a período, si va en camino. Las tres normas piden objetivos medibles, coherentes con la política, con responsable, plazo y un plan para lograrlos.",
      "Lo importante no es el número sino la decisión que habilita: si un indicador se sale de meta, alguien tiene que entender por qué y actuar.",
    ],
  },
  {
    id: "objetivo",
    title: "Cómo formular un objetivo",
    paragraphs: ["Un buen objetivo se puede medir, tiene fecha y un responsable con nombre."],
    items: [
      { term: "Bien", text: "Reducir los reclamos de clientes a menos del 2 % de los pedidos antes de diciembre." },
      { term: "Bien", text: "Cero accidentes con tiempo perdido en la planta 2 durante el año." },
      { term: "A evitar", text: "“Mejorar la calidad” (no dice cuánto ni para cuándo)." },
      { term: "Plan", text: "Anotá qué se va a hacer, con qué recursos y cómo se evalúan los resultados (§6.2.2)." },
    ],
  },
  {
    id: "indicador",
    title: "Cómo definir un indicador",
    items: [
      { term: "Fórmula", text: "Escribí cómo se calcula y de qué registro sale, para que dos personas obtengan el mismo valor." },
      { term: "Unidad", text: "%, casos, horas, días… Siempre la misma en todos los períodos." },
      { term: "Dirección", text: "Mayor es mejor (entregas a tiempo) o menor es mejor (reclamos, accidentes)." },
      { term: "Meta", text: "El valor que se compromete la empresa. Debajo de ella (o encima, si menor es mejor) el indicador sale de meta." },
      { term: "Alerta", text: "Opcional. Un umbral del lado bueno de la meta que avisa antes de incumplirla." },
      { term: "Frecuencia", text: "Que sea la que permite reaccionar: mensual para lo operativo, trimestral o anual para lo estratégico." },
    ],
  },
  {
    id: "proactivo-reactivo",
    title: "Proactivos y reactivos",
    items: [
      { term: "Proactivo", text: "Mide la prevención, antes del resultado: inspecciones hechas, capacitaciones cumplidas." },
      { term: "Reactivo", text: "Mide resultados ya ocurridos: accidentes, reclamos, no conformidades." },
      { term: "Consejo", text: "En seguridad y salud (ISO 45001) conviene tener de los dos: los reactivos llegan tarde." },
    ],
  },
  {
    id: "estados",
    title: "Cómo se lee el estado",
    items: [
      { term: "En meta", text: "El valor cumple la meta y, si hay alerta, también la supera." },
      { term: "Alerta", text: "Cumple la meta pero está cerca del límite: es el momento de actuar." },
      { term: "Fuera de meta", text: "No cumple la meta. Hay que escribir el análisis del desvío." },
      { term: "Sin datos", text: "Todavía no se cargó ningún período." },
      { term: "Del objetivo", text: "Es el peor estado de sus indicadores con datos." },
    ],
  },
  {
    id: "desvios",
    title: "Qué hacer con un desvío",
    paragraphs: [
      "Cuando un valor sale de meta, el análisis explica qué pasó y qué se sabe de la causa. No hace falta que sea definitivo: para llegar a la causa raíz existe el análisis de Hallazgos.",
    ],
    items: [
      { term: "Crear hallazgo", text: "Si el desvío es una no conformidad, se crea un borrador en Hallazgos con el valor y tu análisis." },
      { term: "Explorar riesgo", text: "Si el desvío muestra algo que puede repetirse o agravarse, abrí “Explorar una fuente” en Riesgos con el indicador precargado." },
      { term: "Corregir", text: "Si te equivocaste al cargar, corregí el valor: queda registrado el valor anterior y el motivo." },
    ],
  },
  {
    id: "cargas",
    title: "Cuándo se carga",
    paragraphs: [
      "Cada período se carga una sola vez y vence 10 días después de terminar. El tablero marca las cargas vencidas y el sistema avisa antes del vencimiento.",
    ],
  },
];

export const INDICATOR_GUIDE_REFERENCES = [
  "ISO 9001:2026 — §6.2 (objetivos de la calidad), §9.1 (seguimiento, medición, análisis y evaluación).",
  "ISO 14001:2015 — §6.2 (objetivos ambientales), §9.1 (seguimiento y medición).",
  "ISO 45001:2018 — §6.2 (objetivos de SST), §9.1 (seguimiento, medición y desempeño).",
];
