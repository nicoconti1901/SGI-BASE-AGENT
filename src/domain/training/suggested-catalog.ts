/**
 * Catálogo sugerido de cursos (SPEC-training, decisión 11): plantillas en código, no datos del cliente.
 * Nada se activa sin que el cliente lo elija y todas las vigencias son editables.
 *
 * Fuente y nivel de confianza de cada fila: RESEARCH-training.md §7. Las vigencias NO son asesoramiento
 * legal y están pendientes de validar por un profesional de Higiene y Seguridad (§10).
 */
import type { IsoStandardCode } from "@/domain/ims/catalog";
import type { CourseDraft } from "./courses";

export type SuggestedConfidence = "verified" | "topic" | "practice" | "to_validate";

export const SUGGESTED_CONFIDENCE_LABELS: Record<SuggestedConfidence, { label: string; hint: string }> = {
  verified: { label: "En la norma", hint: "La obligación figura en la normativa leída." },
  topic: { label: "Tema en la norma", hint: "El tema está en la norma; la vigencia es una sugerencia." },
  practice: { label: "Práctica habitual", hint: "Criterio de uso común; no hay una obligación legal verificada." },
  to_validate: { label: "A validar", hint: "Confirmalo con un profesional de Higiene y Seguridad antes de exigirlo." },
};

export type SuggestedCourse = {
  key: string;
  course: CourseDraft;
  /** A quién suele exigírsele (solo orienta; la matriz la arma el cliente). */
  usualTarget: string;
  confidence: SuggestedConfidence;
  /** Base normativa en una línea, para mostrar en la lista. */
  source: string;
};

const ALL: IsoStandardCode[] = ["ISO9001", "ISO14001", "ISO45001"];
const SST: IsoStandardCode[] = ["ISO45001"];
const ENV: IsoStandardCode[] = ["ISO14001"];

export const SUGGESTED_COURSES: readonly SuggestedCourse[] = [
  {
    key: "induccion",
    course: { name: "Inducción de seguridad al ingreso", category: "induction", standards: SST, validityMonths: null, requiresEffectiveness: false, legalBasis: "Res. SRT 905/15 Anexo II 13" },
    usualTarget: "Todo el personal, sin plazo de gracia",
    confidence: "verified",
    source: "Res. SRT 905/15, Anexo II ítem 13. No vence; se repite al cambiar de puesto.",
  },
  {
    key: "conciencia",
    course: { name: "Toma de conciencia del sistema de gestión", category: "awareness", standards: ALL, validityMonths: 12 },
    usualTarget: "Todo el personal",
    confidence: "topic",
    source: "ISO 9001, 14001 y 45001 §7.3. Los 12 meses son una sugerencia.",
  },
  {
    key: "epp",
    course: { name: "Uso de elementos de protección personal", category: "safety", standards: SST, validityMonths: 12, legalBasis: "Res. SRT 905/15 Anexo II 9.1" },
    usualTarget: "Por puesto",
    confidence: "topic",
    source: "Res. SRT 905/15, Anexo II 9.1 (tema mínimo anual).",
  },
  {
    key: "evacuacion",
    course: { name: "Plan de evacuación y emergencias", category: "safety", standards: SST, validityMonths: 12, legalBasis: "Res. SRT 905/15 Anexo II 9.2" },
    usualTarget: "Todo el personal",
    confidence: "topic",
    source: "Res. SRT 905/15, Anexo II 9.2.",
  },
  {
    key: "incendio",
    course: { name: "Riesgo de incendio y uso de extintores", category: "safety", standards: SST, validityMonths: 12, legalBasis: "Res. SRT 905/15 Anexo II 9.3" },
    usualTarget: "Todo el personal",
    confidence: "topic",
    source: "Res. SRT 905/15, Anexo II 9.3.",
  },
  {
    key: "electrico",
    course: { name: "Riesgo eléctrico", category: "safety", standards: SST, validityMonths: 12, legalBasis: "Res. SRT 905/15 Anexo II 9.4" },
    usualTarget: "Por puesto o tarea que corresponda",
    confidence: "topic",
    source: "Res. SRT 905/15, Anexo II 9.4.",
  },
  {
    key: "autocontrol",
    course: { name: "Autocontrol preventivo", category: "safety", standards: SST, validityMonths: 12, legalBasis: "Res. SRT 905/15 Anexo II 9.5" },
    usualTarget: "Por puesto",
    confidence: "topic",
    source: "Res. SRT 905/15, Anexo II 9.5.",
  },
  {
    key: "manejo-seguro",
    course: { name: "Manejo seguro y responsable", category: "driving", standards: SST, validityMonths: 12, legalBasis: "Res. SRT 905/15 Anexo II 9.6" },
    usualTarget: "Quien conduce",
    confidence: "topic",
    source: "Res. SRT 905/15, Anexo II 9.6.",
  },
  {
    key: "peligros-tarea",
    course: { name: "Peligros y procedimientos de trabajo seguro de la tarea", category: "safety", standards: SST, validityMonths: 12, legalBasis: "Res. SRT 905/15 Anexo I 15.1.1 y 15.1.3" },
    usualTarget: "Por puesto o tarea; también al cambiar de puesto",
    confidence: "topic",
    source: "Res. SRT 905/15, Anexo I 15.1.1 y 15.1.3.",
  },
  {
    key: "ergonomia",
    course: { name: "Ergonomía", category: "safety", standards: SST, validityMonths: 12, legalBasis: "Res. SRT 905/15 Anexo I 15.1.4" },
    usualTarget: "Por puesto",
    confidence: "topic",
    source: "Res. SRT 905/15, Anexo I 15.1.4.",
  },
  {
    key: "quimicos",
    course: { name: "Sustancias químicas y SGA: etiquetas y hojas de seguridad", category: "safety", standards: [...SST, ...ENV], validityMonths: 12, legalBasis: "Res. SRT 801/15 art. 2" },
    usualTarget: "Puestos con exposición",
    confidence: "topic",
    source: "Res. SRT 801/15, art. 2 (aplicar el SGA en la capacitación).",
  },
  {
    key: "residuos-peligrosos",
    course: { name: "Manejo de residuos peligrosos", category: "environment", standards: ENV, validityMonths: 12, legalBasis: "Dec. 831/93 art. 34 h" },
    usualTarget: "Puestos de plantas generadoras",
    confidence: "topic",
    source: "Dec. 831/93, art. 34 inc. h.",
  },
  {
    key: "altura",
    course: { name: "Trabajo en altura", category: "safety", standards: SST, validityMonths: 12, requiresEffectiveness: true, legalBasis: "Res. SRT 61/23" },
    usualTarget: "Tarea crítica, obligatorio",
    confidence: "to_validate",
    source: "Existe la Res. SRT 61/23; su contenido de capacitación no fue verificado.",
  },
  {
    key: "espacios-confinados",
    course: { name: "Espacios confinados (trabajador, vigía y rescate)", category: "safety", standards: SST, validityMonths: 12, requiresEffectiveness: true, legalBasis: "Res. SRT 953/10" },
    usualTarget: "Tarea crítica, obligatorio",
    confidence: "to_validate",
    source: "Res. SRT 953/10 e IRAM 3625; la periodicidad no fue verificada (rescate: práctica semestral).",
  },
  {
    key: "izaje",
    course: { name: "Izaje de cargas y operación de autoelevador o grúa", category: "safety", standards: SST, validityMonths: 12, requiresEffectiveness: true },
    usualTarget: "Tarea crítica",
    confidence: "to_validate",
    source: "No se encontró una norma nacional; vigencia sugerida de 12 a 24 meses.",
  },
  {
    key: "manejo-defensivo",
    course: { name: "Manejo defensivo", category: "driving", standards: SST, validityMonths: 24, requiresEffectiveness: true },
    usualTarget: "Tarea crítica (conducción)",
    confidence: "to_validate",
    source: "Sin norma nacional general encontrada; vigencia sugerida de 24 meses.",
  },
  {
    key: "primeros-auxilios",
    course: { name: "Primeros auxilios y RCP", category: "safety", standards: SST, validityMonths: 24 },
    usualTarget: "Brigadistas y personal designado",
    confidence: "to_validate",
    source: "Las certificaciones de RCP suelen vencer a los 2 años; la obligación no fue verificada.",
  },
  {
    key: "tension-electrica",
    course: { name: "Trabajos con tensión eléctrica", category: "safety", standards: SST, validityMonths: 12, requiresEffectiveness: true },
    usualTarget: "Tarea crítica",
    confidence: "to_validate",
    source: "Reglamento de la SRT o de la AEA; el número no fue identificado.",
  },
  {
    key: "derrames",
    course: { name: "Respuesta a derrames y emergencias ambientales", category: "environment", standards: ENV, validityMonths: 12 },
    usualTarget: "Por puesto",
    confidence: "practice",
    source: "ISO 14001 §8.2 (preparación y respuesta ante emergencias).",
  },
  {
    key: "auditor-interno",
    course: { name: "Auditor interno (9001, 14001 y 45001)", category: "quality", standards: ALL, validityMonths: null },
    usualTarget: "Equipo auditor",
    confidence: "practice",
    source: "ISO 19011 y práctica habitual. No vence; actualizar a criterio de la empresa.",
  },
  {
    key: "calibracion",
    course: { name: "Calibración y uso de instrumentos", category: "quality", standards: ["ISO9001"], validityMonths: null },
    usualTarget: "Puestos de calidad",
    confidence: "practice",
    source: "Práctica habitual.",
  },
];

export function findSuggested(key: string): SuggestedCourse | undefined {
  return SUGGESTED_COURSES.find((c) => c.key === key);
}
