import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canManageHealthData, canReportIncident, type SafetyActor } from "@/domain/safety-stats/access";

/** Sesión, empresa y permisos de accidentabilidad. El layout ya verificó que el módulo esté activo. */
export async function loadSafetyAccess(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  const actor: SafetyActor & { userId: string } = { userId: ctx.userId, role: membership?.role, isPlatformSuperuser: ctx.isPlatformSuperuser };
  return {
    ctx,
    tenant,
    actor,
    canReport: canReportIncident(actor),
    canManage: canManageHealthData(actor),
  };
}
