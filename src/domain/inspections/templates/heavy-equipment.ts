import { HEAVY_EQUIPMENT_KEY, HEAVY_PERIODIC_KEY, HEAVY_PRE_USE_KEY } from "../asset-types/heavy-equipment";
import type { TemplateItemDef } from "../types";
import { checkItem, type TemplateDefinition } from "./types";

const docs = "Documentación";
const safety = "Seguridad";
const visibility = "Visibilidad";
const mechanics = "Mecánica";
const equipment = "Equipamiento";
const mechSafety = "Mecánica y seguridad";
const lifting = "Izaje (solo con elementos de izaje)";

/** Los ítems de izaje solo aplican a los equipos que tienen elementos de izaje. */
const withLifting = { source: "asset", key: "hasLiftingGear", equals: true } as const;

/**
 * Lecturas del equipo (SPEC: «horómetro / odómetro»). Un equipo tiene una u otra, así que ninguna es obligatoria; el motor
 * copia la que se cargue al activo y pide confirmar si baja respecto de la anterior. El odómetro solo aparece si circula.
 */
const hourmeter: TemplateItemDef = {
  code: "reading_hours",
  section: "Lectura",
  text: "Horómetro (horas)",
  criticality: "minor",
  kind: "reading",
  readingKey: "hours",
  unit: "h",
  naAllowed: false,
  photoOnNc: false,
  required: false,
  minValue: 0,
};
const odometer: TemplateItemDef = {
  code: "reading_odometer",
  section: "Lectura",
  text: "Odómetro (km)",
  criticality: "minor",
  kind: "reading",
  readingKey: "odometer_km",
  unit: "km",
  naAllowed: false,
  photoOnNc: false,
  required: false,
  minValue: 0,
  appliesWhen: { source: "asset", key: "circulatesOnPublicRoad", equals: true },
};

/**
 * T3. Control previo al uso, equipos pesados: lo hace el operador antes de arrancar (Dec. 351/79 arts. 116 y 134;
 * Dec. 911/96 arts. 257 a 278). No libera un equipo que SST dejó fuera de servicio (`canReinstate: false`) y no lleva
 * calendario ni vencimientos (decisión 10). Un no apto deja el equipo fuera de servicio y crea la acción de seguimiento;
 * con una no conformidad crítica además se crea un hallazgo en borrador, como pide el anexo.
 * Propuesta del anexo del SPEC: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const HEAVY_PRE_USE: TemplateDefinition = {
  key: HEAVY_PRE_USE_KEY,
  name: "Control previo al uso, equipo pesado",
  scope: "asset",
  assetTypeKey: HEAVY_EQUIPMENT_KEY,
  intervalUnit: null,
  intervalValue: null,
  leadDays: 0,
  reinspectionDays: 1,
  findingOnCritical: true,
  canReinstate: false,
  retireOnUnfit: false,
  maxApplicableItems: 20,
  items: [
    checkItem("safety_brakes", safety, "Frenos de servicio y de estacionamiento funcionan", "critical"),
    checkItem("safety_steering", safety, "Dirección sin juego anormal", "critical"),
    checkItem("safety_belt", safety, "Cinturón de seguridad presente y en funcionamiento", "critical"),
    checkItem("safety_operator_protection", safety, "Protección del operador (estructura antivuelco / contra caída de objetos, visera) sin daño", "critical"),
    checkItem("vis_lights", visibility, "Luces, balizas y bocina funcionan", "major"),
    checkItem("vis_backup_alarm", visibility, "Alarma de retroceso funciona", "major"),
    checkItem("vis_mirrors_glass", visibility, "Espejos y vidrios en buen estado", "major"),
    checkItem("mech_leaks", mechanics, "Sin pérdidas de aceite, combustible o hidráulico", "major"),
    checkItem("mech_levels", mechanics, "Niveles correctos (aceite, refrigerante, hidráulico)", "minor"),
    checkItem("mech_tires_tracks", mechanics, "Neumáticos u orugas sin cortes ni desgaste anormal", "major"),
    checkItem("eq_extinguisher", equipment, "Extintor presente y vigente", "major"),
    checkItem("eq_chocks", equipment, "Calzas disponibles", "minor"),
    checkItem("docs_onboard", docs, "Documentación del equipo a bordo", "minor"),
    checkItem("lift_load_limiter", lifting, "Limitador de carga o indicador operativo", "critical", { appliesWhen: withLifting }),
    checkItem("lift_hooks_cables", lifting, "Ganchos con traba; cables y eslingas sin daño", "critical", { appliesWhen: withLifting }),
    checkItem("lift_load_chart", lifting, "Tabla de cargas visible", "major", { appliesWhen: withLifting }),
    checkItem("lift_outriggers", lifting, "Estabilizadores apoyados sobre base firme", "major", { appliesWhen: withLifting }),
    hourmeter,
    odometer,
  ],
};

/**
 * T4. Inspección mensual, equipos pesados: la hace SST (Dec. 351/79 arts. 114, 116, 118 y 134; Dec. 911/96; Ley 24.449 arts. 34 y 40).
 * Seguro, RTO, service y las dos revisiones de izaje salen solos de los vencimientos del equipo; RTO e izaje solo aplican si el
 * equipo circula o tiene elementos de izaje. Libera un equipo fuera de servicio (reinspección apta cerrada por `process_owner`
 * o superior) y crea un hallazgo en borrador si hay una no conformidad crítica.
 * Propuesta del anexo del SPEC: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const HEAVY_PERIODIC: TemplateDefinition = {
  key: HEAVY_PERIODIC_KEY,
  name: "Inspección mensual, equipo pesado",
  scope: "asset",
  assetTypeKey: HEAVY_EQUIPMENT_KEY,
  intervalUnit: "months",
  intervalValue: 1,
  leadDays: 7,
  reinspectionDays: 7,
  findingOnCritical: true,
  canReinstate: true,
  retireOnUnfit: false,
  maxApplicableItems: 25,
  items: [
    checkItem("docs_insurance", docs, "Seguro vigente", "critical", {
      help: "Lo completa el sistema con el vencimiento del seguro del equipo.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "insurance" },
    }),
    checkItem("docs_rto", docs, "RTO vigente", "critical", {
      help: "Lo completa el sistema. Solo aparece si el equipo circula por vía pública.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "rto" },
      appliesWhen: { source: "asset", key: "circulatesOnPublicRoad", equals: true },
    }),
    checkItem("docs_service", docs, "Service al día", "major", {
      help: "Lo completa el sistema con el vencimiento del service del equipo.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "service" },
    }),
    checkItem("docs_lifting_certification", docs, "Certificación de izaje vigente", "critical", {
      help: "Lo completa el sistema. Solo aparece si el equipo tiene elementos de izaje.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "lifting_certification" },
      appliesWhen: withLifting,
    }),
    checkItem("docs_lifting_review", docs, "Revisión trimestral de izaje vigente", "critical", {
      help: "Lo completa el sistema. La hace personal especializado cada 3 meses (Dec. 351/79 art. 116). Solo aparece si el equipo tiene elementos de izaje.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "lifting_review" },
      appliesWhen: withLifting,
    }),
    checkItem("docs_operator_trained", docs, "Operador capacitado, con registro", "critical", {
      help: "Verificá que el operador tenga su capacitación registrada.",
    }),
    checkItem("ms_brakes_steering", mechSafety, "Prueba de frenos y dirección", "critical"),
    checkItem("ms_operator_protection", mechSafety, "Protección del operador y accesos a la cabina sin daño", "critical"),
    checkItem("ms_inertial_belt", mechSafety, "Cinturón inercial", "critical"),
    checkItem("ms_lights_alarm", mechSafety, "Luces, balizas, bocina y alarma de retroceso", "major"),
    checkItem("ms_leaks_hoses", mechSafety, "Sin pérdidas; niveles y mangueras hidráulicas en buen estado", "major"),
    checkItem("ms_tires_tracks", mechSafety, "Neumáticos u orugas", "major"),
    checkItem("ms_max_load_marked", mechSafety, "Carga máxima marcada y visible", "major"),
    checkItem("ms_extinguisher_spill_kit", mechSafety, "Extintor vigente y kit de derrames", "major"),
    checkItem("lift_wire_rope", lifting, "Cable de izar sin hilos rotos ni aplastamientos", "critical", { appliesWhen: withLifting }),
    checkItem("lift_hooks", lifting, "Ganchos con traba y sin deformación", "critical", { appliesWhen: withLifting }),
    checkItem("lift_slings_shackles", lifting, "Eslingas y grilletes identificados y sin daño", "critical", { appliesWhen: withLifting }),
    checkItem("lift_limiter_endstop", lifting, "Limitador de carga y fin de carrera operativos", "critical", { appliesWhen: withLifting }),
    checkItem("lift_load_charts", lifting, "Tablas de carga legibles", "major", { appliesWhen: withLifting }),
    { ...hourmeter },
    { ...odometer },
  ],
};
