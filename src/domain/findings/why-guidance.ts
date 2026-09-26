/**
 * Material de apoyo para quien confecciona el análisis de causa (5 Porqués).
 * Orientado a uso en pantalla: breve, accionable, sin reemplazar la investigación de campo.
 */

export type ProblemStatementExample = {
  label: string;
  text: string;
};

export type WhyLevelGuide = {
  level: number;
  title: string;
  ask: string;
  tip: string;
  goodExample: string;
  badExample: string;
};

export type IndustrialCaseStudy = {
  id: string;
  title: string;
  fact: string;
  branches: { label: string; chain: string[] }[];
  rootCauses: string[];
  lesson: string;
};

/** Checklist previo: los 5 Porqués analizan hechos ya reunidos, no reemplazan la investigación. */
export const INVESTIGATION_CHECKLIST: { id: string; label: string }[] = [
  { id: "task", label: "Tarea que se realizaba" },
  { id: "people", label: "Quiénes estaban presentes" },
  { id: "sequence", label: "Qué ocurrió inmediatamente antes (secuencia)" },
  { id: "equipment", label: "Equipos / instalaciones involucrados" },
  { id: "guards", label: "Estado de protecciones y resguardos" },
  { id: "procedures", label: "Procedimientos y permisos existentes" },
  { id: "training", label: "Capacitación / competencia relacionada" },
  { id: "supervision", label: "Supervisión y organización del trabajo" },
  { id: "maintenance", label: "Mantenimiento y estado de dispositivos críticos" },
  { id: "environment", label: "Condiciones ambientales" },
  { id: "records", label: "Registros, fotos y testimonios" },
  { id: "history", label: "Antecedentes de incidentes similares" },
];

export const SUPPORT_METHOD_STEPS: { step: number; title: string; detail: string }[] =
  [
    {
      step: 1,
      title: "Definir el evento",
      detail: "Un hecho comprobado: qué pasó, cuándo, dónde y con qué evidencia.",
    },
    {
      step: 2,
      title: "Reconstruir qué ocurrió",
      detail: "Testimonios, registros y escena — sin interpretaciones prematuras.",
    },
    {
      step: 3,
      title: "Establecer la secuencia temporal",
      detail: "Orden de hechos previos al evento; evita mezclar causas de distinto momento.",
    },
    {
      step: 4,
      title: "Identificar causas inmediatas",
      detail: "Qué produjo físicamente la lesión o el desvío (puede haber más de una).",
    },
    {
      step: 5,
      title: "Preguntar ¿por qué?",
      detail: "Profundizar cada causa inmediata hacia condiciones del sistema.",
    },
    {
      step: 6,
      title: "Abrir ramas si hace falta",
      detail:
        "Si hay mecanismos causales independientes, cada uno abre su propia línea. No mezclarlos en una sola respuesta.",
    },
    {
      step: 7,
      title: "Continuar cada rama",
      detail: "“5” es una guía: preguntá tantas veces como haga falta hasta una causa controlable.",
    },
    {
      step: 8,
      title: "Identificar causas raíz / subyacentes",
      detail: "Diseño, mantenimiento, procedimientos, capacitación, supervisión, gestión del cambio, etc.",
    },
    {
      step: 9,
      title: "Definir medidas",
      detail: "Acciones que eliminen o reduzcan las condiciones que hicieron posible el evento.",
    },
    {
      step: 10,
      title: "Verificar eficacia",
      detail: "¿Si se corrige esta causa, el hecho no debería repetirse?",
    },
  ];

export const SUPPORT_KEY_IDEAS: string[] = [
  "Los 5 Porqués no buscan culpar a una persona: buscan qué condiciones del sistema permitieron el evento.",
  "Preferí “¿por qué el sistema permitió que…?” frente a “¿por qué el trabajador…?”.",
  "Cada respuesta debe ser comprobable (registro, testimonio, medición, foto). Evitá “estaba distraído” sin evidencia.",
  "Puede haber varias causas raíz. Abrí una rama por cada mecanismo causal independiente.",
  "No forcés exactamente cinco preguntas: puede bastar con 3 o hacer falta 7 u 8.",
  "No termines en “error humano” o “no usó EPP” sin preguntar por qué el sistema permitió esa desviación.",
];

export const BRANCHING_GUIDANCE = {
  title: "¿Varios “porqués” en una misma pregunta?",
  summary:
    "Sí, cuando hay causas independientes. No es “varios porqués dentro de una respuesta”: es abrir ramas paralelas y profundizar cada una por separado.",
  whenToBranch: [
    "Aparecen mecanismos distintos (p. ej. condición peligrosa + exposición + falta de control).",
    "Varias condiciones debieron coexistir (máquina sin resguardo + acceso + energía disponible).",
    "Mezclar todo en una sola cadena confunde niveles (técnica, organizativa, de supervisión).",
  ],
  avoid:
    "Evítá respuestas del tipo “porque A y porque B y porque C” en un solo nivel. Separá A, B y C en ramas.",
};

/** Ejemplos de punto de partida (hechos observables). */
export const PROBLEM_STATEMENT_EXAMPLES: ProblemStatementExample[] = [
  {
    label: "Calidad / producto",
    text: "El 12/09 se rechazaron 3 unidades del lote L-22 en control final por dureza fuera de especificación (medida 62 HRC; límite 55–58).",
  },
  {
    label: "SST / atrapamiento",
    text: "El 08/09 un operario sufrió atrapamiento de la mano al retirar una pieza trabada de la prensa hidráulica PH-04 durante el turno mañana.",
  },
  {
    label: "SST / caída",
    text: "El 10/09 un operario cayó aprox. 4 m desde la plataforma de mantenimiento PM-2 al atravesar una abertura lateral sin baranda.",
  },
  {
    label: "SST / espacio confinado",
    text: "El 05/09 un trabajador perdió el conocimiento dentro del tanque T-7; la atmósfera posterior midió oxígeno deficiente.",
  },
  {
    label: "Documento / registro",
    text: "En la auditoría interna del 10/09 se constató que el certificado de calibración del manómetro M-03 está vencido desde el 01/08 sin evidencia de retiro de uso.",
  },
  {
    label: "Ambiente",
    text: "El 05/09 se registró un derrame de 20 L de aceite usado en el patio de residuos, sin contención secundaria activa en el momento.",
  },
];

/**
 * Orientación por profundidad en la rama.
 * 1 = inmediata · 2–3 = contribuyente · 4+ = sistémica / raíz candidata
 */
export const WHY_LEVEL_GUIDES: WhyLevelGuide[] = [
  {
    level: 1,
    title: "Causa inmediata",
    ask: "¿Qué condición o fallo directo provocó el hecho en esta rama?",
    tip: "Hecho verificable. Todavía no escribas la solución ni culpes a una persona.",
    goodExample:
      "Introdujo la mano en la zona de atrapamiento mientras la prensa podía moverse.",
    badExample: "Porque el operador no prestó atención.",
  },
  {
    level: 2,
    title: "Condición del proceso",
    ask: "¿Por qué existía esa condición o por qué se produjo esa exposición?",
    tip: "Método, material, máquina, instrucción o control que lo permitió.",
    goodExample:
      "Debía retirar manualmente una pieza trabada; el método normal de extracción no estaba disponible.",
    badExample: "Error humano / mala suerte.",
  },
  {
    level: 3,
    title: "Sistema de control",
    ask: "¿Por qué el proceso o el control no detectó o previno esa condición?",
    tip: "Controles faltantes, bloqueos, checklists, permisos, frecuencias de verificación.",
    goodExample:
      "No había condición de parada obligatoria ni bloqueo eficaz ante dispositivo crítico fuera de servicio.",
    badExample: "Hay que capacitar a todo el personal.",
  },
  {
    level: 4,
    title: "Gestión / diseño",
    ask: "¿Por qué el sistema de gestión permitió esa brecha?",
    tip: "Procedimientos, roles, recursos, evaluación de riesgos, gestión del cambio.",
    goodExample:
      "El procedimiento de desbloqueo permitía intervención manual en zona peligrosa; la evaluación de riesgos no contemplaba el atasco.",
    badExample: "Porque siempre se hizo así.",
  },
  {
    level: 5,
    title: "Causa raíz sistémica",
    ask: "¿Qué falla de fondo, si se corrige, evita que el hecho se repita?",
    tip: "Específica, accionable, de proceso o sistema. Candidata a marcar como causa raíz de la rama.",
    goodExample:
      "No existe un sistema eficaz de mantenimiento y control operacional de dispositivos críticos de seguridad.",
    badExample: "Falta de compromiso de la gente.",
  },
];

export function guideForWhyLevel(level: number): WhyLevelGuide {
  if (level <= 1) return WHY_LEVEL_GUIDES[0]!;
  if (level >= 5) return WHY_LEVEL_GUIDES[4]!;
  return WHY_LEVEL_GUIDES[level - 1]!;
}

export const PROBLEM_STATEMENT_RULES = [
  "Describí un hecho concreto y comprobado: qué, cuándo, dónde y con qué evidencia.",
  "No uses el título del hallazgo como punto de partida: el título resume; el hecho detalla.",
  "Evitá interpretaciones (“estaba distraído”) y soluciones (“hay que…”).",
  "Si podés, cuantificá (altura, lote, valor medido, tiempo).",
];

/** Tres casos industriales condensados para orientar al autor (material de apoyo). */
export const INDUSTRIAL_CASE_STUDIES: IndustrialCaseStudy[] = [
  {
    id: "press",
    title: "Atrapamiento en prensa hidráulica",
    fact: "Trabajador sufre atrapamiento de la mano al retirar una pieza trabada de la prensa.",
    branches: [
      {
        label: "A — Intervención manual",
        chain: [
          "Introdujo la mano en zona peligrosa con energía disponible.",
          "Debía retirar la pieza a mano: el dispositivo de extracción estaba fuera de servicio.",
          "Se continuó produciendo sin el dispositivo.",
          "No había parada obligatoria ni control previo de turno sobre ese elemento crítico.",
        ],
      },
      {
        label: "B — Aislamiento de energía",
        chain: [
          "La máquina permanecía energizada durante la intervención.",
          "No se aplicó un bloqueo/aislamiento eficaz para esa tarea.",
          "El sistema de permisos no exigía LOTO documentado en atascos.",
        ],
      },
    ],
    rootCauses: [
      "Deficiencia del control operacional y mantenimiento de dispositivos críticos de seguridad.",
      "Ausencia de barrera administrativa efectiva de aislamiento para intervenciones en atasco.",
    ],
    lesson:
      "No alcanza con “puso la mano”. Hay que explicar por qué el sistema inducía la intervención y por qué la energía seguía disponible.",
  },
  {
    id: "fall",
    title: "Caída desde plataforma (~4 m)",
    fact: "Operario cae al atravesar una abertura lateral de la plataforma de mantenimiento.",
    branches: [
      {
        label: "A — Condición física",
        chain: [
          "Existía una abertura sin protección equivalente.",
          "La baranda se retiró para ingresar materiales.",
          "La tarea no definía un sistema de trabajo con protección retirada.",
          "No había gestión del cambio para configuraciones temporales.",
        ],
      },
      {
        label: "B — Organización / supervisión",
        chain: [
          "Se permitió iniciar la tarea sin verificación previa de trabajo en altura.",
          "El permiso/checklist no contemplaba ese escenario.",
        ],
      },
    ],
    rootCauses: [
      "Falta de control obligatorio de gestión del cambio ante modificaciones temporales de protecciones.",
      "Sistema de permisos incompleto para trabajo en altura con protecciones alteradas.",
    ],
    lesson:
      "Concluir solo “no usó el arnés” es prematuro: hay que explicar por qué existía la exposición.",
  },
  {
    id: "confined",
    title: "Atmósfera peligrosa en espacio confinado",
    fact: "Trabajador pierde el conocimiento en un espacio confinado por atmósfera deficiente en oxígeno.",
    branches: [
      {
        label: "A — Medición atmosférica",
        chain: [
          "Ingresó sin verificación previa de la atmósfera.",
          "No se usó equipo de medición documentado.",
          "El procedimiento no impedía iniciar sin medición.",
          "El sistema de espacios confinados no aseguraba requisitos críticos antes de autorizar.",
        ],
      },
      {
        label: "B — Permiso de trabajo",
        chain: [
          "Se inició sin permiso de ingreso correctamente cumplimentado.",
          "El proceso de autorización no tenía una barrera administrativa efectiva.",
        ],
      },
      {
        label: "C — Capacitación",
        chain: [
          "No reconoció adecuadamente el riesgo del espacio.",
          "El programa de formación no estaba alineado a los riesgos reales de la tarea.",
        ],
      },
    ],
    rootCauses: [
      "Sistema de gestión de espacios confinados sin verificación efectiva de requisitos críticos.",
      "Proceso de autorización sin barrera que impida el ingreso indebido.",
    ],
    lesson:
      "En incidentes complejos es normal un árbol con varias raíces; no forzar una sola cadena lineal.",
  },
];

export const SUGGESTED_BRANCH_LABELS = [
  "A — Condición peligrosa",
  "B — Exposición de la persona",
  "C — Controles / protecciones",
  "D — Organización / supervisión",
  "E — Mantenimiento / energía",
  "F — Capacitación / competencia",
];
