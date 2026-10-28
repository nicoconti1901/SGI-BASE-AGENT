/**
 * Accidentabilidad (Task 17, SPEC-accident-stats.md): tipos y listas.
 * Las listas son propias y cortas, en código (D16): no equivalen a la tabla oficial de la SRT.
 */

export const SAFETY_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** Clasificación del hecho. Coincide con el enum `IncidentClassification` de Prisma. */
export const INCIDENT_CLASSIFICATIONS = [
  "near_miss",
  "first_aid",
  "no_lost_time",
  "lost_time",
  "fatal",
  "occupational_disease",
  "property_damage_only",
] as const;
export type IncidentClassification = (typeof INCIDENT_CLASSIFICATIONS)[number];

/**
 * Clasificaciones que ofrece el alta laboral. `property_damage_only` es solo del evento vial
 * (SPEC-road-safety D9): no entra en IF, IG ni II y no se elige desde la ficha laboral.
 */
export const LABOR_CLASSIFICATIONS: readonly IncidentClassification[] = INCIDENT_CLASSIFICATIONS.filter(
  (c) => c !== "property_damage_only",
);

export const CLASSIFICATION_LABELS: Record<IncidentClassification, string> = {
  near_miss: "Casi accidente",
  first_aid: "Primeros auxilios",
  no_lost_time: "Sin baja",
  lost_time: "Con baja",
  fatal: "Fatal",
  occupational_disease: "Enfermedad profesional",
  property_damage_only: "Solo daño material",
};

/** Ayuda breve para el alta: la pregunta que se hace quien carga el hecho. */
export const CLASSIFICATION_HINTS: Record<IncidentClassification, string> = {
  near_miss: "No hubo lesión, pero pudo haberla.",
  first_aid: "Se curó en el lugar, sin tratamiento médico.",
  no_lost_time: "Tratamiento médico o tareas restringidas; siguió o volvió a trabajar.",
  lost_time: "La persona no pudo trabajar al día siguiente o más.",
  fatal: "Hubo una muerte.",
  occupational_disease: "Enfermedad atribuida al trabajo.",
  property_damage_only: "Evento vial sin lesionados, solo daño en vehículos o bienes.",
};

/** Clasificaciones con lesión o enfermedad: piden persona afectada. */
export const INJURY_CLASSIFICATIONS: readonly IncidentClassification[] = [
  "first_aid",
  "no_lost_time",
  "lost_time",
  "fatal",
  "occupational_disease",
];

export type EmployerKind = "own" | "contractor";
export const EMPLOYER_KINDS: readonly EmployerKind[] = ["own", "contractor"];
export const EMPLOYER_LABELS: Record<EmployerKind, string> = {
  own: "Personal propio",
  contractor: "Contratista",
};

type Option = { key: string; label: string };

export const ACCIDENT_FORMS: readonly Option[] = [
  { key: "fall_same_level", label: "Caída al mismo nivel" },
  { key: "fall_height", label: "Caída de altura" },
  { key: "struck_by_object", label: "Golpe por objeto o caída de objeto" },
  { key: "struck_against", label: "Golpe contra un objeto" },
  { key: "caught", label: "Atrapamiento" },
  { key: "cut", label: "Corte o pinchazo" },
  { key: "overexertion", label: "Sobreesfuerzo" },
  { key: "contact_heat_cold", label: "Contacto con calor o frío" },
  { key: "contact_electric", label: "Contacto eléctrico" },
  { key: "contact_substance", label: "Contacto con sustancias" },
  { key: "traffic", label: "Choque o vuelco" },
  { key: "fire_explosion", label: "Incendio o explosión" },
  { key: "assault", label: "Agresión" },
  { key: "other", label: "Otra forma" },
];

export const MATERIAL_AGENTS: readonly Option[] = [
  { key: "machinery", label: "Máquina o equipo" },
  { key: "hand_tool", label: "Herramienta manual" },
  { key: "vehicle", label: "Vehículo" },
  { key: "floor_stairs", label: "Piso, escalera o desnivel" },
  { key: "scaffold", label: "Andamio o plataforma" },
  { key: "load_material", label: "Carga o material" },
  { key: "chemical", label: "Sustancia química" },
  { key: "electrical", label: "Instalación eléctrica" },
  { key: "environment", label: "Ambiente (calor, ruido, humo…)" },
  { key: "person_animal", label: "Persona o animal" },
  { key: "other", label: "Otro agente" },
];

export const NATURES_OF_INJURY: readonly Option[] = [
  { key: "contusion", label: "Contusión o golpe" },
  { key: "wound", label: "Herida" },
  { key: "fracture", label: "Fractura" },
  { key: "sprain", label: "Esguince o torcedura" },
  { key: "burn", label: "Quemadura" },
  { key: "amputation", label: "Amputación" },
  { key: "foreign_body", label: "Cuerpo extraño" },
  { key: "poisoning", label: "Intoxicación" },
  { key: "back_injury", label: "Lesión de espalda" },
  { key: "multiple", label: "Lesiones múltiples" },
  { key: "other", label: "Otra" },
];

export const BODY_PARTS: readonly Option[] = [
  { key: "head", label: "Cabeza" },
  { key: "eyes", label: "Ojos" },
  { key: "face", label: "Cara" },
  { key: "neck", label: "Cuello" },
  { key: "trunk", label: "Tronco" },
  { key: "back", label: "Espalda" },
  { key: "shoulder_arm", label: "Hombro o brazo" },
  { key: "hand", label: "Mano" },
  { key: "fingers", label: "Dedos de la mano" },
  { key: "hip_leg", label: "Cadera o pierna" },
  { key: "knee", label: "Rodilla" },
  { key: "foot", label: "Pie o tobillo" },
  { key: "multiple", label: "Varias partes" },
  { key: "general", label: "Efecto general" },
];

export const ACCIDENT_FORM_KEYS = ACCIDENT_FORMS.map((o) => o.key);
export const MATERIAL_AGENT_KEYS = MATERIAL_AGENTS.map((o) => o.key);
export const NATURE_KEYS = NATURES_OF_INJURY.map((o) => o.key);
export const BODY_PART_KEYS = BODY_PARTS.map((o) => o.key);

function labelOf(list: readonly Option[], key: string | null | undefined): string {
  if (!key) return "—";
  return list.find((o) => o.key === key)?.label ?? key;
}
export const labelAccidentForm = (key: string | null | undefined) => labelOf(ACCIDENT_FORMS, key);
export const labelMaterialAgent = (key: string | null | undefined) => labelOf(MATERIAL_AGENTS, key);
export const labelNature = (key: string | null | undefined) => labelOf(NATURES_OF_INJURY, key);
export const labelBodyPart = (key: string | null | undefined) => labelOf(BODY_PARTS, key);

export function isClassification(value: string): value is IncidentClassification {
  return (INCIDENT_CLASSIFICATIONS as readonly string[]).includes(value);
}

/** Ajustes de la empresa (valores por defecto del SPEC: D1, D2, D3, D17). */
export type SafetySettings = {
  fatalChargeDays: number;
  /** 1.000 o 1.000.000. */
  severityBase: 1000 | 1000000;
  lostDaysCap: number;
  exposureDueDay: number;
  showOptionalIndices: boolean;
  /** Quien recibe el aviso de carga de la exposición (sin definir: los administradores). */
  exposureOwnerUserId: string | null;
};

export const DEFAULT_SAFETY_SETTINGS: SafetySettings = {
  fatalChargeDays: 6000,
  severityBase: 1000,
  lostDaysCap: 365,
  exposureDueDay: 10,
  showOptionalIndices: false,
  exposureOwnerUserId: null,
};

/** Clave de mes "AAAA-MM". */
export type MonthKey = string;
/** Fecha calendario "AAAA-MM-DD" (sin hora ni zona). */
export type IsoDay = string;
