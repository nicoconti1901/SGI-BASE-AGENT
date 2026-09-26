"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { assertCanTenantRole } from "@/domain/identity/authz";
import {
  createCorrectiveAction,
  createNonconformity,
  updateCorrectiveActionStatus,
  updateNonconformityStatus,
} from "@/lib/operations-nc";

export type OpsActionState = {
  error?: string;
  ok?: string;
};

async function requireTenantWrite(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) {
    return { error: "Debés iniciar sesión" as const };
  }
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return { error: "Tenant no encontrado" as const };
  }
  const membership = await getMembership(ctx.userId, tenant.id);
  try {
    assertCanTenantRole(membership?.role, "write", {
      isPlatformSuperuser: ctx.isPlatformSuperuser,
    });
  } catch {
    return { error: "Sin permiso de escritura" as const };
  }
  return { ctx, tenant, membership };
}

function revalidateOps(slug: string, ncId?: string) {
  revalidatePath(`/t/${slug}/operations`);
  if (ncId) {
    revalidatePath(`/t/${slug}/operations/${ncId}`);
  }
}

export async function createNcAction(
  slug: string,
  _prev: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  const auth = await requireTenantWrite(slug);
  if ("error" in auth && auth.error) return { error: auth.error };
  if (!("tenant" in auth) || !auth.tenant || !auth.ctx) {
    return { error: "Sin acceso" };
  }

  try {
    const nc = await createNonconformity({
      tenantId: auth.tenant.id,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      ownerName: String(formData.get("ownerName") ?? ""),
      source: String(formData.get("source") ?? ""),
      createdByUserId: auth.ctx.userId,
    });
    revalidateOps(slug, nc.id);
    return { ok: "No conformidad creada" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo crear la NC",
    };
  }
}

export async function updateNcStatusAction(
  slug: string,
  ncId: string,
  _prev: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  const auth = await requireTenantWrite(slug);
  if ("error" in auth && auth.error) return { error: auth.error };
  if (!("tenant" in auth) || !auth.tenant) return { error: "Sin acceso" };

  try {
    await updateNonconformityStatus({
      tenantId: auth.tenant.id,
      id: ncId,
      status: String(formData.get("status") ?? ""),
    });
    revalidateOps(slug, ncId);
    return { ok: "Estado de NC actualizado" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo actualizar",
    };
  }
}

export async function createActionAction(
  slug: string,
  ncId: string,
  _prev: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  const auth = await requireTenantWrite(slug);
  if ("error" in auth && auth.error) return { error: auth.error };
  if (!("tenant" in auth) || !auth.tenant) return { error: "Sin acceso" };

  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  try {
    await createCorrectiveAction({
      tenantId: auth.tenant.id,
      nonconformityId: ncId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      ownerName: String(formData.get("ownerName") ?? ""),
      dueAt: dueRaw ? new Date(dueRaw) : null,
    });
    revalidateOps(slug, ncId);
    return { ok: "Acción correctiva creada" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo crear la acción",
    };
  }
}

export async function updateActionStatusAction(
  slug: string,
  ncId: string,
  actionId: string,
  _prev: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  const auth = await requireTenantWrite(slug);
  if ("error" in auth && auth.error) return { error: auth.error };
  if (!("tenant" in auth) || !auth.tenant) return { error: "Sin acceso" };

  try {
    await updateCorrectiveActionStatus({
      tenantId: auth.tenant.id,
      id: actionId,
      status: String(formData.get("status") ?? ""),
    });
    revalidateOps(slug, ncId);
    return { ok: "Estado de acción actualizado" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo actualizar",
    };
  }
}
