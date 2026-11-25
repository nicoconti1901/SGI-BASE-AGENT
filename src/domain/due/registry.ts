/**
 * Única fuente de los tipos de vencimiento (`DueItem.entityType`): de qué módulo es cada uno, cómo se llama
 * y dónde se resuelve. Crear un vencimiento de un tipo que no esté acá no compila.
 */
import type { ModuleKey } from "@/domain/modules/catalog";

/** Ids del registro padre cuando el destino no se arma solo con `entityId` (los resuelve `lib/dashboard.ts`). */
export type DueParentRef = {
  objectiveId?: string;
  findingId?: string;
  assetId?: string | null;
  supplierId?: string;
};

export type DueTypeDefinition = {
  module: ModuleKey;
  label: string;
  /** Ruta relativa a `/t/[slug]`. Sin id o sin padre cae en el listado del módulo. */
  path: (id: string | null, parent: DueParentRef) => string;
};

const detail = (base: string, id: string | null | undefined) => (id ? `${base}/${id}` : base);

/** Para `entityId` que termina en el mes ("2026-09" o "<sede>:2026-09"). */
const monthly = (base: string, id: string | null) => (id ? `${base}?mes=${id.slice(id.lastIndexOf(":") + 1)}` : base);

export const DUE_REGISTRY = {
  document_validity: { module: "documents", label: "Vigencia de documento", path: () => "documents" },
  audit_start: { module: "audits", label: "Inicio de auditoría", path: (id) => detail("audits", id) },
  audit_report: { module: "audits", label: "Informe de auditoría", path: (id) => detail("audits", id) },
  audit_external_response: { module: "audits", label: "Respuesta a auditoría externa", path: (id) => detail("audits", id) },
  finding_verification: { module: "findings", label: "Verificación de hallazgo", path: (id) => detail("findings", id) },
  finding_measure: { module: "findings", label: "Medida de hallazgo", path: (_id, p) => detail("findings", p.findingId) },
  risk: { module: "risks", label: "Riesgo", path: (id) => detail("risks", id) },
  opportunity: { module: "risks", label: "Oportunidad", path: (id) => (id ? `risks/opportunities/${id}` : "risks") },
  operational_action: { module: "risks", label: "Acción", path: () => "risks" },
  indicator_measurement: {
    module: "indicators",
    label: "Carga de indicador",
    path: (id, p) => (id && p.objectiveId ? `indicators/${p.objectiveId}/${id}` : "indicators"),
  },
  inspection_plan: { module: "inspections", label: "Inspección programada", path: (_id, p) => (p.assetId ? `assets/${p.assetId}` : "inspections") },
  asset_due_date: { module: "inspections", label: "Vencimiento de activo", path: (_id, p) => (p.assetId ? `assets/${p.assetId}` : "inspections") },
  instrument_calibration: { module: "instruments", label: "Calibración", path: (id) => detail("instruments", id) },
  instrument_verification: { module: "instruments", label: "Verificación de equipo", path: (id) => detail("instruments", id) },
  instrument_impact: { module: "instruments", label: "Evaluación de impacto", path: (_id, p) => detail("instruments", p.assetId) },
  incident_followup: { module: "safety_stats", label: "Seguimiento de accidente", path: (id) => (id ? `findings/${id}` : "safety") },
  exposure_period: { module: "safety_stats", label: "Horas trabajadas", path: (id) => monthly("safety/exposure", id) },
  road_km_period: { module: "road_safety", label: "Kilómetros de la flota", path: (id) => monthly("road-safety/km", id) },
  driver_license: { module: "road_safety", label: "Licencia de conducir", path: () => "road-safety/conductores" },
  training_person: { module: "training", label: "Capacitación pendiente", path: (id) => (id ? `training/people/${id}` : "training") },
  training_session_effectiveness: {
    module: "training",
    label: "Eficacia de capacitación",
    path: (id) => (id ? `training/effectiveness/session/${id}` : "training/effectiveness"),
  },
  training_record_effectiveness: {
    module: "training",
    label: "Eficacia de capacitación",
    path: (id) => (id ? `training/effectiveness/record/${id}` : "training/effectiveness"),
  },
  supplier_evaluation: { module: "suppliers", label: "Evaluación de proveedor", path: (id) => detail("suppliers", id) },
  supplier_document: { module: "suppliers", label: "Documento de proveedor", path: (_id, p) => detail("suppliers", p.supplierId) },
  /** Cargado a mano desde la plataforma, sin registro de origen. */
  manual: { module: "automations", label: "Vencimiento", path: () => "automations" },
} as const satisfies Record<string, DueTypeDefinition>;

export type DueEntityType = keyof typeof DUE_REGISTRY;

/** Definición de un `entityType` leído de la base; los tipos viejos o desconocidos no tienen. */
export function dueDefinition(entityType: string): DueTypeDefinition | undefined {
  return Object.hasOwn(DUE_REGISTRY, entityType) ? DUE_REGISTRY[entityType as DueEntityType] : undefined;
}

export function dueTypesOf(module: ModuleKey): DueEntityType[] {
  return (Object.keys(DUE_REGISTRY) as DueEntityType[]).filter((type) => DUE_REGISTRY[type].module === module);
}
