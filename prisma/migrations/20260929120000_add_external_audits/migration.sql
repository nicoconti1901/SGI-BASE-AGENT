-- CreateEnum
CREATE TYPE "AuditKind" AS ENUM ('internal', 'external');

-- AlterTable
ALTER TABLE "audit" ADD COLUMN     "kind" "AuditKind" NOT NULL DEFAULT 'internal',
ADD COLUMN     "externalBody" TEXT;

-- CreateIndex
CREATE INDEX "audit_tenantId_kind_idx" ON "audit"("tenantId", "kind");

-- Una auditoría externa nunca pertenece al programa interno ni exige entidad vacía
ALTER TABLE "audit" ADD CONSTRAINT "audit_external_check" CHECK (
  ("kind" = 'internal' AND "externalBody" IS NULL) OR
  ("kind" = 'external' AND "programId" IS NULL AND "externalBody" IS NOT NULL)
);
