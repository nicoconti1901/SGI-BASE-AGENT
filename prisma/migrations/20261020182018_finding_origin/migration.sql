-- CreateEnum
CREATE TYPE "FindingOrigin" AS ENUM ('manual', 'internal_audit', 'external_audit', 'indicator', 'inspection', 'incident', 'supplier');

-- AlterTable
ALTER TABLE "finding" ADD COLUMN     "origin" "FindingOrigin" NOT NULL DEFAULT 'manual';

-- CreateIndex
CREATE INDEX "finding_tenantId_origin_idx" ON "finding"("tenantId", "origin");

-- Backfill: origen de los hallazgos existentes.
UPDATE "finding" f
SET "origin" = CASE a."kind"
  WHEN 'external' THEN 'external_audit'::"FindingOrigin"
  ELSE 'internal_audit'::"FindingOrigin"
END
FROM "audit" a
WHERE f."auditId" = a."id";

UPDATE "finding"
SET "origin" = 'indicator'
WHERE "auditId" IS NULL AND "source" LIKE 'Indicador %';
