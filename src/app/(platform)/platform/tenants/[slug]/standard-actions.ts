"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { adoptOptInStandard, getTenantBySlug } from "@/lib/tenant-provisioning";
import type { IsoStandardCode } from "@/domain/ims/catalog";

/** Adopta una norma opcional (ISO 39001) para una empresa. Solo el superusuario de plataforma. */
export async function adoptStandardAction(slug: string, standard: IsoStandardCode): Promise<void> {
  const ctx = await getAppSessionContext();
  if (!ctx?.isPlatformSuperuser) throw new Error("Solo el superusuario de plataforma gestiona las normas");

  const tenant = await getTenantBySlug(slug);
  if (!tenant) throw new Error("Empresa no encontrada");

  await adoptOptInStandard(tenant.id, standard);
  revalidatePath(`/platform/tenants/${slug}`);
  revalidatePath(`/t/${slug}`, "layout");
}
