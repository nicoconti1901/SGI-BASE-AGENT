-- Un inspector no puede tener dos borradores abiertos del mismo activo y plantilla:
-- empezar dos veces (doble toque, reintento de red) devuelve el mismo borrador.
CREATE UNIQUE INDEX "inspection_one_draft_per_inspector_idx"
  ON "inspection" ("tenantId", "assetId", "templateId", "inspectorUserId")
  WHERE "status" = 'draft' AND "assetId" IS NOT NULL;
