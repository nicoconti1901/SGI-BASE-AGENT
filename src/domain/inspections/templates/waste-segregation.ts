import { checkItem, type TemplateDefinition } from "./types";

const containers = "Contenedores";
const segregation = "Segregación";
const order = "Orden y limpieza";
const people = "Personal";

/**
 * Segregación de residuos (RE 01 PE 06 del PO; ISO 14001 §8.1). Es un área: se hace por sede y sector (oficina administrativa,
 * oficina operativa, acopio de materiales) y el sector se anota en la inspección. La planilla puntúa por rangos (1–6 no conforme,
 * 7–9 cumple con observaciones, 10 cumple), pero acá el resultado lo deriva el motor por criticidad, igual que en las demás
 * plantillas: solo la segregación según el procedimiento es crítica, y cualquier otro incumplimiento es «Apto con observaciones».
 * La zona de obradores revisa los residuos de un vistazo; este control es el detallado.
 * Propuesta basada en la planilla del PO: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const WASTE_SEGREGATION: TemplateDefinition = {
  key: "waste_segregation",
  name: "Segregación de residuos",
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
    checkItem("containers_enough", containers, "Hay contenedores suficientes para las actividades diarias", "major"),
    checkItem("containers_per_type", containers, "Hay un contenedor para cada tipo de residuo", "major"),
    checkItem("containers_labeled", containers, "Los contenedores están rotulados según el tipo de residuo", "major"),
    checkItem("containers_condition", containers, "Los contenedores están en buen estado y tienen tapa o cobertura", "minor"),
    checkItem("containers_location", containers, "Están ubicados de forma segura e higiénica", "minor"),
    checkItem("content_segregated", segregation, "El contenido está segregado según el procedimiento de gestión de residuos", "critical"),
    checkItem("tidy_sector", order, "Todo el sector está limpio y en orden", "minor"),
    checkItem("bags_removed", order, "Las bolsas se retiran con la frecuencia y los días correctos, sin acumulación", "minor"),
    checkItem("no_odors", order, "No hay olores inusuales", "minor"),
    checkItem("staff_trained", people, "Todo el personal del sector recibió la capacitación en gestión de residuos", "major"),
  ],
};
