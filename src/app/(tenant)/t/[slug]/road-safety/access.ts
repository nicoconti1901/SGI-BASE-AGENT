import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canManageRoadSafety, canReportRoadEvent } from "@/domain/road-safety/access";
import type { RoadUser } from "@/lib/road-safety";

/** Sesión, empresa y permisos de seguridad vial. El layout ya verificó que el módulo esté activo. */
export async function loadRoadAccess(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  const actor: RoadUser = { userId: ctx.userId, role: membership?.role, isPlatformSuperuser: ctx.isPlatformSuperuser };
  return { ctx, tenant, actor, canReport: canReportRoadEvent(actor), canManage: canManageRoadSafety(actor) };
}
