import Link from "next/link";
import { notFound } from "next/navigation";
import { listSites } from "@/lib/masterdata";
import { loadInstrumentsAccess } from "@/app/(tenant)/t/[slug]/instruments/access";
import { InstrumentForm } from "@/app/(tenant)/t/[slug]/instruments/InstrumentForm";
import { EmptyState, SectionBlock } from "@/components/ui";

export default async function NewInstrumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canManage } = await loadInstrumentsAccess(slug);
  if (!canManage) notFound();
  const sites = await listSites(tenant.id);

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href={`/t/${slug}/instruments`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a equipos
        </Link>
      </p>
      <SectionBlock
        title="Registrar un equipo de medición"
        what="Los datos del equipo y cuándo lo aceptás: el estado (vigente, por vencer, vencido) lo calcula el sistema con cada calibración."
      >
        {sites.length === 0 ? (
          <EmptyState what="Falta cargar al menos una sede." next="registrala en Datos maestros y volvé." action={{ href: `/t/${slug}/master-data/sites`, label: "Cargar sedes" }} />
        ) : (
          <InstrumentForm slug={slug} sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
        )}
      </SectionBlock>
    </div>
  );
}
