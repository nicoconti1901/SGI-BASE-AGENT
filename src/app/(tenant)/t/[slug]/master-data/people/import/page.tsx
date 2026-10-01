import Link from "next/link";
import { notFound } from "next/navigation";
import { loadMasterDataAccess } from "@/app/(tenant)/t/[slug]/master-data/access";
import { RosterImport } from "@/app/(tenant)/t/[slug]/master-data/people/import/RosterImport";
import { SectionBlock } from "@/components/ui";

export default async function ImportPeoplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { canManage } = await loadMasterDataAccess(slug);
  if (!canManage) notFound();
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/master-data/people`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a personas
        </Link>
      </p>
      <SectionBlock
        title="Importar nómina"
        what="Cargá o actualizá muchas personas de una vez desde un CSV."
        next="subí el archivo, revisá la vista previa y confirmá. Reimportar el mismo archivo no duplica a nadie."
      >
        <RosterImport slug={slug} />
      </SectionBlock>
    </div>
  );
}
