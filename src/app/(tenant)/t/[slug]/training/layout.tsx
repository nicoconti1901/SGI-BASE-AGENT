import { PageFrame, PageHeader } from "@/components/ui";
import { TrainingTabs } from "@/app/(tenant)/t/[slug]/training/TrainingTabs";
import { requireModuleForSlug } from "@/lib/modules";

export default async function TrainingLayout({ children, params }: LayoutProps<"/t/[slug]/training">) {
  const { slug } = await params;
  await requireModuleForSlug(slug, "training");
  const base = `/t/${slug}/training`;
  return (
    <PageFrame>
      <PageHeader
        eyebrow="ISO 9001 · 14001 · 45001 · §7.2 y §7.3"
        title="Capacitaciones"
        purpose="Qué necesita saber cada persona según su puesto y sus tareas, y quién está al día."
      />
      <TrainingTabs
        tabs={[
          { href: base, label: "Resumen" },
          { href: `${base}/compliance`, label: "Cumplimiento" },
          { href: `${base}/sessions`, label: "Sesiones" },
          { href: `${base}/effectiveness`, label: "Eficacia" },
          { href: `${base}/plan`, label: "Plan anual" },
          { href: `${base}/courses`, label: "Cursos" },
          { href: `${base}/requirements`, label: "Requisitos" },
        ]}
      />
      {children}
    </PageFrame>
  );
}
