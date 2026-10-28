import type { TenantRole } from "@prisma/client";
import { canTenantRole } from "@/domain/identity/authz";

/**
 * Quién hace qué en seguridad vial (SPEC-road-safety § Permisos por rol, D24). El superusuario de
 * plataforma no ve conductores ni gestiona km por defecto, aunque `canTenantRole` le abra todo.
 */
export type RoadActor = { role: TenantRole | null | undefined; isPlatformSuperuser?: boolean };

/** Da de alta el detalle vial de un evento: colaborador, responsable de proceso y administrador. */
export function canReportRoadEvent(actor: RoadActor): boolean {
  return !actor.isPlatformSuperuser && canTenantRole(actor.role, "write");
}

/** Ve el conductor del evento y la lista «para revisar»; carga y confirma km, reinicios y ajustes. */
export function canManageRoadSafety(actor: RoadActor): boolean {
  return !actor.isPlatformSuperuser && canTenantRole(actor.role, "manage_road_safety");
}
