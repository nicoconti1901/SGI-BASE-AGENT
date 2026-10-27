-- AlterTable
ALTER TABLE "inspection" ADD COLUMN     "contractorName" TEXT,
ADD COLUMN     "jobTaskId" TEXT,
ADD COLUMN     "specialTasks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "supervisorPersonId" TEXT;

-- CreateTable
CREATE TABLE "inspection_target" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "monthlyTarget" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_target_tenantId_siteId_idx" ON "inspection_target"("tenantId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_target_templateId_siteId_key" ON "inspection_target"("templateId", "siteId");

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_jobTaskId_fkey" FOREIGN KEY ("jobTaskId") REFERENCES "job_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_supervisorPersonId_fkey" FOREIGN KEY ("supervisorPersonId") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_target" ADD CONSTRAINT "inspection_target_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_target" ADD CONSTRAINT "inspection_target_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "inspection_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_target" ADD CONSTRAINT "inspection_target_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las tareas especiales de la auditoría de campo son un conjunto cerrado; la meta mensual es un entero positivo y acotado.
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_special_tasks_check"
  CHECK ("specialTasks" <@ ARRAY['height', 'confined_space', 'lifting']::TEXT[]);

ALTER TABLE "inspection_target" ADD CONSTRAINT "inspection_target_monthly_target_check"
  CHECK ("monthlyTarget" BETWEEN 1 AND 200);
