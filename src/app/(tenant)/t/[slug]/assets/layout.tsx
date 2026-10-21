import { PageFrame, PageHeader } from "@/components/ui";
import { InspectionTabs } from "@/app/(tenant)/t/[slug]/inspections/InspectionTabs";
import { requireAssetsModuleForSlug } from "@/app/(tenant)/t/[slug]/inspections/access";

export default async function AssetsLayout({ children, params }: LayoutProps<"/t/[slug]/assets">) {
  const { slug } = await params;
  await requireAssetsModuleForSlug(slug);
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Inspecciones · activos"
        title="Activos"
        purpose="Los equipos que controlás: dónde están, cómo están y cuándo vence cada cosa."
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
