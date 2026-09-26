"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import {
  createDueItem,
  scanDueReminders,
  setOfferActivation,
} from "@/lib/automation";

export type AutomationActionState = {
  error?: string;
  ok?: string;
};

async function requirePlatformSuperuser() {
  const session = await getSession();
  if (!session?.user) {
    return { error: "Debés iniciar sesión" as const, session: null };
  }
  const platformRole = (session.user as { platformRole?: string | null })
    .platformRole;
  if (platformRole !== "platform_superuser") {
    return {
      error: "Solo el administrador de plataforma" as const,
      session: null,
    };
  }
  return { session };
}

export async function runDueScanAction(
  _prev: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const auth = await requirePlatformSuperuser();
  if (auth.error || !auth.session) {
    return { error: auth.error ?? "Sin acceso" };
  }

  const slug = String(formData.get("slug") ?? "").trim();
  try {
    let tenantId: string | undefined;
    if (slug) {
      const tenant = await getTenantBySlug(slug);
      if (!tenant) return { error: "Tenant no encontrado" };
      tenantId = tenant.id;
    }
    const result = await scanDueReminders({ tenantId });
    revalidatePath("/platform/automations");
    if (slug) {
      revalidatePath(`/t/${slug}/automations`);
      revalidatePath(`/platform/tenants/${slug}`);
    }
    return {
      ok: `Scan OK: ${result.reminded} recordatorios / ${result.scanned} ítems abiertos`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falló el scan",
    };
  }
}

export async function toggleOfferAction(
  slug: string,
  _prev: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const auth = await requirePlatformSuperuser();
  if (auth.error || !auth.session) {
    return { error: auth.error ?? "Sin acceso" };
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Tenant no encontrado" };

  const offerCode = String(formData.get("offerCode") ?? "");
  const active = formData.get("active") === "true";

  try {
    await setOfferActivation({
      tenantId: tenant.id,
      offerCode,
      active,
    });
    revalidatePath(`/t/${slug}/automations`);
    revalidatePath(`/platform/tenants/${slug}/automations`);
    revalidatePath("/platform/automations");
    return {
      ok: active ? "Oferta activada" : "Oferta desactivada",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo actualizar",
    };
  }
}

export async function createDueItemAction(
  slug: string,
  _prev: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const auth = await requirePlatformSuperuser();
  if (auth.error || !auth.session) {
    return { error: auth.error ?? "Sin acceso" };
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Tenant no encontrado" };

  const title = String(formData.get("title") ?? "");
  const entityType = String(formData.get("entityType") ?? "manual");
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const leadDays = Number(formData.get("leadDays") ?? 7);

  try {
    await createDueItem({
      tenantId: tenant.id,
      title,
      entityType,
      dueAt: new Date(dueAtRaw),
      leadDays: Number.isFinite(leadDays) ? leadDays : 7,
    });
    revalidatePath(`/t/${slug}/automations`);
    revalidatePath(`/platform/tenants/${slug}/automations`);
    return { ok: "Vencimiento creado" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo crear",
    };
  }
}
