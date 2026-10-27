import { z } from "zod";
import { yesNo } from "./extinguisher";
import type { AssetTypeDef, CsvAttributeColumn, DueKindSpec } from "./index";

/** Clave del tipo y de sus dos plantillas: el control previo (conductor) y el mensual (SST). */
export const LIGHT_VEHICLE_KEY = "light_vehicle";
export const LIGHT_PRE_USE_KEY = "light_pre_use";
export const LIGHT_PERIODIC_KEY = "light_periodic";

const MIN_YEAR = 1950;

/** El dominio se guarda en mayúsculas y sin espacios ni guiones (ABC123, AB123CD). */
export function normalizePlate(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
}

const plate = z
  .string({ error: "Indicá el dominio" })
  .transform(normalizePlate)
  .refine((v) => /^[A-Z0-9]{5,8}$/.test(v), "El dominio debe tener entre 5 y 8 letras o números (ej.: AB123CD)");

/** Atributos de un vehículo liviano. Propiedad y conductor viven en el activo (`ownership`, `assignedPersonId`). */
export const lightVehicleAttributes = z.object({
  plate,
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  year: z
    .number({ error: "Indicá un año válido" })
    .int("Indicá un año válido")
    .min(MIN_YEAR, "Año demasiado antiguo")
    .max(new Date().getFullYear() + 1, "El año no puede ser futuro")
    .optional(),
  initialOdometerKm: z.number({ error: "Indicá los km" }).int("Indicá km enteros").min(0, "No puede ser negativo").max(5_000_000, "El valor parece demasiado alto").optional(),
  hasRollbar: z.boolean().default(false),
  hasSatelliteMonitoring: z.boolean().default(false),
});
export type LightVehicleAttributes = z.infer<typeof lightVehicleAttributes>;

/**
 * Vencimientos documentales del vehículo (SPEC, anexo): seguro, RTO y service son obligatorios porque la inspección mensual
 * los toma como ítems automáticos; el monitoreo satelital solo se pide si el vehículo lo tiene. Seguro y RTO vencidos
 * impiden el uso (Ley 24.449 arts. 34 y 40). Los intervalos son los de referencia; se pueden cargar a mano.
 */
function dueKinds(raw: Record<string, unknown>): DueKindSpec[] {
  const specs: DueKindSpec[] = [
    { kind: "insurance", label: "Seguro", intervalMonths: 12, leadDays: 30, blocking: true, required: true },
    { kind: "rto", label: "RTO (revisión técnica obligatoria)", intervalMonths: 12, leadDays: 30, blocking: true, required: true },
    { kind: "service", label: "Service", intervalMonths: 6, leadDays: 15, blocking: false, required: true },
  ];
  if (raw.hasSatelliteMonitoring === true) {
    specs.push({ kind: "satellite_monitoring", label: "Monitoreo satelital", intervalMonths: 12, leadDays: 30, blocking: false, required: true });
  }
  return specs;
}

function optionalText(raw: string) {
  return { ok: true, value: raw.trim() || undefined } as const;
}

const csvAttributes: CsvAttributeColumn[] = [
  {
    header: "dominio",
    key: "plate",
    label: "Dominio",
    parse: (raw) => {
      const value = normalizePlate(raw);
      return /^[A-Z0-9]{5,8}$/.test(value) ? { ok: true, value } : { ok: false, message: "Dominio inválido (ej.: AB123CD)" };
    },
  },
  { header: "marca", key: "brand", label: "Marca", parse: optionalText },
  { header: "modelo", key: "model", label: "Modelo", parse: optionalText },
  {
    header: "anio",
    key: "year",
    label: "Año",
    parse: (raw) => {
      if (raw.trim() === "") return { ok: true, value: undefined };
      const n = Number(raw.trim());
      return Number.isInteger(n) ? { ok: true, value: n } : { ok: false, message: "Indicá un año de cuatro cifras (ej.: 2021)" };
    },
  },
  {
    header: "odometro_inicial_km",
    key: "initialOdometerKm",
    label: "Odómetro inicial (km)",
    parse: (raw) => {
      if (raw.trim() === "") return { ok: true, value: undefined };
      const n = Number(raw.replace(/\./g, "").replace(",", ".").trim());
      return Number.isInteger(n) ? { ok: true, value: n } : { ok: false, message: "Indicá los km como número entero (ej.: 45000)" };
    },
  },
  { header: "antivuelco", key: "hasRollbar", label: "Barra o jaula antivuelco", parse: yesNo },
  { header: "monitoreo_satelital", key: "hasSatelliteMonitoring", label: "Tiene monitoreo satelital", parse: yesNo },
];

export const LIGHT_VEHICLE_TYPE = {
  key: LIGHT_VEHICLE_KEY,
  label: "Vehículo liviano",
  plural: "Vehículos livianos",
  schemaVersion: 1,
  attributesSchema: lightVehicleAttributes as unknown as AssetTypeDef["attributesSchema"],
  dueKinds,
  dueKindLabels: {
    insurance: "Seguro",
    rto: "RTO",
    service: "Service",
    satellite_monitoring: "Monitoreo satelital (si lo tiene)",
  },
  dueHelp:
    "Seguro, RTO y service son obligatorios: cargá la última fecha en que se hicieron y el sistema calcula el vencimiento, o cargá el vencimiento directamente. El monitoreo satelital solo se pide si marcaste que el vehículo lo tiene.",
  periodicTemplateKey: LIGHT_PERIODIC_KEY,
  preUseTemplateKey: LIGHT_PRE_USE_KEY,
  summarize: (raw) => {
    const a = raw as Partial<LightVehicleAttributes>;
    return [a.plate, [a.brand, a.model].filter(Boolean).join(" ") || null, a.year ? String(a.year) : null].filter(Boolean).join(" · ");
  },
  fields: [
    { key: "plate", label: "Dominio", type: "text", required: true, hint: "La patente, sin espacios. Ej.: AB123CD." },
    { key: "brand", label: "Marca", type: "text", required: false },
    { key: "model", label: "Modelo", type: "text", required: false },
    { key: "year", label: "Año", type: "number", required: false, min: MIN_YEAR, step: 1 },
    { key: "initialOdometerKm", label: "Odómetro inicial (km)", type: "number", required: false, min: 0, step: 1, hint: "Opcional. Los controles piden el odómetro y avisan si baja." },
    { key: "hasRollbar", label: "Tiene barra o jaula antivuelco", type: "boolean", required: false },
    { key: "hasSatelliteMonitoring", label: "Tiene monitoreo satelital", type: "boolean", required: false },
  ],
  csvAttributes,
  csvDueDates: [
    { header: "ultimo_seguro", kind: "insurance", mode: "last", label: "Inicio del seguro vigente" },
    { header: "vence_seguro", kind: "insurance", mode: "due", label: "Vence el seguro" },
    { header: "ultima_rto", kind: "rto", mode: "last", label: "Última RTO" },
    { header: "vence_rto", kind: "rto", mode: "due", label: "Vence la RTO" },
    { header: "ultimo_service", kind: "service", mode: "last", label: "Último service" },
    { header: "vence_service", kind: "service", mode: "due", label: "Vence el service" },
    { header: "ultimo_monitoreo", kind: "satellite_monitoring", mode: "last", label: "Último monitoreo" },
    { header: "vence_monitoreo", kind: "satellite_monitoring", mode: "due", label: "Vence el monitoreo" },
  ],
} as const satisfies AssetTypeDef;
