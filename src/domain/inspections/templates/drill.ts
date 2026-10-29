import { checkItem, textItem, type TemplateDefinition } from "./types";

const prep = "Preparación";
const dev = "Desarrollo";
const close = "Cierre";

/**
 * Registro de simulacro (RG 02 PG 10 del PO; ISO 45001 §8.2, ISO 14001 §8.2). Es un área: se hace por sede y sector, una vez al
 * año. La planilla califica cada acción con B / R / M; acá cada acción es conforme o no conforme y el resultado lo deriva el motor:
 * no seguir el procedimiento de emergencia es crítico y abre un hallazgo borrador. La contingencia simulada, los participantes, los
 * veedores y las correcciones detectadas van en ítems de texto, que no puntúan.
 * Propuesta basada en la planilla del PO: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const DRILL: TemplateDefinition = {
  key: "emergency_drill",
  name: "Simulacro de emergencia",
  scope: "area",
  assetTypeKey: null,
  intervalUnit: "months",
  intervalValue: 12,
  leadDays: 30,
  reinspectionDays: 14,
  findingOnCritical: true,
  canReinstate: false,
  retireOnUnfit: false,
  maxApplicableItems: 15,
  items: [
    textItem("scenario", prep, "Contingencia simulada", "Incendio, derrame, evacuación, rescate u otra, y el lugar donde se hizo (RG 02 PG 10)."),
    textItem("participants", prep, "Participantes y veedores", "Personal interno, personal externo y quienes observaron el simulacro."),
    checkItem("resources_ready", prep, "Los recursos de emergencia estaban disponibles y en condiciones (extintores, botiquín, alarma)", "major"),
    checkItem("routes_clear", prep, "Las vías de evacuación y las salidas estaban despejadas y señalizadas", "major"),
    checkItem("alarm_heard", dev, "Se activó la alarma o el aviso y se escuchó en toda la zona", "major"),
    checkItem("procedure_followed", dev, "Se siguieron los pasos del procedimiento de emergencia", "critical"),
    checkItem("roles_met", dev, "Cada persona cumplió el rol asignado en el rol de comunicaciones ante emergencias", "major"),
    checkItem("headcount", dev, "Se hizo el recuento de personas en el punto de reunión", "major"),
    checkItem("response_times", dev, "Los tiempos de respuesta fueron los esperados", "major", {
      help: "Anotá en las observaciones los tiempos medidos: detección, alarma, evacuación completa.",
    }),
    checkItem("notifications", dev, "Se avisó a quien corresponde (jefatura, servicios de emergencia)", "minor"),
    textItem("corrections", close, "Necesidades de corrección detectadas", "Lo que haya que mejorar y que no es una no conformidad de los ítems anteriores. Las no conformidades abren su acción de seguimiento."),
  ],
};
