-- AlterTable
ALTER TABLE "inspection" ADD COLUMN     "actionId" TEXT,
ADD COLUMN     "findingId" TEXT;

-- CreateTable
CREATE TABLE "inspection_correction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "previousResult" "InspectionResult",
    "newResult" "InspectionResult" NOT NULL,
    "reason" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_correction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_correction_tenantId_inspectionId_createdAt_idx" ON "inspection_correction"("tenantId", "inspectionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_findingId_key" ON "inspection"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_actionId_key" ON "inspection"("actionId");

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_correction" ADD CONSTRAINT "inspection_correction_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

