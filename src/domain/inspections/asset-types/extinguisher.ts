import { z } from "zod";
import { normalizeKey, parseDateCell } from "@/domain/masterdata/roster";
import { isIsoDate } from "../dates";
import type { AssetTypeDef, CsvAttributeColumn, DueKindSpec } from "./index";

export const EXTINGUISHER_AGENTS = {
  abc: "Polvo ABC",
  bc: "Polvo BC",
  co2: "CO₂",
  foam_afff: "Espuma AFFF",
  hcfc: "HCFC / halotrón",
  water: "Agua",
  class_k: "Clase K",
} as const;
export type ExtinguisherAgent = keyof typeof EXTINGUISHER_AGENTS;

export const EXTINGUISHER_INSTALLED_IN = { fixed: "Puesto fijo", vehicle: "Vehículo" } as const;

const isoDate = z.string().refine(isIsoDate, "Fecha inválida: usá AAAA-MM-DD");

/** Atributos del extintor. La fecha de fabricación es obligatoria (IRAM 3517-2 §9.11). */
export const extinguisherAttributes = z.object({
  agent: z.enum(Object.keys(EXTINGUISHER_AGENTS) as [ExtinguisherAgent, ...ExtinguisherAgent[]], {
    error: "Elegí el agente extintor",
  }),
  capacityKg: z.number({ error: "Indicá la capacidad en kg" }).positive("La capacidad debe ser mayor que cero").max(500, "La capacidad parece demasiado alta"),
  manufacturedAt: isoDate,
  cylinderNumber: z.string().trim().max(60).optional(),
  rechargeCompany: z.string().trim().max(120).optional(),
  installedIn: z.enum(["fixed", "vehicle"]).default("fixed"),
  hoseWithValve: z.boolean().default(false),
  onWheels: z.boolean().default(false),
});
export type ExtinguisherAttributes = z.infer<typeof extinguisherAttributes>;

const POWDER: ExtinguisherAgent[] = ["abc", "bc"];

/**
 * Vencimientos del extintor (IRAM 3517-2): mantenimiento anual (semestral para polvo en vehículos),
 * prueba hidráulica cada 5 años (2 si es de agua) y prueba de manguera anual para CO₂ o con válvula de control.
 * El mantenimiento vencido se trata como no conformidad mayor y la prueba hidráulica vencida como crítica.
 */
function dueKinds(raw: Record<string, unknown>): DueKindSpec[] {
  const a = raw as Partial<ExtinguisherAttributes>;
  const specs: DueKindSpec[] = [
    {
      kind: "maintenance",
      label: "Mantenimiento",
      intervalMonths: POWDER.includes(a.agent as ExtinguisherAgent) && a.installedIn === "vehicle" ? 6 : 12,
      leadDays: 15,
      blocking: false,
      required: true,
    },
    {
      kind: "hydrostatic_test",
      label: "Prueba hidráulica",
      intervalMonths: a.agent === "water" ? 24 : 60,
      leadDays: 30,
      blocking: true,
      required: false,
      defaultFromManufacture: true,
    },
  ];
  if (a.agent === "co2" || a.hoseWithValve) {
    specs.push({ kind: "hose_test", label: "Prueba de manguera", intervalMonths: 12, leadDays: 30, blocking: false, required: false });
  }
  return specs;
}

export function yesNo(raw: string): { ok: true; value: boolean } | { ok: false; message: string } {
  const k = normalizeKey(raw);
  if (["si", "s", "true", "1", "x"].includes(k)) return { ok: true, value: true };
  if (["", "no", "n", "false", "0"].includes(k)) return { ok: true, value: false };
  return { ok: false, message: "Usá «sí» o «no»" };
}

const csvAttributes: CsvAttributeColumn[] = [
  {
    header: "agente",
    key: "agent",
    label: "Agente",
    parse: (raw) => {
      const k = normalizeKey(raw);
      const found = (Object.entries(EXTINGUISHER_AGENTS) as [ExtinguisherAgent, string][]).find(
        ([key, label]) => normalizeKey(key) === k || normalizeKey(label) === k || normalizeKey(label.replace("Polvo ", "")) === k,
      );
      return found ? { ok: true, value: found[0] } : { ok: false, message: `Agente desconocido. Usá: ${Object.values(EXTINGUISHER_AGENTS).join(", ")}` };
    },
  },
  {
    header: "capacidad_kg",
    key: "capacityKg",
    label: "Capacidad (kg)",
    parse: (raw) => {
      const n = Number(raw.replace(",", ".").trim());
      return raw.trim() !== "" && Number.isFinite(n) ? { ok: true, value: n } : { ok: false, message: "Indicá un número (ej.: 5 o 2,5)" };
    },
  },
  {
    header: "fabricacion",
    key: "manufacturedAt",
    label: "Fabricación",
    parse: (raw) => {
      const iso = parseDateCell(raw);
      return iso ? { ok: true, value: iso } : { ok: false, message: "Fecha inválida: usá AAAA-MM-DD o DD/MM/AAAA" };
    },
  },
  { header: "cilindro", key: "cylinderNumber", label: "N.º de cilindro", parse: (raw) => ({ ok: true, value: raw.trim() || undefined }) },
  { header: "recargadora", key: "rechargeCompany", label: "Empresa recargadora", parse: (raw) => ({ ok: true, value: raw.trim() || undefined }) },
  {
    header: "instalado_en",
    key: "installedIn",
    label: "Instalado en",
    parse: (raw) => {
      const k = normalizeKey(raw);
      if (k === "" || k.startsWith("puesto") || k === "fijo") return { ok: true, value: "fixed" };
      if (k.startsWith("vehic")) return { ok: true, value: "vehicle" };
      return { ok: false, message: "Usá «puesto fijo» o «vehículo»" };
    },
  },
  { header: "manguera_valvula", key: "hoseWithValve", label: "Manguera con válvula", parse: yesNo },
  { header: "sobre_ruedas", key: "onWheels", label: "Sobre ruedas", parse: yesNo },
];

export const EXTINGUISHER_TYPE = {
  key: "extinguisher",
  label: "Extintor",
  plural: "Extintores",
  schemaVersion: 1,
  attributesSchema: extinguisherAttributes as unknown as AssetTypeDef["attributesSchema"],
  dueKinds,
  dueKindLabels: { maintenance: "Mantenimiento", hydrostatic_test: "Prueba hidráulica", hose_test: "Prueba de manguera" },
  periodicTemplateKey: "extinguisher_periodic",
  summarize: (raw) => {
    const a = raw as Partial<ExtinguisherAttributes>;
    return [a.agent ? EXTINGUISHER_AGENTS[a.agent] : null, a.capacityKg ? `${String(a.capacityKg).replace(".", ",")} kg` : null].filter(Boolean).join(" · ");
  },
  fields: [
    { key: "agent", label: "Agente", type: "select", required: true, options: Object.entries(EXTINGUISHER_AGENTS).map(([value, label]) => ({ value, label })) },
    { key: "capacityKg", label: "Capacidad (kg)", type: "number", required: true, min: 0.5, step: 0.5 },
    { key: "manufacturedAt", label: "Fecha de fabricación", type: "date", required: true, hint: "Está grabada en el cilindro (IRAM 3517-2)." },
    { key: "cylinderNumber", label: "N.º de cilindro", type: "text", required: false },
    { key: "rechargeCompany", label: "Empresa recargadora", type: "text", required: false },
    {
      key: "installedIn",
      label: "Instalado en",
      type: "select",
      required: true,
      options: Object.entries(EXTINGUISHER_INSTALLED_IN).map(([value, label]) => ({ value, label })),
    },
    { key: "hoseWithValve", label: "Manguera con válvula de control", type: "boolean", required: false },
    { key: "onWheels", label: "Está sobre ruedas", type: "boolean", required: false },
  ],
  csvAttributes,
  csvDueDates: [
    { header: "ultimo_mantenimiento", kind: "maintenance", mode: "last", label: "Último mantenimiento" },
    { header: "vence_mantenimiento", kind: "maintenance", mode: "due", label: "Vence el mantenimiento" },
    { header: "ultima_prueba_hidraulica", kind: "hydrostatic_test", mode: "last", label: "Última prueba hidráulica" },
    { header: "vence_prueba_hidraulica", kind: "hydrostatic_test", mode: "due", label: "Vence la prueba hidráulica" },
    { header: "ultima_prueba_manguera", kind: "hose_test", mode: "last", label: "Última prueba de manguera" },
    { header: "vence_prueba_manguera", kind: "hose_test", mode: "due", label: "Vence la prueba de manguera" },
  ],
} as const satisfies AssetTypeDef;
