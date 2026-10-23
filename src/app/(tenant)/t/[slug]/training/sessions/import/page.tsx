import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { TrainingImport } from "@/app/(tenant)/t/[slug]/training/sessions/import/TrainingImport";
import { SectionBlock } from "@/components/ui";

export default async function ImportTrainingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { canRecord } = await loadTrainingAccess(slug);
  if (!canRecord) notFound();
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/training/sessions`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a Sesiones
        </Link>
      </p>
      <SectionBlock title="Importar el histórico" what="Cargá de una vez lo que ya se hizo, desde un CSV." next="descargá la plantilla, completala, subila, revisá la vista previa y confirmá. Reimportar el mismo archivo no duplica nada.">
        <TrainingImport slug={slug} />
      </SectionBlock>
    </div>
  );
}
