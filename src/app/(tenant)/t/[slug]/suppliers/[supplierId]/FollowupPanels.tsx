import Link from "next/link";
import { EmptyState, SectionBlock, StatusChip, buttonClass } from "@/components/ui";
import type { ChipStatus } from "@/components/ui";
import { CommunicationForm, NewSupplierFindingForm } from "@/app/(tenant)/t/[slug]/suppliers/[supplierId]/FollowupControls";
import { isoDay } from "@/domain/suppliers/dates";
import { EVALUATION_KIND_LABELS } from "@/domain/suppliers/evaluation";
import {
  SUPPLIER_COMMUNICATION_CHANNEL_LABELS,
  SUPPLIER_COMMUNICATION_KIND_LABELS,
  SUPPLIER_FINDING_KIND_LABELS,
  type SupplierCommunicationKindValue,
  type TrendPoint,
} from "@/domain/suppliers/findings";
import type { listSupplierCommunications, listSupplierFindings } from "@/lib/supplier-followup";

const dmy = (date: Date) => isoDay(date).split("-").reverse().join("/");
const score = (n: number) => n.toFixed(1).replace(".", ",");

const FINDING_STATUS: Record<string, { chip: ChipStatus; label: string }> = {
  draft: { chip: "pending", label: "Borrador" },
  published: { chip: "warning", label: "Publicado" },
  in_progress: { chip: "warning", label: "En curso" },
  verification: { chip: "info", label: "En verificación" },
  closed: { chip: "ok", label: "Cerrado" },
  cancelled: { chip: "pending", label: "Anulado" },
};
const ACTION_STATUS: Record<string, string> = { open: "Abierta", in_progress: "En curso", completed: "Completada", cancelled: "Anulada" };

type FindingRow = Awaited<ReturnType<typeof listSupplierFindings>>[number];
type CommunicationRow = Awaited<ReturnType<typeof listSupplierCommunications>>[number];

export function FindingsPanel({
  slug,
  supplierId,
  rows,
  canRegister,
  canEvaluate,
  hasEvaluation,
  today,
}: {
  slug: string;
  supplierId: string;
  rows: FindingRow[];
  canRegister: boolean;
  canEvaluate: boolean;
  hasEvaluation: boolean;
  today: string;
}) {
  const open = rows.filter((r) => r.finding.status !== "closed" && r.finding.status !== "cancelled").length;
  return (
    <SectionBlock
      title="Hallazgos y acciones"
      what="Lo que se detectó en este proveedor y cómo se está resolviendo. Cada hallazgo se trabaja en Hallazgos, con sus medidas y su cierre."
      next={rows.length === 0 && canRegister ? "registrá lo que pasó; la próxima evaluación lo va a mostrar como evidencia." : undefined}
    >
      {rows.length === 0 ? (
        <EmptyState what="No hay hallazgos registrados para este proveedor." />
      ) : (
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
          {rows.map((r) => {
            const status = FINDING_STATUS[r.finding.status] ?? FINDING_STATUS.draft;
            return (
              <li key={r.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <Link href={`/t/${slug}/findings/${r.finding.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {r.finding.title}
                    </Link>
                    <span className="block text-xs text-[var(--color-ink-muted)]">
                      {SUPPLIER_FINDING_KIND_LABELS[r.kind]} · detectado el {dmy(r.finding.detectedAt)}
                    </span>
                  </span>
                  <StatusChip status={status.chip} label={status.label} />
                </div>
                {r.actions.length ? (
                  <ul className="flex flex-col gap-1 border-l-2 border-[var(--color-line-strong)] pl-3 text-xs text-[var(--color-ink-muted)]">
                    {r.actions.map((a) => (
                      <li key={a.id}>
                        {a.title} · {ACTION_STATUS[a.status] ?? a.status}
                        {a.dueAt ? ` · para el ${dmy(a.dueAt)}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {open > 0 && canEvaluate && hasEvaluation ? (
        <p className="mt-3 text-sm">
          Hay {open === 1 ? "un hallazgo abierto" : `${open} hallazgos abiertos`}.{" "}
          <Link href={`/t/${slug}/suppliers/${supplierId}/evaluate?tipo=event`} className={buttonClass("secondary")}>
            Reevaluar por evento
          </Link>
        </p>
      ) : null}
      {canRegister ? (
        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
          <h3 className="font-[family-name:var(--font-display)] text-lg">Registrar un hallazgo</h3>
          <NewSupplierFindingForm slug={slug} supplierId={supplierId} today={today} />
        </div>
      ) : null}
    </SectionBlock>
  );
}

export function CommunicationsPanel({
  slug,
  supplierId,
  rows,
  evaluations,
  canRegister,
  today,
  defaultKind,
  defaultEvaluationId,
}: {
  slug: string;
  supplierId: string;
  rows: CommunicationRow[];
  evaluations: { id: string; label: string }[];
  canRegister: boolean;
  today: string;
  defaultKind: SupplierCommunicationKindValue;
  defaultEvaluationId?: string;
}) {
  return (
    <SectionBlock
      title="Comunicaciones"
      what="Qué se le pidió y qué resultado se le comunicó al proveedor (ISO 9001 §8.4.3). Acá solo se registra: no se envía nada."
      next={rows.length === 0 && canRegister ? "registrá cuándo y cómo se lo comunicaste." : undefined}
    >
      {rows.length === 0 ? (
        <EmptyState what="Todavía no se registró ninguna comunicación." />
      ) : (
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium tabular-nums">{dmy(r.sentAt)}</span>
                  <span className="ml-2">{SUPPLIER_COMMUNICATION_KIND_LABELS[r.kind]}</span>
                  <span className="block text-xs text-[var(--color-ink-muted)]">
                    {SUPPLIER_COMMUNICATION_CHANNEL_LABELS[r.channel]}
                    {r.recipientName ? ` · a ${r.recipientName}` : ""}
                    {r.createdByName ? ` · lo registró ${r.createdByName}` : ""}
                    {r.evaluation ? ` · ${EVALUATION_KIND_LABELS[r.evaluation.kind].toLowerCase()} del ${dmy(r.evaluation.evaluatedAt)}` : ""}
                  </span>
                </span>
                {r.fileName ? (
                  <a href={`/api/suppliers/communications/${r.id}/download`} className="text-[var(--color-accent)] hover:underline">
                    Descargar {r.fileName}
                  </a>
                ) : null}
              </div>
              <p className="whitespace-pre-line">{r.summary}</p>
            </li>
          ))}
        </ul>
      )}
      {canRegister ? (
        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
          <h3 className="font-[family-name:var(--font-display)] text-lg">Registrar una comunicación</h3>
          <CommunicationForm
            slug={slug}
            supplierId={supplierId}
            today={today}
            evaluations={evaluations}
            defaultKind={defaultKind}
            defaultEvaluationId={defaultEvaluationId}
          />
        </div>
      ) : null}
    </SectionBlock>
  );
}

const W = 320;
const H = 96;
const PAD = 10;

/** Evolución del puntaje: línea de 0 a 100 con una tabla al lado para quien no ve el gráfico. */
export function ScoreTrendPanel({ points, approvedMin }: { points: (TrendPoint & { delta: number | null })[]; approvedMin: number }) {
  if (points.length === 0) return null;
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (points.length - 1));
  const y = (value: number) => PAD + ((100 - value) * (H - 2 * PAD)) / 100;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <SectionBlock title="Evolución del puntaje" what={`Las últimas ${points.length} evaluaciones con puntaje. La línea punteada marca el mínimo para aprobar (${approvedMin}).`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Puntaje de ${score(first.score)} el ${dmy(first.evaluatedAt)} a ${score(last.score)} el ${dmy(last.evaluatedAt)}`}
          className="w-full max-w-sm shrink-0 text-[var(--color-accent)]"
        >
          <line x1={PAD} x2={W - PAD} y1={y(approvedMin)} y2={y(approvedMin)} stroke="var(--color-line-strong)" strokeDasharray="4 4" />
          {points.length > 1 ? <path d={path} fill="none" stroke="currentColor" strokeWidth={2} /> : null}
          {points.map((p, i) => (
            <circle key={`${p.evaluatedAt.toISOString()}-${i}`} cx={x(i)} cy={y(p.score)} r={3.5} fill="currentColor" />
          ))}
        </svg>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
            <tr>
              <th scope="col" className="py-1 pr-3">Fecha</th>
              <th scope="col" className="py-1 pr-3 text-right">Puntaje</th>
              <th scope="col" className="py-1 text-right">Cambio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {points.slice().reverse().map((p, i) => (
              <tr key={`${p.evaluatedAt.toISOString()}-${i}`}>
                <td className="py-1 pr-3 tabular-nums">{dmy(p.evaluatedAt)}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{score(p.score)}</td>
                <td className="py-1 text-right tabular-nums text-[var(--color-ink-muted)]">
                  {p.delta === null ? "—" : `${p.delta > 0 ? "+" : ""}${score(p.delta)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionBlock>
  );
}
