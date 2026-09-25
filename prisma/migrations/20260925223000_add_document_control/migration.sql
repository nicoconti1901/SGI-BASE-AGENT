-- AlterTable
ALTER TABLE "document" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'procedure',
ADD COLUMN "fate" "DocumentFate" NOT NULL DEFAULT 'undecided',
ADD COLUMN "tenantRequirementId" TEXT,
ADD COLUMN "currentVersionId" TEXT,
ADD COLUMN "validFrom" TIMESTAMP(3),
ADD COLUMN "validUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "document_version" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_version_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_currentVersionId_key" ON "document"("currentVersionId");
CREATE INDEX "document_tenantRequirementId_idx" ON "document"("tenantRequirementId");
CREATE UNIQUE INDEX "document_version_documentId_versionNumber_key" ON "document_version"("documentId", "versionNumber");
CREATE INDEX "document_version_documentId_idx" ON "document_version"("documentId");

ALTER TABLE "document" ADD CONSTRAINT "document_tenantRequirementId_fkey" FOREIGN KEY ("tenantRequirementId") REFERENCES "tenant_requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document" ADD CONSTRAINT "document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
