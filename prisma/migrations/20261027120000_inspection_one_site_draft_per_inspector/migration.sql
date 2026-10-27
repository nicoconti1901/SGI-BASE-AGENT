-- Inspecciones de área (zona de obradores): un inspector no puede tener dos borradores abiertos de la misma sede y
-- plantilla. Complementa "inspection_one_draft_per_inspector_idx", que solo cubre las inspecciones sobre un activo.
CREATE UNIQUE INDEX "inspection_one_site_draft_per_inspector_idx"
  ON "inspection" ("tenantId", "siteId", "templateId", "inspectorUserId")
  WHERE "status" = 'draft' AND "assetId" IS NULL;
