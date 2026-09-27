import type { TenantRole } from "@prisma/client";
import type { ShellIdentity } from "@/components/shell/AppShell";
import {
  describeCapabilities,
  personaRoleLabel,
  resolvePersona,
} from "@/domain/identity/persona";

export function buildShellIdentity(
  ctx: { name: string; email: string; isPlatformSuperuser: boolean },
  tenantRole: TenantRole | null | undefined,
): ShellIdentity {
  const input = { isPlatformSuperuser: ctx.isPlatformSuperuser, tenantRole };
  return {
    persona: resolvePersona(input),
    name: ctx.name,
    email: ctx.email,
    roleLabel: personaRoleLabel(input),
    capabilities: describeCapabilities(input),
  };
}
