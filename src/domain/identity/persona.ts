import type { TenantRole } from "@prisma/client";
import { canTenantRole, labelTenantRole } from "@/domain/identity/authz";

/**
 * Quién está usando la app, en términos que el usuario entiende sin deducir:
 * - superuser: opera la plataforma y todas las empresas.
 * - company_admin: administrador general de una empresa.
 * - member: integrante de una empresa (responsable, colaborador o consulta).
 */
export type Persona = "superuser" | "company_admin" | "member";

export const PERSONA_LABELS: Record<Persona, string> = {
  superuser: "Superusuario",
  company_admin: "Administrador de la empresa",
  member: "Integrante de la empresa",
};

export function resolvePersona(input: {
  isPlatformSuperuser: boolean;
  tenantRole: TenantRole | null | undefined;
}): Persona {
  if (input.isPlatformSuperuser) return "superuser";
  if (input.tenantRole === "tenant_admin") return "company_admin";
  return "member";
}

/** Rol concreto a mostrar junto a la persona (ej. "Colaborador"). */
export function personaRoleLabel(input: {
  isPlatformSuperuser: boolean;
  tenantRole: TenantRole | null | undefined;
}): string {
  if (input.isPlatformSuperuser) return "Acceso total";
  return labelTenantRole(input.tenantRole);
}

/**
 * Lista corta de lo que el usuario puede hacer, para mostrarla siempre
 * visible en vez de que la descubra probando botones.
 */
export function describeCapabilities(input: {
  isPlatformSuperuser: boolean;
  tenantRole: TenantRole | null | undefined;
}): { canEdit: boolean; items: string[] } {
  const opts = { isPlatformSuperuser: input.isPlatformSuperuser };
  const role = input.tenantRole;
  const canEdit = canTenantRole(role, "write", opts);
  const items = ["Ver"];
  if (canEdit) items.push("Crear y editar");
  if (canTenantRole(role, "delete", opts)) items.push("Eliminar");
  if (canTenantRole(role, "invite_users", opts)) items.push("Gestionar usuarios");
  return { canEdit, items };
}

/**
 * Destino natural después de iniciar sesión.
 * El superusuario va a la plataforma; un integrante, directo a su empresa.
 */
export function resolveHomePath(input: {
  isPlatformSuperuser: boolean;
  tenantSlugs: string[];
}): string | null {
  if (input.isPlatformSuperuser) return "/platform";
  const [first] = input.tenantSlugs;
  return first ? `/t/${first}` : null;
}
