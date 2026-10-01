import { listSites } from "@/lib/masterdata";
import { CatalogSection } from "@/app/(tenant)/t/[slug]/master-data/CatalogSection";
import { loadMasterDataAccess } from "@/app/(tenant)/t/[slug]/master-data/access";

export default async function SitesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadMasterDataAccess(slug);
  const sites = await listSites(tenant.id, { includeInactive: true });
  return (
    <CatalogSection
      slug={slug}
      entity="site"
      canManage={canManage}
      items={sites.map((s) => ({ id: s.id, name: s.name, active: s.active, kind: s.kind, address: s.address }))}
    />
  );
}
