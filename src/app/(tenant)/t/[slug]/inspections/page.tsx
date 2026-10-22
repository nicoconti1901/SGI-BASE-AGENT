import Link from "next/link";
import { listInspections } from "@/lib/inspections";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { formatDateEs, isoFromDate } from "@/domain/inspections/dates";
import { RESULT_LABELS, type InspectionResult } from "@/domain/inspections/types";
import { EmptyState, FormError, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

const RESULT_CHIP: Record<InspectionResult, "ok" | "warning" | "danger"> = { fit: "ok", fit_with_observations: "warning", unfit: "danger" };

export default async function InspectionsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ despues?: string; error?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canWrite } = await loadInspectionsAccess(slug);
  const page = await listInspections(tenant.id, { after: sp.despues });
  const base = `/t/${slug}/inspections`;

  return (
    <SectionBlock
      title="Inspecciones"
      what="Cada control queda con su resultado, sus fotos y quién lo firmó."
      next={canWrite ? "tocá «Nueva inspección», elegí el activo y respondé el listado." : "consultá las inspecciones hechas."}
      actions={
        canWrite ? (
          <Link href={`${base}/new`} className={buttonClass("primary", "min-h-12")}>
            Nueva inspección
          </Link>
        ) : undefined
      }
    >
      {sp.error ? <FormError>{sp.error}</FormError> : null}
      {page.items.length === 0 ? (
        <EmptyState
          what="Todavía no hay inspecciones."
          next={canWrite ? "cargá los activos que vas a controlar y empezá la primera inspección." : "cuando se haga la primera, la vas a ver acá."}
          action={{ href: `/t/${slug}/assets`, label: "Ir a Activos" }}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Inspecciones de la empresa</caption>
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Fecha</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Activo</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Sede</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Inspector</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {page.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 tabular-nums">{formatDateEs(isoFromDate(i.inspectedAt))}</td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/${i.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {i.asset?.code ?? i.template.name}
                    </Link>
                    <span className="block text-xs text-[var(--color-ink-muted)]">{i.template.name}</span>
                  </td>
                  <td className="px-4 py-3">{i.site.name}</td>
                  <td className="px-4 py-3">{i.inspectorName}</td>
                  <td className="px-4 py-3">{i.result ? <StatusChip status={RESULT_CHIP[i.result]} label={RESULT_LABELS[i.result]} /> : <StatusChip status="pending" label="Borrador" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor ? (
        <p>
          <Link href={`${base}?despues=${page.nextCursor}`} className={buttonClass("ghost")}>
            Ver las siguientes
          </Link>
        </p>
      ) : null}
    </SectionBlock>
  );
}
