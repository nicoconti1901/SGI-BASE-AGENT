/** Guía de Capacitaciones: qué hace el módulo, cómo se calcula cada estado y qué se avisa. */
export type TrainingGuideSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: { term: string; text: string }[];
};

export const TRAINING_GUIDE_SECTIONS: TrainingGuideSection[] = [
  {
    id: "para-que-sirve",
    title: "Para qué sirve",
    paragraphs: [
      "Responde tres preguntas que pide la auditoría: qué necesita saber cada persona, qué tiene vigente o vencido, y si lo que se enseñó funcionó.",
      "Vos mantenés dos cosas: los requisitos (qué curso se le exige a cada puesto, tarea o a todo el personal) y los registros (lo que se hizo). El estado de cada persona se calcula solo; nunca se marca a mano.",
    ],
  },
  {
    id: "estados",
    title: "Qué significa cada estado",
    items: [
      { term: "Vigente", text: "tiene el curso aprobado y no vence pronto." },
      { term: "Por vencer", text: "vence dentro del plazo de aviso del curso (30 días si no se cambió)." },
      { term: "Vencida", text: "el curso venció y no se renovó." },
      { term: "Falta", text: "se le exige el curso y nunca lo hizo, o lo hizo y no aprobó, y el plazo ya pasó." },
      { term: "En plazo", text: "todavía está dentro de los días de gracia desde que ingresó, cambió de puesto o se creó el requisito." },
      { term: "No se exige", text: "tiene registros de un curso que su puesto o sus tareas actuales no piden. Se conservan en su historial." },
    ],
  },
  {
    id: "avisos",
    title: "Qué se avisa y a quién",
    paragraphs: [
      "Cada persona tiene un solo aviso, no uno por curso. Vence el primer día en que deja de cumplir algo obligatorio, y su título resume lo que pesa sobre ella: por ejemplo «Juan Pérez: 1 vencida, 2 por vencer».",
      "El aviso se actualiza solo cuando registrás una sesión, cargás un certificado o anulás un registro, y se cierra cuando la persona queda al día. Cada noche se vuelve a controlar toda la empresa, por si cambió el puesto o las tareas de alguien.",
      "Los avisos llegan al responsable de capacitaciones (se elige en Requisitos). Si no hay responsable, los reciben los administradores, agrupados por sede.",
      "Al importar el histórico o crear requisitos en lote no se manda nada por lo que ya estaba vencido: solo avisan los cambios posteriores.",
    ],
  },
  {
    id: "eficacia",
    title: "Eficacia de la capacitación",
    paragraphs: [
      "Solo los cursos marcados con «Requiere evaluar eficacia» la piden. Pasado el plazo del curso (90 días si no se cambió), el evaluador designado la ve en la pestaña Eficacia.",
      "Se evalúa por sesión: un resultado general y excepciones por persona. Hay que indicar cómo se evaluó y, si no fue plenamente eficaz, qué se observó.",
    ],
    items: [
      { term: "Eficaz", text: "se aplica lo aprendido; no hay nada más que hacer." },
      { term: "Parcialmente eficaz", text: "se aplica en parte; queda registrado lo que faltó." },
      { term: "No eficaz", text: "hay que crear una acción de refuerzo (con responsable y plazo) o reprogramar la evaluación." },
    ],
  },
  {
    id: "plan-anual",
    title: "Plan anual",
    paragraphs: [
      "En la pestaña Plan anual cargás las capacitaciones previstas del año, por sede y nivel. Cuando una se dicta, la registrás desde el plan y queda contada como realizada; lo que se dicta sin haber sido planificado se cuenta aparte, como «fuera del plan».",
      "Podés exportar el plan para imprimirlo y firmarlo; el plan firmado se sube a Documentos como evidencia.",
    ],
  },
  {
    id: "habilitacion",
    title: "Quién está habilitado para una tarea crítica",
    paragraphs: [
      "Una persona está habilitada para una tarea cuando tiene vigentes todos los cursos obligatorios de esa tarea. Si falta uno, está vencido, todavía está «en plazo» o la capacitación no fue eficaz, no está habilitada.",
      "Si un curso está por vencer, sigue habilitada y se informa cuántos días le quedan. Si la tarea no tiene cursos obligatorios, se muestra «Tarea sin requisitos» para que revises la matriz.",
      "En los selectores de personas de otros módulos aparece la insignia «Habilitado» o «No habilitado». Es informativa: no impide elegir a nadie.",
    ],
  },
  {
    id: "limites",
    title: "Lo que el módulo no hace",
    items: [
      { term: "Datos de salud", text: "no guarda aptitud médica ni exámenes médicos." },
      { term: "Cursos en línea", text: "no reproduce contenido ni toma exámenes: registra el resultado que vos cargás." },
      { term: "Vigencias legales", text: "las vigencias sugeridas no son asesoramiento legal; validalas con tu profesional de Higiene y Seguridad." },
    ],
  },
];

export const TRAINING_GUIDE_REFERENCES = [
  "ISO 9001:2015 · §7.2 Competencia y §7.3 Toma de conciencia",
  "ISO 14001:2015 · §7.2 y §7.3",
  "ISO 45001:2018 · §7.2, §7.3 y §5.4 (consulta y participación)",
  "Decreto 351/79, arts. 210 y 211 (capacitación y plan anual)",
  "Res. SRT 905/15",
];
