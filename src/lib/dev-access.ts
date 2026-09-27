import type { TenantRole } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Accesos directos del home, solo en `next dev`.
 * Las contraseñas salen de las mismas variables que usan los seeds y nunca
 * se envían al navegador: el login lo hace una server action.
 */
export function isDevQuickAccessEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function superuserDevEmail(): string {
  return (process.env.SEED_SUPERUSER_EMAIL ?? "admin@sgi.local").toLowerCase();
}

export function devPasswordFor(email: string): string {
  if (email.toLowerCase() === superuserDevEmail()) {
    return process.env.SEED_SUPERUSER_PASSWORD ?? "CambiarYa!123";
  }
  // Misma contraseña que scripts/seed-tisico-users.ts
  return process.env.DEV_MEMBER_PASSWORD ?? "Tisico123!";
}

export type DevAccount = {
  email: string;
  name: string;
  tenantName?: string;
  role?: TenantRole;
};

export async function listDevAccounts(): Promise<{
  superuser: DevAccount | null;
  companyAdmins: DevAccount[];
  members: DevAccount[];
}> {
  const superuserEmail = superuserDevEmail();
  const [superuser, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { email: superuserEmail },
      select: { email: true, name: true },
    }),
    prisma.membership.findMany({
      include: {
        user: { select: { email: true, name: true } },
        tenant: { select: { name: true } },
      },
      orderBy: [{ tenant: { name: "asc" } }, { createdAt: "asc" }],
      take: 40,
    }),
  ]);

  const toAccount = (m: (typeof memberships)[number]): DevAccount => ({
    email: m.user.email,
    name: m.user.name,
    tenantName: m.tenant.name,
    role: m.role,
  });

  return {
    superuser,
    companyAdmins: memberships.filter((m) => m.role === "tenant_admin").map(toAccount),
    members: memberships.filter((m) => m.role !== "tenant_admin").map(toAccount),
  };
}
