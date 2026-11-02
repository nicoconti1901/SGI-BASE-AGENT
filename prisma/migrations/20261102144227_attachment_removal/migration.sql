-- CreateTable
CREATE TABLE "attachment_removal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "removedByUserId" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_removal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachment_removal_tenantId_kind_parentId_idx" ON "attachment_removal"("tenantId", "kind", "parentId");

-- AddForeignKey
ALTER TABLE "attachment_removal" ADD CONSTRAINT "attachment_removal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
