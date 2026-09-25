-- CreateEnum
CREATE TYPE "IsoStandard" AS ENUM ('ISO9001', 'ISO14001', 'ISO45001');

-- CreateTable
CREATE TABLE "iso_requirement" (
    "id" TEXT NOT NULL,
    "standard" "IsoStandard" NOT NULL,
    "clauseCode" TEXT NOT NULL,
    "clauseKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "essential" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iso_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iso_requirement_clauseKey_key" ON "iso_requirement"("clauseKey");

-- CreateIndex
CREATE INDEX "iso_requirement_standard_essential_idx" ON "iso_requirement"("standard", "essential");
