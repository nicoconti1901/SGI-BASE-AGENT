import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { buildShellIdentity } from "@/components/shell/identity";
import { StatusScreen } from "@/components/shell/StatusScreen";
import { getAppSessionContext } from "@/lib/session";
import { getMembership, setActiveTenantForSession } from "@/lib/identity";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getEnabledModulesCached } from "@/lib/modules";
import { trailIndex } from "@/domain/modules/hub";
import { canTenantRole } from "@/domain/identity/authz";

export default async function TenantLayout({
  children,
  params,
}: LayoutProps<"/t/[slug]">) {
  const { slug } = await params;
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const membership = await getMembership(ctx.userId, tenant.id);
  if (!membership && !ctx.isPlatformSuperuser) {
    return (
      <StatusScreen
        title="Sin acceso a esta empresa"
        body={
          <>
            {ctx.email} no forma parte de <strong>{tenant.name}</strong>.
          </>
        }
        action={{ href: "/portal", label: "Ir a mi empresa" }}
      />
    );
  }

  // Recordar la última empresa visitada para que /portal vuelva acá.
  if (ctx.tenantId !== tenant.id) {
    await setActiveTenantForSession({
      sessionToken: ctx.sessionToken,
      userId: ctx.userId,
      tenantId: tenant.id,
      allowPlatformSuperuser: ctx.isPlatformSuperuser,
    });
  }

  const canWrite = canTenantRole(membership?.role, "write", { isPlatformSuperuser: ctx.isPlatformSuperuser });

  return (
    <AppShell
      identity={buildShellIdentity(ctx, membership?.role)}
      contextLabel={tenant.name}
      trail={trailIndex(slug, await getEnabledModulesCached(tenant.id), canWrite)}
      backLink={
        ctx.isPlatformSuperuser
          ? { href: "/platform/tenants", label: "Volver a plataforma" }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
