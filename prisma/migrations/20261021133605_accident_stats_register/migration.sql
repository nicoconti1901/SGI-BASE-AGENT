-- CreateEnum
CREATE TYPE "IncidentClassification" AS ENUM ('near_miss', 'first_aid', 'no_lost_time', 'lost_time', 'fatal', 'occupational_disease');

-- CreateTable
CREATE TABLE "incident_record" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "periodMonth" DATE NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "hourOfDay" SMALLINT NOT NULL,
    "classification" "IncidentClassification" NOT NULL,
    "inItinere" BOOLEAN NOT NULL DEFAULT false,
    "isRoad" BOOLEAN NOT NULL DEFAULT false,
    "employerKind" "PersonEmployer" NOT NULL,
    "restrictedWork" BOOLEAN NOT NULL DEFAULT false,
    "accidentForm" TEXT NOT NULL,
    "materialAgent" TEXT NOT NULL,
    "lostDays" INTEGER NOT NULL DEFAULT 0,
    "returnToWorkDate" DATE,
    "chargePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_health" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentRecordId" TEXT NOT NULL,
    "affectedPersonId" TEXT,
    "natureOfInjury" TEXT,
    "bodyPart" TEXT,
    "artClaimNumber" TEXT,
    "deathDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_follow_up" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentRecordId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorUserId" TEXT,
    "classification" "IncidentClassification" NOT NULL,
    "lostDays" INTEGER NOT NULL,
    "returnToWorkDate" DATE,
    "chargePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "incident_follow_up_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exposure_period" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "periodMonth" DATE NOT NULL,
    "employerKind" "PersonEmployer" NOT NULL,
    "hours" INTEGER NOT NULL,
    "headcountAvg" DECIMAL(8,2) NOT NULL,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exposure_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exposure_revision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exposurePeriodId" TEXT NOT NULL,
    "previousHours" INTEGER NOT NULL,
    "previousHeadcountAvg" DECIMAL(8,2) NOT NULL,
    "newHours" INTEGER NOT NULL,
    "newHeadcountAvg" DECIMAL(8,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exposure_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_stats_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fatalChargeDays" INTEGER NOT NULL DEFAULT 6000,
    "severityBase" INTEGER NOT NULL DEFAULT 1000,
    "lostDaysCap" INTEGER NOT NULL DEFAULT 365,
    "exposureDueDay" INTEGER NOT NULL DEFAULT 10,
    "exposureOwnerUserId" TEXT,
    "showOptionalIndices" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_stats_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incident_record_findingId_key" ON "incident_record"("findingId");

-- CreateIndex
CREATE INDEX "incident_record_tenantId_periodMonth_siteId_idx" ON "incident_record"("tenantId", "periodMonth", "siteId");

-- CreateIndex
CREATE INDEX "incident_record_tenantId_classification_idx" ON "incident_record"("tenantId", "classification");

-- CreateIndex
CREATE INDEX "incident_record_siteId_occurredOn_idx" ON "incident_record"("siteId", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "incident_health_incidentRecordId_key" ON "incident_health"("incidentRecordId");

-- CreateIndex
CREATE INDEX "incident_health_tenantId_affectedPersonId_idx" ON "incident_health"("tenantId", "affectedPersonId");

-- CreateIndex
CREATE INDEX "incident_follow_up_incidentRecordId_at_idx" ON "incident_follow_up"("incidentRecordId", "at");

-- CreateIndex
CREATE INDEX "incident_follow_up_tenantId_at_idx" ON "incident_follow_up"("tenantId", "at");

-- CreateIndex
CREATE INDEX "exposure_period_tenantId_periodMonth_idx" ON "exposure_period"("tenantId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "exposure_period_siteId_periodMonth_employerKind_key" ON "exposure_period"("siteId", "periodMonth", "employerKind");

-- CreateIndex
CREATE INDEX "exposure_revision_exposurePeriodId_createdAt_idx" ON "exposure_revision"("exposurePeriodId", "createdAt");

-- CreateIndex
CREATE INDEX "exposure_revision_tenantId_createdAt_idx" ON "exposure_revision"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "safety_stats_settings_tenantId_key" ON "safety_stats_settings"("tenantId");

-- AddForeignKey
ALTER TABLE "incident_record" ADD CONSTRAINT "incident_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_record" ADD CONSTRAINT "incident_record_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_record" ADD CONSTRAINT "incident_record_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_health" ADD CONSTRAINT "incident_health_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_health" ADD CONSTRAINT "incident_health_incidentRecordId_fkey" FOREIGN KEY ("incidentRecordId") REFERENCES "incident_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_health" ADD CONSTRAINT "incident_health_affectedPersonId_fkey" FOREIGN KEY ("affectedPersonId") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_follow_up" ADD CONSTRAINT "incident_follow_up_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_follow_up" ADD CONSTRAINT "incident_follow_up_incidentRecordId_fkey" FOREIGN KEY ("incidentRecordId") REFERENCES "incident_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exposure_period" ADD CONSTRAINT "exposure_period_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exposure_period" ADD CONSTRAINT "exposure_period_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exposure_revision" ADD CONSTRAINT "exposure_revision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exposure_revision" ADD CONSTRAINT "exposure_revision_exposurePeriodId_fkey" FOREIGN KEY ("exposurePeriodId") REFERENCES "exposure_period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_stats_settings" ADD CONSTRAINT "safety_stats_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes que Prisma no expresa: la base los hace cumplir aunque falle un camino de escritura.

-- AddCheck
ALTER TABLE "incident_record"
  ADD CONSTRAINT "incident_record_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
  ADD CONSTRAINT "incident_record_hour_check" CHECK ("hourOfDay" BETWEEN 0 AND 23),
  ADD CONSTRAINT "incident_record_lost_days_check" CHECK ("lostDays" >= 0),
  ADD CONSTRAINT "incident_record_charge_pct_check" CHECK ("chargePct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "incident_record_fatal_days_check" CHECK ("classification" <> 'fatal' OR "lostDays" = 0),
  ADD CONSTRAINT "incident_record_restricted_check" CHECK (NOT "restrictedWork" OR "classification" = 'no_lost_time'),
  ADD CONSTRAINT "incident_record_return_check" CHECK ("returnToWorkDate" IS NULL OR "classification" = 'lost_time'),
  ADD CONSTRAINT "incident_record_itinere_check" CHECK (NOT "inItinere" OR "classification" NOT IN ('near_miss', 'occupational_disease'));

ALTER TABLE "incident_follow_up"
  ADD CONSTRAINT "incident_follow_up_lost_days_check" CHECK ("lostDays" >= 0),
  ADD CONSTRAINT "incident_follow_up_charge_pct_check" CHECK ("chargePct" BETWEEN 0 AND 100);

ALTER TABLE "exposure_period"
  ADD CONSTRAINT "exposure_period_hours_check" CHECK ("hours" >= 0),
  ADD CONSTRAINT "exposure_period_headcount_check" CHECK ("headcountAvg" >= 0);

ALTER TABLE "safety_stats_settings"
  ADD CONSTRAINT "safety_stats_settings_base_check" CHECK ("severityBase" IN (1000, 1000000)),
  ADD CONSTRAINT "safety_stats_settings_charge_check" CHECK ("fatalChargeDays" >= 0),
  ADD CONSTRAINT "safety_stats_settings_cap_check" CHECK ("lostDaysCap" BETWEEN 1 AND 3650),
  ADD CONSTRAINT "safety_stats_settings_due_day_check" CHECK ("exposureDueDay" BETWEEN 1 AND 28);

-- Aislamiento entre empresas y tipo del hallazgo (AT-16): un registro solo apunta a un hallazgo de
-- tipo incidente, y a una sede o persona, de su misma empresa.
CREATE FUNCTION "incident_record_check_links"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "finding" f
    WHERE f."id" = NEW."findingId" AND f."tenantId" = NEW."tenantId" AND f."type" = 'incident'
  ) THEN
    RAISE EXCEPTION 'incident_record: el hallazgo debe ser de tipo incidente y de la misma empresa';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "site" s WHERE s."id" = NEW."siteId" AND s."tenantId" = NEW."tenantId") THEN
    RAISE EXCEPTION 'incident_record: la sede debe ser de la misma empresa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "incident_record_check_links"
  BEFORE INSERT OR UPDATE OF "tenantId", "findingId", "siteId" ON "incident_record"
  FOR EACH ROW EXECUTE FUNCTION "incident_record_check_links"();

CREATE FUNCTION "incident_health_check_links"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "incident_record" r WHERE r."id" = NEW."incidentRecordId" AND r."tenantId" = NEW."tenantId"
  ) THEN
    RAISE EXCEPTION 'incident_health: la ficha debe ser de la misma empresa';
  END IF;
  IF NEW."affectedPersonId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "person" p WHERE p."id" = NEW."affectedPersonId" AND p."tenantId" = NEW."tenantId"
  ) THEN
    RAISE EXCEPTION 'incident_health: la persona debe ser de la misma empresa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "incident_health_check_links"
  BEFORE INSERT OR UPDATE OF "tenantId", "incidentRecordId", "affectedPersonId" ON "incident_health"
  FOR EACH ROW EXECUTE FUNCTION "incident_health_check_links"();

CREATE FUNCTION "exposure_period_check_links"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "site" s WHERE s."id" = NEW."siteId" AND s."tenantId" = NEW."tenantId") THEN
    RAISE EXCEPTION 'exposure_period: la sede debe ser de la misma empresa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "exposure_period_check_links"
  BEFORE INSERT OR UPDATE OF "tenantId", "siteId" ON "exposure_period"
  FOR EACH ROW EXECUTE FUNCTION "exposure_period_check_links"();
