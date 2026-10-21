import Link from "next/link";
import { EmptyState, PageHeader, SectionBlock, StatusChip, buttonClass } from "@/components/ui";
import { getApprovedList } from "@/lib/suppliers";
import { loadSupplierAccess } from "@/app/(tenant)/t/[slug]/suppliers/access";
import { PrintButton } from "@/app/(tenant)/t/[slug]/suppliers/approved/PrintButton";
import { formatDateTimeAr } from "@/domain/suppliers/approved-list";
import { formatCuit } from "@/domain/suppliers/cuit";
import { isoDay } from "@/domain/suppliers/dates";
import { SUPPLIER_CRITICALITY_LABELS, SUPPLIER_TYPE_LABELS } from "@/domain/suppliers/types";

const dmy = (date: Date) => isoDay(date).split("-").reverse().join("/");

export default async function ApprovedListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, ctx } = await loadSupplierAccess(slug);
  const list = await getApprovedList(tenant.id);
  const base = `/t/${slug}/suppliers`;

  return (
    <>
      <PageHeader
        eyebrow="Proveedores · ISO 9001 §8.4.1"
        title="Lista de aprobados"
        purpose="Los proveedores que hoy se pueden usar: aprobados o con condiciones, y con su documentación al día."
        actions={
          <>
            <a href={`${base}/approved/export`} className={buttonClass("primary")}>
              Descargar CSV
            </a>
            <PrintButton slug={slug} />
            <Link href={base} className={buttonClass("ghost")}>
              Volver a la lista
            </Link>
          </>
        }
      />
      <SectionBlock
        title={`Aprobados vigentes (${list.entries.length})`}
        what={`Generada el ${formatDateTimeAr(list.generatedAt)} por ${ctx.name}.`}
      >
        {list.entries.length === 0 ? (
          <EmptyState what="Todavía no hay proveedores aprobados." next="evaluá a los proveedores para que figuren acá." action={{ href: base, label: "Ver proveedores" }} />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <caption className="sr-only">Lista de proveedores aprobados</caption>
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Razón social</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">CUIT</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Tipo</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Criticidad</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Próxima reevaluación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {list.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <Link href={`${base}/${e.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                        {e.legalName}
                      </Link>
                      {e.category ? <span className="block text-xs text-[var(--color-ink-muted)]">{e.category}</span> : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{e.taxId ? formatCuit(e.taxId) : "—"}</td>
                    <td className="px-4 py-3">{SUPPLIER_TYPE_LABELS[e.type]}</td>
                    <td className="px-4 py-3">{SUPPLIER_CRITICALITY_LABELS[e.criticality]}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={e.withConditions ? "warning" : "ok"} label={e.withConditions ? "Con condiciones" : "Aprobado"} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{e.nextEvaluationDueAt ? dmy(e.nextEvaluationDueAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-[var(--color-ink-muted)]">
          {list.excludedForDocs} no figuran por documentación vencida o faltante.
        </p>
      </SectionBlock>
    </>
  );
}
