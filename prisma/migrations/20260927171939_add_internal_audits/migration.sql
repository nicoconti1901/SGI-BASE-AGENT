-- CreateEnum
CREATE TYPE "AuditProgramStatus" AS ENUM ('draft', 'approved', 'closed');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('planned', 'prepared', 'in_progress', 'reporting', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "AuditMode" AS ENUM ('onsite', 'remote', 'hybrid');

-- CreateEnum
CREATE TYPE "AuditTeamRole" AS ENUM ('lead', 'auditor');

-- CreateEnum
CREATE TYPE "AuditItemResult" AS ENUM ('pending', 'conforming', 'nc_major', 'nc_minor', 'observation', 'improvement', 'not_applicable');

-- AlterTable
ALTER TABLE "finding" ADD COLUMN     "auditId" TEXT;

-- CreateTable
CREATE TABLE "audit_program" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "objectives" TEXT NOT NULL DEFAULT '',
    "frequencyRationale" TEXT NOT NULL DEFAULT '',
    "status" "AuditProgramStatus" NOT NULL DEFAULT 'draft',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "standards" "IsoStandard"[],
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "mode" "AuditMode" NOT NULL DEFAULT 'onsite',
    "status" "AuditStatus" NOT NULL DEFAULT 'planned',
    "impartialityException" TEXT,
    "cancelReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "reportConclusion" TEXT,
    "reportStrengths" TEXT,
    "workersCommunicated" BOOLEAN NOT NULL DEFAULT false,
    "reportIssuedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_team_member" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AuditTeamRole" NOT NULL,

    CONSTRAINT "audit_team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_auditee" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT,
    "area" TEXT NOT NULL,

    CONSTRAINT "audit_auditee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_checklist_item" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "tenantRequirementId" TEXT,
    "question" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "result" "AuditItemResult" NOT NULL DEFAULT 'pending',
    "evidence" TEXT,
    "findingId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_evidence_attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_evidence_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_program_tenantId_year_key" ON "audit_program"("tenantId", "year");

-- CreateIndex
CREATE INDEX "audit_tenantId_status_idx" ON "audit"("tenantId", "status");

-- CreateIndex
CREATE INDEX "audit_programId_idx" ON "audit"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_tenantId_code_key" ON "audit"("tenantId", "code");

-- CreateIndex
CREATE INDEX "audit_team_member_userId_idx" ON "audit_team_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_team_member_auditId_userId_key" ON "audit_team_member"("auditId", "userId");

-- CreateIndex
CREATE INDEX "audit_auditee_auditId_idx" ON "audit_auditee"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_checklist_item_findingId_key" ON "audit_checklist_item"("findingId");

-- CreateIndex
CREATE INDEX "audit_checklist_item_auditId_sortOrder_idx" ON "audit_checklist_item"("auditId", "sortOrder");

-- CreateIndex
CREATE INDEX "audit_checklist_item_tenantRequirementId_idx" ON "audit_checklist_item"("tenantRequirementId");

-- CreateIndex
CREATE INDEX "audit_evidence_attachment_tenantId_itemId_idx" ON "audit_evidence_attachment"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "finding_auditId_idx" ON "finding"("auditId");

-- AddForeignKey
ALTER TABLE "finding" ADD CONSTRAINT "finding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_program" ADD CONSTRAINT "audit_program_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit" ADD CONSTRAINT "audit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit" ADD CONSTRAINT "audit_programId_fkey" FOREIGN KEY ("programId") REFERENCES "audit_program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_team_member" ADD CONSTRAINT "audit_team_member_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_auditee" ADD CONSTRAINT "audit_auditee_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklist_item" ADD CONSTRAINT "audit_checklist_item_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklist_item" ADD CONSTRAINT "audit_checklist_item_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklist_item" ADD CONSTRAINT "audit_checklist_item_tenantRequirementId_fkey" FOREIGN KEY ("tenantRequirementId") REFERENCES "tenant_requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklist_item" ADD CONSTRAINT "audit_checklist_item_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_evidence_attachment" ADD CONSTRAINT "audit_evidence_attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_evidence_attachment" ADD CONSTRAINT "audit_evidence_attachment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "audit_checklist_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes que Prisma no expresa
ALTER TABLE "audit" ADD CONSTRAINT "audit_dates_check" CHECK ("plannedEnd" >= "plannedStart");
ALTER TABLE "audit_program" ADD CONSTRAINT "audit_program_year_check" CHECK ("year" BETWEEN 2000 AND 2100);
ALTER TABLE "audit_evidence_attachment" ADD CONSTRAINT "audit_evidence_size_check" CHECK ("sizeBytes" >= 0);
