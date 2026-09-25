import type { TenantRole } from "@prisma/client";

export type AuthzAction =
  | "read"
  | "write"
  | "invite_users"
  | "manage_roles"
  | "delete";

/**
 * Política documentada (Task 6):
 * - Consulta: solo lectura
 * - Colaborador: lectura + escritura (sin invite/roles/delete)
 * - Responsable de proceso: igual que colaborador + delete de entidades de negocio
 * - Administrador de la organización: invite, manage_roles, write, delete
 * - Administrador de plataforma: todo
 */
const ROLE_PERMISSIONS: Record<TenantRole, AuthzAction[]> = {
  viewer: ["read"],
  contributor: ["read", "write"],
  process_owner: ["read", "write", "delete"],
  tenant_admin: ["read", "write", "delete", "invite_users", "manage_roles"],
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
