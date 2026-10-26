import { InspectionTabs } from "@/app/(tenant)/t/[slug]/inspections/InspectionTabs";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";

/** Pestañas de Inspecciones y Activos. «Plantillas» solo para quien registra inspecciones; «Consulta» no las ve. */
export async function InspectionNav({ slug }: { slug: string }) {
  const { canViewTemplates } = await loadInspectionsAccess(slug);
  return (
    <InspectionTabs
      tabs={[
        { href: `/t/${slug}/inspections`, label: "Inspecciones" },
        { href: `/t/${slug}/assets`, label: "Activos" },
        ...(canViewTemplates ? [{ href: `/t/${slug}/inspections/templates`, label: "Plantillas" }] : []),
        { href: `/t/${slug}/inspections/guia`, label: "Guía" },
      ]}
    />
  );
}
