import { z } from "zod";
import { normalizeKey } from "@/domain/masterdata/roster";
import { yesNo } from "./extinguisher";
import { normalizePlate } from "./light-vehicle";
import type { AssetTypeDef, CsvAttributeColumn, DueKindSpec } from "./index";

/** Clave del tipo y de sus dos plantillas: el control previo (operador) y el mensual (SST). */
export const HEAVY_EQUIPMENT_KEY = "heavy_equipment";
export const HEAVY_PRE_USE_KEY = "heavy_pre_use";
export const HEAVY_PERIODIC_KEY = "heavy_periodic";

export const HEAVY_EQUIPMENT_KINDS = {
  crane: "Grúa",
  hydro_crane: "Hidrogrúa",
  backhoe: "Retroexcavadora",
  loader: "Pala",
  truck: "Camión",
  forklift: "Autoelevador",
} as const;
export type HeavyEquipmentKind = keyof typeof HEAVY_EQUIPMENT_KINDS;

/** Lo que mide el equipo: la mayoría cuenta horas de trabajo; los que circulan suelen contar km. */
export const HEAVY_METER_KINDS = { hours: "Horómetro (horas)", odometer: "Odómetro (km)" } as const;
export type HeavyMeterKind = keyof typeof HEAVY_METER_KINDS;

const MIN_YEAR = 1950;
const kindKeys = Object.keys(HEAVY_EQUIPMENT_KINDS) as [HeavyEquipmentKind, ...HeavyEquipmentKind[]];
const meterKeys = Object.keys(HEAVY_METER_KINDS) as [HeavyMeterKind, ...HeavyMeterKind[]];

/**
 * Atributos de un equipo o vehículo pesado. «Circula por vía pública» y «tiene elementos de izaje» son obligatorios
 * porque deciden qué vencimientos se piden (RTO, certificación y revisión de izaje) y qué ítems aplican.
 * Propiedad y operador viven en el activo (`ownership`, `assignedPersonId`).
 */
export const heavyEquipmentAttributes = z.object({
  kind: z.enum(kindKeys, { error: "Elegí el tipo de equipo" }),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  year: z
    .number({ error: "Indicá un año válido" })
    .int("Indicá un año válido")
    .min(MIN_YEAR, "Año demasiado antiguo")
    .max(new Date().getFullYear() + 1, "El año no puede ser futuro")
    .optional(),
  plate: z
    .string()
    .transform(normalizePlate)
    .refine((v) => v === "" || /^[A-Z0-9]{5,8}$/.test(v), "El dominio debe tener entre 5 y 8 letras o números")
    .optional(),
  circulatesOnPublicRoad: z.boolean({ error: "Indicá si circula por vía pública" }),
  hasLiftingGear: z.boolean({ error: "Indicá si tiene elementos de izaje" }),
  meterKind: z.enum(meterKeys).default("hours"),
  initialMeterReading: z.number({ error: "Indicá la lectura" }).min(0, "No puede ser negativa").max(5_000_000, "El valor parece demasiado alto").optional(),
});
export type HeavyEquipmentAttributes = z.infer<typeof heavyEquipmentAttributes>;

/**
 * Vencimientos documentales (SPEC, anexo): seguro y service siempre; RTO solo si circula por vía pública (Ley 24.449 arts. 34
 * y 40); certificación anual y revisión trimestral de izaje solo con elementos de izaje (Dec. 351/79 art. 116, que pide la
 * revisión trimestral por personal especializado). Seguro, RTO y los de izaje vencidos impiden el uso.
 */
function dueKinds(raw: Record<string, unknown>): DueKindSpec[] {
  const specs: DueKindSpec[] = [
    { kind: "insurance", label: "Seguro", intervalMonths: 12, leadDays: 30, blocking: true, required: true },
    { kind: "service", label: "Service", intervalMonths: 6, leadDays: 15, blocking: false, required: true },
  ];
  if (raw.circulatesOnPublicRoad === true) {
    specs.push({ kind: "rto", label: "RTO (revisión técnica obligatoria)", intervalMonths: 12, leadDays: 30, blocking: true, required: true });
  }
  if (raw.hasLiftingGear === true) {
    specs.push(
      { kind: "lifting_certification", label: "Certificación de izaje", intervalMonths: 12, leadDays: 30, blocking: true, required: true },
      { kind: "lifting_review", label: "Revisión trimestral de izaje", intervalMonths: 3, leadDays: 15, blocking: true, required: true },
    );
  }
  return specs;
}

function optionalText(raw: string) {
  return { ok: true, value: raw.trim() || undefined } as const;
}

function findByLabel<K extends string>(raw: string, labels: Record<K, string>): K | null {
  const k = normalizeKey(raw);
  const found = (Object.entries(labels) as [K, string][]).find(([key, label]) => normalizeKey(key) === k || normalizeKey(label) === k);
  return found ? found[0] : null;
}

const csvAttributes: CsvAttributeColumn[] = [
  {
    header: "tipo_equipo",
    key: "kind",
    label: "Tipo de equipo",
    parse: (raw) => {
      const found = findByLabel(raw, HEAVY_EQUIPMENT_KINDS);
      return found ? { ok: true, value: found } : { ok: false, message: `Tipo desconocido. Usá: ${Object.values(HEAVY_EQUIPMENT_KINDS).join(", ")}` };
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
      return Number.isInteger(n) ? { ok: true, value: n } : { ok: false, message: "Indicá un año de cuatro cifras (ej.: 2019)" };
    },
  },
  { header: "dominio", key: "plate", label: "Dominio", parse: optionalText },
  { header: "circula_via_publica", key: "circulatesOnPublicRoad", label: "Circula por vía pública", parse: yesNo },
  { header: "tiene_izaje", key: "hasLiftingGear", label: "Tiene elementos de izaje", parse: yesNo },
  {
    header: "medidor",
    key: "meterKind",
    label: "Medidor",
    parse: (raw) => {
      if (raw.trim() === "") return { ok: true, value: undefined };
      const k = normalizeKey(raw);
      if (["horas", "horometro", "hs", "h"].includes(k)) return { ok: true, value: "hours" };
      if (["km", "odometro", "kilometros"].includes(k)) return { ok: true, value: "odometer" };
      return { ok: false, message: "Usá «horas» o «km»" };
    },
  },
  {
    header: "lectura_inicial",
    key: "initialMeterReading",
    label: "Lectura inicial",
    parse: (raw) => {
      if (raw.trim() === "") return { ok: true, value: undefined };
      const n = Number(raw.replace(/\./g, "").replace(",", ".").trim());
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, message: "Indicá la lectura como número (ej.: 4500)" };
    },
  },
];

export const HEAVY_EQUIPMENT_TYPE = {
  key: HEAVY_EQUIPMENT_KEY,
  label: "Equipo o vehículo pesado",
  plural: "Equipos y vehículos pesados",
  schemaVersion: 1,
  attributesSchema: heavyEquipmentAttributes as unknown as AssetTypeDef["attributesSchema"],
  dueKinds,
  dueKindLabels: {
    insurance: "Seguro",
    service: "Service",
    rto: "RTO (si circula por vía pública)",
    lifting_certification: "Certificación de izaje (si tiene izaje)",
    lifting_review: "Revisión trimestral de izaje (si tiene izaje)",
  },
  dueHelp:
    "Seguro y service son obligatorios. La RTO se pide solo si el equipo circula por vía pública, y la certificación y la revisión trimestral de izaje solo si tiene elementos de izaje: dejá vacías las que no apliquen. Cargá la última fecha en que se hicieron y el sistema calcula el vencimiento, o cargá el vencimiento directamente.",
  periodicTemplateKey: HEAVY_PERIODIC_KEY,
  preUseTemplateKey: HEAVY_PRE_USE_KEY,
  summarize: (raw) => {
    const a = raw as Partial<HeavyEquipmentAttributes>;
    return [a.kind ? HEAVY_EQUIPMENT_KINDS[a.kind] : null, [a.brand, a.model].filter(Boolean).join(" ") || null, a.year ? String(a.year) : null].filter(Boolean).join(" · ");
  },
  fields: [
    { key: "kind", label: "Tipo de equipo", type: "select", required: true, options: Object.entries(HEAVY_EQUIPMENT_KINDS).map(([value, label]) => ({ value, label })) },
    { key: "brand", label: "Marca", type: "text", required: false },
    { key: "model", label: "Modelo", type: "text", required: false },
    { key: "year", label: "Año", type: "number", required: false, min: MIN_YEAR, step: 1 },
    { key: "plate", label: "Dominio", type: "text", required: false, hint: "Solo si está patentado. Sin espacios. Ej.: AB123CD." },
    { key: "circulatesOnPublicRoad", label: "Circula por vía pública", type: "boolean", required: true, hint: "Si circula, se pide la RTO y el control previo incluye las luces." },
    { key: "hasLiftingGear", label: "Tiene elementos de izaje", type: "boolean", required: true, hint: "Grúa, hidrogrúa, aparejos o cualquier equipo que levante cargas." },
    { key: "meterKind", label: "Qué mide el equipo", type: "select", required: true, options: Object.entries(HEAVY_METER_KINDS).map(([value, label]) => ({ value, label })) },
    { key: "initialMeterReading", label: "Lectura inicial", type: "number", required: false, min: 0, step: 1, hint: "Opcional. Los controles piden la lectura y avisan si baja." },
  ],
  csvAttributes,
  csvDueDates: [
    { header: "ultimo_seguro", kind: "insurance", mode: "last", label: "Inicio del seguro vigente" },
    { header: "vence_seguro", kind: "insurance", mode: "due", label: "Vence el seguro" },
    { header: "ultimo_service", kind: "service", mode: "last", label: "Último service" },
    { header: "vence_service", kind: "service", mode: "due", label: "Vence el service" },
    { header: "ultima_rto", kind: "rto", mode: "last", label: "Última RTO" },
    { header: "vence_rto", kind: "rto", mode: "due", label: "Vence la RTO" },
    { header: "ultima_certificacion_izaje", kind: "lifting_certification", mode: "last", label: "Última certificación de izaje" },
    { header: "vence_certificacion_izaje", kind: "lifting_certification", mode: "due", label: "Vence la certificación de izaje" },
    { header: "ultima_revision_izaje", kind: "lifting_review", mode: "last", label: "Última revisión de izaje" },
    { header: "vence_revision_izaje", kind: "lifting_review", mode: "due", label: "Vence la revisión de izaje" },
  ],
} as const satisfies AssetTypeDef;
