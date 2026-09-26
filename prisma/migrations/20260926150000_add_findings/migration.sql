CREATE TYPE "FindingType" AS ENUM ('nonconformity', 'observation', 'incident', 'opportunity');
CREATE TYPE "FindingStatus" AS ENUM ('draft', 'published', 'in_progress', 'closed', 'cancelled');
CREATE TYPE "MeasureKind" AS ENUM ('corrective', 'preventive');
CREATE TYPE "RcaStatus" AS ENUM ('incomplete', 'confirmed');

CREATE TABLE "finding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "FindingType" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "location" TEXT,
    "severity" TEXT,
    "createdByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "rcaJson" JSONB,
    "rcaStatus" "RcaStatus" NOT NULL DEFAULT 'incomplete',
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finding_tenantId_status_idx" ON "finding"("tenantId", "status");
CREATE INDEX "finding_tenantId_type_idx" ON "finding"("tenantId", "type");

CREATE TABLE "finding_measure" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "MeasureKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "linkedRootCause" BOOLEAN NOT NULL DEFAULT false,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finding_measure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finding_measure_tenantId_status_idx" ON "finding_measure"("tenantId", "status");
CREATE INDEX "finding_measure_findingId_idx" ON "finding_measure"("findingId");
CREATE INDEX "finding_measure_ownerUserId_idx" ON "finding_measure"("ownerUserId");

CREATE TABLE "finding_notify_recipient" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_notify_recipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finding_notify_recipient_findingId_userId_key" ON "finding_notify_recipient"("findingId", "userId");
CREATE INDEX "finding_notify_recipient_userId_idx" ON "finding_notify_recipient"("userId");

ALTER TABLE "finding" ADD CONSTRAINT "finding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finding_measure" ADD CONSTRAINT "finding_measure_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finding_notify_recipient" ADD CONSTRAINT "finding_notify_recipient_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
