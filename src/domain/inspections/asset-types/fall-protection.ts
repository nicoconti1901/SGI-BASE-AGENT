import { z } from "zod";
import { normalizeKey, parseDateCell } from "@/domain/masterdata/roster";
import { isIsoDate } from "../dates";
import type { AssetTypeDef, CsvAttributeColumn, DueKindSpec } from "./index";

export const FALL_PROTECTION_KINDS = {
  harness: "Arnés de cuerpo completo",
  lanyard_single: "Cabo simple con absorbedor",
  lanyard_double: "Cabo doble con absorbedor",
  positioning_lanyard: "Cabo de posicionamiento",
  retractable: "Retráctil",
  carabiner: "Mosquetón",
} as const;
export type FallProtectionKind = keyof typeof FALL_PROTECTION_KINDS;

/** Vida útil sugerida mientras la empresa no cargue la del fabricante (SPEC, decisión 9: inicial 5 años, a validar). */
export const DEFAULT_SERVICE_LIFE_YEARS = 5;

const isoDate = z.string().refine(isIsoDate, "Fecha inválida: usá AAAA-MM-DD");

/** Atributos de un arnés o cabo de vida: la serie y la fecha de fabricación son obligatorias (Res. SRT 61/2023). */
export const fallProtectionAttributes = z.object({
  kind: z.enum(Object.keys(FALL_PROTECTION_KINDS) as [FallProtectionKind, ...FallProtectionKind[]], {
    error: "Elegí el tipo de equipo",
  }),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  serialNumber: z.string({ error: "Indicá el n.º de serie" }).trim().min(1, "Indicá el n.º de serie").max(80),
  certificationStandard: z.string().trim().max(80).optional(),
  manufacturedAt: isoDate,
  serviceLifeYears: z
    .number({ error: "Indicá los años de vida útil" })
    .int("Indicá años enteros")
    .min(1, "Al menos 1 año")
    .max(20, "La vida útil parece demasiado larga")
    .default(DEFAULT_SERVICE_LIFE_YEARS),
});
export type FallProtectionAttributes = z.infer<typeof fallProtectionAttributes>;

/**
 * El único vencimiento del equipo es el fin de su vida útil: fabricación + años (o la fecha que indique el fabricante).
 * Vencida, el equipo no se puede declarar apto: la plantilla la toma como no conformidad crítica y se pide la baja.
 */
function dueKinds(raw: Record<string, unknown>): DueKindSpec[] {
  const years = typeof raw.serviceLifeYears === "number" && raw.serviceLifeYears > 0 ? raw.serviceLifeYears : DEFAULT_SERVICE_LIFE_YEARS;
  return [
    {
      kind: "service_life_end",
      label: "Fin de la vida útil",
      intervalMonths: years * 12,
      leadDays: 30,
      blocking: true,
      required: true,
      defaultFromManufacture: true,
    },
  ];
}

const csvAttributes: CsvAttributeColumn[] = [
  {
    header: "tipo_equipo",
    key: "kind",
    label: "Tipo de equipo",
    parse: (raw) => {
      const k = normalizeKey(raw);
      const found = (Object.entries(FALL_PROTECTION_KINDS) as [FallProtectionKind, string][]).find(
        ([key, label]) => normalizeKey(key) === k || normalizeKey(label) === k,
      );
      return found ? { ok: true, value: found[0] } : { ok: false, message: `Tipo desconocido. Usá: ${Object.values(FALL_PROTECTION_KINDS).join(", ")}` };
    },
  },
  { header: "marca", key: "brand", label: "Marca", parse: (raw) => ({ ok: true, value: raw.trim() || undefined }) },
  { header: "modelo", key: "model", label: "Modelo", parse: (raw) => ({ ok: true, value: raw.trim() || undefined }) },
  { header: "serie", key: "serialNumber", label: "N.º de serie", parse: (raw) => ({ ok: true, value: raw.trim() }) },
  { header: "norma", key: "certificationStandard", label: "Norma de certificación", parse: (raw) => ({ ok: true, value: raw.trim() || undefined }) },
  {
    header: "fabricacion",
    key: "manufacturedAt",
    label: "Fabricación",
    parse: (raw) => {
      const iso = parseDateCell(raw);
      return iso ? { ok: true, value: iso } : { ok: false, message: "Fecha inválida: usá AAAA-MM-DD o DD/MM/AAAA" };
    },
  },
  {
    header: "vida_util_anios",
    key: "serviceLifeYears",
    label: "Vida útil (años)",
    parse: (raw) => {
      if (raw.trim() === "") return { ok: true, value: DEFAULT_SERVICE_LIFE_YEARS };
      const n = Number(raw.replace(",", ".").trim());
      return Number.isInteger(n) ? { ok: true, value: n } : { ok: false, message: "Indicá años enteros (ej.: 5)" };
    },
  },
];

export const FALL_PROTECTION_TYPE = {
  key: "fall_protection",
  label: "Arnés / cabo de vida",
  plural: "Arneses y cabos de vida",
  schemaVersion: 1,
  attributesSchema: fallProtectionAttributes as unknown as AssetTypeDef["attributesSchema"],
  dueKinds,
  dueKindLabels: { service_life_end: "Fin de la vida útil" },
  periodicTemplateKey: "fall_protection_periodic",
  summarize: (raw) => {
    const a = raw as Partial<FallProtectionAttributes>;
    return [a.kind ? FALL_PROTECTION_KINDS[a.kind] : null, a.serialNumber ? `serie ${a.serialNumber}` : null].filter(Boolean).join(" · ");
  },
  fields: [
    { key: "kind", label: "Tipo de equipo", type: "select", required: true, options: Object.entries(FALL_PROTECTION_KINDS).map(([value, label]) => ({ value, label })) },
    { key: "brand", label: "Marca", type: "text", required: false },
    { key: "model", label: "Modelo", type: "text", required: false },
    { key: "serialNumber", label: "N.º de serie", type: "text", required: true, hint: "Está en la etiqueta del equipo." },
    { key: "certificationStandard", label: "Norma de certificación", type: "text", required: false, hint: "Ej.: IRAM 3622-1 o EN 361." },
    { key: "manufacturedAt", label: "Fecha de fabricación", type: "date", required: true, hint: "Figura en la etiqueta." },
    {
      key: "serviceLifeYears",
      label: "Años de vida útil",
      type: "number",
      required: true,
      min: 1,
      step: 1,
      initial: DEFAULT_SERVICE_LIFE_YEARS,
      hint: `Manda lo que indique el fabricante. Si no lo sabés, ${DEFAULT_SERVICE_LIFE_YEARS} años es un valor de partida.`,
    },
  ],
  csvAttributes,
  csvDueDates: [{ header: "vence_vida_util", kind: "service_life_end", mode: "due", label: "Fin de la vida útil (si el fabricante indica otra fecha)" }],
} as const satisfies AssetTypeDef;
