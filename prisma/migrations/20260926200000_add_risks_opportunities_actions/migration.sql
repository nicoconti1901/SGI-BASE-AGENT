-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('identified', 'analyzing', 'evaluated', 'response_planned', 'implementing', 'effectiveness_review', 'monitored', 'closed');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('discovered', 'analyzing', 'evaluated', 'decision', 'pursuing', 'implementing', 'benefit_review', 'realized', 'closed');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('process', 'finding', 'supplier', 'change', 'objective', 'stakeholder', 'indicator', 'other');

-- CreateEnum
CREATE TYPE "AssessmentMethod" AS ENUM ('qualitative', 'probability_impact');

-- CreateEnum
CREATE TYPE "RiskResponseDecision" AS ENUM ('mitigate', 'accept', 'transfer', 'avoid', 'monitor', 'retain');

-- CreateEnum
CREATE TYPE "OpportunityPursuitDecision" AS ENUM ('pursue_now', 'pursue_later', 'monitor', 'investigate', 'do_not_pursue', 'close');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('open', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "EffectivenessStatus" AS ENUM ('pending', 'effective', 'partially_effective', 'not_effective', 'not_applicable');

-- CreateEnum
CREATE TYPE "ActionLinkTarget" AS ENUM ('risk', 'opportunity', 'finding');

-- CreateTable
CREATE TABLE "risk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'identified',
    "cause" TEXT NOT NULL DEFAULT '',
    "event" TEXT NOT NULL DEFAULT '',
    "effect" TEXT NOT NULL DEFAULT '',
    "existingControlsJson" JSONB NOT NULL DEFAULT '[]',
    "sourceKind" "SourceKind" NOT NULL DEFAULT 'other',
    "sourceLabel" TEXT NOT NULL DEFAULT '',
    "findingId" TEXT,
    "responseDecision" "RiskResponseDecision",
    "responseRationale" TEXT,
    "responseOwnerUserId" TEXT,
    "nextReviewAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "closeRationale" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "method" "AssessmentMethod" NOT NULL,
    "resultJson" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'discovered',
    "condition" TEXT NOT NULL DEFAULT '',
    "circumstance" TEXT NOT NULL DEFAULT '',
    "benefit" TEXT NOT NULL DEFAULT '',
    "sourceKind" "SourceKind" NOT NULL DEFAULT 'other',
    "sourceLabel" TEXT NOT NULL DEFAULT '',
    "findingId" TEXT,
    "pursuitDecision" "OpportunityPursuitDecision",
    "pursuitRationale" TEXT,
    "pursuitOwnerUserId" TEXT,
    "benefitExpected" TEXT,
    "benefitObserved" TEXT,
    "nextReviewAt" TIMESTAMP(3),
    "closeRationale" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "method" "AssessmentMethod" NOT NULL,
    "resultJson" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'open',
    "ownerUserId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "effectivenessStatus" "EffectivenessStatus" NOT NULL DEFAULT 'pending',
    "effectivenessNote" TEXT,
    "effectivenessAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_link" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "targetType" "ActionLinkTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "label" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_tenantId_status_idx" ON "risk"("tenantId", "status");

-- CreateIndex
CREATE INDEX "risk_tenantId_sourceKind_idx" ON "risk"("tenantId", "sourceKind");

-- CreateIndex
CREATE INDEX "risk_findingId_idx" ON "risk"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessment_riskId_version_key" ON "risk_assessment"("riskId", "version");

-- CreateIndex
CREATE INDEX "risk_assessment_tenantId_riskId_idx" ON "risk_assessment"("tenantId", "riskId");

-- CreateIndex
CREATE INDEX "opportunity_tenantId_status_idx" ON "opportunity"("tenantId", "status");

-- CreateIndex
CREATE INDEX "opportunity_tenantId_sourceKind_idx" ON "opportunity"("tenantId", "sourceKind");

-- CreateIndex
CREATE INDEX "opportunity_findingId_idx" ON "opportunity"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_assessment_opportunityId_version_key" ON "opportunity_assessment"("opportunityId", "version");

-- CreateIndex
CREATE INDEX "opportunity_assessment_tenantId_opportunityId_idx" ON "opportunity_assessment"("tenantId", "opportunityId");

-- CreateIndex
CREATE INDEX "action_tenantId_status_idx" ON "action"("tenantId", "status");

-- CreateIndex
CREATE INDEX "action_ownerUserId_idx" ON "action"("ownerUserId");

-- CreateIndex
CREATE INDEX "action_tenantId_dueAt_idx" ON "action"("tenantId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "action_link_actionId_targetType_targetId_key" ON "action_link"("actionId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "action_link_targetType_targetId_idx" ON "action_link"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "action_attachment_tenantId_actionId_idx" ON "action_attachment"("tenantId", "actionId");

-- AddForeignKey
ALTER TABLE "risk" ADD CONSTRAINT "risk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk" ADD CONSTRAINT "risk_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessment" ADD CONSTRAINT "risk_assessment_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_assessment" ADD CONSTRAINT "opportunity_assessment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_link" ADD CONSTRAINT "action_link_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_attachment" ADD CONSTRAINT "action_attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_attachment" ADD CONSTRAINT "action_attachment_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
