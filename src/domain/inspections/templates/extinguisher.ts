import { checkItem, textItem, type TemplateDefinition } from "./types";

const loc = "Ubicación";
const state = "Estado";
const ident = "Identificación";
const docs = "Documentación";

/**
 * T1. Control de extintores (IRAM 3517-2, Dec. 351/79 arts. 184–185, Dec. 911/96 arts. 90–91).
 * Propuesta del anexo del SPEC: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 * Etiqueta celeste tras el control: no es un ítem, lo recuerda la ayuda del cierre.
 */
export const EXTINGUISHER_PERIODIC: TemplateDefinition = {
  key: "extinguisher_periodic",
  name: "Control de extintores",
  scope: "asset",
  assetTypeKey: "extinguisher",
  intervalUnit: "months",
  intervalValue: 1,
  leadDays: 7,
  reinspectionDays: 7,
  findingOnCritical: false,
  canReinstate: true,
  retireOnUnfit: false,
  maxApplicableItems: 25,
  items: [
    checkItem("loc_in_place", loc, "Está en su puesto, con señalización visible", "major"),
    checkItem("loc_access", loc, "Acceso libre y sin obstrucción visual", "major"),
    checkItem("loc_mount", loc, "Altura y fijación del soporte o gabinete correctas", "minor"),
    checkItem("state_gauge", state, "Manómetro en zona verde", "critical", {
      help: "No aplica a los extintores de CO₂ (no tienen manómetro).",
      appliesWhen: { source: "asset", key: "agent", notEquals: "co2" },
    }),
    checkItem("state_weight", state, "Peso de la carga conforme al cilindro", "critical", {
      help: "Solo para CO₂: se controla pesando el extintor.",
      appliesWhen: { source: "asset", key: "agent", equals: "co2" },
    }),
    checkItem("state_seal", state, "Precinto y pasador de seguridad intactos", "critical"),
    checkItem("state_cylinder", state, "Cilindro sin golpes, corrosión, «panza» ni soldaduras", "critical"),
    checkItem("state_hose", state, "Manguera, tobera o difusor completos y sin daño; válvula sin pérdidas", "major"),
    checkItem("state_wheels", state, "Ruedas y carro en buen estado", "minor", {
      help: "Solo para extintores sobre ruedas.",
      appliesWhen: { source: "asset", key: "onWheels", equals: true },
    }),
    checkItem("ident_instructions", ident, "Instrucciones legibles y de cara al usuario", "minor"),
    checkItem("ident_manufacture_date", ident, "Fecha de fabricación legible", "critical"),
    checkItem("docs_maintenance", docs, "Mantenimiento vigente", "major", {
      help: "Lo completa el sistema con el vencimiento del activo.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "maintenance" },
    }),
    checkItem("docs_hydrostatic", docs, "Prueba hidráulica vigente", "critical", {
      help: "Lo completa el sistema con el vencimiento del activo.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "hydrostatic_test" },
    }),
    checkItem("docs_tag", docs, "Tarjeta o etiqueta de control colocada", "minor"),
    checkItem("fit_agent", "Adecuación", "Agente y potencial adecuados al riesgo del sector", "major"),
    textItem("notice_site_management", "Cierre", "Notificación a la jefatura de obra", "Anotá a quién avisaste de las no conformidades y cuándo (RE 01 PE 05). Si todo está conforme, dejalo vacío."),
  ],
};
