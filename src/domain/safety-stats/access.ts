import type { TenantRole } from "@prisma/client";
import { canTenantRole } from "@/domain/identity/authz";

/**
 * Quién hace qué con las fichas de accidente (SPEC-accident-stats.md § Permisos por rol).
 * Decisión del PO (D10): todos los roles de la empresa ven las fichas de salud, sin permiso aparte.
 * D13: el superusuario de plataforma no las ve ni las edita, aunque `canTenantRole` le abra todo.
 */
export type SafetyActor = { role: TenantRole | null | undefined; isPlatformSuperuser?: boolean };

/** Lee la ficha de salud: cualquier integrante de la empresa, nunca el personal de plataforma. */
export function canViewHealthData(actor: SafetyActor): boolean {
  return !actor.isPlatformSuperuser && Boolean(actor.role);
}

/** Da de alta el hecho: colaborador, responsable de proceso y administrador. */
export function canReportIncident(actor: SafetyActor): boolean {
  return canTenantRole(actor.role, "write", { isPlatformSuperuser: actor.isPlatformSuperuser });
}

/** Completa la ficha de salud, edita el hecho, actualiza días y reclasifica. */
export function canManageHealthData(actor: SafetyActor): boolean {
  return !actor.isPlatformSuperuser && canTenantRole(actor.role, "manage_safety_stats");
}
