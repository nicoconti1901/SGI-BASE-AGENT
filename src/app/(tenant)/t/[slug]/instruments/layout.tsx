import { PageFrame, PageHeader } from "@/components/ui";
import { requireModuleForSlug } from "@/lib/modules";

export default async function InstrumentsLayout({ children, params }: LayoutProps<"/t/[slug]/instruments">) {
  const { slug } = await params;
  await requireModuleForSlug(slug, "instruments");
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Equipos de medición · ISO 9001 §7.1.5 · ISO 14001 y 45001 §9.1.1"
        title="Equipos de medición"
        purpose="Qué equipos podés usar hoy y cuáles no, con la evidencia de su calibración."
        guideHref={`/t/${slug}/instruments/guia`}
        guideLabel="Guía de equipos de medición →"
      />
      {children}
    </PageFrame>
  );
}
