/*
  Warnings:

  - You are about to drop the `corrective_action` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nonconformity` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "corrective_action" DROP CONSTRAINT "corrective_action_nonconformityId_fkey";

-- DropForeignKey
ALTER TABLE "corrective_action" DROP CONSTRAINT "corrective_action_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "nonconformity" DROP CONSTRAINT "nonconformity_tenantId_fkey";

-- DropTable
DROP TABLE "corrective_action";

-- DropTable
DROP TABLE "nonconformity";
