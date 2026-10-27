import Link from "next/link";
import { notFound } from "next/navigation";
import { listSites } from "@/lib/masterdata";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { AssetForm } from "@/app/(tenant)/t/[slug]/assets/AssetForms";
import { ASSET_TYPES, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { EmptyState, SectionBlock, buttonClass } from "@/components/ui";

export default async function NewAssetPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const { slug } = await params;
  const { tipo } = await searchParams;
  const { tenant, canManageAssets } = await loadInspectionsAccess(slug);
  if (!canManageAssets) notFound();
  const type = ASSET_TYPES[tipo && isAssetTypeKey(tipo) ? tipo : "extinguisher"];
  const sites = await listSites(tenant.id);
  const types = Object.values(ASSET_TYPES);

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/assets`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a activos
        </Link>
      </p>
      {types.length > 1 ? (
        <nav aria-label="Tipo de activo" className="flex flex-wrap gap-2">
          {types.map((t) => (
            <Link key={t.key} href={`/t/${slug}/assets/new?tipo=${t.key}`} aria-current={t.key === type.key ? "page" : undefined} className={buttonClass(t.key === type.key ? "primary" : "secondary", "min-h-10")}>
              {t.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <SectionBlock title={`Registrar ${type.label.toLowerCase()}`} what="Los datos del equipo y sus vencimientos. Lo demás (estado, próxima inspección) lo calcula el sistema.">
        {sites.length === 0 ? (
          <EmptyState what="Falta cargar al menos una sede." next="registrala en Datos maestros y volvé." action={{ href: `/t/${slug}/master-data/sites`, label: "Cargar sedes" }} />
        ) : (
          <AssetForm key={type.key} slug={slug} typeKey={type.key} fields={type.fields} dueKindLabels={type.dueKindLabels} sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
        )}
      </SectionBlock>
    </div>
  );
}
