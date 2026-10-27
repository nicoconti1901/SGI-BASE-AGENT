import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";

/** Sesión, empresa y permisos de Inspecciones y Activos. El layout del tenant ya garantizó la lectura. */
export async function loadInspectionsAccess(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  const can = (action: AuthzAction) => canTenantRole(membership?.role, action, { isPlatformSuperuser: ctx.isPlatformSuperuser });
  return {
    ctx,
    tenant,
    role: membership?.role ?? null,
    canWrite: can("write"),
    canManageAssets: can("manage_assets"),
    canImportAssets: can("import_assets"),
    canRelease: can("release_assets"),
    canManageTemplates: can("manage_inspection_templates"),
    // Plantillas: lectura para quien registra inspecciones; «Consulta» no las ve (SPEC, Permisos).
    canViewTemplates: can("write"),
  };
}

/**
 * Activos es una pestaña de Inspecciones y también lo usará Equipos de medición: la ruta existe si cualquiera
 * de los dos módulos está activo. Un módulo apagado responde 404.
 */
export async function requireAssetsModuleForSlug(slug: string): Promise<void> {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const enabled = await getEnabledModulesCached(tenant.id);
  if (!enabled.has("inspections") && !enabled.has("instruments")) notFound();
}
