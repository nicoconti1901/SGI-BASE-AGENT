import type { PrismaClient } from "@prisma/client";
import {
  assertTenantAccess,
  requireTenantId,
  tenantWhere,
  type TenantContext,
} from "@/domain/tenancy/access";

export async function listDocumentsForTenant(
  db: PrismaClient,
  ctx: TenantContext,
  tenantId?: string,
) {
  const scopedTenantId = requireTenantId(ctx, tenantId);
  return db.document.findMany({
    where: tenantWhere(scopedTenantId),
    orderBy: { createdAt: "desc" },
  });
}

export async function getDocumentForTenant(
  db: PrismaClient,
  ctx: TenantContext,
  documentId: string,
) {
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) {
    return null;
  }

  assertTenantAccess(ctx, document.tenantId);
  return document;
}

export async function createDocumentForTenant(
  db: PrismaClient,
  ctx: TenantContext,
  input: { title: string; tenantId?: string },
) {
  const scopedTenantId = requireTenantId(ctx, input.tenantId);
  return db.document.create({
    data: {
      title: input.title,
      tenantId: scopedTenantId,
    },
  });
}
