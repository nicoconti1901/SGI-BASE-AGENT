import Link from "next/link";
import { notFound } from "next/navigation";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { AssetImport } from "@/app/(tenant)/t/[slug]/assets/import/AssetImport";
import { ASSET_TYPES, isAssetTypeKey } from "@/domain/inspections/asset-types";
import { assetCsvTemplate } from "@/domain/inspections/asset-types/csv";
import { SectionBlock, buttonClass } from "@/components/ui";

export default async function ImportAssetsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const { slug } = await params;
  const { tipo } = await searchParams;
  const { canImportAssets } = await loadInspectionsAccess(slug);
  if (!canImportAssets) notFound();
  const type = ASSET_TYPES[tipo && isAssetTypeKey(tipo) ? tipo : "extinguisher"];
  const types = Object.values(ASSET_TYPES);
  const template = assetCsvTemplate(type);
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
            <Link key={t.key} href={`/t/${slug}/assets/import?tipo=${t.key}`} aria-current={t.key === type.key ? "page" : undefined} className={buttonClass(t.key === type.key ? "primary" : "secondary", "min-h-10")}>
              {t.plural}
            </Link>
          ))}
        </nav>
      ) : null}
      <SectionBlock
        title={`Importar ${type.plural.toLowerCase()}`}
        what="Cargá o actualizá muchos activos de una vez desde un CSV."
        next="descargá la plantilla, completala, subila, revisá la vista previa y confirmá. Reimportar el mismo archivo no duplica nada."
      >
        <AssetImport key={type.key} slug={slug} typeKey={type.key} typeLabel={type.label} columns={template.trim().split(",").join(", ")} template={template} />
      </SectionBlock>
    </div>
  );
}
