"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import type { TenantActivity, TenantSize } from "@/domain/tenant/provisioning";

export type CreateTenantState = {
  error?: string;
};

export async function createTenantAction(
  _prev: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  const session = await getSession();
  if (!session?.user) {
    return { error: "Debés iniciar sesión" };
  }

  const platformRole = (session.user as { platformRole?: string | null })
    .platformRole;
  if (platformRole !== "platform_superuser") {
    return { error: "Solo el superusuario puede crear tenants" };
  }

  const name = String(formData.get("name") ?? "");
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const size = String(formData.get("size") ?? "") as TenantSize;
  const activity = String(formData.get("activity") ?? "") as TenantActivity;

  try {
    const tenant = await createTenantWithTemplate({
      name,
      slug: slugRaw || undefined,
      size,
      activity,
    });
    revalidatePath("/platform/tenants");
    redirect(`/platform/tenants/${tenant.slug}`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      error: error instanceof Error ? error.message : "No se pudo crear el tenant",
    };
  }
}
