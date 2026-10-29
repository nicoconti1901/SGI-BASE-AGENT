import { checkItem, textItem, type TemplateDefinition } from "./types";

const general = "Estado general";
const electric = "Seguridad eléctrica";
const guards = "Protecciones y accesorios";
const order = "Identificación y orden";

/**
 * Control de máquinas y herramientas (RE 01 PE 12 del PO). La planilla lista cada equipo con su cantidad y
 * lo marca «Satisfactorio / No satisfactorio»; acá el listado va en un ítem de texto y la revisión se hace por los criterios
 * comunes a toda máquina o herramienta de mano, para que el resultado lo derive el motor por criticidad. Es un área (sede y
 * sector): lo que no cumple un equipo puntual se anota en las observaciones del ítem, con su designación.
 * Propuesta basada en la planilla del PO: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const MACHINERY_TOOLS: TemplateDefinition = {
  key: "machinery_tools",
  name: "Control de máquinas y herramientas",
  scope: "area",
  assetTypeKey: null,
  intervalUnit: "months",
  intervalValue: 1,
  leadDays: 5,
  reinspectionDays: 7,
  findingOnCritical: true,
  canReinstate: false,
  retireOnUnfit: false,
  maxApplicableItems: 15,
  items: [
    textItem(
      "equipment_list",
      general,
      "Máquinas y herramientas controladas",
      "Anotá cada equipo con su designación y cantidad, como en la planilla RE 01 PE 12. Si alguno no es satisfactorio, nombralo en las observaciones del ítem que corresponda.",
    ),
    checkItem("visual_condition", general, "Sin golpes, fisuras, deformaciones ni piezas flojas", "major"),
    checkItem("switch_works", general, "El interruptor o gatillo corta al soltarlo y no queda trabado", "major"),
    checkItem("cables_plugs", electric, "Cables, fichas y prolongaciones sin cortes, empalmes precarios ni conductores a la vista", "critical"),
    checkItem("insulation_grounding", electric, "Doble aislación o puesta a tierra en los equipos eléctricos", "major"),
    checkItem("guards_in_place", guards, "Las protecciones y resguardos (de disco, de transmisión, de partes móviles) están colocados", "critical"),
    checkItem("discs_accessories", guards, "Discos, brocas y accesorios son los adecuados al equipo y no están gastados ni dañados", "major"),
    checkItem("handles", guards, "Mangos y empuñaduras firmes, sin astillas ni fisuras", "minor"),
    checkItem("tagged_out", order, "Los equipos dañados están fuera de servicio y con tarjeta de «No usar»", "major"),
    checkItem("storage", order, "Se guardan limpios, ordenados y en su lugar", "minor"),
  ],
};
