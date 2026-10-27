import Link from "next/link";
import { notFound } from "next/navigation";
import { listTemplates } from "@/lib/inspection-templates";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { formatDateEs, isoFromDate } from "@/domain/inspections/dates";
import { describeInterval } from "@/domain/inspections/templates/edit";
import { EmptyState, SectionBlock, StatusChip } from "@/components/ui";

export default async function TemplatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, canViewTemplates, canManageTemplates } = await loadInspectionsAccess(slug);
  if (!canViewTemplates) notFound();
  const templates = await listTemplates(tenant.id);

  return (
    <SectionBlock
      title="Plantillas"
      what="Los ítems que se controlan en cada tipo de inspección. Editar una plantilla crea una versión nueva; las inspecciones ya hechas no cambian."
      next={canManageTemplates ? "abrí una plantilla para ajustar sus ítems, su criticidad o la frecuencia." : "consultá qué se controla en cada inspección. Las edita el administrador."}
    >
      {templates.length === 0 ? (
        <EmptyState what="Todavía no hay plantillas." next="se cargan solas al activar el módulo; si no aparecen, avisale al administrador de la plataforma." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Plantillas de inspección</caption>
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Plantilla</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Frecuencia</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Ítems</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Versión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    <Link href={`/t/${slug}/inspections/templates/${t.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{describeInterval(t.intervalUnit, t.intervalValue)}</td>
                  <td className="px-4 py-3 tabular-nums">{t.itemCount}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums">v{t.activeVersion?.version ?? 1}</span>
                      {(t.activeVersion?.version ?? 1) > 1 ? (
                        <StatusChip status="info" label={`Editada ${t.activeVersion ? formatDateEs(isoFromDate(t.activeVersion.createdAt)) : ""}`.trim()} />
                      ) : (
                        <span className="text-xs text-[var(--color-ink-muted)]">Original</span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionBlock>
  );
}
