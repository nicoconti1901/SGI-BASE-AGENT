-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('active', 'achieved', 'not_achieved', 'cancelled');

-- CreateEnum
CREATE TYPE "IndicatorDirection" AS ENUM ('higher_better', 'lower_better');

-- CreateEnum
CREATE TYPE "IndicatorFrequency" AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');

-- CreateEnum
CREATE TYPE "IndicatorKind" AS ENUM ('leading', 'lagging');

-- CreateEnum
CREATE TYPE "MeasurementStatus" AS ENUM ('on_target', 'alert', 'off_target');

-- CreateTable
CREATE TABLE "objective" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "standards" "IsoStandard"[],
    "ownerUserId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "plan" TEXT NOT NULL DEFAULT '',
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'active',
    "closingNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formula" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL,
    "direction" "IndicatorDirection" NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "alertThreshold" DOUBLE PRECISION,
    "frequency" "IndicatorFrequency" NOT NULL,
    "kind" "IndicatorKind" NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "status" "MeasurementStatus" NOT NULL,
    "analysis" TEXT,
    "findingId" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_correction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "previousValue" DOUBLE PRECISION NOT NULL,
    "newValue" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurement_correction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "objective_tenantId_status_idx" ON "objective"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "objective_tenantId_code_key" ON "objective"("tenantId", "code");

-- CreateIndex
CREATE INDEX "indicator_tenantId_objectiveId_idx" ON "indicator"("tenantId", "objectiveId");

-- CreateIndex
CREATE INDEX "indicator_ownerUserId_idx" ON "indicator"("ownerUserId");

-- CreateIndex
CREATE INDEX "measurement_tenantId_indicatorId_periodStart_idx" ON "measurement"("tenantId", "indicatorId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_indicatorId_periodKey_key" ON "measurement"("indicatorId", "periodKey");

-- CreateIndex
CREATE INDEX "measurement_correction_measurementId_idx" ON "measurement_correction"("measurementId");

-- AddForeignKey
ALTER TABLE "objective" ADD CONSTRAINT "objective_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator" ADD CONSTRAINT "indicator_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator" ADD CONSTRAINT "indicator_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_correction" ADD CONSTRAINT "measurement_correction_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "measurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariante del dominio: la alerta avisa antes de salir de la meta.
ALTER TABLE "indicator" ADD CONSTRAINT "indicator_alert_side_check" CHECK (
  "alertThreshold" IS NULL
  OR ("direction" = 'higher_better' AND "alertThreshold" > "target")
  OR ("direction" = 'lower_better' AND "alertThreshold" < "target")
);
