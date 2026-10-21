import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBlock } from "@/components/ui";
import { loadSupplierAccess } from "@/app/(tenant)/t/[slug]/suppliers/access";
import { SupplierImport } from "@/app/(tenant)/t/[slug]/suppliers/import/SupplierImport";

export default async function ImportSuppliersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { canManage } = await loadSupplierAccess(slug);
  if (!canManage) notFound();
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/suppliers`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a proveedores
        </Link>
      </p>
      <SectionBlock
        eyebrow="Proveedores · ISO 9001 §8.4"
        title="Importar proveedores"
        what="Cargá muchos proveedores de una vez desde un CSV. Todos entran «sin evaluar»: importar nunca aprueba a nadie."
        next="subí el archivo, revisá la vista previa y confirmá. Reimportar el mismo archivo no duplica a nadie."
      >
        <SupplierImport slug={slug} />
      </SectionBlock>
    </div>
  );
}
