import Link from "next/link";
import { notFound } from "next/navigation";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { AssetImport } from "@/app/(tenant)/t/[slug]/assets/import/AssetImport";
import { ASSET_TYPES } from "@/domain/inspections/asset-types";
import { assetCsvTemplate } from "@/domain/inspections/asset-types/csv";
import { SectionBlock } from "@/components/ui";

export default async function ImportAssetsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { canImportAssets } = await loadInspectionsAccess(slug);
  if (!canImportAssets) notFound();
  const type = ASSET_TYPES.extinguisher;
  const template = assetCsvTemplate(type);
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/assets`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a activos
        </Link>
      </p>
      <SectionBlock
        title={`Importar ${type.plural.toLowerCase()}`}
        what="Cargá o actualizá muchos activos de una vez desde un CSV."
        next="descargá la plantilla, completala, subila, revisá la vista previa y confirmá. Reimportar el mismo archivo no duplica nada."
      >
        <AssetImport slug={slug} typeKey={type.key} typeLabel={type.label} columns={template.trim().split(",").join(", ")} template={template} />
      </SectionBlock>
    </div>
  );
}
