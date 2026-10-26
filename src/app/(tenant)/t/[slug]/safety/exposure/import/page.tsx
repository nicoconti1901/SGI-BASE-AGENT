import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSafetyAccess } from "@/app/(tenant)/t/[slug]/safety/access";
import { ExposureImport } from "@/app/(tenant)/t/[slug]/safety/exposure/import/ExposureImport";
import { SectionBlock } from "@/components/ui";

export default async function ImportExposurePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { canManage } = await loadSafetyAccess(slug);
  if (!canManage) notFound();
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/safety/exposure`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a Horas trabajadas
        </Link>
      </p>
      <SectionBlock
        title="Importar horas trabajadas"
        what="Cargá varios meses y sedes de una vez, desde un CSV."
        next="descargá la plantilla, completala, subila, revisá la vista previa y confirmá. Reimportar el mismo archivo no cambia nada."
      >
        <ExposureImport slug={slug} />
      </SectionBlock>
    </div>
  );
}
