import type { SourceKind } from "@/domain/risks/types";

/**
 * Instructivo de identificación de riesgos y oportunidades.
 * Una sola fuente para la página de guía y las ayudas de los formularios.
 *
 * Base: ISO 9001:2026 §4.1, §4.2, §6.1 (6.1.1 / 6.1.2 / 6.1.3), §9.1.3, §9.3;
 * ISO 31000:2018 (definición de riesgo, proceso de identificación);
 * IEC 31010:2019 (técnicas de apreciación); ISO/IAF APG "Risk-based thinking".
 * Ver RESEARCH-risks-opportunities.md para el ledger de fuentes.
 */

export const GUIDE_DEFINITIONS = {
  risk: {
    title: "Riesgo",
    text: "Algo incierto que, si ocurre, perjudica un resultado del sistema de gestión: la conformidad del producto o servicio, la satisfacción del cliente o el logro de un objetivo.",
    formula: "Debido a [causa], puede ocurrir [evento], lo que provocaría [efecto].",
    example:
      "Debido a que dependemos de un único proveedor de acero, puede ocurrir un corte de abastecimiento, lo que provocaría atrasos en las entregas a clientes.",
  },
  opportunity: {
    title: "Oportunidad",
    text: "Una circunstancia favorable que, si se aprovecha, mejora un resultado: nuevos clientes, procesos más eficientes, nuevas tecnologías o mejor desempeño.",
    formula:
      "Hoy [condición actual]; si aprovechamos [circunstancia favorable], lograríamos [beneficio].",
    example:
      "Hoy la planificación se hace en planillas; si aprovechamos el nuevo ERP, lograríamos reducir a la mitad los errores de carga de pedidos.",
  },
} as const;

/** Preguntas disparadoras por tipo de fuente (ISO 9001 §4.1 / §4.2). */
export const SOURCE_GUIDANCE: Record<
  SourceKind,
  { question: string; example: string }
> = {
  process: {
    question:
      "¿Qué podría fallar en las entradas, actividades o salidas de este proceso? ¿Qué podría hacerse mejor?",
    example: "Proceso de compras, recepción de materia prima",
  },
  supplier: {
    question:
      "¿Qué pasa si este proveedor se atrasa, falla en calidad o deja de operar? ¿Hay alternativas mejores?",
    example: "Proveedor único de acero",
  },
  change: {
    question:
      "¿Qué puede salir mal al implementar este cambio? ¿Qué nuevas posibilidades abre?",
    example: "Migración a nuevo ERP, cambio de layout de planta",
  },
  objective: {
    question: "¿Qué podría impedir cumplir este objetivo? ¿Qué ayudaría a superarlo?",
    example: "Reducir reclamos de clientes un 20 %",
  },
  stakeholder: {
    question:
      "¿Qué espera esta parte interesada y qué pasa si no lo cumplimos? ¿Qué nuevas necesidades podríamos atender?",
    example: "Cliente principal, organismo regulador, personal",
  },
  indicator: {
    question: "¿Qué tendencia muestra este indicador? ¿Anticipa un problema o una mejora posible?",
    example: "Entregas a tiempo cayendo tres meses seguidos",
  },
  finding: {
    question:
      "¿Este hallazgo revela algo que podría repetirse o extenderse a otros procesos?",
    example: "No conformidad en auditoría interna de despacho",
  },
  other: {
    question:
      "¿Qué situación del contexto (mercado, tecnología, normativa, economía) puede afectar los resultados?",
    example: "Nueva regulación de etiquetado",
  },
};

/** Ayudas cortas por campo, usadas en los formularios. */
export const FIELD_HINTS = {
  sourceLabel: "Nombrá la fuente concreta: un proceso, proveedor, cambio o situación.",
  cause: "Por qué podría pasar. Ej.: dependemos de un único proveedor.",
  event: "Qué podría ocurrir. Ej.: corte de abastecimiento.",
  effect: "Qué consecuencia tendría. Ej.: atrasos en entregas a clientes.",
  existingControls:
    "Lo que ya hacen hoy para prevenirlo (no acciones nuevas). Uno por línea.",
  condition: "Cómo es la situación hoy. Ej.: planificación en planillas.",
  circumstance: "Qué circunstancia favorable aparece. Ej.: implementamos un ERP.",
  benefit: "Qué mejora concreta traería. Ej.: menos errores de carga de pedidos.",
} as const;

export type GuideSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: { term: string; text: string }[];
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "por-que",
    title: "Por qué se identifican",
    paragraphs: [
      "ISO 9001 pide que la empresa determine los riesgos y las oportunidades que pueden afectar los resultados de su sistema de gestión, y que actúe sobre ellos en proporción a su impacto. No exige una matriz ni un método en particular: lo importante es poder mostrar qué se identificó, qué se decidió y si lo que se hizo funcionó.",
      "La versión 2026 de la norma separa el tratamiento de riesgos (6.1.2) y de oportunidades (6.1.3). Una oportunidad no es “un riesgo positivo”: se describe y se evalúa distinto.",
    ],
  },
  {
    id: "donde-buscar",
    title: "Dónde buscar",
    paragraphs: [
      "Partí de las fuentes del contexto de la empresa (ISO 9001 §4.1 y §4.2). Cada fuente puede generar un riesgo, una oportunidad, ambos o ninguno.",
    ],
    items: [
      { term: "Contexto interno", text: "Procesos, personal, infraestructura, conocimiento, cultura." },
      { term: "Contexto externo", text: "Mercado, competencia, tecnología, normativa, economía." },
      { term: "Partes interesadas", text: "Clientes, proveedores, reguladores, personal, comunidad." },
      { term: "Desempeño", text: "Indicadores, reclamos, hallazgos de auditoría, no conformidades." },
      { term: "Cambios", text: "Nuevos productos, procesos, sistemas, instalaciones u organización." },
    ],
  },
  {
    id: "tecnicas",
    title: "Técnicas simples",
    paragraphs: [
      "IEC 31010 describe muchas técnicas; para empezar alcanza con estas:",
    ],
    items: [
      { term: "Tormenta de ideas", text: "Con quienes operan el proceso, preguntando “¿qué podría salir mal?” y “¿qué podríamos aprovechar?”." },
      { term: "FODA", text: "Debilidades y amenazas sugieren riesgos; fortalezas y oportunidades sugieren oportunidades." },
      { term: "PESTEL", text: "Recorre factores políticos, económicos, sociales, tecnológicos, ambientales y legales." },
      { term: "Revisión de historial", text: "Reclamos, no conformidades e indicadores de los últimos meses." },
    ],
  },
  {
    id: "errores",
    title: "Errores comunes",
    items: [
      { term: "Describir solo el efecto", text: "“Atrasos en entregas” es un efecto; sin causa no se puede tratar." },
      { term: "Mezclar controles con acciones", text: "Los controles son lo que ya existe; las acciones son lo nuevo que se decide hacer." },
      { term: "Cerrar al completar la acción", text: "Una acción terminada no es una acción eficaz: hay que verificar el resultado." },
      { term: "Cargar todo", text: "Registrá lo que puede afectar de verdad los resultados; la norma pide proporcionalidad." },
    ],
  },
];

/** Las cuatro etapas del workspace, con lo que el usuario tiene que hacer en cada una. */
export const WORKSPACE_STAGES = [
  {
    key: "discovery",
    title: "1 · Identificación",
    what: "Recién registrados o sin describir por completo.",
    next: "Completá causa, evento y efecto (u hoy, circunstancia y beneficio) y cargá una evaluación de nivel.",
    empty: "No hay nada pendiente de identificar.",
  },
  {
    key: "decisions",
    title: "2 · Evaluación y decisión",
    what: "Ya tienen nivel evaluado; falta decidir qué hacer.",
    next: "Elegí la respuesta (mitigar, aceptar, transferir… o perseguir, investigar…), el responsable y la próxima revisión.",
    empty: "No hay decisiones pendientes.",
  },
  {
    key: "execution",
    title: "3 · Tratamiento",
    what: "Con respuesta decidida y acciones en marcha.",
    next: "Cargá las acciones con responsable y fecha, y marcá cada una cuando se complete.",
    empty: "No hay tratamientos en curso.",
  },
  {
    key: "learning",
    title: "4 · Seguimiento",
    what: "Acciones completadas sin verificar y registros con revisión vencida.",
    next: "Verificá si cada acción fue eficaz y reevaluá lo que quedó sin revisar.",
    empty: "Todo está al día.",
  },
] as const;

export const GUIDE_REFERENCES = [
  "ISO 9001:2026 — Sistemas de gestión de la calidad. Requisitos (§4.1, §4.2, §6.1, §9.1.3, §9.3).",
  "ISO 31000:2018 — Gestión del riesgo. Directrices.",
  "IEC 31010:2019 — Gestión del riesgo. Técnicas de evaluación del riesgo.",
  "ISO/IAF Auditing Practices Group — Risk-based thinking (guía de auditoría).",
  "UKAS Technical Bulletin — Transición a ISO 9001:2026.",
];
