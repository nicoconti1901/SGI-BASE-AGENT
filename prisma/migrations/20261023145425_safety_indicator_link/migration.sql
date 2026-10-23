-- CreateTable
CREATE TABLE "safety_indicator_link" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_indicator_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "safety_indicator_link_indicatorId_idx" ON "safety_indicator_link"("indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "safety_indicator_link_tenantId_metric_key" ON "safety_indicator_link"("tenantId", "metric");

-- Solo los cuatro índices del tablero pueden tener meta.
ALTER TABLE "safety_indicator_link" ADD CONSTRAINT "safety_indicator_link_metric_check" CHECK ("metric" IN ('if', 'ig', 'ii', 'id'));

-- AddForeignKey
ALTER TABLE "safety_indicator_link" ADD CONSTRAINT "safety_indicator_link_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_indicator_link" ADD CONSTRAINT "safety_indicator_link_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
