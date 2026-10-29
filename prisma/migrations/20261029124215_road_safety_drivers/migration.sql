-- AlterTable
ALTER TABLE "road_safety_settings" ADD COLUMN     "driverTaskId" TEXT;

-- CreateTable
CREATE TABLE "driver_license" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "expiresOn" DATE NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_license_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_license_tenantId_expiresOn_idx" ON "driver_license"("tenantId", "expiresOn");

-- CreateIndex
CREATE UNIQUE INDEX "driver_license_personId_key" ON "driver_license"("personId");

-- AddForeignKey
ALTER TABLE "road_safety_settings" ADD CONSTRAINT "road_safety_settings_driverTaskId_fkey" FOREIGN KEY ("driverTaskId") REFERENCES "job_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_license" ADD CONSTRAINT "driver_license_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_license" ADD CONSTRAINT "driver_license_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
