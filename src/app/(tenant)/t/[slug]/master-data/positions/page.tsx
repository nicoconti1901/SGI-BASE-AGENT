import { listJobPositions } from "@/lib/masterdata";
import { CatalogSection } from "@/app/(tenant)/t/[slug]/master-data/CatalogSection";
import { loadMasterDataAccess } from "@/app/(tenant)/t/[slug]/master-data/access";

export default async function PositionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadMasterDataAccess(slug);
  const positions = await listJobPositions(tenant.id, { includeInactive: true });
  return (
    <CatalogSection
      slug={slug}
      entity="position"
      canManage={canManage}
      items={positions.map((p) => ({ id: p.id, name: p.name, active: p.active }))}
    />
  );
}
