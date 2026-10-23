import type { TenantRole } from "@prisma/client";

export type AuthzAction =
  | "read"
  | "write"
  | "invite_users"
  | "manage_roles"
  | "delete"
  | "plan_audits"
  | "approve_audit_program"
  | "verify_findings"
  | "cancel_findings"
  | "manage_objectives"
  | "manage_master_data"
  | "assign_job_tasks"
  | "manage_safety_stats"
  | "manage_suppliers"
  | "evaluate_suppliers"
  | "manage_supplier_criteria"
  | "upload_supplier_documents"
  | "manage_training"
  | "record_training"
  | "manage_assets"
  | "import_assets"
  | "manage_inspection_templates"
  | "release_assets"
  | "manage_calibration";

/**
 * Política documentada (Task 6):
 * - Consulta: solo lectura
 * - Colaborador: lectura + escritura (sin invite/roles/delete)
 * - Responsable de proceso: igual que colaborador + delete de entidades de negocio
 * - Administrador de la organización: invite, manage_roles, write, delete
 * - Administrador de plataforma: todo
 * - Hallazgos (SPEC-findings-lifecycle): verifica eficacia admin o responsable de proceso; anula y reabre solo el admin
 * - Objetivos e indicadores (SPEC-indicators): crean y editan admin y responsable de proceso;
 *   cargan valores además el responsable de cada indicador (se controla en la acción)
 * - Datos maestros (SPEC-master-data): sedes, puestos, personas e importación solo el admin;
 *   asignar tareas a personas también el responsable de proceso
 * - Auditorías (SPEC-audits): planifica admin o responsable de proceso; aprueba el programa solo el admin
 * - Accidentabilidad (SPEC-accident-stats): completa la ficha de salud, reclasifica y carga exposición
 *   el admin y el responsable de proceso. Dar de alta el hecho es `write`; leer la ficha la puede todo
 *   integrante de la empresa (decisión del PO, D10), pero no el superusuario de plataforma (D13)
 * - Proveedores (SPEC-suppliers): alta, edición y evaluación admin y responsable de proceso; criterios y tipos
 *   de documento solo el admin; cargar documentos también el colaborador
 * - Capacitaciones (SPEC-training): cursos, matriz y anulaciones (`manage_training`) admin y responsable de
 *   proceso; registrar sesiones y registros (`record_training`) además el colaborador
 * - Inspecciones (SPEC-inspections): activos (alta, edición, baja) y liberar un activo, admin y responsable de proceso;
 *   importar activos y editar plantillas, solo el admin. Registrar inspecciones usa «write».
 * - Equipos de medición (SPEC-calibration): configurar el equipo (regla, EMP, intervalos), anular registros y completar
 *   evaluaciones de impacto (`manage_calibration`) admin y responsable de proceso. Cargar calibraciones usa «write».
 */
const ROLE_PERMISSIONS: Record<TenantRole, AuthzAction[]> = {
  viewer: ["read"],
  contributor: ["read", "write", "upload_supplier_documents", "record_training"],
  process_owner: [
    "read",
    "write",
    "delete",
    "plan_audits",
    "verify_findings",
    "manage_objectives",
    "assign_job_tasks",
    "manage_safety_stats",
    "manage_suppliers",
    "evaluate_suppliers",
    "upload_supplier_documents",
    "manage_training",
    "record_training",
    "manage_assets",
    "release_assets",
    "manage_calibration",
  ],
  tenant_admin: [
    "read",
    "write",
    "delete",
    "invite_users",
    "manage_roles",
    "plan_audits",
    "approve_audit_program",
    "verify_findings",
    "cancel_findings",
    "manage_objectives",
    "manage_master_data",
    "assign_job_tasks",
    "manage_safety_stats",
    "manage_suppliers",
    "evaluate_suppliers",
    "manage_supplier_criteria",
    "upload_supplier_documents",
    "manage_training",
    "record_training",
    "manage_assets",
    "import_assets",
    "manage_inspection_templates",
    "release_assets",
    "manage_calibration",
  ],
};

/** Etiquetas profesionales en español (UI). Los valores técnicos siguen en inglés en DB. */
export const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  tenant_admin: "Administrador de la organización",
  process_owner: "Responsable de proceso",
  contributor: "Colaborador",
  viewer: "Consulta",
};

export const TENANT_ROLE_DESCRIPTIONS: Record<TenantRole, string> = {
  tenant_admin:
    "Gestiona usuarios, roles y la configuración del SGI de la empresa.",
  process_owner: "Lidera procesos y puede eliminar registros operativos.",
  contributor: "Carga y actualiza información del sistema de gestión.",
  viewer: "Solo lectura: visualiza información sin modificarla.",
};

export const PLATFORM_ROLE_LABEL = "Administrador de plataforma";

export function labelTenantRole(role: TenantRole | null | undefined): string {
  if (!role) return "Sin rol";
  return TENANT_ROLE_LABELS[role];
}

export function labelPlatformOrTenantRole(input: {
  isPlatformSuperuser?: boolean;
  tenantRole?: TenantRole | null;
}): string {
  if (input.isPlatformSuperuser) {
    return PLATFORM_ROLE_LABEL;
  }
  return labelTenantRole(input.tenantRole);
}

export function canTenantRole(
  role: TenantRole | null | undefined,
  action: AuthzAction,
  options?: { isPlatformSuperuser?: boolean },
): boolean {
  if (options?.isPlatformSuperuser) {
    return true;
  }
  if (!role) {
    return false;
  }
  return ROLE_PERMISSIONS[role].includes(action);
}

export function assertCanTenantRole(
  role: TenantRole | null | undefined,
  action: AuthzAction,
  options?: { isPlatformSuperuser?: boolean },
): void {
  if (!canTenantRole(role, action, options)) {
    throw new Error(`Permiso denegado para acción: ${action}`);
  }
}

export const TENANT_ROLE_OPTIONS: TenantRole[] = [
  "tenant_admin",
  "process_owner",
  "contributor",
  "viewer",
];
