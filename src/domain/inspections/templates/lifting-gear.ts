import { checkItem, type TemplateDefinition } from "./types";

const ident = "Identificación";
const state = "Estado";
const hardware = "Herrajes y terminales";
const care = "Conservación";

/**
 * Elementos de izaje (RE 03 PE 12 del PO): eslingas, cadenas, cables de acero, grilletes,
 * ganchos y aparejos. La planilla es un registro de identificación y certificación; acá la certificación es el vencimiento del
 * activo (frecuencia, última fecha, n.º y ente) y esta es la inspección visual periódica. Con la certificación vencida el
 * elemento no se puede declarar apto. Un no apto lo saca de servicio, pero se puede reponer tras reparar y recertificar.
 * Propuesta basada en la planilla del PO: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const LIFTING_GEAR_PERIODIC: TemplateDefinition = {
  key: "lifting_gear_periodic",
  name: "Elementos de izaje",
  scope: "asset",
  assetTypeKey: "lifting_gear",
  intervalUnit: "months",
  intervalValue: 3,
  leadDays: 10,
  reinspectionDays: 7,
  findingOnCritical: false,
  canReinstate: true,
  retireOnUnfit: false,
  maxApplicableItems: 15,
  items: [
    checkItem("ident_capacity", ident, "Marcado o placa legible con la capacidad de carga", "critical"),
    checkItem("ident_certification", ident, "Certificación vigente", "critical", {
      help: "Lo completa el sistema con el vencimiento de la certificación. Vencida, el elemento no se puede declarar apto.",
      photoOnNc: false,
      naAllowed: false,
      autoSource: { dueKind: "certification" },
    }),
    checkItem("state_wear", state, "Sin deformaciones, cortes, hilos rotos, nudos, aplastamientos ni corrosión", "critical"),
    checkItem("state_ends", state, "Ojales, costuras y terminales sin daño", "critical"),
    checkItem("hardware_hooks", hardware, "Ganchos con traba de seguridad que cierra y sin apertura de la garganta", "critical"),
    checkItem("hardware_pins", hardware, "Pasadores, bulones y tuercas completos y ajustados", "major"),
    checkItem("hoist_works", "Aparejo", "El freno, la cadena y el accionamiento funcionan", "critical", {
      help: "Solo para aparejos y polipastos.",
      appliesWhen: { source: "asset", key: "kind", equals: "hoist" },
    }),
    checkItem("care_storage", care, "Se guarda limpio, seco, colgado y protegido de la intemperie", "minor"),
  ],
};
