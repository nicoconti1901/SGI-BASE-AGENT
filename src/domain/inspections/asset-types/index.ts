import type { z } from "zod";
import { EXTINGUISHER_TYPE } from "./extinguisher";

/** Qué vencimiento documental lleva un tipo de activo y cada cuánto se renueva. */
export type DueKindSpec = {
  kind: string;
  label: string;
  /** Meses entre una renovación y la siguiente. */
  intervalMonths: number;
  /** Días de anticipación del aviso. */
  leadDays: number;
  /** Si vence, impide usar el activo. */
  blocking: boolean;
  /** Se pide al dar de alta. Si no, solo se registra cuando se informa una fecha. */
  required: boolean;
  /** Sin dato cargado, la primera fecha se calcula desde la fecha de fabricación. */
  defaultFromManufacture?: boolean;
};

/** Columna de un CSV: encabezado, clave del atributo y cómo se lee la celda. */
export type CsvAttributeColumn = {
  header: string;
  key: string;
  label: string;
  parse: (raw: string) => { ok: true; value: unknown } | { ok: false; message: string };
};

export type CsvDueColumn = { header: string; kind: string; mode: "last" | "due"; label: string };

export type AssetTypeDef = {
  key: string;
  label: string;
  plural: string;
  schemaVersion: number;
  attributesSchema: z.ZodType<Record<string, unknown>>;
  dueKinds: (attributes: Record<string, unknown>) => DueKindSpec[];
  /** Plantilla de inspección periódica con calendario: la que genera el programa del activo. */
  periodicTemplateKey: string;
  /** Resumen de una línea para listas ("Polvo ABC · 5 kg"). */
  summarize: (attributes: Record<string, unknown>) => string;
  /** Campos del formulario de alta y de edición. */
  fields: AttributeField[];
  csvAttributes: CsvAttributeColumn[];
  csvDueDates: CsvDueColumn[];
};

export type AttributeField =
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; required: boolean; hint?: string }
  | { key: string; label: string; type: "number"; required: boolean; min?: number; step?: number; hint?: string }
  | { key: string; label: string; type: "date"; required: boolean; hint?: string }
  | { key: string; label: string; type: "text"; required: boolean; hint?: string }
  | { key: string; label: string; type: "boolean"; required: boolean; hint?: string };

/**
 * Registro de tipos de activo. Un tipo nuevo es una entrada acá (esquema de atributos, vencimientos,
 * plantilla periódica y columnas del CSV) más su plantilla en `templates/`.
 */
export const ASSET_TYPES = {
  extinguisher: EXTINGUISHER_TYPE,
} as const satisfies Record<string, AssetTypeDef>;

export type AssetTypeKey = keyof typeof ASSET_TYPES;

export const ASSET_TYPE_KEYS = Object.keys(ASSET_TYPES) as AssetTypeKey[];

export function isAssetTypeKey(value: string): value is AssetTypeKey {
  return Object.hasOwn(ASSET_TYPES, value);
}

export function getAssetType(key: string): AssetTypeDef {
  if (!isAssetTypeKey(key)) throw new Error(`Tipo de activo desconocido: ${key}`);
  return ASSET_TYPES[key];
}

export function assetTypeLabel(key: string): string {
  return isAssetTypeKey(key) ? ASSET_TYPES[key].label : key;
}
