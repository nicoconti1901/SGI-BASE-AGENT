import { prisma } from "@/lib/db";
import type { TenantRole } from "@prisma/client";
import { TENANT_ROLE_OPTIONS } from "@/domain/identity/authz";
import { hashPassword } from "better-auth/crypto";

export async function listTenantMembers(tenantId: string) {
  return prisma.membership.findMany({
    where: { tenantId },
    include: {
      user: {
        select: { id: true, name: true, email: true, platformRole: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteTenantMember(input: {
  tenantId: string;
  email: string;
  name: string;
  password: string;
  role: TenantRole;
}) {
  if (!TENANT_ROLE_OPTIONS.includes(input.role)) {
    throw new Error("Rol de tenant inválido");
  }

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) {
    throw new Error("Nombre y email son obligatorios");
  }
  if (input.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
  });
  if (!tenant) {
    throw new Error("Tenant no encontrado");
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const userId = crypto.randomUUID();
    const hashed = await hashPassword(input.password);
    user = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: true,
        accounts: {
          create: {
            id: crypto.randomUUID(),
            accountId: userId,
            providerId: "credential",
            password: hashed,
          },
        },
      },
    });
  }

  const existing = await prisma.membership.findUnique({
    where: {
      userId_tenantId: { userId: user.id, tenantId: input.tenantId },
    },
  });
  if (existing) {
    throw new Error("El usuario ya es miembro de este tenant");
  }

  return prisma.membership.create({
    data: {
      userId: user.id,
      tenantId: input.tenantId,
      role: input.role,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function setActiveTenantForSession(input: {
  sessionToken: string;
  userId: string;
  tenantId: string;
  allowPlatformSuperuser: boolean;
}) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: {
        userId: input.userId,
        tenantId: input.tenantId,
      },
    },
  });

  if (!membership && !input.allowPlatformSuperuser) {
    throw new Error("No tenés membresía en este tenant");
  }

  return prisma.session.update({
    where: { token: input.sessionToken },
    data: { activeTenantId: input.tenantId },
  });
}

export async function getMembership(userId: string, tenantId: string) {
  return prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
}
