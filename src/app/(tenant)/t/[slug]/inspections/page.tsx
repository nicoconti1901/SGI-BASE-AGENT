import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { EmptyState, SectionBlock } from "@/components/ui";

export default async function InspectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { canWrite } = await loadInspectionsAccess(slug);
  return (
    <SectionBlock
      title="Inspecciones"
      what="Cada control queda con su resultado, sus fotos y quién lo firmó."
      next={canWrite ? "elegí un activo y tocá «Inspeccionar»." : "consultá las inspecciones hechas."}
    >
      <EmptyState
        what="Todavía no hay inspecciones."
        next="primero cargá los activos que vas a controlar."
        action={{ href: `/t/${slug}/assets`, label: "Ir a Activos" }}
      />
    </SectionBlock>
  );
}
