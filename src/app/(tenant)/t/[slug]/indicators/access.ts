import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";

/** Sesión, empresa y permisos de objetivos e indicadores. El layout ya garantizó la lectura. */
export async function loadIndicatorsAccess(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  return {
    ctx,
    tenant,
    canManage: canTenantRole(membership?.role, "manage_objectives", {
      isPlatformSuperuser: ctx.isPlatformSuperuser,
    }),
  };
}

export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("es-AR", { timeZone: "UTC" });
}
