-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('in_service', 'out_of_service', 'retired');

-- CreateEnum
CREATE TYPE "AssetOwnership" AS ENUM ('own', 'rented', 'contractor');

-- CreateEnum
CREATE TYPE "InspectionTemplateScope" AS ENUM ('asset', 'area', 'activity');

-- CreateEnum
CREATE TYPE "InspectionIntervalUnit" AS ENUM ('days', 'months');

-- CreateEnum
CREATE TYPE "InspectionItemCriticality" AS ENUM ('critical', 'major', 'minor');

-- CreateEnum
CREATE TYPE "InspectionItemKind" AS ENUM ('check', 'number', 'text', 'reading');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('draft', 'closed');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('fit', 'fit_with_observations', 'unfit');

-- CreateEnum
CREATE TYPE "InspectionAnswerValue" AS ENUM ('conform', 'nonconform', 'na');

-- CreateEnum
CREATE TYPE "InspectionAttachmentKind" AS ENUM ('photo', 'evidence', 'destruction');

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sector" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'in_service',
    "statusReason" TEXT,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownership" "AssetOwnership" NOT NULL DEFAULT 'own',
    "contractorName" TEXT,
    "assignedPersonId" TEXT,
    "attributes" JSONB NOT NULL,
    "attributesVersion" INTEGER NOT NULL DEFAULT 1,
    "retiredAt" TIMESTAMP(3),
    "retirementReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_due_date" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" DATE NOT NULL,
    "lastDoneAt" DATE,
    "reference" TEXT,
    "leadDays" INTEGER NOT NULL DEFAULT 30,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_due_date_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_status_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromStatus" "AssetStatus",
    "toStatus" "AssetStatus" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "inspectionId" TEXT,
    "byUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_template" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "InspectionTemplateScope" NOT NULL,
    "assetTypeKey" TEXT,
    "intervalUnit" "InspectionIntervalUnit",
    "intervalValue" INTEGER,
    "leadDays" INTEGER NOT NULL DEFAULT 7,
    "reinspectionDays" INTEGER NOT NULL DEFAULT 7,
    "findingOnCritical" BOOLEAN NOT NULL DEFAULT false,
    "canReinstate" BOOLEAN NOT NULL DEFAULT false,
    "retireOnUnfit" BOOLEAN NOT NULL DEFAULT false,
    "activeVersionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_template_version" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_template_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_template_item" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "help" TEXT,
    "criticality" "InspectionItemCriticality" NOT NULL DEFAULT 'minor',
    "kind" "InspectionItemKind" NOT NULL DEFAULT 'check',
    "unit" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "naAllowed" BOOLEAN NOT NULL DEFAULT true,
    "photoOnNc" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "readingKey" TEXT,
    "autoSource" JSONB,
    "appliesWhen" JSONB,

    CONSTRAINT "inspection_template_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "assetId" TEXT,
    "siteId" TEXT NOT NULL,
    "sector" TEXT,
    "inspectorUserId" TEXT NOT NULL,
    "performedByPersonId" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'draft',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectedAt" DATE NOT NULL,
    "closedAt" TIMESTAMP(3),
    "result" "InspectionResult",
    "scorePct" DOUBLE PRECISION,
    "applicableCount" INTEGER,
    "conformCount" INTEGER,
    "nonconformCount" INTEGER,
    "readingKm" INTEGER,
    "readingHours" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_answer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "value" "InspectionAnswerValue",
    "numberValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "comment" TEXT,
    "autoDerived" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "inspection_answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "answerId" TEXT,
    "assetId" TEXT,
    "kind" "InspectionAttachmentKind" NOT NULL DEFAULT 'photo',
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "label" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_plan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "assetId" TEXT,
    "siteId" TEXT NOT NULL,
    "lastInspectionId" TEXT,
    "lastInspectedAt" DATE,
    "lastResult" "InspectionResult",
    "nextDueAt" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_tenantId_typeKey_status_idx" ON "asset"("tenantId", "typeKey", "status");

-- CreateIndex
CREATE INDEX "asset_tenantId_siteId_status_idx" ON "asset"("tenantId", "siteId", "status");

-- CreateIndex
CREATE INDEX "asset_siteId_idx" ON "asset"("siteId");

-- CreateIndex
CREATE INDEX "asset_assignedPersonId_idx" ON "asset"("assignedPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_tenantId_code_key" ON "asset"("tenantId", "code");

-- CreateIndex
CREATE INDEX "asset_due_date_tenantId_dueAt_idx" ON "asset_due_date"("tenantId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "asset_due_date_assetId_kind_key" ON "asset_due_date"("assetId", "kind");

-- CreateIndex
CREATE INDEX "asset_status_event_assetId_createdAt_idx" ON "asset_status_event"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "asset_status_event_tenantId_createdAt_idx" ON "asset_status_event"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_template_tenantId_key_key" ON "inspection_template"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_template_version_templateId_version_key" ON "inspection_template_version"("templateId", "version");

-- CreateIndex
CREATE INDEX "inspection_template_item_versionId_sortOrder_idx" ON "inspection_template_item"("versionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_template_item_versionId_code_key" ON "inspection_template_item"("versionId", "code");

-- CreateIndex
CREATE INDEX "inspection_tenantId_status_inspectedAt_idx" ON "inspection"("tenantId", "status", "inspectedAt" DESC);

-- CreateIndex
CREATE INDEX "inspection_tenantId_siteId_inspectedAt_idx" ON "inspection"("tenantId", "siteId", "inspectedAt" DESC);

-- CreateIndex
CREATE INDEX "inspection_tenantId_assetId_inspectedAt_idx" ON "inspection"("tenantId", "assetId", "inspectedAt" DESC);

-- CreateIndex
CREATE INDEX "inspection_tenantId_templateId_inspectedAt_idx" ON "inspection"("tenantId", "templateId", "inspectedAt" DESC);

-- CreateIndex
CREATE INDEX "inspection_tenantId_result_inspectedAt_idx" ON "inspection"("tenantId", "result", "inspectedAt" DESC);

-- CreateIndex
CREATE INDEX "inspection_versionId_idx" ON "inspection"("versionId");

-- CreateIndex
CREATE INDEX "inspection_siteId_idx" ON "inspection"("siteId");

-- CreateIndex
CREATE INDEX "inspection_answer_itemId_idx" ON "inspection_answer"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_answer_inspectionId_itemId_key" ON "inspection_answer"("inspectionId", "itemId");

-- CreateIndex
CREATE INDEX "inspection_attachment_tenantId_inspectionId_idx" ON "inspection_attachment"("tenantId", "inspectionId");

-- CreateIndex
CREATE INDEX "inspection_attachment_answerId_idx" ON "inspection_attachment"("answerId");

-- CreateIndex
CREATE INDEX "inspection_attachment_assetId_idx" ON "inspection_attachment"("assetId");

-- CreateIndex
CREATE INDEX "inspection_plan_tenantId_nextDueAt_idx" ON "inspection_plan"("tenantId", "nextDueAt");

-- CreateIndex
CREATE INDEX "inspection_plan_tenantId_templateId_lastInspectedAt_idx" ON "inspection_plan"("tenantId", "templateId", "lastInspectedAt");

-- CreateIndex
CREATE INDEX "inspection_plan_tenantId_siteId_nextDueAt_idx" ON "inspection_plan"("tenantId", "siteId", "nextDueAt");

-- CreateIndex
CREATE INDEX "inspection_plan_assetId_idx" ON "inspection_plan"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_plan_templateId_subjectKey_key" ON "inspection_plan"("templateId", "subjectKey");

-- CreateIndex
CREATE INDEX "inspection_audit_tenantId_createdAt_idx" ON "inspection_audit"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "inspection_audit_tenantId_entityType_entityId_idx" ON "inspection_audit"("tenantId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_assignedPersonId_fkey" FOREIGN KEY ("assignedPersonId") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_due_date" ADD CONSTRAINT "asset_due_date_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_status_event" ADD CONSTRAINT "asset_status_event_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_template" ADD CONSTRAINT "inspection_template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_template" ADD CONSTRAINT "inspection_template_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "inspection_template_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_template_version" ADD CONSTRAINT "inspection_template_version_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "inspection_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_template_item" ADD CONSTRAINT "inspection_template_item_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "inspection_template_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "inspection_template"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "inspection_template_version"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_performedByPersonId_fkey" FOREIGN KEY ("performedByPersonId") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_answer" ADD CONSTRAINT "inspection_answer_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_answer" ADD CONSTRAINT "inspection_answer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inspection_template_item"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_attachment" ADD CONSTRAINT "inspection_attachment_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_attachment" ADD CONSTRAINT "inspection_attachment_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "inspection_answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_attachment" ADD CONSTRAINT "inspection_attachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_plan" ADD CONSTRAINT "inspection_plan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_plan" ADD CONSTRAINT "inspection_plan_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "inspection_template"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_plan" ADD CONSTRAINT "inspection_plan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_plan" ADD CONSTRAINT "inspection_plan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_plan" ADD CONSTRAINT "inspection_plan_lastInspectionId_fkey" FOREIGN KEY ("lastInspectionId") REFERENCES "inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_audit" ADD CONSTRAINT "inspection_audit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes que Prisma no expresa: se aseguran en la base y no solo en la aplicación.
ALTER TABLE "asset" ADD CONSTRAINT "asset_code_format_check"
  CHECK ("code" = upper("code") AND char_length("code") BETWEEN 1 AND 30);

ALTER TABLE "inspection_attachment" ADD CONSTRAINT "inspection_attachment_target_check"
  CHECK ("inspectionId" IS NOT NULL OR "assetId" IS NOT NULL);

ALTER TABLE "inspection_template" ADD CONSTRAINT "inspection_template_interval_check"
  CHECK (("intervalUnit" IS NULL) = ("intervalValue" IS NULL) AND ("intervalValue" IS NULL OR "intervalValue" > 0));

ALTER TABLE "inspection_template_item" ADD CONSTRAINT "inspection_template_item_range_check"
  CHECK ("minValue" IS NULL OR "maxValue" IS NULL OR "minValue" <= "maxValue");

ALTER TABLE "inspection" ADD CONSTRAINT "inspection_closed_has_result_check"
  CHECK ("status" = 'draft' OR ("result" IS NOT NULL AND "closedAt" IS NOT NULL));
