import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { TenantContext } from "@/domain/tenancy/access";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getTenantContext(): Promise<TenantContext | null> {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const platformRole = (session.user as { platformRole?: string | null }).platformRole;
  const activeTenantId = (session.session as { activeTenantId?: string | null })
    .activeTenantId;

  return {
    tenantId: activeTenantId ?? null,
    isPlatformSuperuser: platformRole === "platform_superuser",
  };
}
