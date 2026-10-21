-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('product', 'service', 'contractor');

-- CreateEnum
CREATE TYPE "SupplierCriticality" AS ENUM ('critical', 'standard', 'low');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('potential', 'approved', 'conditional', 'not_approved', 'inactive');

-- CreateEnum
CREATE TYPE "SupplierTemplateStatus" AS ENUM ('draft', 'published', 'retired');

-- CreateEnum
CREATE TYPE "SupplierCriterionPhase" AS ENUM ('selection', 'performance', 'both');

-- CreateEnum
CREATE TYPE "SupplierEvaluationKind" AS ENUM ('initial', 'periodic', 'event');

-- CreateEnum
CREATE TYPE "SupplierEvaluationMode" AS ENUM ('full', 'simplified', 'declared');

-- CreateEnum
CREATE TYPE "SupplierEvaluationResult" AS ENUM ('approved', 'conditional', 'not_approved');

-- CreateEnum
CREATE TYPE "SupplierResultReason" AS ENUM ('score', 'excluding_criterion', 'declared');

-- CreateEnum
CREATE TYPE "SupplierDocumentRecurrence" AS ENUM ('none', 'monthly');

-- CreateEnum
CREATE TYPE "SupplierFindingKind" AS ENUM ('quality', 'delivery', 'safety', 'environment', 'documentation', 'claim');

-- CreateEnum
CREATE TYPE "SupplierCommunicationKind" AS ENUM ('requirements', 'evaluation_result');

-- CreateEnum
CREATE TYPE "SupplierCommunicationChannel" AS ENUM ('email', 'letter', 'meeting', 'other');

-- AlterTable
ALTER TABLE "person" ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "taxId" TEXT,
    "type" "SupplierType" NOT NULL,
    "category" TEXT,
    "criticality" "SupplierCriticality" NOT NULL DEFAULT 'standard',
    "criticalityReason" TEXT,
    "ownerUserId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'potential',
    "inactiveAt" TIMESTAMP(3),
    "inactiveReason" TEXT,
    "lastEvaluationId" TEXT,
    "lastEvaluatedAt" DATE,
    "lastScore" DECIMAL(4,1),
    "nextEvaluationDueAt" DATE,
    "blockingDocExpiresAt" DATE,
    "missingRequiredDocs" INTEGER NOT NULL DEFAULT 0,
    "missingBlockingDocs" INTEGER NOT NULL DEFAULT 0,
    "attentionAt" DATE,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_site" (
    "supplierId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "supplier_site_pkey" PRIMARY KEY ("supplierId","siteId")
);

-- CreateTable
CREATE TABLE "supplier_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reevalCriticalMonths" INTEGER DEFAULT 12,
    "reevalStandardMonths" INTEGER DEFAULT 24,
    "reevalConditionalMonths" INTEGER DEFAULT 6,
    "initialEvalDays" INTEGER NOT NULL DEFAULT 30,
    "docWarnDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_criteria_template" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierType" "SupplierType" NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "SupplierTemplateStatus" NOT NULL DEFAULT 'draft',
    "approvedMin" INTEGER NOT NULL DEFAULT 80,
    "conditionalMin" INTEGER NOT NULL DEFAULT 60,
    "changeNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_criteria_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_criterion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "descriptor1" TEXT NOT NULL DEFAULT '',
    "descriptor3" TEXT NOT NULL DEFAULT '',
    "descriptor5" TEXT NOT NULL DEFAULT '',
    "weight" INTEGER NOT NULL,
    "excluding" BOOLEAN NOT NULL DEFAULT false,
    "allowNA" BOOLEAN NOT NULL DEFAULT false,
    "phase" "SupplierCriterionPhase" NOT NULL DEFAULT 'both',
    "basic" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "supplier_criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_evaluation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "kind" "SupplierEvaluationKind" NOT NULL,
    "mode" "SupplierEvaluationMode" NOT NULL,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "approvedMin" INTEGER NOT NULL,
    "conditionalMin" INTEGER NOT NULL,
    "criticalityAtEvaluation" "SupplierCriticality" NOT NULL,
    "periodFrom" DATE,
    "periodTo" DATE,
    "evaluatedAt" DATE NOT NULL,
    "evaluatorUserId" TEXT,
    "totalScore" DECIMAL(4,1),
    "coverage" DECIMAL(4,1),
    "result" "SupplierEvaluationResult" NOT NULL,
    "resultReason" "SupplierResultReason" NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_evaluation_item" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weight" INTEGER NOT NULL,
    "excluding" BOOLEAN NOT NULL DEFAULT false,
    "allowNA" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "comment" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "supplier_evaluation_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_document_type" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliesTo" "SupplierType"[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "blocksEnablement" BOOLEAN NOT NULL DEFAULT false,
    "validityMonths" INTEGER,
    "recurrence" "SupplierDocumentRecurrence" NOT NULL DEFAULT 'none',
    "note" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_document_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_document" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "issuedAt" DATE,
    "expiresAt" DATE,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_finding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "kind" "SupplierFindingKind" NOT NULL,
    "evaluationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_communication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "kind" "SupplierCommunicationKind" NOT NULL,
    "evaluationId" TEXT,
    "sentAt" DATE NOT NULL,
    "channel" "SupplierCommunicationChannel" NOT NULL,
    "recipientName" TEXT,
    "summary" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_communication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_tenantId_status_idx" ON "supplier"("tenantId", "status");

-- CreateIndex
CREATE INDEX "supplier_tenantId_criticality_idx" ON "supplier"("tenantId", "criticality");

-- CreateIndex
CREATE INDEX "supplier_tenantId_attentionAt_idx" ON "supplier"("tenantId", "attentionAt");

-- CreateIndex
CREATE INDEX "supplier_tenantId_legalName_idx" ON "supplier"("tenantId", "legalName");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_tenantId_taxId_key" ON "supplier"("tenantId", "taxId");

-- CreateIndex
CREATE INDEX "supplier_site_tenantId_siteId_idx" ON "supplier_site"("tenantId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_settings_tenantId_key" ON "supplier_settings"("tenantId");

-- CreateIndex
CREATE INDEX "supplier_criteria_template_tenantId_supplierType_status_idx" ON "supplier_criteria_template"("tenantId", "supplierType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_criteria_template_tenantId_supplierType_version_key" ON "supplier_criteria_template"("tenantId", "supplierType", "version");

-- CreateIndex
CREATE INDEX "supplier_criterion_tenantId_templateId_idx" ON "supplier_criterion"("tenantId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_criterion_templateId_position_key" ON "supplier_criterion"("templateId", "position");

-- CreateIndex
CREATE INDEX "supplier_evaluation_tenantId_supplierId_evaluatedAt_idx" ON "supplier_evaluation"("tenantId", "supplierId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "supplier_evaluation_tenantId_result_idx" ON "supplier_evaluation"("tenantId", "result");

-- CreateIndex
CREATE INDEX "supplier_evaluation_item_tenantId_evaluationId_idx" ON "supplier_evaluation_item"("tenantId", "evaluationId");

-- CreateIndex
CREATE INDEX "supplier_document_type_tenantId_active_idx" ON "supplier_document_type"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_document_type_tenantId_key_key" ON "supplier_document_type"("tenantId", "key");

-- CreateIndex
CREATE INDEX "supplier_document_tenantId_supplierId_typeId_idx" ON "supplier_document"("tenantId", "supplierId", "typeId");

-- CreateIndex
CREATE INDEX "supplier_document_tenantId_expiresAt_idx" ON "supplier_document"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_finding_findingId_key" ON "supplier_finding"("findingId");

-- CreateIndex
CREATE INDEX "supplier_finding_tenantId_supplierId_idx" ON "supplier_finding"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "supplier_communication_tenantId_supplierId_sentAt_idx" ON "supplier_communication"("tenantId", "supplierId", "sentAt");

-- CreateIndex
CREATE INDEX "person_tenantId_supplierId_idx" ON "person"("tenantId", "supplierId");

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_site" ADD CONSTRAINT "supplier_site_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_site" ADD CONSTRAINT "supplier_site_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_settings" ADD CONSTRAINT "supplier_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_criteria_template" ADD CONSTRAINT "supplier_criteria_template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_criterion" ADD CONSTRAINT "supplier_criterion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "supplier_criteria_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluation" ADD CONSTRAINT "supplier_evaluation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluation" ADD CONSTRAINT "supplier_evaluation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "supplier_criteria_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluation_item" ADD CONSTRAINT "supplier_evaluation_item_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "supplier_evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_document_type" ADD CONSTRAINT "supplier_document_type_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_document" ADD CONSTRAINT "supplier_document_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_document" ADD CONSTRAINT "supplier_document_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "supplier_document_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_finding" ADD CONSTRAINT "supplier_finding_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_finding" ADD CONSTRAINT "supplier_finding_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_finding" ADD CONSTRAINT "supplier_finding_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "supplier_evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_communication" ADD CONSTRAINT "supplier_communication_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_communication" ADD CONSTRAINT "supplier_communication_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "supplier_evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invariantes que Prisma no expresa (el servicio las repite, la base las garantiza).

-- A lo sumo una plantilla publicada por empresa y tipo de proveedor.
CREATE UNIQUE INDEX "supplier_criteria_template_one_published_idx"
  ON "supplier_criteria_template"("tenantId", "supplierType")
  WHERE "status" = 'published';

ALTER TABLE "supplier_criteria_template"
  ADD CONSTRAINT "supplier_criteria_template_thresholds_chk"
  CHECK ("conditionalMin" >= 0 AND "conditionalMin" <= "approvedMin" AND "approvedMin" <= 100);

ALTER TABLE "supplier_criterion"
  ADD CONSTRAINT "supplier_criterion_weight_chk" CHECK ("weight" > 0);

ALTER TABLE "supplier_evaluation_item"
  ADD CONSTRAINT "supplier_evaluation_item_weight_chk" CHECK ("weight" > 0),
  ADD CONSTRAINT "supplier_evaluation_item_score_chk" CHECK ("score" IS NULL OR "score" BETWEEN 1 AND 5);

ALTER TABLE "supplier_evaluation"
  ADD CONSTRAINT "supplier_evaluation_score_chk"
  CHECK ("totalScore" IS NULL OR ("totalScore" >= 20 AND "totalScore" <= 100));

-- CUIT de 11 dígitos normalizados; los proveedores críticos y de bajo impacto llevan su motivo.
ALTER TABLE "supplier"
  ADD CONSTRAINT "supplier_tax_id_chk" CHECK ("taxId" IS NULL OR "taxId" ~ '^[0-9]{11}$'),
  ADD CONSTRAINT "supplier_criticality_reason_chk"
  CHECK ("criticality" = 'standard' OR length(btrim(coalesce("criticalityReason", ''))) > 0);
