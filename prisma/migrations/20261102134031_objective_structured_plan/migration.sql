-- AlterTable
ALTER TABLE "objective" ADD COLUMN     "planEvaluation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "planResources" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "planSteps" JSONB NOT NULL DEFAULT '[]';
