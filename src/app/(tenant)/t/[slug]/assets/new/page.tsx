import Link from "next/link";
import { notFound } from "next/navigation";
import { listSites } from "@/lib/masterdata";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { AssetForm } from "@/app/(tenant)/t/[slug]/assets/AssetForms";
import { ASSET_TYPES, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { EmptyState, SectionBlock } from "@/components/ui";

export default async function NewAssetPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const { slug } = await params;
  const { tipo } = await searchParams;
  const { tenant, canManageAssets } = await loadInspectionsAccess(slug);
  if (!canManageAssets) notFound();
  const type = ASSET_TYPES[tipo && isAssetTypeKey(tipo) ? tipo : "extinguisher"];
  const sites = await listSites(tenant.id);

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/assets`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a activos
        </Link>
      </p>
      <SectionBlock title={`Registrar ${type.label.toLowerCase()}`} what="Los datos del equipo y sus vencimientos. Lo demás (estado, próxima inspección) lo calcula el sistema.">
        {sites.length === 0 ? (
          <EmptyState what="Falta cargar al menos una sede." next="registrala en Datos maestros y volvé." action={{ href: `/t/${slug}/master-data/sites`, label: "Cargar sedes" }} />
        ) : (
          <AssetForm slug={slug} typeKey={type.key} fields={type.fields} dueKindLabels={type.dueKindLabels} sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
        )}
      </SectionBlock>
    </div>
  );
}
