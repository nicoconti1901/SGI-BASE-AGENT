import { AppShell } from "@/components/shell/AppShell";
import { platformNavItems } from "@/components/shell/nav-config";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell kind="platform" navItems={platformNavItems} eyebrow="Superusuario">
      {children}
    </AppShell>
  );
}
