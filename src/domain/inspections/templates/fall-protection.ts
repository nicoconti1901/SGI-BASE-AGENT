import { checkItem, type TemplateDefinition } from "./types";

const ident = "Identificación";
const webbing = "Cintas y costuras";
const hardware = "Herrajes";
const absorber = "Absorbedor";

/**
 * T8. Arneses y cabos de vida, inspección periódica (Res. SRT 61/2023; práctica HSE).
 * Cualquier daño inhabilita el equipo: casi todos los ítems son críticos y un no apto es baja definitiva
 * (`retireOnUnfit`): no hay liberación ni reinspección. Sin hallazgo automático (decisión 5): el seguimiento es la acción
 * de destruir el equipo y adjuntar la foto. La vida útil la deriva el sistema del vencimiento del activo.
 * Propuesta del anexo del SPEC: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const FALL_PROTECTION_PERIODIC: TemplateDefinition = {
  key: "fall_protection_periodic",
  name: "Arneses y cabos de vida",
  scope: "asset",
  assetTypeKey: "fall_protection",
  intervalUnit: "months",
  intervalValue: 6,
  leadDays: 15,
  reinspectionDays: 7,
  findingOnCritical: false,
  canReinstate: false,
  retireOnUnfit: true,
  maxApplicableItems: 25,
  items: [
    checkItem("ident_label", ident, "Etiqueta o marcado legible (norma, serie, fabricación)", "critical"),
    checkItem("ident_service_life", ident, "Vida útil vigente", "critical", {
      help: "Lo completa el sistema con el fin de la vida útil del equipo. Vencida, el equipo se da de baja.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "service_life_end" },
    }),
    checkItem("webbing_cuts", webbing, "Cintas sin cortes, deshilachado, quemaduras ni daño químico", "critical"),
    checkItem("webbing_stitching", webbing, "Costuras íntegras", "critical"),
    checkItem("webbing_knots", webbing, "Sin nudos ni empalmes", "critical"),
    checkItem("hardware_buckles", hardware, "Hebillas y argollas D sin deformación ni corrosión", "critical"),
    checkItem("hardware_hooks", hardware, "Ganchos y mosquetones con traba y cierre correcto", "critical"),
    checkItem("absorber_indicator", absorber, "Indicador de caída o absorbedor sin activar", "critical"),
    checkItem("absorber_no_fall", absorber, "Sin registro de caída detenida desde la última inspección", "critical"),
    checkItem("retractable_brake", "Retráctil", "Retracción y freno funcionan", "critical", {
      help: "Solo para equipos retráctiles.",
      appliesWhen: { source: "asset", key: "kind", equals: "retractable" },
    }),
    checkItem("harness_antitrauma", "Arnés", "Dispositivo antitrauma presente", "major", {
      help: "Solo para arneses que se usan desde 6 m de altura o más: si no corresponde, marcá «No aplica».",
      appliesWhen: { source: "asset", key: "kind", equals: "harness" },
    }),
    checkItem("care_storage", "Conservación", "Limpio, seco y guardado según el fabricante", "minor"),
  ],
};
