"use client";

import { useActionState, useMemo } from "react";
import {
  DOCUMENT_FATE_LABELS,
  GAP_STATUS_LABELS,
  REQUIREMENT_STATUSES,
  resolveDocumentFateHint,
  type RequirementStatus,
} from "@/domain/assessment/gap";
import {
  saveTenantGapAction,
  type SaveGapState,
} from "@/app/(platform)/platform/tenants/[slug]/gap/actions";

export type GapFormRow = {
  id: string;
  status: RequirementStatus;
  notes: string | null;
  hasClientDocument: boolean;
  documentFate: string;
  requirement: {
    standard: string;
    clauseCode: string;
    title: string;
    essential: boolean;
  };
};

const initial: SaveGapState = {};

export function GapAssessmentForm({
  slug,
  rows,
}: {
  slug: string;
  rows: GapFormRow[];
}) {
  const action = saveTenantGapAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.status] = (map[row.status] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Evaluación de requisitos
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {rows.length} requisitos ·{" "}
            {REQUIREMENT_STATUSES.filter((s) => counts[s])
              .map((s) => `${GAP_STATUS_LABELS[s]}: ${counts[s]}`)
              .join(" · ") || "sin evaluar"}
          </p>
        </div>
        <button
          type="submit"
          disabled={pending || rows.length === 0}
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar gap"}
        </button>
      </div>

      {state.error ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-success)]/25 bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-success)]">
          Gap guardado ({state.saved} filas procesadas). Se registró auditoría de
          cambios.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)]">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-subtle)]">
            <tr>
              <th className="px-3 py-3 font-medium">Requisito</th>
              <th className="px-3 py-3 font-medium">Estado</th>
              <th className="px-3 py-3 font-medium">Doc. cliente</th>
              <th className="px-3 py-3 font-medium">Destino</th>
              <th className="px-3 py-3 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const fateHint = resolveDocumentFateHint({
                status: row.status,
                hasClientDocument: row.hasClientDocument,
              });
              return (
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-line)] align-top last:border-b-0"
                >
                  <td className="px-3 py-3">
                    <input type="hidden" name="tenantRequirementId" value={row.id} />
                    <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-subtle)]">
                      {row.requirement.standard} · {row.requirement.clauseCode}
                      {row.requirement.essential ? " · esencial" : ""}
                    </p>
                    <p className="mt-0.5 font-medium text-[var(--color-ink)]">
                      {row.requirement.title}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      name={`status_${row.id}`}
                      defaultValue={row.status}
                      className="w-full min-w-[9rem] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 text-[var(--color-ink)]"
                    >
                      {REQUIREMENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {GAP_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <label className="inline-flex items-center gap-2 text-[var(--color-ink-muted)]">
                      <input
                        type="checkbox"
                        name={`hasDoc_${row.id}`}
                        defaultChecked={row.hasClientDocument}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      Tiene
                    </label>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-ink-muted)]">
                    <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2 py-1 text-xs">
                      {DOCUMENT_FATE_LABELS[fateHint]}
                    </span>
                    <p className="mt-1 text-[10px] text-[var(--color-ink-subtle)]">
                      Se recalcula al guardar
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <textarea
                      name={`notes_${row.id}`}
                      defaultValue={row.notes ?? ""}
                      rows={2}
                      placeholder="Observaciones del diagnóstico…"
                      className="w-full min-w-[12rem] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 text-[var(--color-ink)]"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || rows.length === 0}
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar gap"}
        </button>
      </div>
    </form>
  );
}
