"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import {
  getMembership,
  inviteTenantMember,
  setActiveTenantForSession,
} from "@/lib/identity";
import { assertCanTenantRole } from "@/domain/identity/authz";
import type { TenantRole } from "@prisma/client";
import { getTenantBySlug } from "@/lib/tenant-provisioning";

export type InviteState = { error?: string; ok?: boolean };

export async function activateTenantAction(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) {
    throw new Error("Debés iniciar sesión");
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    throw new Error("Tenant no encontrado");
  }

  await setActiveTenantForSession({
    sessionToken: ctx.sessionToken,
    userId: ctx.userId,
    tenantId: tenant.id,
    allowPlatformSuperuser: ctx.isPlatformSuperuser,
  });

  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/users`);
}

export async function inviteMemberAction(
  slug: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const ctx = await getAppSessionContext();
  if (!ctx) {
    return { error: "Debés iniciar sesión" };
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return { error: "Tenant no encontrado" };
  }

  try {
    const membership = await getMembership(ctx.userId, tenant.id);
    assertCanTenantRole(membership?.role, "invite_users", {
      isPlatformSuperuser: ctx.isPlatformSuperuser,
    });

    if (ctx.tenantId !== tenant.id) {
      await setActiveTenantForSession({
        sessionToken: ctx.sessionToken,
        userId: ctx.userId,
        tenantId: tenant.id,
        allowPlatformSuperuser: ctx.isPlatformSuperuser,
      });
    }

    const role = String(formData.get("role") ?? "viewer") as TenantRole;
    await inviteTenantMember({
      tenantId: tenant.id,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role,
    });

    revalidatePath(`/t/${slug}/users`);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo invitar",
    };
  }
}
