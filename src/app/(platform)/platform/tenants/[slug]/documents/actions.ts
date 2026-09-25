"use server";

import { revalidatePath } from "next/cache";
import type { DocumentFate } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { uploadTenantDocument } from "@/lib/documents";

export type UploadDocumentState = {
  error?: string;
  ok?: boolean;
  documentId?: string;
};

const FATES: DocumentFate[] = ["create", "replace", "keep", "undecided"];

export async function uploadDocumentAction(
  slug: string,
  _prev: UploadDocumentState,
  formData: FormData,
): Promise<UploadDocumentState> {
  const session = await getSession();
  if (!session?.user) {
    return { error: "Debés iniciar sesión" };
  }

  const platformRole = (session.user as { platformRole?: string | null })
    .platformRole;
  const isPlatformSuperuser = platformRole === "platform_superuser";
  if (!isPlatformSuperuser) {
    return {
      error:
        "Solo el administrador de plataforma puede cargar documentos en el MVP",
    };
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return { error: "Tenant no encontrado" };
  }

  const title = String(formData.get("title") ?? "");
  const fateRaw = String(formData.get("fate") ?? "create") as DocumentFate;
  if (!FATES.includes(fateRaw)) {
    return { error: "Destino documental inválido" };
  }
  const tenantRequirementId = String(formData.get("tenantRequirementId") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const forceOverwriteKeep = formData.get("forceOverwriteKeep") === "on";
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleccioná un archivo" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  try {
    const doc = await uploadTenantDocument({
      tenantId: tenant.id,
      title,
      fate: fateRaw,
      tenantRequirementId: tenantRequirementId || null,
      fileName: file.name,
      contentType,
      body: buffer,
      uploadedById: session.user.id,
      notes,
      isPlatformSuperuser,
      forceOverwriteKeep,
      documentId: documentId || undefined,
    });

    revalidatePath(`/platform/tenants/${slug}/documents`);
    revalidatePath(`/t/${slug}/documents`);
    return { ok: true, documentId: doc.id };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo subir el documento",
    };
  }
}
