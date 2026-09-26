-- AlterTable
CREATE TYPE "FindingAttachmentKind" AS ENUM ('finding_doc', 'measure_evidence');

-- CreateTable
CREATE TABLE "finding_attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "measureId" TEXT,
    "kind" "FindingAttachmentKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "label" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finding_attachment_tenantId_findingId_idx" ON "finding_attachment"("tenantId", "findingId");

-- CreateIndex
CREATE INDEX "finding_attachment_measureId_idx" ON "finding_attachment"("measureId");

-- AddForeignKey
ALTER TABLE "finding_attachment" ADD CONSTRAINT "finding_attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_attachment" ADD CONSTRAINT "finding_attachment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_attachment" ADD CONSTRAINT "finding_attachment_measureId_fkey" FOREIGN KEY ("measureId") REFERENCES "finding_measure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
