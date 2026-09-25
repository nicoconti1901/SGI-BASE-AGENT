import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/domain/tenancy/access";
import type { TenantRole } from "@prisma/client";

export type AppSessionContext = TenantContext & {
  userId: string;
  email: string;
  tenantRole: TenantRole | null;
  sessionToken: string;
};

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getTenantContext(): Promise<TenantContext | null> {
  const ctx = await getAppSessionContext();
  if (!ctx) return null;
  return {
    tenantId: ctx.tenantId,
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  };
}

export async function getAppSessionContext(): Promise<AppSessionContext | null> {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const platformRole = (session.user as { platformRole?: string | null })
    .platformRole;
  const isPlatformSuperuser = platformRole === "platform_superuser";
  const activeTenantId =
    (session.session as { activeTenantId?: string | null }).activeTenantId ??
    null;

  let tenantRole: TenantRole | null = null;
  if (activeTenantId) {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: session.user.id,
          tenantId: activeTenantId,
        },
      },
    });
    tenantRole = membership?.role ?? null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    tenantId: activeTenantId,
    isPlatformSuperuser,
    tenantRole,
    sessionToken: session.session.token,
  };
}
