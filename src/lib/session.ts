import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/domain/tenancy/access";
import type { TenantRole } from "@prisma/client";
import { resolveHomePath } from "@/domain/identity/persona";

export type AppSessionContext = TenantContext & {
  userId: string;
  email: string;
  name: string;
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

/** Slugs de las empresas del usuario; la última usada (activeTenantId) primero. */
export async function listUserTenantSlugs(
  ctx: Pick<AppSessionContext, "userId" | "tenantId">,
): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId: ctx.userId },
    select: { tenantId: true, tenant: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  memberships.sort(
    (a, b) => Number(b.tenantId === ctx.tenantId) - Number(a.tenantId === ctx.tenantId),
  );
  return memberships.map((m) => m.tenant.slug);
}

/** A dónde llevar al usuario al entrar; `null` si no pertenece a ninguna empresa. */
export async function resolveUserHomePath(
  ctx: AppSessionContext,
): Promise<string | null> {
  return resolveHomePath({
    isPlatformSuperuser: ctx.isPlatformSuperuser,
    tenantSlugs: ctx.isPlatformSuperuser ? [] : await listUserTenantSlugs(ctx),
  });
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
    name: session.user.name,
    tenantId: activeTenantId,
    isPlatformSuperuser,
    tenantRole,
    sessionToken: session.session.token,
  };
}
