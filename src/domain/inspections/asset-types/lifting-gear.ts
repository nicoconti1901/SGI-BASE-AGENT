import { z } from "zod";
import { normalizeKey } from "@/domain/masterdata/roster";
import type { AssetTypeDef, CsvAttributeColumn, DueKindSpec } from "./index";

export const LIFTING_GEAR_KINDS = {
  sling: "Eslinga",
  chain: "Cadena",
  wire_rope: "Cable de acero",
  shackle: "Grillete",
  hook: "Gancho",
  hoist: "Aparejo / polipasto",
  other: "Otro",
} as const;
export type LiftingGearKind = keyof typeof LIFTING_GEAR_KINDS;

/** Frecuencia de certificación mientras la empresa no cargue la suya (a validar con un profesional). */
export const DEFAULT_CERTIFICATION_MONTHS = 12;

/** Atributos de la planilla RE 03 PE 12: identificación, características y frecuencia de certificación. */
export const liftingGearAttributes = z.object({
  kind: z.enum(Object.keys(LIFTING_GEAR_KINDS) as [LiftingGearKind, ...LiftingGearKind[]], { error: "Elegí el tipo de elemento" }),
  description: z.string({ error: "Indicá el nombre o la descripción" }).trim().min(1, "Indicá el nombre o la descripción").max(120),
  brand: z.string().trim().max(80).optional(),
  capacity: z.string().trim().max(80).optional(),
  serialNumber: z.string().trim().max(80).optional(),
  certificationMonths: z
    .number({ error: "Indicá cada cuántos meses se certifica" })
    .int("Indicá meses enteros")
    .min(1, "Al menos 1 mes")
    .max(60, "La frecuencia parece demasiado larga")
    .default(DEFAULT_CERTIFICATION_MONTHS),
  certificateNumber: z.string().trim().max(80).optional(),
  certifyingBody: z.string().trim().max(120).optional(),
});
export type LiftingGearAttributes = z.infer<typeof liftingGearAttributes>;

/** El vencimiento del elemento es su certificación: vencida, no se puede usar ni declarar apto. */
function dueKinds(raw: Record<string, unknown>): DueKindSpec[] {
  const months = typeof raw.certificationMonths === "number" && raw.certificationMonths > 0 ? raw.certificationMonths : DEFAULT_CERTIFICATION_MONTHS;
  return [{ kind: "certification", label: "Certificación", intervalMonths: months, leadDays: 30, blocking: true, required: true }];
}

const text = (header: string, key: string, label: string): CsvAttributeColumn => ({
  header,
  key,
  label,
  parse: (raw) => ({ ok: true, value: raw.trim() || undefined }),
});

const csvAttributes: CsvAttributeColumn[] = [
  {
    header: "tipo",
    key: "kind",
    label: "Tipo de elemento",
    parse: (raw) => {
      const k = normalizeKey(raw);
      const found = (Object.entries(LIFTING_GEAR_KINDS) as [LiftingGearKind, string][]).find(
        ([key, label]) => normalizeKey(key) === k || normalizeKey(label) === k,
      );
      return found ? { ok: true, value: found[0] } : { ok: false, message: `Tipo desconocido. Usá: ${Object.values(LIFTING_GEAR_KINDS).join(", ")}` };
    },
  },
  { header: "descripcion", key: "description", label: "Nombre / descripción", parse: (raw) => ({ ok: true, value: raw.trim() }) },
  text("marca", "brand", "Marca"),
  text("capacidad", "capacity", "Características / rango"),
  text("serie", "serialNumber", "N.º de serie"),
  {
    header: "frecuencia_meses",
    key: "certificationMonths",
    label: "Frecuencia de certificación (meses)",
    parse: (raw) => {
      if (raw.trim() === "") return { ok: true, value: DEFAULT_CERTIFICATION_MONTHS };
      const n = Number(raw.replace(",", ".").trim());
      return Number.isInteger(n) ? { ok: true, value: n } : { ok: false, message: "Indicá meses enteros (ej.: 12)" };
    },
  },
  text("nro_certificado", "certificateNumber", "N.º de certificado"),
  text("ente", "certifyingBody", "Ente certificante"),
];

export const LIFTING_GEAR_TYPE = {
  key: "lifting_gear",
  label: "Elemento de izaje",
  plural: "Elementos de izaje",
  schemaVersion: 1,
  attributesSchema: liftingGearAttributes as unknown as AssetTypeDef["attributesSchema"],
  dueKinds,
  dueKindLabels: { certification: "Certificación" },
  periodicTemplateKey: "lifting_gear_periodic",
  dueHelp: "Cargá la fecha de la última certificación (o cuándo vence). El vencimiento se calcula con la frecuencia de certificación.",
  summarize: (raw) => {
    const a = raw as Partial<LiftingGearAttributes>;
    return [a.kind ? LIFTING_GEAR_KINDS[a.kind] : null, a.capacity || null].filter(Boolean).join(" · ");
  },
  fields: [
    { key: "kind", label: "Tipo de elemento", type: "select", required: true, options: Object.entries(LIFTING_GEAR_KINDS).map(([value, label]) => ({ value, label })) },
    { key: "description", label: "Nombre / descripción", type: "text", required: true, hint: "Ej.: Eslinga de poliéster 3 m." },
    { key: "brand", label: "Marca", type: "text", required: false },
    { key: "capacity", label: "Características / rango", type: "text", required: false, hint: "Capacidad de carga y largo, como figura en la placa." },
    { key: "serialNumber", label: "N.º de serie", type: "text", required: false },
    {
      key: "certificationMonths",
      label: "Frecuencia de certificación (meses)",
      type: "number",
      required: true,
      min: 1,
      step: 1,
      initial: DEFAULT_CERTIFICATION_MONTHS,
      hint: `Cada cuántos meses se certifica. ${DEFAULT_CERTIFICATION_MONTHS} es un valor de partida: confirmalo con el ente certificante.`,
    },
    { key: "certificateNumber", label: "N.º de certificado", type: "text", required: false },
    { key: "certifyingBody", label: "Ente certificante", type: "text", required: false },
  ],
  csvAttributes,
  csvDueDates: [
    { header: "ultima_certificacion", kind: "certification", mode: "last", label: "Última certificación" },
    { header: "vence_certificacion", kind: "certification", mode: "due", label: "Vence la certificación" },
  ],
} as const satisfies AssetTypeDef;
