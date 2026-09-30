"use client";

import { useActionState, useState } from "react";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  addCustomQuestionAction,
  recordItemResultAction,
  removeChecklistItemAction,
  setRequirementItemsAction,
  startAuditAction,
  uploadAuditEvidenceAction,
  type AuditActionState,
} from "@/app/(tenant)/t/[slug]/audits/actions";
import { Feedback } from "@/app/(tenant)/t/[slug]/audits/AuditForms";
import { requiresEvidence } from "@/domain/audits/lifecycle";
import {
  AUDIT_ITEM_RESULT_LABELS,
  AUDIT_STANDARD_LABELS,
  type AuditItemResult,
  type AuditStandard,
} from "@/domain/audits/types";

const initial: AuditActionState = {};
const input =
  "rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";
const primary =
  "self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60";
const secondary =
  "self-start rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-1.5 text-sm font-medium disabled:opacity-60";

export type Candidate = {
  tenantRequirementId: string;
  standard: AuditStandard;
  clauseCode: string;
  title: string;
};

// ─── Armado (antes de iniciar) ──────────────────────────────────────────────

export function ChecklistBuilder({
  slug,
  auditId,
  candidates,
  selectedIds,
  customItems,
}: {
  slug: string;
  auditId: string;
  candidates: Candidate[];
  selectedIds: string[];
  customItems: { id: string; question: string }[];
}) {
  const [state, action, pending] = useActionState(
    setRequirementItemsAction.bind(null, slug, auditId),
    initial,
  );
  const actionForm = useKeepInputs(action, state);
  const [selected, setSelected] = useState(new Set(selectedIds));
  const standards = [...new Set(candidates.map((c) => c.standard))];

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      <form {...actionForm} className="flex flex-col gap-3">
        <p className="rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent-ink)]">
          ¿Qué requisitos cubre el alcance de esta auditoría? No hace falta auditar todo en cada
          auditoría: el programa del año es el que cubre el sistema completo.
        </p>
        {standards.map((std) => {
          const group = candidates.filter((c) => c.standard === std);
          const allOn = group.every((c) => selected.has(c.tenantRequirementId));
          return (
            <fieldset key={std} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
              <legend className="px-1 text-sm font-semibold">{AUDIT_STANDARD_LABELS[std]}</legend>
              <button
                type="button"
                onClick={() => group.forEach((c) => toggle(c.tenantRequirementId, !allOn))}
                className="mb-2 text-xs font-medium text-[var(--color-accent)]"
              >
                {allOn ? "Quitar todos" : "Seleccionar todos"}
              </button>
              <div className="grid gap-1 sm:grid-cols-2">
                {group.map((c) => (
                  <label key={c.tenantRequirementId} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="requirementIds"
                      value={c.tenantRequirementId}
                      checked={selected.has(c.tenantRequirementId)}
                      onChange={(e) => toggle(c.tenantRequirementId, e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                        {c.clauseCode}
                      </span>{" "}
                      {c.title}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
        <Feedback state={state} />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Guardando…" : `Guardar lista (${selected.size} requisitos)`}
        </button>
      </form>

      <CustomQuestions slug={slug} auditId={auditId} items={customItems} />
    </div>
  );
}

function CustomQuestions({
  slug,
  auditId,
  items,
}: {
  slug: string;
  auditId: string;
  items: { id: string; question: string }[];
}) {
  const [state, action, pending] = useActionState(
    addCustomQuestionAction.bind(null, slug, auditId),
    initial,
  );
  const actionForm = useKeepInputs(action, state, { resetOnSuccess: true });
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Preguntas propias</h3>
      {items.length > 0 ? (
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
          {items.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>{q.question}</span>
              <form action={removeChecklistItemAction.bind(null, slug, auditId, q.id)}>
                <button type="submit" className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-danger)]">
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      <form {...actionForm} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="question"
          aria-label="Nueva pregunta"
          placeholder="Ej.: ¿Los registros de calibración de balanzas están al día?"
          className={`${input} flex-1`}
        />
        <button type="submit" disabled={pending} className={secondary}>
          Agregar pregunta
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

// ─── Inicio ─────────────────────────────────────────────────────────────────

export function StartAuditForm({
  slug,
  auditId,
  early,
}: {
  slug: string;
  auditId: string;
  early: boolean;
}) {
  const [state, action, pending] = useActionState(startAuditAction.bind(null, slug, auditId), initial);
  const actionForm = useKeepInputs(action, state);
  return (
    <form {...actionForm} className="flex flex-col gap-2">
      {early ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Motivo para adelantar el inicio</span>
          <input name="reason" required placeholder="Ej.: el responsable del área viaja la semana planificada" className={input} />
        </label>
      ) : null}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={primary}>
        Iniciar auditoría
      </button>
    </form>
  );
}

// ─── Ejecución ──────────────────────────────────────────────────────────────

export type RunnerItem = {
  id: string;
  question: string;
  standard: AuditStandard | null;
  result: AuditItemResult;
  evidence: string | null;
  findingId: string | null;
  /** Estado del hallazgo vinculado; publicado bloquea el cambio de resultado. */
  findingStatus: string | null;
  attachments: { id: string; fileName: string }[];
};

const RESULT_OPTIONS: AuditItemResult[] = [
  "conforming",
  "nc_major",
  "nc_minor",
  "observation",
  "improvement",
  "not_applicable",
];

const RESULT_TONE: Record<AuditItemResult, string> = {
  pending: "bg-[var(--color-surface)] text-[var(--color-ink-muted)]",
  conforming: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  nc_major: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  nc_minor: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  observation: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  improvement: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]",
  not_applicable: "bg-[var(--color-surface)] text-[var(--color-ink-subtle)]",
};

export function ResultChip({ result }: { result: AuditItemResult }) {
  return (
    <span className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-semibold ${RESULT_TONE[result]}`}>
      {AUDIT_ITEM_RESULT_LABELS[result]}
    </span>
  );
}

export function ChecklistItemCard({
  slug,
  auditId,
  item,
  editable,
}: {
  slug: string;
  auditId: string;
  item: RunnerItem;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(
    recordItemResultAction.bind(null, slug, auditId, item.id),
    initial,
  );
  const actionForm = useKeepInputs(action, state);
  const [result, setResult] = useState<AuditItemResult>(item.result);
  const findingPublished =
    Boolean(item.findingId) && item.findingStatus !== "draft" && item.findingStatus !== "cancelled";
  const locked = !editable || findingPublished;

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {item.standard ? (
            <span className="mr-2 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
              {AUDIT_STANDARD_LABELS[item.standard]}
            </span>
          ) : null}
          {item.question}
        </p>
        <ResultChip result={item.result} />
      </div>

      {item.findingId ? (
        <p className="text-sm">
          <a
            href={`/t/${slug}/findings/${item.findingId}${findingPublished ? "" : "/edit"}`}
            className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            {findingPublished ? "Ver hallazgo" : "Completar hallazgo (borrador)"}
          </a>
          {findingPublished ? null : (
            <span className="text-[var(--color-ink-muted)]">
              {" "}
              · se creó al registrar el resultado; causa y medidas se cargan en Hallazgos
            </span>
          )}
        </p>
      ) : null}

      {locked ? (
        item.evidence ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Evidencia: {item.evidence}</p>
        ) : null
      ) : (
        <form {...actionForm} className="flex flex-col gap-2">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Resultado</legend>
            {RESULT_OPTIONS.map((r) => (
              <label
                key={r}
                className={`cursor-pointer rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium ${
                  result === r
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]"
                    : "border-[var(--color-line)] text-[var(--color-ink-muted)]"
                }`}
              >
                <input
                  type="radio"
                  name="result"
                  value={r}
                  checked={result === r}
                  onChange={() => setResult(r)}
                  className="sr-only"
                />
                {AUDIT_ITEM_RESULT_LABELS[r]}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              Evidencia{requiresEvidence(result) ? " (obligatoria para hallazgos)" : " (opcional)"}
            </span>
            <textarea
              name="evidence"
              rows={2}
              defaultValue={item.evidence ?? ""}
              placeholder="Ej.: se revisaron 5 órdenes de compra de agosto; 2 sin proveedor evaluado"
              className={input}
            />
          </label>
          <Feedback state={state} />
          <button type="submit" disabled={pending || result === "pending"} className={secondary}>
            {pending ? "Guardando…" : "Guardar resultado"}
          </button>
        </form>
      )}

      <EvidenceFiles slug={slug} auditId={auditId} item={item} canUpload={editable} />
    </li>
  );
}

function EvidenceFiles({
  slug,
  auditId,
  item,
  canUpload,
}: {
  slug: string;
  auditId: string;
  item: RunnerItem;
  canUpload: boolean;
}) {
  const [state, action, pending] = useActionState(
    uploadAuditEvidenceAction.bind(null, slug, auditId, item.id),
    initial,
  );
  const actionForm = useKeepInputs(action, state, { resetOnSuccess: true });
  if (!canUpload && item.attachments.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {item.attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {item.attachments.map((a) => (
            <li key={a.id}>
              <a
                href={`/api/audits/evidence/${a.id}/download`}
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                {a.fileName}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {canUpload ? (
        <form {...actionForm} className="flex flex-wrap items-center gap-2">
          <input type="file" name="file" aria-label="Archivo de evidencia" className="text-xs" />
          <button type="submit" disabled={pending} className={secondary}>
            {pending ? "Subiendo…" : "Adjuntar evidencia"}
          </button>
          <Feedback state={state} />
        </form>
      ) : null}
    </div>
  );
}
