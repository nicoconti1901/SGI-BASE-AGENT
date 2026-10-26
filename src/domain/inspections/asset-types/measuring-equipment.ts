import { INSTRUMENT_TYPE_KEY, FUNCTIONAL_CHECK_TEMPLATE_KEY } from "@/domain/calibration/types";
import { instrumentAttributesSchema } from "@/domain/calibration/config";
import type { AssetTypeDef } from "./index";

/**
 * Equipo de medición (Task 16) visto por el motor de inspecciones, solo para la prueba funcional. No está en el
 * registro `ASSET_TYPES`: no se da de alta, no se importa ni se lista en Activos; vive en el módulo Equipos de medición.
 */
export const MEASURING_EQUIPMENT_TYPE: AssetTypeDef = {
  key: INSTRUMENT_TYPE_KEY,
  label: "Equipo de medición",
  plural: "Equipos de medición",
  schemaVersion: 1,
  attributesSchema: instrumentAttributesSchema as unknown as AssetTypeDef["attributesSchema"],
  // Los vencimientos de calibración los lleva el módulo de equipos, no los vencimientos documentales del activo.
  dueKinds: () => [],
  dueKindLabels: {},
  periodicTemplateKey: FUNCTIONAL_CHECK_TEMPLATE_KEY,
  summarize: (attributes) => [attributes.brand, attributes.model].filter(Boolean).join(" ") || "Sin marca ni modelo",
  fields: [],
  csvAttributes: [],
  csvDueDates: [],
};
