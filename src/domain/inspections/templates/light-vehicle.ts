import { LIGHT_PERIODIC_KEY, LIGHT_PRE_USE_KEY, LIGHT_VEHICLE_KEY } from "../asset-types/light-vehicle";
import type { TemplateItemDef } from "../types";
import { checkItem, type TemplateDefinition } from "./types";

const docs = "Documentación";
const safety = "Seguridad";
const visibility = "Visibilidad";
const mechanics = "Mecánica";
const kit = "Kit";
const crane = "Hidrogrúa";

/** La sección de hidrogrúa solo aplica a los vehículos que la tienen. */
const withCrane = { source: "asset", key: "hasHydraulicCrane", equals: true } as const;

/** Lectura del odómetro: el motor la copia al cerrar y pide confirmar si baja respecto de la anterior. */
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
};

/**
 * T5. Control previo al uso, vehículos livianos: lo hace el conductor antes de salir (Ley 24.449 arts. 30, 31, 39 y 40).
 * Es corto a propósito (9 ítems y la lectura). No libera un vehículo que SST dejó fuera de servicio (`canReinstate: false`) y no
 * lleva calendario ni vencimientos (decisión 10): la ficha muestra «último control previo: hace N días». Un no apto deja el
 * vehículo fuera de servicio y crea la acción de seguimiento, sin hallazgo: lo escala la inspección mensual.
 * Propuesta del anexo del SPEC: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const LIGHT_PRE_USE: TemplateDefinition = {
  key: LIGHT_PRE_USE_KEY,
  name: "Control previo al uso, vehículo liviano",
  scope: "asset",
  assetTypeKey: LIGHT_VEHICLE_KEY,
  intervalUnit: null,
  intervalValue: null,
  leadDays: 0,
  reinspectionDays: 1,
  findingOnCritical: false,
  canReinstate: false,
  retireOnUnfit: false,
  maxApplicableItems: 15,
  items: [
    checkItem("docs_license", docs, "Licencia del conductor vigente y de la categoría", "critical"),
    checkItem("docs_onboard", docs, "Documentación a bordo (cédula, comprobante de seguro)", "minor"),
    checkItem("safety_brakes", safety, "Frenos", "critical"),
    checkItem("safety_steering", safety, "Dirección", "critical"),
    checkItem("safety_tires", safety, "Neumáticos sin cortes ni deformaciones", "critical"),
    checkItem("safety_belts", safety, "Cinturones de seguridad", "critical"),
    checkItem("vis_lights", visibility, "Luces (bajas, freno, giro)", "major"),
    checkItem("vis_glass", visibility, "Parabrisas, limpiaparabrisas y espejos", "major"),
    checkItem("mech_leaks", mechanics, "Sin pérdidas bajo el vehículo", "major"),
    odometer,
  ],
};

/**
 * T6. Inspección mensual, vehículos livianos: la hace SST (Ley 24.449 arts. 30, 31, 34 y 40).
 * Seguro, RTO, service y monitoreo salen solos de los vencimientos del vehículo. Libera un vehículo fuera de servicio
 * (reinspección apta cerrada por `process_owner` o superior) y crea un hallazgo en borrador si hay una no conformidad crítica.
 * Incorpora la planilla RE 02 PE 12 del PO (credencial, tarjeta verde/azul, chapa y patentes, engrase, equipamiento de obra e
 * hidrogrúa) sin duplicarla: fluidos e hidráulico son un solo ítem y la hidrogrúa aplica solo si el vehículo la tiene.
 * Propuesta del anexo del SPEC: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const LIGHT_PERIODIC: TemplateDefinition = {
  key: LIGHT_PERIODIC_KEY,
  name: "Inspección mensual, vehículo liviano",
  scope: "asset",
  assetTypeKey: LIGHT_VEHICLE_KEY,
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
      help: "Lo completa el sistema con el vencimiento del seguro del vehículo.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "insurance" },
    }),
    checkItem("docs_rto", docs, "RTO vigente", "critical", {
      help: "Lo completa el sistema con el vencimiento de la RTO del vehículo.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "rto" },
    }),
    checkItem("docs_service", docs, "Service al día", "major", {
      help: "Lo completa el sistema con el vencimiento del service del vehículo.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "service" },
    }),
    checkItem("docs_satellite", docs, "Monitoreo satelital activo", "minor", {
      help: "Lo completa el sistema. Solo aparece si el vehículo tiene monitoreo satelital.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "satellite_monitoring" },
      appliesWhen: { source: "asset", key: "hasSatelliteMonitoring", equals: true },
    }),
    checkItem("docs_credential", docs, "Credencial del vehículo vigente", "minor", { help: "Verificá el vencimiento impreso en la credencial." }),
    checkItem("docs_registration", docs, "Tarjeta verde o azul vigente", "major", { help: "Verificá el vencimiento y que figure el conductor autorizado." }),
    checkItem("safety_brakes_steering", safety, "Frenos y dirección (prueba)", "critical"),
    checkItem("safety_tread", safety, "Profundidad del dibujo del neumático (mm)", "major", {
      kind: "number",
      unit: "mm",
      minValue: 1.6,
      maxValue: 15,
      naAllowed: false,
      help: "Medí el neumático más gastado. El límite mínimo es 1,6 mm (valor habitual: lo puede cambiar la empresa).",
    }),
    checkItem("safety_tires", safety, "Neumáticos sin daño estructural", "critical"),
    checkItem("safety_belts", safety, "Cinturones y apoyacabezas", "critical"),
    checkItem("safety_rollbar", safety, "Barra o jaula antivuelco", "major", {
      help: "Solo para vehículos que la tienen.",
      appliesWhen: { source: "asset", key: "hasRollbar", equals: true },
    }),
    checkItem("vis_lights_glass", visibility, "Luces, bocina, espejos, parabrisas y limpiaparabrisas", "major"),
    checkItem("mech_body_plates", mechanics, "Chapa, pintura y chapas patente en buen estado", "minor"),
    checkItem("mech_levels", mechanics, "Fluidos (aceite, refrigerante, frenos, hidráulico): niveles correctos y sin pérdidas", "minor"),
    checkItem("mech_grease", mechanics, "Engrase al día", "minor"),
    checkItem("kit_extinguisher", kit, "Matafuego vigente", "major"),
    checkItem("kit_flares", kit, "Balizas portátiles", "major"),
    checkItem("kit_firstaid", kit, "Botiquín", "minor"),
    checkItem("kit_vest", kit, "Chaleco reflectivo", "minor"),
    checkItem("kit_spare", kit, "Rueda de auxilio, gato y llave", "major"),
    checkItem("kit_site_gear", kit, "Escalera aislada, vallas, conos y cintas de peligro", "minor", { help: "Marcá «No aplica» si este vehículo no los lleva por su tarea." }),
    checkItem("kit_site_signs", kit, "Cartelería de peligro y cartel de identificación de obra", "minor", { help: "Marcá «No aplica» si este vehículo no los lleva por su tarea." }),
    checkItem("crane_hydraulic", crane, "Nivel de aceite hidráulico correcto y sin pérdidas", "major", { appliesWhen: withCrane }),
    checkItem("crane_grease", crane, "Engrase de la hidrogrúa al día", "minor", { appliesWhen: withCrane }),
    checkItem("crane_basket", crane, "Canasto en buen estado", "major", { appliesWhen: withCrane }),
    { ...odometer },
  ],
};
