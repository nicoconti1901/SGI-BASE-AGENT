-- AlterTable
ALTER TABLE "training_session" ADD COLUMN     "plannedFor" DATE;

-- CreateIndex
CREATE INDEX "training_session_tenantId_plannedFor_idx" ON "training_session"("tenantId", "plannedFor");
