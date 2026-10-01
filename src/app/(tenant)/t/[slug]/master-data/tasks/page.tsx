import { listJobTasks } from "@/lib/masterdata";
import { CatalogSection } from "@/app/(tenant)/t/[slug]/master-data/CatalogSection";
import { loadMasterDataAccess } from "@/app/(tenant)/t/[slug]/master-data/access";

export default async function TasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadMasterDataAccess(slug);
  const tasks = await listJobTasks(tenant.id, { includeInactive: true });
  return (
    <CatalogSection
      slug={slug}
      entity="task"
      canManage={canManage}
      items={tasks.map((t) => ({ id: t.id, name: t.name, active: t.active, critical: t.critical }))}
    />
  );
}
