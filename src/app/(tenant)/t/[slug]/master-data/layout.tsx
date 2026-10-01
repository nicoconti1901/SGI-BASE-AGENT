import { PageFrame, PageHeader } from "@/components/ui";
import { MasterDataTabs } from "@/app/(tenant)/t/[slug]/master-data/MasterDataTabs";

export default async function MasterDataLayout({ children, params }: LayoutProps<"/t/[slug]/master-data">) {
  const { slug } = await params;
  const base = `/t/${slug}/master-data`;
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Datos maestros · base de inspecciones, capacitaciones y estadísticas"
        title="Datos maestros"
        purpose="Dónde trabaja la empresa y qué hace su gente. Los demás módulos eligen de acá."
      />
      <MasterDataTabs
        tabs={[
          { href: `${base}/people`, label: "Personas" },
          { href: `${base}/sites`, label: "Sedes" },
          { href: `${base}/positions`, label: "Puestos" },
          { href: `${base}/tasks`, label: "Tareas" },
        ]}
      />
      {children}
    </PageFrame>
  );
}
