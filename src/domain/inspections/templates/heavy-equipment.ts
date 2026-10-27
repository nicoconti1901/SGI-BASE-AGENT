import { HEAVY_EQUIPMENT_KEY, HEAVY_PERIODIC_KEY, HEAVY_PRE_USE_KEY } from "../asset-types/heavy-equipment";
import type { AppliesWhen, TemplateItemDef } from "../types";
import { checkItem, type TemplateDefinition } from "./types";

const docs = "Documentación";
const safety = "Seguridad";
const visibility = "Visibilidad";
const mechanics = "Mecánica";
const equipment = "Equipamiento";
const mechSafety = "Mecánica y seguridad";
const lifting = "Izaje";

const withLifting: AppliesWhen = { source: "asset", key: "hasLiftingGear", equals: true };
const circulates: AppliesWhen = { source: "asset", key: "circulatesOnPublicRoad", equals: true };

/**
 * Lectura del medidor del equipo: horómetro u odómetro según lo que cargó la empresa en el alta. Una sola de las dos
 * aplica a cada equipo; el motor la copia al cerrar y pide confirmar si baja respecto de la anterior.
 */
const hours: TemplateItemDef = {
  code: "reading_hours",
  section: "Lectura",
  text: "Horómetro (horas)",
  criticality: "minor",
  kind: "reading",
  readingKey: "hours",
  unit: "h",
  naAllowed: false,
  photoOnNc: false,
  required: true,
  minValue: 0,
  appliesWhen: { source: "asset", key: "meterKind", equals: "hours" },
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
  required: true,
  minValue: 0,
  appliesWhen: { source: "asset", key: "meterKind", equals: "odometer" },
};

/**
 * T3. Control previo al uso, equipos y vehículos pesados: lo hace el operador antes de arrancar (Dec. 351/79 arts. 116 y 134;
 * Dec. 911/96 arts. 257, 259, 261, 266, 274 y 278). Es corto a propósito: 13 ítems, 17 con izaje, más la lectura. No libera
 * un equipo que SST dejó fuera de servicio (`canReinstate: false`) y no lleva calendario ni vencimientos (decisión 10): la
 * ficha muestra «último control previo: hace N días». Un no apto deja el equipo fuera de servicio y crea la acción de
 * seguimiento; el hallazgo borrador nace solo si hay una no conformidad crítica.
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
    checkItem("safety_cabin", safety, "Protección del operador (estructura antivuelco o contra caída de objetos, visera) sin daño", "critical"),
    checkItem("vis_lights_horn", visibility, "Luces, balizas y bocina funcionan", "major"),
    checkItem("vis_backup_alarm", visibility, "Alarma de retroceso funciona", "major"),
    checkItem("vis_mirrors_glass", visibility, "Espejos y vidrios en buen estado", "major"),
    checkItem("mech_leaks", mechanics, "Sin pérdidas de aceite, combustible o hidráulico", "major"),
    checkItem("mech_levels", mechanics, "Niveles correctos (aceite, refrigerante, hidráulico)", "minor"),
    checkItem("mech_tires_tracks", mechanics, "Neumáticos u orugas sin cortes ni desgaste anormal", "major"),
    checkItem("equip_extinguisher", equipment, "Extintor presente y vigente", "major"),
    checkItem("equip_chocks", equipment, "Calzas disponibles", "minor"),
    checkItem("docs_onboard", docs, "Documentación del equipo a bordo", "minor"),
    checkItem("lift_load_limiter", lifting, "Limitador de carga o indicador operativo", "critical", {
      help: "Solo para equipos con elementos de izaje.",
      appliesWhen: withLifting,
    }),
    checkItem("lift_hooks_slings", lifting, "Ganchos con traba; cables y eslingas sin daño", "critical", {
      help: "Solo para equipos con elementos de izaje.",
      appliesWhen: withLifting,
    }),
    checkItem("lift_load_chart", lifting, "Tabla de cargas visible", "major", {
      help: "Solo para equipos con elementos de izaje.",
      appliesWhen: withLifting,
    }),
    checkItem("lift_outriggers", lifting, "Estabilizadores apoyados sobre base firme", "major", {
      help: "Solo para equipos con elementos de izaje.",
      appliesWhen: withLifting,
    }),
    { ...hours },
    { ...odometer },
  ],
};

const autoDoc = { photoOnNc: false, naAllowed: false } as const;

/**
 * T4. Inspección mensual, equipos y vehículos pesados: la hace SST (Ley 24.449 arts. 34 y 40; Dec. 351/79 arts. 114, 116, 118
 * y 134; Dec. 911/96 arts. 257, 265, 266, 274 y 276). Seguro, RTO, service y los vencimientos de izaje salen solos de los
 * vencimientos del equipo; la RTO solo aplica si circula por vía pública y los ítems de izaje solo si tiene elementos de
 * izaje. Libera un equipo fuera de servicio (reinspección apta cerrada por `process_owner` o superior) y crea un hallazgo
 * borrador si hay una no conformidad crítica.
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
      autoSource: { dueKind: "insurance" },
      ...autoDoc,
    }),
    checkItem("docs_rto", docs, "RTO vigente", "critical", {
      help: "Lo completa el sistema con el vencimiento de la RTO. Solo aparece si el equipo circula por vía pública.",
      autoSource: { dueKind: "rto" },
      appliesWhen: circulates,
      ...autoDoc,
    }),
    checkItem("docs_service", docs, "Service al día", "major", {
      help: "Lo completa el sistema con el vencimiento del service del equipo.",
      autoSource: { dueKind: "service" },
      ...autoDoc,
    }),
    checkItem("docs_lifting_cert", docs, "Certificación de izaje vigente", "critical", {
      help: "Lo completa el sistema. Solo aparece si el equipo tiene elementos de izaje.",
      autoSource: { dueKind: "lifting_certification" },
      appliesWhen: withLifting,
      ...autoDoc,
    }),
    checkItem("docs_lifting_review", docs, "Revisión trimestral de izaje vigente", "critical", {
      help: "Lo completa el sistema. La revisión la hace personal especializado cada tres meses. Solo aparece si el equipo tiene elementos de izaje.",
      autoSource: { dueKind: "lifting_review" },
      appliesWhen: withLifting,
      ...autoDoc,
    }),
    checkItem("docs_operator", docs, "Operador capacitado, con registro", "critical", {
      help: "Pedí el registro de capacitación del operador de este equipo.",
    }),
    checkItem("ms_brakes_steering", mechSafety, "Prueba de frenos y dirección", "critical"),
    checkItem("ms_operator_protection", mechSafety, "Protección del operador y accesos a la cabina sin daño", "critical"),
    checkItem("ms_inertial_belt", mechSafety, "Cinturón inercial", "critical"),
    checkItem("ms_lights_alarm", mechSafety, "Luces, balizas, bocina y alarma de retroceso", "major"),
    checkItem("ms_leaks_hoses", mechSafety, "Sin pérdidas; niveles y mangueras hidráulicas en buen estado", "major"),
    checkItem("ms_tires_tracks", mechSafety, "Neumáticos u orugas", "major"),
    checkItem("ms_max_load_marked", mechSafety, "Carga máxima marcada y visible", "major"),
    checkItem("ms_extinguisher_spill_kit", mechSafety, "Extintor vigente y kit de derrames", "major"),
    checkItem("lift_rope", lifting, "Cable de izar sin hilos rotos ni aplastamientos", "critical", {
      help: "Solo para equipos con elementos de izaje.",
      appliesWhen: withLifting,
    }),
    checkItem("lift_hooks", lifting, "Ganchos con traba y sin deformación", "critical", {
      help: "Solo para equipos con elementos de izaje.",
      appliesWhen: withLifting,
    }),
    checkItem("lift_slings_shackles", lifting, "Eslingas y grilletes identificados y sin daño", "critical", {
      help: "Solo para equipos con elementos de izaje.",
      appliesWhen: withLifting,
    }),
    checkItem("lift_limiter_endstop", lifting, "Limitador de carga y fin de carrera operativos", "critical", {
      help: "Solo para equipos con elementos de izaje.",
      appliesWhen: withLifting,
    }),
    checkItem("lift_load_charts", lifting, "Tablas de carga legibles", "major", {
      help: "Solo para equipos con elementos de izaje.",
      appliesWhen: withLifting,
    }),
    { ...hours },
    { ...odometer },
  ],
};
