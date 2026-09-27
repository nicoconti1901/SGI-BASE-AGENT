-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('effective', 'not_effective');

-- AlterEnum
ALTER TYPE "FindingStatus" ADD VALUE 'verification';

-- AlterTable
ALTER TABLE "finding" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "reworkSince" TIMESTAMP(3),
ADD COLUMN     "verificationDueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "finding_measure" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedByUserId" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "finding_verification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "result" "VerificationResult" NOT NULL,
    "evidence" TEXT NOT NULL,
    "independenceException" TEXT,
    "earlyReason" TEXT,
    "verifiedByUserId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_status_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "fromStatus" "FindingStatus",
    "toStatus" "FindingStatus" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finding_verification_tenantId_findingId_idx" ON "finding_verification"("tenantId", "findingId");

-- CreateIndex
CREATE INDEX "finding_status_event_findingId_createdAt_idx" ON "finding_status_event"("findingId", "createdAt");

-- AddForeignKey
ALTER TABLE "finding_verification" ADD CONSTRAINT "finding_verification_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_status_event" ADD CONSTRAINT "finding_status_event_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
