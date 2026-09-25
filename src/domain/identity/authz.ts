import type { TenantRole } from "@prisma/client";

export type AuthzAction =
  | "read"
  | "write"
  | "invite_users"
  | "manage_roles"
  | "delete";

/**
 * Política documentada (Task 6):
 * - viewer: solo lectura
 * - contributor: lectura + escritura (sin invite/roles/delete)
 * - process_owner: igual que contributor + delete de entidades de negocio (no usuarios)
 * - tenant_admin: invite, manage_roles, write, delete (ámbito tenant)
 * - platform_superuser: todo
 */
const ROLE_PERMISSIONS: Record<TenantRole, AuthzAction[]> = {
  viewer: ["read"],
  contributor: ["read", "write"],
  process_owner: ["read", "write", "delete"],
  tenant_admin: ["read", "write", "delete", "invite_users", "manage_roles"],
};

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
