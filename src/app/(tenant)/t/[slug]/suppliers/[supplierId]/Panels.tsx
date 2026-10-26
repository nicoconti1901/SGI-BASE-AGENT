import Link from "next/link";
import { EmptyState, SectionBlock, StatusChip, buttonClass } from "@/components/ui";
import type { ChipStatus } from "@/components/ui";
import { VoidDocumentForm, VoidEvaluationForm, UploadDocumentForm } from "@/app/(tenant)/t/[slug]/suppliers/[supplierId]/RecordControls";
import { isoDay } from "@/domain/suppliers/dates";
import { EVALUATION_KIND_LABELS, EVALUATION_MODE_LABELS, describeResult } from "@/domain/suppliers/evaluation";
import {
  EVALUATION_RESULT_LABELS,
  SUPPLIER_CRITICALITY_LABELS,
  type EvaluationResultValue,
} from "@/domain/suppliers/types";
import type { getSupplierEvaluation, listSupplierEvaluations } from "@/lib/supplier-evaluations";
import type { SupplierDocumentRow, listSupplierDocumentHistory } from "@/lib/supplier-documents";

const dmy = (date: Date) => isoDay(date).split("-").reverse().join("/");
const score = (n: number | null) => (n === null ? "—" : n.toFixed(1).replace(".", ","));

const RESULT_CHIP: Record<EvaluationResultValue, ChipStatus> = { approved: "ok", conditional: "warning", not_approved: "danger" };
const DOC_CHIP: Record<SupplierDocumentRow["status"], { chip: ChipStatus; label: string }> = {
  valid: { chip: "ok", label: "Vigente" },
  expiring: { chip: "warning", label: "Por vencer" },
  expired: { chip: "danger", label: "Vencido" },
  missing: { chip: "pending", label: "Falta" },
};
const ACTION_STATUS: Record<string, string> = { open: "Abierta", in_progress: "En curso", completed: "Completada", cancelled: "Anulada" };

type EvaluationRow = Awaited<ReturnType<typeof listSupplierEvaluations>>[number];
type EvaluationDetail = NonNullable<Awaited<ReturnType<typeof getSupplierEvaluation>>>;
type DocumentHistoryRow = Awaited<ReturnType<typeof listSupplierDocumentHistory>>[number];

export function EvaluationsPanel({
  slug,
  supplierId,
  rows,
  selected,
  canEvaluate,
  canCommunicate,
}: {
  slug: string;
  supplierId: string;
  rows: EvaluationRow[];
  selected: EvaluationDetail | null;
  canEvaluate: boolean;
  canCommunicate: boolean;
}) {
  const base = `/t/${slug}/suppliers/${supplierId}`;
  return (
    <SectionBlock
      title="Evaluaciones"
      what="Cada evaluación guarda una copia fija de los criterios, los pesos y los umbrales con los que se hizo: cambiar los criterios después no la modifica."
      next={rows.length === 0 && canEvaluate ? "usá «Evaluar» para registrar la evaluación inicial." : undefined}
    >
      {rows.length === 0 ? (
        <EmptyState what="Todavía no se registró ninguna evaluación." />
      ) : (
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
          {rows.map((r) => (
            <li key={r.id} className={r.voidedAt ? "opacity-70" : undefined}>
              <Link
                href={`${base}?tab=evaluaciones&eval=${r.id}`}
                aria-current={selected?.id === r.id ? "true" : undefined}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-[var(--color-accent-soft)] aria-[current=true]:bg-[var(--color-accent-soft)]"
              >
                <span>
                  <span className="font-medium tabular-nums">{dmy(r.evaluatedAt)}</span>
                  <span className="ml-2">{EVALUATION_KIND_LABELS[r.kind]}</span>
                  <span className="block text-xs text-[var(--color-ink-muted)]">
                    {EVALUATION_MODE_LABELS[r.mode]}
                    {r.templateVersion ? ` · criterios v${r.templateVersion}` : ""}
                    {r.evaluatorName ? ` · ${r.evaluatorName}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-display)] text-lg tabular-nums">{score(r.totalScore)}</span>
                  {r.voidedAt ? <StatusChip status="pending" label="Anulada" /> : <StatusChip status={RESULT_CHIP[r.result]} label={EVALUATION_RESULT_LABELS[r.result]} />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <article aria-label="Detalle de la evaluación" className="mt-6 flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] p-4">
          <header className="flex flex-col gap-1">
            <h3 className="font-[family-name:var(--font-display)] text-lg">
              {EVALUATION_KIND_LABELS[selected.kind]} · {dmy(selected.evaluatedAt)}
            </h3>
            <p className="text-sm text-[var(--color-ink-muted)]">
              {EVALUATION_MODE_LABELS[selected.mode]} · criticidad {SUPPLIER_CRITICALITY_LABELS[selected.criticalityAtEvaluation].toLowerCase()} en ese momento
              {selected.evaluatorName ? ` · evaluó ${selected.evaluatorName}` : ""}
              {selected.periodFrom || selected.periodTo ? ` · período ${selected.periodFrom ? dmy(selected.periodFrom) : "…"} a ${selected.periodTo ? dmy(selected.periodTo) : "…"}` : ""}
            </p>
          </header>

          <p className="flex flex-wrap items-center gap-3">
            <span className="font-[family-name:var(--font-display)] text-3xl tabular-nums">{score(selected.totalScore)}</span>
            <StatusChip status={RESULT_CHIP[selected.result]} label={EVALUATION_RESULT_LABELS[selected.result]} />
            <span className="text-sm text-[var(--color-ink-muted)]">
              {describeResult(selected.result, selected.resultReason, selected.items.filter((i) => i.excluding && i.score !== null && i.score <= 2).map((i) => ({ name: i.name, score: i.score as number })))}
            </span>
          </p>
          {selected.templateVersion ? (
            <p className="text-xs text-[var(--color-ink-muted)]">
              Criterios v{selected.templateVersion} · aprobado desde {selected.approvedMin}, con condiciones desde {selected.conditionalMin}
              {selected.coverage !== null ? ` · cobertura ${score(selected.coverage)} %` : ""}
            </p>
          ) : null}

          {selected.voidedAt ? (
            <p role="status" className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface-sunken)] p-3 text-sm">
              <span className="font-semibold">Anulada el {dmy(selected.voidedAt)}</span>
              {selected.voidedByName ? ` por ${selected.voidedByName}` : ""}: {selected.voidReason}
            </p>
          ) : null}

          {selected.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-[var(--color-surface-sunken)] text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                  <tr>
                    <th scope="col" className="px-3 py-2">Criterio</th>
                    <th scope="col" className="px-3 py-2 text-right">Peso</th>
                    <th scope="col" className="px-3 py-2 text-right">Nota</th>
                    <th scope="col" className="px-3 py-2">Comentario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {selected.items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2">
                        {i.name}
                        {i.excluding ? <span className="ml-2 text-xs text-[var(--color-ink-muted)]">(excluyente)</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{i.weight}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{i.score ?? "N/A"}</td>
                      <td className="px-3 py-2 text-[var(--color-ink-muted)]">{i.comment || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {selected.comment ? (
            <p className="text-sm">
              <span className="font-semibold">{selected.mode === "declared" ? "Motivo de la aceptación: " : "Comentario general: "}</span>
              {selected.comment}
            </p>
          ) : null}

          {selected.actions.length ? (
            <div>
              <h4 className="text-sm font-semibold">Plan de mejora</h4>
              <ul className="mt-1 divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
                {selected.actions.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <span className="font-medium">{a.title}</span>
                      <span className="block text-xs text-[var(--color-ink-muted)]">
                        {a.ownerName ?? "Sin responsable"}
                        {a.dueAt ? ` · para el ${dmy(a.dueAt)}` : ""}
                      </span>
                    </span>
                    <StatusChip status={a.status === "completed" ? "ok" : a.status === "cancelled" ? "pending" : "info"} label={ACTION_STATUS[a.status] ?? a.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canCommunicate && !selected.voidedAt ? (
            <p>
              <Link href={`${base}?tab=comunicaciones&tipo=resultado&eval=${selected.id}`} className={buttonClass("secondary")}>
                Registrar que se lo comunicó
              </Link>
            </p>
          ) : null}
          {canEvaluate && !selected.voidedAt ? <VoidEvaluationForm slug={slug} supplierId={supplierId} evaluationId={selected.id} /> : null}
        </article>
      ) : null}

      {canEvaluate ? (
        <p className="mt-4">
          <Link href={`${base}/evaluate`} className={buttonClass("secondary")}>
            Evaluar
          </Link>
        </p>
      ) : null}
    </SectionBlock>
  );
}

export function DocumentsPanel({
  slug,
  supplierId,
  rows,
  history,
  canUpload,
  canVoid,
}: {
  slug: string;
  supplierId: string;
  rows: SupplierDocumentRow[];
  history: DocumentHistoryRow[];
  canUpload: boolean;
  canVoid: boolean;
}) {
  const download = (id: string) => `/api/suppliers/documents/${id}/download`;
  return (
    <SectionBlock
      title="Documentos"
      what="Certificados, seguros y habilitaciones, cada uno con su vencimiento. Un documento obligatorio que bloquea la habilitación, si falta o vence, deja al proveedor «no habilitado»."
      next={canUpload ? "cargá el documento vigente de cada tipo; al cargar uno nuevo, reemplaza al anterior." : undefined}
    >
      {rows.length === 0 ? (
        <EmptyState what="No hay tipos de documento que se le pidan a este tipo de proveedor." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-[var(--color-surface-sunken)] text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="px-3 py-2">Documento</th>
                <th scope="col" className="px-3 py-2">Estado</th>
                <th scope="col" className="px-3 py-2">Vence</th>
                <th scope="col" className="px-3 py-2">Archivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {rows.map((r) => (
                <tr key={r.type.id}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.type.name}</span>
                    <span className="block text-xs text-[var(--color-ink-muted)]">
                      {r.type.blocksEnablement ? "Obligatorio · impide la habilitación" : r.type.required ? "Obligatorio" : "Opcional"}
                      {r.type.note ? ` · ${r.type.note}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2"><StatusChip status={DOC_CHIP[r.status].chip} label={DOC_CHIP[r.status].label} /></td>
                  <td className="px-3 py-2 tabular-nums">{r.current ? (r.current.expiresAt ? dmy(r.current.expiresAt) : "Sin vencimiento") : "—"}</td>
                  <td className="px-3 py-2">
                    {r.current ? (
                      <a href={download(r.current.id)} className="text-[var(--color-accent)] hover:underline">{r.current.fileName}</a>
                    ) : (
                      <span className="text-[var(--color-ink-muted)]">—</span>
                    )}
                    {r.previous > 0 ? <span className="block text-xs text-[var(--color-ink-muted)]">{r.previous} anterior{r.previous === 1 ? "" : "es"} en el historial</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canUpload && rows.length ? (
        <div className="mt-6 border-t border-[var(--color-line)] pt-4">
          <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg">Cargar un documento</h3>
          <UploadDocumentForm slug={slug} supplierId={supplierId} types={rows.map((r) => ({ id: r.type.id, name: r.type.name, validityMonths: r.type.validityMonths }))} />
        </div>
      ) : null}

      {history.length > 0 ? (
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer font-semibold">Historial de documentos ({history.length})</summary>
          <ul className="mt-2 divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className={h.voidedAt ? "line-through opacity-70" : undefined}>
                  {h.type.name} ·{" "}
                  <a href={download(h.id)} className="text-[var(--color-accent)] hover:underline">{h.fileName}</a>
                  <span className="block text-xs text-[var(--color-ink-muted)]">
                    Cargado el {dmy(h.createdAt)} · {h.expiresAt ? `vence ${dmy(h.expiresAt)}` : "sin vencimiento"}
                    {h.voidedAt ? ` · anulado: ${h.voidReason}` : h.supersededAt ? " · reemplazado" : ""}
                  </span>
                </span>
                {canVoid && !h.voidedAt ? <VoidDocumentForm slug={slug} supplierId={supplierId} documentId={h.id} /> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </SectionBlock>
  );
}
