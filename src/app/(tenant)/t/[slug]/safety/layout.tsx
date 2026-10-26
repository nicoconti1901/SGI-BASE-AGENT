import Link from "next/link";
import { PageFrame, PageHeader, buttonClass } from "@/components/ui";
import { SafetyTabs } from "@/app/(tenant)/t/[slug]/safety/SafetyTabs";
import { loadSafetyAccess } from "@/app/(tenant)/t/[slug]/safety/access";
import { requireModuleForSlug } from "@/lib/modules";

export default async function SafetyModuleLayout({ children, params }: LayoutProps<"/t/[slug]/safety">) {
  const { slug } = await params;
  await requireModuleForSlug(slug, "safety_stats");
  const { canReport, canManage } = await loadSafetyAccess(slug);
  const base = `/t/${slug}/safety`;
  return (
    <PageFrame>
      <PageHeader
        eyebrow="ISO 45001 · §9.1.1 · §10.2"
        title="Accidentabilidad"
        purpose="Cada accidente se registra una sola vez, como un hallazgo de tipo incidente con su ficha. Los índices se calculan solos con las horas que cargás."
        guideHref={`${base}/guia`}
        guideLabel="Guía de accidentabilidad →"
        actions={
          canReport ? (
            <Link href={`/t/${slug}/findings/new?type=incident`} className={buttonClass("primary")}>
              Registrar accidente
            </Link>
          ) : null
        }
      />
      <SafetyTabs
        tabs={[
          { href: `${base}/stats`, label: "Tablero" },
          { href: base, label: "Casos" },
          { href: `${base}/exposure`, label: "Horas trabajadas" },
          ...(canManage ? [{ href: `${base}/settings`, label: "Ajustes" }] : []),
        ]}
      />
      {children}
    </PageFrame>
  );
}
