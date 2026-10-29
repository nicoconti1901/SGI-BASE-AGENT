-- CreateEnum
CREATE TYPE "RoadVehicleKind" AS ENUM ('own', 'contractor', 'private', 'none');

-- CreateEnum
CREATE TYPE "RoadEventType" AS ENUM ('collision_vehicle', 'collision_fixed_object', 'rollover', 'run_off_road', 'pedestrian_cyclist', 'other');

-- CreateEnum
CREATE TYPE "RoadSurface" AS ENUM ('dry', 'wet', 'ice_snow', 'gravel_dirt', 'other', 'unknown');

-- CreateEnum
CREATE TYPE "RoadLight" AS ENUM ('day', 'dusk_dawn', 'night_lit', 'night_dark', 'unknown');

-- CreateEnum
CREATE TYPE "RoadWeather" AS ENUM ('clear', 'rain', 'fog', 'wind', 'snow_ice', 'unknown');

-- CreateEnum
CREATE TYPE "RoadSeatbelt" AS ENUM ('all', 'some_not', 'none', 'not_applicable', 'unknown');

-- CreateEnum
CREATE TYPE "RoadPropertyDamage" AS ENUM ('none', 'minor', 'major');

-- CreateEnum
CREATE TYPE "RoadMainCause" AS ENUM ('speed', 'fatigue_distraction', 'alcohol_drugs', 'mechanical', 'road_conditions', 'other_driver', 'weather', 'other', 'undetermined');

-- CreateEnum
CREATE TYPE "VehicleKmSource" AS ENUM ('odometer', 'manual');

-- CreateTable
CREATE TABLE "road_event_detail" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentRecordId" TEXT NOT NULL,
    "vehicleKind" "RoadVehicleKind" NOT NULL,
    "assetId" TEXT,
    "vehicleLabel" TEXT,
    "driverPersonId" TEXT,
    "eventType" "RoadEventType" NOT NULL,
    "roadSurface" "RoadSurface" NOT NULL DEFAULT 'unknown',
    "light" "RoadLight" NOT NULL DEFAULT 'unknown',
    "weather" "RoadWeather" NOT NULL DEFAULT 'unknown',
    "seatbelt" "RoadSeatbelt" NOT NULL DEFAULT 'unknown',
    "estimatedSpeedKmh" SMALLINT,
    "propertyDamage" "RoadPropertyDamage" NOT NULL DEFAULT 'none',
    "injuredCount" SMALLINT NOT NULL DEFAULT 0,
    "hospitalizedCount" SMALLINT NOT NULL DEFAULT 0,
    "fatalCount" SMALLINT NOT NULL DEFAULT 0,
    "mainCause" "RoadMainCause" NOT NULL DEFAULT 'undetermined',
    "reportFiled" BOOLEAN NOT NULL DEFAULT false,
    "reportRef" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "road_event_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_km_period" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "periodMonth" DATE NOT NULL,
    "km" INTEGER NOT NULL,
    "source" "VehicleKmSource" NOT NULL,
    "computedKm" INTEGER,
    "manualReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_km_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_odometer_reset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_odometer_reset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speeding_period" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "personId" TEXT,
    "personKey" TEXT NOT NULL DEFAULT '',
    "periodMonth" DATE NOT NULL,
    "count" INTEGER NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speeding_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_safety_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "minExposureKm" INTEGER NOT NULL DEFAULT 100000,
    "repeatThreshold" INTEGER NOT NULL DEFAULT 2,
    "repeatWindowMonths" INTEGER NOT NULL DEFAULT 12,
    "speedingPerDriver" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "road_safety_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "road_event_detail_incidentRecordId_key" ON "road_event_detail"("incidentRecordId");

-- CreateIndex
CREATE INDEX "road_event_detail_tenantId_assetId_idx" ON "road_event_detail"("tenantId", "assetId");

-- CreateIndex
CREATE INDEX "road_event_detail_tenantId_driverPersonId_idx" ON "road_event_detail"("tenantId", "driverPersonId");

-- CreateIndex
CREATE INDEX "vehicle_km_period_tenantId_periodMonth_idx" ON "vehicle_km_period"("tenantId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_km_period_tenantId_assetId_periodMonth_key" ON "vehicle_km_period"("tenantId", "assetId", "periodMonth");

-- CreateIndex
CREATE INDEX "vehicle_odometer_reset_tenantId_assetId_idx" ON "vehicle_odometer_reset"("tenantId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_odometer_reset_assetId_effectiveOn_key" ON "vehicle_odometer_reset"("assetId", "effectiveOn");

-- CreateIndex
CREATE INDEX "speeding_period_tenantId_periodMonth_idx" ON "speeding_period"("tenantId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "speeding_period_tenantId_assetId_periodMonth_personKey_key" ON "speeding_period"("tenantId", "assetId", "periodMonth", "personKey");

-- CreateIndex
CREATE UNIQUE INDEX "road_safety_settings_tenantId_key" ON "road_safety_settings"("tenantId");

-- AddForeignKey
ALTER TABLE "road_event_detail" ADD CONSTRAINT "road_event_detail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_event_detail" ADD CONSTRAINT "road_event_detail_incidentRecordId_fkey" FOREIGN KEY ("incidentRecordId") REFERENCES "incident_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_event_detail" ADD CONSTRAINT "road_event_detail_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_event_detail" ADD CONSTRAINT "road_event_detail_driverPersonId_fkey" FOREIGN KEY ("driverPersonId") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_km_period" ADD CONSTRAINT "vehicle_km_period_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_km_period" ADD CONSTRAINT "vehicle_km_period_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_odometer_reset" ADD CONSTRAINT "vehicle_odometer_reset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_odometer_reset" ADD CONSTRAINT "vehicle_odometer_reset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speeding_period" ADD CONSTRAINT "speeding_period_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speeding_period" ADD CONSTRAINT "speeding_period_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speeding_period" ADD CONSTRAINT "speeding_period_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_safety_settings" ADD CONSTRAINT "road_safety_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK que Prisma no expresa (SPEC-road-safety § Domain model y casos borde).
ALTER TABLE "road_event_detail" ADD CONSTRAINT "road_event_detail_counts_check"
  CHECK ("injuredCount" >= 0 AND "hospitalizedCount" >= 0 AND "fatalCount" >= 0 AND "hospitalizedCount" <= "injuredCount");
ALTER TABLE "road_event_detail" ADD CONSTRAINT "road_event_detail_speed_check"
  CHECK ("estimatedSpeedKmh" IS NULL OR ("estimatedSpeedKmh" >= 0 AND "estimatedSpeedKmh" <= 250));
ALTER TABLE "road_event_detail" ADD CONSTRAINT "road_event_detail_own_asset_check"
  CHECK ("vehicleKind" <> 'own' OR "assetId" IS NOT NULL);

ALTER TABLE "vehicle_km_period" ADD CONSTRAINT "vehicle_km_period_km_check" CHECK ("km" >= 0);
ALTER TABLE "vehicle_km_period" ADD CONSTRAINT "vehicle_km_period_month_check" CHECK (EXTRACT(DAY FROM "periodMonth") = 1);
ALTER TABLE "vehicle_km_period" ADD CONSTRAINT "vehicle_km_period_manual_reason_check"
  CHECK ("source" <> 'manual' OR length(btrim(coalesce("manualReason", ''))) > 0);

ALTER TABLE "vehicle_odometer_reset" ADD CONSTRAINT "vehicle_odometer_reset_reason_check" CHECK (length(btrim("reason")) > 0);

ALTER TABLE "speeding_period" ADD CONSTRAINT "speeding_period_count_check" CHECK ("count" >= 0);
ALTER TABLE "speeding_period" ADD CONSTRAINT "speeding_period_month_check" CHECK (EXTRACT(DAY FROM "periodMonth") = 1);

ALTER TABLE "road_safety_settings" ADD CONSTRAINT "road_safety_settings_check"
  CHECK ("minExposureKm" >= 0 AND "repeatThreshold" >= 1 AND "repeatWindowMonths" BETWEEN 1 AND 60);
