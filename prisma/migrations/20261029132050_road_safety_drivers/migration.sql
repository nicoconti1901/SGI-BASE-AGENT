-- AlterTable
ALTER TABLE "road_safety_settings" ADD COLUMN     "driverTaskId" TEXT;

-- CreateTable
CREATE TABLE "road_driver" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "licenseExpiresOn" DATE,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "road_driver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "road_driver_tenantId_licenseExpiresOn_idx" ON "road_driver"("tenantId", "licenseExpiresOn");

-- CreateIndex
CREATE UNIQUE INDEX "road_driver_personId_key" ON "road_driver"("personId");

-- AddForeignKey
ALTER TABLE "road_safety_settings" ADD CONSTRAINT "road_safety_settings_driverTaskId_fkey" FOREIGN KEY ("driverTaskId") REFERENCES "job_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_driver" ADD CONSTRAINT "road_driver_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_driver" ADD CONSTRAINT "road_driver_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
