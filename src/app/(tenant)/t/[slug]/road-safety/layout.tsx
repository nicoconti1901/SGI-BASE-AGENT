import Link from "next/link";
import { PageFrame, PageHeader, buttonClass } from "@/components/ui";
import { SafetyTabs } from "@/app/(tenant)/t/[slug]/safety/SafetyTabs";
import { loadRoadAccess } from "@/app/(tenant)/t/[slug]/road-safety/access";
import { requireModuleForSlug } from "@/lib/modules";

export default async function RoadSafetyLayout({ children, params }: LayoutProps<"/t/[slug]/road-safety">) {
  const { slug } = await params;
  await requireModuleForSlug(slug, "road_safety");
  const { canReport, canManage } = await loadRoadAccess(slug);
  const base = `/t/${slug}/road-safety`;
  return (
    <PageFrame>
      <PageHeader
        eyebrow="ISO 39001"
        title="Seguridad vial"
        purpose="Los hechos de tránsito se registran una sola vez, como incidentes con su detalle vial. Con los km de cada vehículo se calculan las tasas por millón de km."
        actions={
          canReport ? (
            <Link href={`/t/${slug}/findings/new?type=incident`} className={buttonClass("primary")}>
              Registrar hecho de tránsito
            </Link>
          ) : null
        }
      />
      <SafetyTabs
        tabs={[
          { href: base, label: "Tablero" },
          { href: `${base}/km`, label: "Km del mes" },
          ...(canManage ? [{ href: `${base}/conductores`, label: "Conductores" }] : []),
          { href: `${base}/ajustes`, label: "Ajustes" },
          { href: `${base}/guia`, label: "Guía" },
        ]}
      />
      {children}
    </PageFrame>
  );
}
