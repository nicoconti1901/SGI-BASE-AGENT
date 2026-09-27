import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { buildShellIdentity } from "@/components/shell/identity";
import { tenantNavItems } from "@/components/shell/nav-config";
import { StatusScreen } from "@/components/shell/StatusScreen";
import { getAppSessionContext } from "@/lib/session";
import { getMembership, setActiveTenantForSession } from "@/lib/identity";
import { getTenantBySlug } from "@/lib/tenant-provisioning";

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

  return (
    <AppShell
      identity={buildShellIdentity(ctx, membership?.role)}
      contextLabel={tenant.name}
      navItems={tenantNavItems(slug)}
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
