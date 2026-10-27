import { checkItem, type TemplateDefinition } from "./types";

const order = "Orden y circulación";
const bounds = "Delimitación";
const power = "Electricidad";
const fire = "Incendio";
const hazmat = "Sustancias peligrosas";
const waste = "Residuos";
const services = "Servicios";
const emergency = "Emergencia";

/**
 * T2. Zona de obradores (Dec. 911/96; ISO 45001 §8.1; ISO 14001 §8.1).
 * Es un área, no un activo: se programa por sede (cada 7 días) y un no apto abre acción y, si hay una crítica, hallazgo.
 * Propuesta del anexo del SPEC: debe revisarla un profesional de Higiene y Seguridad antes de activar el módulo.
 */
export const SITE_OBRADOR: TemplateDefinition = {
  key: "site_obrador",
  name: "Zona de obradores",
  scope: "area",
  assetTypeKey: null,
  intervalUnit: "days",
  intervalValue: 7,
  leadDays: 2,
  reinspectionDays: 7,
  findingOnCritical: true,
  canReinstate: false,
  retireOnUnfit: false,
  maxApplicableItems: 25,
  items: [
    checkItem("order_aisles", order, "Pasillos y accesos despejados", "major"),
    checkItem("order_stacking", order, "Materiales apilados de forma estable", "major"),
    checkItem("order_waste", order, "Sin acumulación de residuos", "minor"),
    checkItem("bounds_fence", bounds, "Obrador delimitado, con acceso controlado", "major"),
    checkItem("bounds_signs", bounds, "Señalización de seguridad (prohibición, obligación, evacuación) legible", "major"),
    checkItem("power_panels", power, "Tableros con tapa y sin partes vivas expuestas", "critical"),
    checkItem("power_rcd", power, "Disyuntor diferencial presente y probado", "critical"),
    checkItem("power_earth", power, "Puesta a tierra conectada", "critical"),
    checkItem("power_earth_test", power, "Medición de puesta a tierra vigente (≤ 12 meses)", "major", {
      help: "Res. SRT 900/2015: la medición se renueva cada año.",
    }),
    checkItem("power_cables", power, "Sin empalmes precarios ni cables expuestos al tránsito", "major"),
    checkItem("fire_extinguishers", fire, "Extintores presentes, vigentes y señalizados", "major", {
      help: "Al abrir la inspección, el sistema te muestra cuántos extintores de esta sede están vencidos.",
    }),
    checkItem("fire_escape", fire, "Medios de escape libres", "critical"),
    checkItem("fire_fuels", fire, "Combustibles lejos de fuentes de ignición", "major"),
    checkItem("hazmat_sds", hazmat, "Hojas de seguridad (FDS) disponibles", "major"),
    checkItem("hazmat_labels", hazmat, "Envases rotulados", "major"),
    checkItem("hazmat_containment", hazmat, "Contención secundaria y almacenamiento separado", "major"),
    checkItem("hazmat_spill_kit", hazmat, "Kit antiderrame completo", "major"),
    checkItem("waste_segregation", waste, "Separación por tipo con recipientes identificados", "major"),
    checkItem("waste_spills", waste, "Sin derrames ni manchas en el suelo", "major"),
    checkItem("services_toilets", services, "Sanitarios limpios y habilitados", "major"),
    checkItem("services_water", services, "Agua potable disponible", "major"),
    checkItem("services_firstaid", services, "Botiquín completo y vigente", "major"),
    checkItem("emergency_plan", emergency, "Plan de emergencia y punto de encuentro visibles", "major"),
    checkItem("emergency_lighting", emergency, "Iluminación suficiente en circulaciones y áreas de trabajo", "minor"),
  ],
};
