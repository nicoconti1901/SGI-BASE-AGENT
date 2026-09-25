import { AppShell } from "@/components/shell/AppShell";
import { tenantNavItems } from "@/components/shell/nav-config";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell kind="tenant" navItems={tenantNavItems} eyebrow="Tenant">
      {children}
    </AppShell>
  );
}
