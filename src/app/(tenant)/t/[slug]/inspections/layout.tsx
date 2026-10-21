import { PageFrame, PageHeader } from "@/components/ui";
import { InspectionTabs } from "@/app/(tenant)/t/[slug]/inspections/InspectionTabs";
import { requireModuleForSlug } from "@/lib/modules";

export default async function InspectionsLayout({ children, params }: LayoutProps<"/t/[slug]/inspections">) {
  const { slug } = await params;
  await requireModuleForSlug(slug, "inspections");
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Inspecciones · ISO 45001 §8.1 y §9.1.1 · ISO 14001 §9.1.1"
        title="Inspecciones"
        purpose="Controlá tus equipos con evidencia: el resultado, el estado del equipo y la próxima fecha salen solos."
      />
      <InspectionTabs
        tabs={[
          { href: `/t/${slug}/inspections`, label: "Inspecciones" },
          { href: `/t/${slug}/assets`, label: "Activos" },
        ]}
      />
      {children}
    </PageFrame>
  );
}
