/**
 * Guía breve de equipos de medición. Base: ISO 9001 §7.1.5 (7.1.5.1 y 7.1.5.2), ISO 14001 §9.1.1 e ISO 45001 §9.1.1.
 * Ver RESEARCH-calibration.md y SPEC-calibration.md.
 */
export type CalibrationGuideSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: { term: string; text: string }[];
};

export const CALIBRATION_GUIDE_SECTIONS: CalibrationGuideSection[] = [
  {
    id: "para-que",
    title: "Para qué sirve",
    paragraphs: [
      "Cuando una decisión depende de una medición (un detector de gases que autoriza entrar a un espacio confinado, un manómetro, un luxímetro), la norma pide poder demostrar que el equipo medía bien. Este módulo responde dos preguntas: qué equipos puedo usar hoy, y qué evidencia tengo de que midieron bien.",
      "La norma exige trazabilidad de las mediciones y reaccionar cuando un equipo resulta no apto. No exige un laboratorio acreditado ni un intervalo fijo: eso lo define cada empresa según el uso.",
    ],
  },
  {
    id: "estados",
    title: "Qué significa cada estado",
    items: [
      { term: "Vigente", text: "Tiene una calibración apta que todavía no venció. Se puede usar." },
      { term: "Por vencer", text: "Sigue vigente, pero faltan pocos días (el aviso previo lo define cada equipo). Conviene programar el envío al laboratorio." },
      { term: "No usar", text: "Vencido, no apto o sin calibración inicial. El equipo aparece deshabilitado en los demás módulos, con el motivo." },
      { term: "En calibración", text: "Está en el laboratorio. No se usa hasta que vuelva y se cargue su nueva calibración." },
      { term: "Evaluación pendiente", text: "Estuvo fuera de tolerancia: hay que revisar las mediciones hechas con él antes de volver a usarlo." },
      { term: "Sin control", text: "Equipo indicativo, que no decide nada. Se justifica por escrito por qué no se calibra." },
    ],
  },
  {
    id: "carga",
    title: "Cómo se carga una calibración",
    paragraphs: [
      "Se carga lo que dice el certificado: la fecha del servicio, el laboratorio y, punto por punto, el valor del patrón, lo que midió el equipo y la incertidumbre. El error, el máximo permitido y si pasa o no se calculan solos; nadie escribe el resultado.",
      "Con la regla recomendada, un punto pasa si el error más la incertidumbre no superan el máximo permitido. Si el certificado trae solo «conforme» o «no conforme», se carga la declaración, con la especificación y la regla que usó el laboratorio; en un equipo de uso crítico eso no alcanza.",
      "Si el laboratorio ajustó el equipo, cargá también los valores de antes del ajuste: decidirán si hay que revisar mediciones pasadas. El de después decide si el equipo vuelve a servir.",
      "El certificado (PDF o foto) es obligatorio para cerrar. Si todavía no llegó, guardá el borrador. Un registro cerrado no se edita: se anula con un motivo y se carga de nuevo.",
    ],
  },
  {
    id: "vigencia",
    title: "Cuándo vence",
    paragraphs: [
      "La vigencia corre desde la fecha del servicio, en meses de calendario. El equipo se puede usar todo el día del vencimiento y está vencido desde el día siguiente.",
      "No hay un intervalo universal. Los valores sugeridos son editables: 12 meses en general y 6 meses en detectores portátiles de gases, que es el tope que indican varios fabricantes.",
    ],
  },
  {
    id: "impacto",
    title: "Cuando un equipo salió fuera de tolerancia",
    paragraphs: [
      "Si al recibirlo del laboratorio el equipo ya estaba fuera de tolerancia, todas las mediciones hechas desde la última calibración apta quedan en duda. La plataforma abre una evaluación de impacto y bloquea el equipo hasta completarla.",
      "En la evaluación se anota qué se midió en ese período, qué se concluyó y por qué. Si hubo mediciones afectadas, se crea un hallazgo en borrador y se pueden asignar acciones de seguimiento (repetir mediciones, avisar al cliente). Un equipo de uso crítico que se ajustó sin medir cómo estaba antes también exige la evaluación.",
    ],
  },
  {
    id: "prueba-funcional",
    title: "Prueba funcional antes de usarlo",
    paragraphs: [
      "Es opcional y usa el módulo de Inspecciones. Es un control rápido (por ejemplo, aplicar gas de prueba a un detector) que se hace antes de salir a campo. No reemplaza ni extiende la calibración.",
      "Si la prueba falla, el equipo queda fuera de servicio y se abre la evaluación de impacto. Para volver a servicio hay que repetir la prueba y que la cierre un responsable de proceso o un administrador.",
    ],
  },
];

export const CALIBRATION_GUIDE_REFERENCES = [
  "ISO 9001 §7.1.5.1 (generalidades) y §7.1.5.2 (trazabilidad de las mediciones)",
  "ISO 14001 §9.1.1 e ISO 45001 §9.1.1 (seguimiento y medición)",
  "ISO/IEC 17025 §7.8.6 (declaraciones de conformidad) y JCGM 106 (reglas de decisión)",
  "Documentos internos del proyecto: RESEARCH-calibration.md y SPEC-calibration.md",
];
