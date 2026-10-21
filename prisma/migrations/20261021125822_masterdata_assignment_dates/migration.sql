-- AlterTable
ALTER TABLE "person" ADD COLUMN     "positionSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "person_job_task" ADD COLUMN     "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: las asignaciones existentes cuentan desde el ingreso de la persona (o su alta si no hay fecha),
-- no desde esta migración. positionSince queda NULL en las personas existentes: significa "desde el ingreso".
UPDATE "person_job_task" pjt
SET "assignedAt" = COALESCE(p."hiredAt", p."createdAt")
FROM "person" p
WHERE pjt."personId" = p."id";
