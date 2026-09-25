"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { bulkSaveTenantGap, type GapRowUpdate } from "@/lib/assessment-gap";
import { isRequirementStatus } from "@/domain/assessment/gap";

export type SaveGapState = {
  error?: string;
  ok?: boolean;
  saved?: number;
};

function parseGapRows(formData: FormData): GapRowUpdate[] {
  const ids = formData.getAll("tenantRequirementId").map(String);
  const rows: GapRowUpdate[] = [];

  for (const id of ids) {
    const statusRaw = String(formData.get(`status_${id}`) ?? "pending");
    if (!isRequirementStatus(statusRaw)) {
      throw new Error(`Estado inválido para requisito ${id}`);
    }
    const notes = String(formData.get(`notes_${id}`) ?? "");
    const hasClientDocument = formData.get(`hasDoc_${id}`) === "on";
    rows.push({
      tenantRequirementId: id,
      status: statusRaw,
      notes,
      hasClientDocument,
    });
  }

  return rows;
}

export async function saveTenantGapAction(
  slug: string,
  _prev: SaveGapState,
  formData: FormData,
): Promise<SaveGapState> {
  const session = await getSession();
  if (!session?.user) {
    return { error: "Debés iniciar sesión" };
  }

  const platformRole = (session.user as { platformRole?: string | null })
    .platformRole;
  if (platformRole !== "platform_superuser") {
    return { error: "Solo el administrador de plataforma puede cargar el gap" };
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return { error: "Tenant no encontrado" };
  }

  try {
    const rows = parseGapRows(formData);
    await bulkSaveTenantGap({
      tenantId: tenant.id,
      userId: session.user.id,
      rows,
    });
    revalidatePath(`/platform/tenants/${slug}/gap`);
    revalidatePath(`/platform/tenants/${slug}`);
    return { ok: true, saved: rows.length };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo guardar el gap",
    };
  }
}
