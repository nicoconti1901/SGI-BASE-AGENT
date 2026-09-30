"use client";

import { useState, useTransition } from "react";
import {
  confirmExtractedFindingsAction,
  extractReportFindingsAction,
  type AuditActionState,
} from "@/app/(tenant)/t/[slug]/audits/actions";
import { Feedback } from "@/app/(tenant)/t/[slug]/audits/AuditForms";
import type { ProposedFinding } from "@/domain/audits/extraction";
import { AUDIT_ITEM_RESULT_LABELS } from "@/domain/audits/types";

const input =
  "rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";
const primary =
  "self-start rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-solid)] disabled:opacity-60";
const secondary =
  "self-start rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-medium disabled:opacity-60";

const KINDS: ProposedFinding["kind"][] = ["nc_major", "nc_minor", "observation", "improvement"];

type Row = ProposedFinding & { include: boolean };

export function ExternalFindingsReview({
  slug,
  auditId,
  reports,
}: {
  slug: string;
  auditId: string;
  reports: { id: string; fileName: string }[];
}) {
  const [reportId, setReportId] = useState(reports[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<AuditActionState>({});
  const [pending, startTransition] = useTransition();

  if (reports.length === 0) return null;

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const analyze = () =>
    startTransition(async () => {
      setState({});
      const result = await extractReportFindingsAction(slug, auditId, reportId);
      setRows((result.proposals ?? []).map((p) => ({ ...p, include: true })));
      setState({ error: result.error, issues: result.issues, ok: result.ok });
    });

  const confirm = () =>
    startTransition(async () => {
      const chosen = rows.filter((r) => r.include).map((r) => ({
        kind: r.kind,
        clause: r.clause,
        title: r.title,
        description: r.description,
        quote: r.quote,
        page: r.page,
      }));
      const result = await confirmExtractedFindingsAction(slug, auditId, chosen);
      setState(result);
      if (result.ok) setRows([]);
    });

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
      <h3 className="text-sm font-semibold">Extraer hallazgos del informe con IA</h3>
      <p className="text-xs text-[var(--color-ink-muted)]">
        El PDF se envía a un proveedor de IA para analizarlo. Vas a revisar cada propuesta antes de que
        se cree ningún hallazgo; contrastala con la cita del informe.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {reports.length > 1 ? (
          <select
            aria-label="Informe a analizar"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            className={input}
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fileName}
              </option>
            ))}
          </select>
        ) : null}
        <button type="button" onClick={analyze} disabled={pending} className={secondary}>
          {pending && rows.length === 0 ? "Analizando…" : "Analizar informe"}
        </button>
      </div>
      <Feedback state={state} />

      {rows.length > 0 ? (
        <>
          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-md border border-[var(--color-line)] p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => update(i, { include: e.target.checked })}
                  />
                  Registrar este hallazgo
                </label>
                <div className="grid gap-2 sm:grid-cols-[12rem_8rem_1fr]">
                  <select
                    aria-label="Tipo"
                    value={r.kind}
                    onChange={(e) => update(i, { kind: e.target.value as ProposedFinding["kind"] })}
                    className={input}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {AUDIT_ITEM_RESULT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Cláusula"
                    value={r.clause}
                    onChange={(e) => update(i, { clause: e.target.value })}
                    placeholder="Cláusula"
                    className={input}
                  />
                  <input
                    aria-label="Título"
                    value={r.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                    className={input}
                  />
                </div>
                <textarea
                  aria-label="Descripción"
                  rows={3}
                  value={r.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  className={input}
                />
                {r.quote ? (
                  <blockquote className="border-l-2 border-[var(--color-line)] pl-3 text-xs text-[var(--color-ink-muted)]">
                    {r.quote}
                    {r.page ? ` (pág. ${r.page})` : ""}
                  </blockquote>
                ) : null}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={confirm}
            disabled={pending || !rows.some((r) => r.include)}
            className={primary}
          >
            {pending ? "Registrando…" : `Registrar ${rows.filter((r) => r.include).length} hallazgo(s) como borrador`}
          </button>
        </>
      ) : null}
    </div>
  );
}
