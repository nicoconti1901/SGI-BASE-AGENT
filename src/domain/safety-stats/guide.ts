/**
 * Guía breve de accidentabilidad. Base: ISO 45001 §9.1.1, §10.2 y §9.3; definiciones de la OIT y de la SRT.
 * Ver RESEARCH-accident-stats.md y SPEC-accident-stats.md.
 */
export type SafetyGuideSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: { term: string; text: string }[];
};

export const SAFETY_GUIDE_SECTIONS: SafetyGuideSection[] = [
  {
    id: "para-que",
    title: "Para qué sirve",
    paragraphs: [
      "Cada accidente se registra una sola vez, como un hallazgo de tipo incidente con su ficha. Con esos casos y las horas que trabajó la gente cada mes, el módulo calcula los índices de siniestralidad. Nadie los escribe a mano.",
      "La norma pide hacer seguimiento del desempeño en seguridad y salud (§9.1.1), reaccionar ante los incidentes e investigar sus causas (§10.2) y que la dirección revise los resultados (§9.3). Este módulo junta las tres cosas.",
    ],
  },
  {
    id: "registro",
    title: "Cómo se registra un accidente",
    paragraphs: [
      "Desde «Registrar accidente» se da de alta el hecho: cuándo y dónde pasó, si hubo lesión y cuánto se perdió, si fue en el trayecto, si fue personal propio o de un contratista, la forma del accidente y el agente. Lo puede hacer cualquiera que pueda cargar hallazgos.",
      "La ficha de salud (a quién le pasó, qué lesión, cuántos días de baja) la completan el administrador y el responsable de proceso. Si la persona sigue de baja, se deja sin fecha de reintegro: el sistema cuenta los días y avisa para actualizarlos.",
      "El accidente cuenta desde que se guarda, aunque el hallazgo siga en borrador. Si se anula el hallazgo, deja de contar. No conviene escribir diagnósticos en la descripción.",
    ],
  },
  {
    id: "clasificacion",
    title: "Cuánto se perdió",
    items: [
      { term: "Casi accidente", text: "No hubo lesión, pero pudo haberla." },
      { term: "Primeros auxilios", text: "Se curó en el lugar, sin tratamiento médico." },
      { term: "Sin baja", text: "Tratamiento médico o tareas restringidas; siguió o volvió a trabajar." },
      { term: "Con baja", text: "La persona no pudo trabajar al día siguiente o más. Entra en frecuencia, gravedad, incidencia y duración." },
      { term: "Fatal", text: "Hubo una muerte. Entra en frecuencia y suma un cargo en la gravedad, pero no en la duración media." },
      { term: "Enfermedad profesional", text: "Enfermedad atribuida al trabajo. Se cuenta aparte." },
    ],
  },
  {
    id: "horas",
    title: "Las horas trabajadas",
    paragraphs: [
      "Los índices necesitan saber cuánto se trabajó. Cada mes se carga, por sede, las horas trabajadas y la dotación promedio del personal propio y de contratistas. Si un mes no hubo contratistas, se marca «Sin personal contratista» y queda en 0.",
      "Se puede cargar a mano o importar un CSV con las columnas sede, mes, empresa, horas y dotacion. El archivo se revisa antes de guardar y una sede que no existe es un error, no se crea. El sistema avisa cuando se acerca el día 10 del mes siguiente.",
      "Las horas no se estiman desde la dotación: si no se cargaron, el índice dice «sin datos». Corregir un mes pasado pide un motivo y deja registro.",
    ],
  },
  {
    id: "indices",
    title: "Cómo leer los índices",
    items: [
      { term: "Frecuencia (IF)", text: "Casos con baja y fatales por cada millón de horas trabajadas." },
      { term: "Gravedad (IG)", text: "Días perdidos por cada mil horas (o por millón, si así se configura en Ajustes). Cada fatal suma un cargo de días, 6.000 por defecto; el tablero muestra también el valor con días reales." },
      { term: "Incidencia (II)", text: "Casos con baja y fatales por cada mil trabajadores de la dotación." },
      { term: "Duración media (ID)", text: "Días de baja por cada caso con baja, sin contar los fatales." },
      { term: "Días", text: "Se cuentan corridos, sin el día del accidente, con tope de 365. Son los días del mes del accidente aunque la baja siga después." },
    ],
    paragraphs: [
      "En un período de varios meses se suman los casos, los días y las horas antes de dividir. Nunca se promedian los índices de cada mes, porque daría un número distinto y engañoso.",
    ],
  },
  {
    id: "sin-datos",
    title: "«Sin datos», «parcial» y «provisorio»",
    items: [
      { term: "Sin datos", text: "Faltan horas. No significa cero: el tablero dice qué mes y qué sede falta y lleva a cargarlo." },
      { term: "Cero", text: "Hay horas y no hubo casos. Es un resultado, no una falta." },
      { term: "Parcial", text: "El período deja afuera los meses sin horas. Se ve cuáles se usaron y cuáles no." },
      { term: "Provisorio", text: "Hay un caso con baja que sigue sin fecha de reintegro: los días de ese mes todavía pueden crecer." },
    ],
  },
  {
    id: "aparte",
    title: "Lo que se cuenta aparte",
    paragraphs: [
      "Los accidentes en el trayecto de ida o vuelta al trabajo (in itinere) y las enfermedades profesionales no entran en ningún índice. Tienen su propia tarjeta en el tablero y su columna en la exportación.",
    ],
  },
  {
    id: "salud",
    title: "Quién ve los datos de salud",
    paragraphs: [
      "Todas las personas de la empresa ven las fichas en solo lectura; editan el administrador y el responsable de proceso. Cada vez que alguien consulta una ficha, o baja el archivo de casos con nombres, queda registrado quién y cuándo. El personal de la plataforma no ve las fichas.",
      "Son datos sensibles (Ley 25.326). Antes de usar el módulo con clientes conviene que un profesional revise la política de acceso y los plazos de conservación. Una empresa que no quiera exponerlos a todos sus usuarios puede desactivar el módulo.",
    ],
  },
  {
    id: "exportar",
    title: "Exportar y presentar",
    items: [
      { term: "CSV por sede y mes", text: "Casos, horas, dotación, estado y los cuatro índices de cada sede y mes del período elegido, con la base en el encabezado. Sin nombres." },
      { term: "Casos con nombres", text: "Un renglón por accidente, con la persona afectada y la lesión. Deja registro de la descarga." },
      { term: "Resumen para imprimir", text: "Una página con los índices, la comparación con el período anterior, la meta, los eventos y el resultado de cada sede, con lugar para las decisiones de la dirección (§9.3)." },
    ],
  },
];

export const SAFETY_GUIDE_REFERENCES: string[] = [
  "ISO 45001:2018, §9.1.1 (seguimiento y medición), §9.3 (revisión por la dirección) y §10.2 (incidentes, no conformidades y acciones correctivas).",
  "OIT, Resolución sobre estadísticas de lesiones ocasionadas por accidentes del trabajo (1998): definiciones y tasas.",
  "Ley 24.557 de Riesgos del Trabajo y Res. SRT 905/2015: registro e investigación de siniestros.",
  "Ley 25.326 de Protección de los Datos Personales: datos sensibles, seguridad y confidencialidad.",
  "Las bases de los índices (por millón o por mil horas) y el cargo por fatal son convenciones internacionales; la SRT no fija las del índice por horas. Las listas de clasificación del módulo no equivalen a la tabla oficial de la SRT.",
];
