import type { TenantRole } from "@prisma/client";
import { canTenantRole } from "@/domain/identity/authz";
import type { AttachmentActor } from "@/domain/attachments/removal";

/** Quién está mirando la pantalla, en los términos de `canRemoveAttachment`. */
export function attachmentActorOf(input: {
  userId: string;
  role: TenantRole | null | undefined;
  isPlatformSuperuser: boolean;
}): AttachmentActor {
  const opts = { isPlatformSuperuser: input.isPlatformSuperuser };
  return {
    userId: input.userId,
    canWrite: canTenantRole(input.role, "write", opts),
    canManage: canTenantRole(input.role, "delete", opts),
    isPlatformSuperuser: input.isPlatformSuperuser,
  };
}
