import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { buildShellIdentity } from "@/components/shell/identity";
import { platformNavItems } from "@/components/shell/nav-config";
import { getAppSessionContext } from "@/lib/session";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  // La plataforma es solo del superusuario; el resto va directo a su empresa.
  if (!ctx.isPlatformSuperuser) redirect("/portal");

  return (
    <AppShell
      identity={buildShellIdentity(ctx, null)}
      contextLabel="Plataforma"
      navItems={platformNavItems}
    >
      {children}
    </AppShell>
  );
}
