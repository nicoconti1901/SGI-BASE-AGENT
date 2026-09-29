-- CreateEnum
CREATE TYPE "ExternalAuditType" AS ENUM ('certification_initial', 'surveillance', 'recertification', 'customer');

-- AlterTable
ALTER TABLE "audit" ADD COLUMN     "externalType" "ExternalAuditType",
ADD COLUMN     "externalAuditor" TEXT,
ADD COLUMN     "externalResult" TEXT,
ADD COLUMN     "responseDueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "audit_report_attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_report_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_report_attachment_tenantId_auditId_idx" ON "audit_report_attachment"("tenantId", "auditId");

-- AddForeignKey
ALTER TABLE "audit_report_attachment" ADD CONSTRAINT "audit_report_attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_report_attachment" ADD CONSTRAINT "audit_report_attachment_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
