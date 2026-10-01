import { notFound } from "next/navigation";
import { listJobPositions, listJobTasks, listSites } from "@/lib/masterdata";
import { listTenantMemberOptions } from "@/lib/findings";
import { loadMasterDataAccess } from "@/app/(tenant)/t/[slug]/master-data/access";
import { PersonForm } from "@/app/(tenant)/t/[slug]/master-data/PersonForms";
import { EmptyState, SectionBlock } from "@/components/ui";

export default async function NewPersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadMasterDataAccess(slug);
  if (!canManage) notFound();
  const [sites, positions, tasks, members] = await Promise.all([
    listSites(tenant.id),
    listJobPositions(tenant.id),
    listJobTasks(tenant.id),
    listTenantMemberOptions(tenant.id),
  ]);
  const base = `/t/${slug}/master-data`;

  return (
    <SectionBlock title="Registrar persona" what="Cada persona tiene un puesto, una sede base y, si rota, sedes adicionales.">
      {sites.length === 0 || positions.length === 0 ? (
        <EmptyState
          what="Falta cargar al menos una sede y un puesto."
          next="registralos primero (o importá la nómina, que los crea con tu confirmación)."
          action={{ href: sites.length === 0 ? `${base}/sites` : `${base}/positions`, label: sites.length === 0 ? "Cargar sedes" : "Cargar puestos" }}
        />
      ) : (
        <PersonForm
          slug={slug}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          positions={positions.map((p) => ({ id: p.id, name: p.name }))}
          tasks={tasks.map((t) => ({ id: t.id, name: t.name, critical: t.critical }))}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
        />
      )}
    </SectionBlock>
  );
}
