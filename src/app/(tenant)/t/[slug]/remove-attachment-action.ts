"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import { isAttachmentKind } from "@/domain/attachments/removal";
import { AttachmentRemovalError, removeAttachment } from "@/lib/attachment-removal";

export type RemoveAttachmentState = { ok?: string; error?: string };

/** Quita un archivo adjunto de cualquier módulo; las reglas de quién y cuándo están en `removeAttachment`. */
export async function removeAttachmentAction(
  slug: string,
  kind: string,
  attachmentId: string,
): Promise<RemoveAttachmentState> {
  if (!isAttachmentKind(kind)) return { error: "Tipo de archivo desconocido" };
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" };
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" };
  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  if (!membership && !ctx.isPlatformSuperuser) return { error: "Sin acceso" };

  try {
    const { fileName } = await removeAttachment({
      tenantId: tenant.id,
      kind,
      attachmentId,
      actor: {
        userId: ctx.userId,
        canWrite: canTenantRole(membership?.role, "write", opts),
        canManage: canTenantRole(membership?.role, "delete", opts),
        isPlatformSuperuser: ctx.isPlatformSuperuser,
      },
    });
    revalidatePath(`/t/${slug}`, "layout");
    return { ok: `Se quitó «${fileName}»` };
  } catch (error) {
    if (error instanceof AttachmentRemovalError) return { error: error.message };
    console.error(`removeAttachmentAction ${kind} ${attachmentId}: ${error instanceof Error ? error.stack : String(error)}`);
    return { error: "No se pudo quitar el archivo" };
  }
}
