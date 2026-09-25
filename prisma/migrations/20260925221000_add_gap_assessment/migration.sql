-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('pending', 'not_applicable', 'missing', 'partial', 'compliant', 'automated');

-- CreateEnum
CREATE TYPE "DocumentFate" AS ENUM ('keep', 'replace', 'create', 'undecided');

-- AlterTable: convert status string → GapStatus
ALTER TABLE "tenant_requirement" ADD COLUMN "status_new" "GapStatus" NOT NULL DEFAULT 'pending';

UPDATE "tenant_requirement"
SET "status_new" = CASE
  WHEN "status" IN ('pending', 'not_applicable', 'missing', 'partial', 'compliant', 'automated')
    THEN "status"::"GapStatus"
  ELSE 'pending'::"GapStatus"
END;

ALTER TABLE "tenant_requirement" DROP COLUMN "status";
ALTER TABLE "tenant_requirement" RENAME COLUMN "status_new" TO "status";

ALTER TABLE "tenant_requirement" ADD COLUMN "notes" TEXT,
ADD COLUMN "hasClientDocument" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "documentFate" "DocumentFate" NOT NULL DEFAULT 'undecided',
ADD COLUMN "assessedAt" TIMESTAMP(3),
ADD COLUMN "assessedByUserId" TEXT;

CREATE INDEX "tenant_requirement_tenantId_status_idx" ON "tenant_requirement"("tenantId", "status");

-- CreateTable
CREATE TABLE "gap_assessment_audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantRequirementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousStatus" "GapStatus" NOT NULL,
    "newStatus" "GapStatus" NOT NULL,
    "previousNotes" TEXT,
    "newNotes" TEXT,
    "previousHasDocument" BOOLEAN NOT NULL,
    "newHasDocument" BOOLEAN NOT NULL,
    "previousDocumentFate" "DocumentFate" NOT NULL,
    "newDocumentFate" "DocumentFate" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gap_assessment_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gap_assessment_audit_tenantId_createdAt_idx" ON "gap_assessment_audit"("tenantId", "createdAt");
CREATE INDEX "gap_assessment_audit_tenantRequirementId_idx" ON "gap_assessment_audit"("tenantRequirementId");

ALTER TABLE "gap_assessment_audit" ADD CONSTRAINT "gap_assessment_audit_tenantRequirementId_fkey" FOREIGN KEY ("tenantRequirementId") REFERENCES "tenant_requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gap_assessment_audit" ADD CONSTRAINT "gap_assessment_audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
