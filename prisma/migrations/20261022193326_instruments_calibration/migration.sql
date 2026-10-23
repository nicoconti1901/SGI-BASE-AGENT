-- CreateEnum
CREATE TYPE "CalibrationKind" AS ENUM ('calibration', 'verification');

-- CreateEnum
CREATE TYPE "CalibrationRecordStatus" AS ENUM ('draft', 'closed', 'voided');

-- CreateEnum
CREATE TYPE "CalibrationTraceability" AS ENUM ('nmi', 'accredited_lab', 'other_lab', 'in_house');

-- CreateEnum
CREATE TYPE "CalibrationDecisionRule" AS ENUM ('guard_band', 'simple_acceptance', 'certificate_statement');

-- CreateEnum
CREATE TYPE "CalibrationBasis" AS ENUM ('points', 'certificate_statement');

-- CreateEnum
CREATE TYPE "CalibrationLabStatement" AS ENUM ('conforme', 'no_conforme');

-- CreateEnum
CREATE TYPE "CalibrationResult" AS ENUM ('apt', 'not_apt');

-- CreateEnum
CREATE TYPE "CalibrationAsFoundResult" AS ENUM ('apt', 'not_apt', 'not_evaluated');

-- CreateEnum
CREATE TYPE "CalibrationStage" AS ENUM ('as_found', 'as_left');

-- CreateEnum
CREATE TYPE "ImpactAssessmentTrigger" AS ENUM ('as_found_not_apt', 'adjusted_without_as_found', 'functional_check_failed');

-- CreateEnum
CREATE TYPE "ImpactAssessmentStatus" AS ENUM ('pending', 'completed');

-- CreateEnum
CREATE TYPE "ImpactAssessmentOutcome" AS ENUM ('no_affected_results', 'affected_results_actioned', 'cannot_determine');

-- CreateTable
CREATE TABLE "instrument_control" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "magnitude" TEXT NOT NULL,
    "isReferenceStandard" BOOLEAN NOT NULL DEFAULT false,
    "criticalUse" BOOLEAN NOT NULL DEFAULT false,
    "criticalUseReason" TEXT,
    "requiresCalibration" BOOLEAN NOT NULL DEFAULT false,
    "calibrationIntervalMonths" INTEGER,
    "requiresVerification" BOOLEAN NOT NULL DEFAULT false,
    "verificationIntervalMonths" INTEGER,
    "intervalReason" TEXT,
    "noControlReason" TEXT,
    "decisionRule" "CalibrationDecisionRule" NOT NULL DEFAULT 'guard_band',
    "decisionRuleReason" TEXT,
    "alertLeadDays" INTEGER NOT NULL DEFAULT 30,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "calibrationValidUntil" DATE,
    "verificationValidUntil" DATE,
    "nextDueAt" DATE,
    "lastDecision" "CalibrationResult",
    "impactPending" BOOLEAN NOT NULL DEFAULT false,
    "inCalibrationSince" DATE,
    "expectedReturnAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instrument_control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration_record" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "CalibrationKind" NOT NULL,
    "status" "CalibrationRecordStatus" NOT NULL DEFAULT 'draft',
    "voidReason" TEXT,
    "voidedByUserId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "performedAt" DATE NOT NULL,
    "certificateNumber" TEXT,
    "certificateIssuedAt" DATE,
    "labName" TEXT NOT NULL,
    "traceability" "CalibrationTraceability" NOT NULL,
    "accreditationBody" TEXT,
    "accreditationNumber" TEXT,
    "accreditationScopeCovers" BOOLEAN,
    "traceabilityBasis" TEXT,
    "referenceStandardAssetId" TEXT,
    "conditions" TEXT,
    "adjusted" BOOLEAN NOT NULL DEFAULT false,
    "ruleApplied" "CalibrationDecisionRule" NOT NULL,
    "ruleReasonApplied" TEXT,
    "basis" "CalibrationBasis" NOT NULL DEFAULT 'points',
    "labStatement" "CalibrationLabStatement",
    "labStatementSpec" TEXT,
    "labDecisionRule" TEXT,
    "asFoundResult" "CalibrationAsFoundResult",
    "asLeftResult" "CalibrationResult",
    "intervalMonthsApplied" INTEGER,
    "validUntil" DATE,
    "loadedByUserId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calibration_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration_point" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "stage" "CalibrationStage" NOT NULL DEFAULT 'as_found',
    "nominal" DECIMAL(20,8) NOT NULL,
    "measured" DECIMAL(20,8) NOT NULL,
    "uncertainty" DECIMAL(20,8),
    "coverageK" DECIMAL(6,2),
    "error" DECIMAL(20,8),
    "empApplied" DECIMAL(20,8),
    "unit" TEXT,
    "ok" BOOLEAN,
    "reason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "calibration_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration_attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibration_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "triggerRecordId" TEXT,
    "trigger" "ImpactAssessmentTrigger" NOT NULL,
    "windowFrom" DATE,
    "windowTo" DATE NOT NULL,
    "status" "ImpactAssessmentStatus" NOT NULL DEFAULT 'pending',
    "outcome" "ImpactAssessmentOutcome",
    "affectedSummary" TEXT,
    "rationale" TEXT,
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "findingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impact_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_assessment_action" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "impactAssessmentId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_assessment_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instrument_shipment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sentAt" DATE NOT NULL,
    "expectedReturnAt" DATE,
    "returnedAt" DATE,
    "labName" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instrument_shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instrument_control_assetId_key" ON "instrument_control"("assetId");

-- CreateIndex
CREATE INDEX "instrument_control_tenantId_nextDueAt_idx" ON "instrument_control"("tenantId", "nextDueAt");

-- CreateIndex
CREATE INDEX "instrument_control_tenantId_magnitude_idx" ON "instrument_control"("tenantId", "magnitude");

-- CreateIndex
CREATE INDEX "instrument_control_tenantId_impactPending_idx" ON "instrument_control"("tenantId", "impactPending");

-- CreateIndex
CREATE INDEX "calibration_record_tenantId_assetId_performedAt_idx" ON "calibration_record"("tenantId", "assetId", "performedAt" DESC);

-- CreateIndex
CREATE INDEX "calibration_record_tenantId_status_idx" ON "calibration_record"("tenantId", "status");

-- CreateIndex
CREATE INDEX "calibration_record_referenceStandardAssetId_idx" ON "calibration_record"("referenceStandardAssetId");

-- CreateIndex
CREATE INDEX "calibration_point_recordId_stage_sortOrder_idx" ON "calibration_point"("recordId", "stage", "sortOrder");

-- CreateIndex
CREATE INDEX "calibration_point_tenantId_recordId_idx" ON "calibration_point"("tenantId", "recordId");

-- CreateIndex
CREATE INDEX "calibration_attachment_tenantId_recordId_idx" ON "calibration_attachment"("tenantId", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "impact_assessment_triggerRecordId_key" ON "impact_assessment"("triggerRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "impact_assessment_findingId_key" ON "impact_assessment"("findingId");

-- CreateIndex
CREATE INDEX "impact_assessment_tenantId_assetId_idx" ON "impact_assessment"("tenantId", "assetId");

-- CreateIndex
CREATE INDEX "impact_assessment_tenantId_status_idx" ON "impact_assessment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "impact_assessment_action_actionId_idx" ON "impact_assessment_action"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "impact_assessment_action_impactAssessmentId_actionId_key" ON "impact_assessment_action"("impactAssessmentId", "actionId");

-- CreateIndex
CREATE INDEX "instrument_shipment_tenantId_assetId_sentAt_idx" ON "instrument_shipment"("tenantId", "assetId", "sentAt" DESC);

-- AddForeignKey
ALTER TABLE "instrument_control" ADD CONSTRAINT "instrument_control_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrument_control" ADD CONSTRAINT "instrument_control_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_record" ADD CONSTRAINT "calibration_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_record" ADD CONSTRAINT "calibration_record_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_record" ADD CONSTRAINT "calibration_record_referenceStandardAssetId_fkey" FOREIGN KEY ("referenceStandardAssetId") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_point" ADD CONSTRAINT "calibration_point_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "calibration_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_attachment" ADD CONSTRAINT "calibration_attachment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "calibration_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_assessment" ADD CONSTRAINT "impact_assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_assessment" ADD CONSTRAINT "impact_assessment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_assessment" ADD CONSTRAINT "impact_assessment_triggerRecordId_fkey" FOREIGN KEY ("triggerRecordId") REFERENCES "calibration_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_assessment" ADD CONSTRAINT "impact_assessment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_assessment_action" ADD CONSTRAINT "impact_assessment_action_impactAssessmentId_fkey" FOREIGN KEY ("impactAssessmentId") REFERENCES "impact_assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_assessment_action" ADD CONSTRAINT "impact_assessment_action_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrument_shipment" ADD CONSTRAINT "instrument_shipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrument_shipment" ADD CONSTRAINT "instrument_shipment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes en el esquema, no solo en la aplicación (SPEC-calibration.md, decisiones 4, 8, 9, 10, 20 y 21).

-- Cada control exigido lleva su intervalo (entre 1 y 120 meses); sin ningún control hay una justificación.
ALTER TABLE "instrument_control" ADD CONSTRAINT "instrument_control_intervals_check" CHECK (
  ("calibrationIntervalMonths" IS NULL OR "calibrationIntervalMonths" BETWEEN 1 AND 120)
  AND ("verificationIntervalMonths" IS NULL OR "verificationIntervalMonths" BETWEEN 1 AND 120)
  AND (NOT "requiresCalibration" OR "calibrationIntervalMonths" IS NOT NULL)
  AND (NOT "requiresVerification" OR "verificationIntervalMonths" IS NOT NULL)
);
ALTER TABLE "instrument_control" ADD CONSTRAINT "instrument_control_no_control_reason_check" CHECK (
  "requiresCalibration" OR "requiresVerification" OR coalesce(length(btrim("noControlReason")), 0) > 0
);
ALTER TABLE "instrument_control" ADD CONSTRAINT "instrument_control_lead_days_check" CHECK ("alertLeadDays" BETWEEN 0 AND 365);
ALTER TABLE "instrument_control" ADD CONSTRAINT "instrument_control_rule_reason_check" CHECK (
  "decisionRule" = 'guard_band' OR coalesce(length(btrim("decisionRuleReason")), 0) > 0
);

-- Un registro cerrado tiene resultado y fecha de cierre; uno anulado conserva el motivo.
ALTER TABLE "calibration_record" ADD CONSTRAINT "calibration_record_closed_check" CHECK (
  "status" <> 'closed' OR ("asLeftResult" IS NOT NULL AND "closedAt" IS NOT NULL)
);
ALTER TABLE "calibration_record" ADD CONSTRAINT "calibration_record_voided_check" CHECK (
  "status" <> 'voided' OR coalesce(length(btrim("voidReason")), 0) > 0
);
-- La vigencia solo existe si el equipo quedó apto.
ALTER TABLE "calibration_record" ADD CONSTRAINT "calibration_record_valid_until_check" CHECK (
  "validUntil" IS NULL OR ("asLeftResult" = 'apt' AND "validUntil" >= "performedAt")
);
-- Una verificación interna se hace contra otro equipo registrado.
ALTER TABLE "calibration_record" ADD CONSTRAINT "calibration_record_in_house_check" CHECK (
  "traceability" <> 'in_house' OR "referenceStandardAssetId" IS NOT NULL OR "status" = 'draft'
);
ALTER TABLE "calibration_record" ADD CONSTRAINT "calibration_record_statement_check" CHECK (
  "basis" <> 'certificate_statement' OR "labStatement" IS NOT NULL
);

ALTER TABLE "calibration_attachment" ADD CONSTRAINT "calibration_attachment_size_check" CHECK ("sizeBytes" >= 0);

-- Una evaluación completada tiene decisión, justificación y quién la cerró.
ALTER TABLE "impact_assessment" ADD CONSTRAINT "impact_assessment_completed_check" CHECK (
  "status" <> 'completed'
  OR ("outcome" IS NOT NULL AND coalesce(length(btrim("rationale")), 0) > 0 AND "completedAt" IS NOT NULL)
);
ALTER TABLE "impact_assessment" ADD CONSTRAINT "impact_assessment_window_check" CHECK ("windowFrom" IS NULL OR "windowFrom" <= "windowTo");

ALTER TABLE "instrument_shipment" ADD CONSTRAINT "instrument_shipment_dates_check" CHECK (
  ("expectedReturnAt" IS NULL OR "expectedReturnAt" >= "sentAt") AND ("returnedAt" IS NULL OR "returnedAt" >= "sentAt")
);

-- Un equipo no puede tener dos envíos abiertos: enviar dos veces (doble toque) no duplica.
CREATE UNIQUE INDEX "instrument_shipment_one_open_idx" ON "instrument_shipment" ("assetId") WHERE "returnedAt" IS NULL;