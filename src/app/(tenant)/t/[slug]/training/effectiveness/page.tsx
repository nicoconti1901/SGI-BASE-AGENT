import Link from "next/link";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { listEffectivenessInbox } from "@/lib/training-followup";
import { EmptyState, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

const day = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

/** Bandeja del evaluador: las capacitaciones cuya eficacia todavía no se evaluó, la más urgente primero. */
export default async function EffectivenessInboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, ctx, canManage, canRecord } = await loadTrainingAccess(slug);
  // Quien gestiona ve todo; el resto, solo lo que le designaron.
  const items = await listEffectivenessInbox(tenant.id, canManage ? {} : { evaluatorUserId: ctx.userId });
  const base = `/t/${slug}/training`;

  return (
    <SectionBlock
      title="Eficacia"
      what="¿Lo que se enseñó se aplica en el trabajo? Se evalúa un tiempo después de la capacitación, solo en los cursos que lo piden."
      next={
        canRecord
          ? "abrí una capacitación, indicá cómo se evaluó y marcá a quien no alcanzó el resultado. Si no fue eficaz, creá una acción o reprogramá."
          : "consultá las evaluaciones pendientes."
      }
    >
      {items.length === 0 ? (
        <EmptyState
          what="No hay evaluaciones de eficacia pendientes."
          next={canManage ? "los cursos con «Requiere evaluar eficacia» aparecen acá después de cada sesión." : "cuando te designen como evaluador, las vas a ver acá."}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Evaluaciones de eficacia pendientes</caption>
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Curso</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Dictado</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Personas</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Evaluar antes del</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Evaluador</th>
                <th scope="col" className="px-4 py-2.5 font-semibold"><span className="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {items.map((item) => (
                <tr key={`${item.kind}-${item.id}`}>
                  <td className="px-4 py-3 font-medium">
                    {item.courseName}
                    {item.siteName ? <span className="block text-xs font-normal text-[var(--color-ink-muted)]">{item.siteName}</span> : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{day(item.heldAt)}</td>
                  <td className="px-4 py-3 tabular-nums">{item.pending}</td>
                  <td className="px-4 py-3">
                    <span className="tabular-nums">{day(item.dueAt)}</span>{" "}
                    {item.overdue ? <StatusChip status="overdue" label="Vencida" /> : null}
                  </td>
                  <td className="px-4 py-3">{item.evaluatorName ?? <span className="text-[var(--color-ink-muted)]">Sin designar</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {canRecord ? (
                      <Link href={`${base}/effectiveness/${item.kind}/${item.id}`} className={buttonClass("secondary")}>
                        Evaluar
                      </Link>
                    ) : null}
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
