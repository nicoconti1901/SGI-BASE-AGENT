"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Field, FormError, HintCallout, INPUT_CLASS, StatusChip, buttonClass } from "@/components/ui";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import { saveEvaluationAction } from "@/app/(tenant)/t/[slug]/suppliers/evaluation-actions";
import type { SupplierActionState } from "@/app/(tenant)/t/[slug]/suppliers/guard";
import {
  EVALUATION_KIND_LABELS,
  EVALUATION_MODE_LABELS,
  criteriaForEvaluation,
  describeResult,
  looksUnevidenced,
  type EvaluationKindValue,
} from "@/domain/suppliers/evaluation";
import { SCORE_ERROR_MESSAGES, evaluateSupplier } from "@/domain/suppliers/scoring";
import type { CriterionPhaseValue, EvaluationModeValue, SupplierCriticalityValue } from "@/domain/suppliers/types";

const initial: SupplierActionState = {};

export type FormCriterion = {
  id: string;
  name: string;
  description: string;
  descriptor1: string;
  descriptor3: string;
  descriptor5: string;
  weight: number;
  excluding: boolean;
  allowNA: boolean;
  phase: CriterionPhaseValue;
  basic: boolean;
};

type Option = { id: string; name: string };

const RESULT_CHIP = { approved: "ok", conditional: "warning", not_approved: "danger" } as const;
const RESULT_LABEL = { approved: "Aprobado", conditional: "Con condiciones", not_approved: "No aprobado" } as const;

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

/** Formulario de evaluación. El resultado en vivo usa la misma función pura que el servidor, que lo vuelve a calcular. */
export function EvaluateForm({
  slug,
  supplierId,
  criticality,
  kinds,
  defaultKind,
  template,
  members,
  currentUserId,
  evidence,
  defaultPlanDue,
}: {
  slug: string;
  supplierId: string;
  criticality: SupplierCriticalityValue;
  kinds: EvaluationKindValue[];
  /** Tipo preseleccionado (por ejemplo «por evento» desde un hallazgo). */
  defaultKind?: EvaluationKindValue;
  template: { version: number; approvedMin: number; conditionalMin: number; criteria: FormCriterion[] };
  members: Option[];
  currentUserId: string;
  /** Líneas de evidencia del período (estado de documentos). */
  evidence: string[];
  defaultPlanDue: string;
}) {
  const action = saveEvaluationAction.bind(null, slug, supplierId);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);

  const modes: EvaluationModeValue[] = criticality === "critical" ? ["full"] : criticality === "low" ? ["declared", "full", "simplified"] : ["full", "simplified"];
  const [kind, setKind] = useState<EvaluationKindValue>(defaultKind && kinds.includes(defaultKind) ? defaultKind : kinds[0]);
  const [mode, setMode] = useState<EvaluationModeValue>(modes[0]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [overall, setOverall] = useState("");

  const scoped = useMemo(() => criteriaForEvaluation(template.criteria, kind, mode), [template.criteria, kind, mode]);

  const live = useMemo(() => {
    if (mode === "declared") return evaluateSupplier([], "declared", criticality, template);
    const items = scoped.map((c) => {
      const raw = scores[c.id];
      return { name: c.name, weight: c.weight, excluding: c.excluding, allowNA: c.allowNA, basic: true, score: raw === "na" ? null : raw ? Number(raw) : undefined };
    });
    if (items.some((i) => i.score === undefined)) return null;
    return evaluateSupplier(items.map((i) => ({ ...i, score: i.score ?? null })), mode, criticality, template);
  }, [mode, scoped, scores, criticality, template]);

  const missing = mode === "declared" ? 0 : scoped.filter((c) => !scores[c.id]).length;
  const noEvidence = mode !== "declared" && looksUnevidenced(
    scoped.map((c) => ({ score: scores[c.id] && scores[c.id] !== "na" ? Number(scores[c.id]) : null, comment: comments[c.id] ?? "" })),
    overall,
  );
  const conditional = live?.ok === true && live.result === "conditional";

  return (
    <form {...keep} className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de evaluación" required>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as EvaluationKindValue)} className={INPUT_CLASS}>
            {kinds.map((k) => (
              <option key={k} value={k}>{EVALUATION_KIND_LABELS[k]}</option>
            ))}
          </select>
        </Field>
        <Field label="Cómo evaluar" required hint={criticality === "critical" ? "Un proveedor crítico siempre se evalúa completo." : criticality === "low" ? "Bajo impacto: alcanza con aceptarlo escribiendo el motivo." : undefined}>
          <select name="mode" value={mode} onChange={(e) => setMode(e.target.value as EvaluationModeValue)} className={INPUT_CLASS}>
            {modes.map((m) => (
              <option key={m} value={m}>{EVALUATION_MODE_LABELS[m]}</option>
            ))}
          </select>
        </Field>
        {kind !== "initial" ? (
          <>
            <Field label="Período evaluado: desde" hint="Opcional.">
              <input type="date" name="periodFrom" className={INPUT_CLASS} />
            </Field>
            <Field label="Período evaluado: hasta" hint="Opcional.">
              <input type="date" name="periodTo" className={INPUT_CLASS} />
            </Field>
          </>
        ) : null}
      </div>

      {evidence.length ? (
        <HintCallout>
          <span className="font-semibold">Evidencia a mano: </span>
          {evidence.join(" · ")}
        </HintCallout>
      ) : null}

      {mode === "declared" ? (
        <Field label="Motivo de la aceptación" required hint="Queda registrado como respaldo ante una auditoría. Sin notas ni puntaje.">
          <textarea name="comment" required minLength={3} rows={3} value={overall} onChange={(e) => setOverall(e.target.value)} placeholder="Ej.: Compra ocasional de insumos de librería; no afecta el producto ni la seguridad." className={INPUT_CLASS} />
        </Field>
      ) : (
        <ol className="flex flex-col divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
          {scoped.map((c, index) => {
            const score = scores[c.id] ?? "";
            const low = score === "1" || score === "2";
            return (
              <li key={c.id} className="flex flex-col gap-3 p-4">
                <input type="hidden" name="criterionId" value={c.id} />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span className="mr-2 tabular-nums text-[var(--color-ink-muted)]">{index + 1}.</span>
                      {c.name}
                    </p>
                    {c.description ? <p className="text-sm text-[var(--color-ink-muted)]">{c.description}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">Peso {c.weight}</span>
                    {c.excluding ? <StatusChip status="warning" label="Excluyente" /> : null}
                  </div>
                </div>
                {c.descriptor1 || c.descriptor3 || c.descriptor5 ? (
                  <dl className="grid gap-1 text-xs text-[var(--color-ink-muted)] sm:grid-cols-3">
                    <div><dt className="font-semibold">1</dt><dd>{c.descriptor1 || "—"}</dd></div>
                    <div><dt className="font-semibold">3</dt><dd>{c.descriptor3 || "—"}</dd></div>
                    <div><dt className="font-semibold">5</dt><dd>{c.descriptor5 || "—"}</dd></div>
                  </dl>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <Field label="Nota" required>
                    <select
                      name={`score_${c.id}`}
                      required
                      value={score}
                      onChange={(e) => setScores((s) => ({ ...s, [c.id]: e.target.value }))}
                      className={INPUT_CLASS}
                    >
                      <option value="" disabled>Elegí</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                      {c.allowNA && !c.excluding ? <option value="na">No aplica</option> : null}
                    </select>
                  </Field>
                  <Field label="Comentario" required={low} hint={low ? "Explicá la nota: es obligatorio con 1 o 2." : "Opcional: qué se vio o qué documento lo respalda."}>
                    <input
                      name={`comment_${c.id}`}
                      required={low}
                      value={comments[c.id] ?? ""}
                      onChange={(e) => setComments((s) => ({ ...s, [c.id]: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </Field>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div aria-live="polite" className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface-sunken)] p-4">
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
          Resultado · criterios v{template.version} · aprobado desde {template.approvedMin}, con condiciones desde {template.conditionalMin}
        </p>
        {mode === "declared" && live?.ok ? (
          <p className="flex items-center gap-2"><StatusChip status="ok" label="Aprobado" /> <span className="text-sm">Aceptación con motivo, sin puntaje.</span></p>
        ) : live === null ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Faltan {missing} nota{missing === 1 ? "" : "s"} para calcular el puntaje.</p>
        ) : !live.ok ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">{SCORE_ERROR_MESSAGES[live.error]}</p>
        ) : (
          <p className="flex flex-wrap items-center gap-3">
            <span className="font-[family-name:var(--font-display)] text-3xl tabular-nums">{live.total === null ? "—" : fmt(live.total)}</span>
            <StatusChip status={RESULT_CHIP[live.result]} label={RESULT_LABEL[live.result]} />
            <span className="text-sm text-[var(--color-ink-muted)]">{describeResult(live.result, live.resultReason, live.excludingFailures)}</span>
          </p>
        )}
        <p className="text-xs text-[var(--color-ink-muted)]">El servidor vuelve a calcular el puntaje al guardar: lo que ve acá es una vista previa.</p>
      </div>

      {noEvidence ? (
        <p role="status" className="text-sm text-[var(--color-warning)]">Todas las notas son iguales y no hay comentarios: ¿tiene evidencia que lo respalde?</p>
      ) : null}

      {mode !== "declared" ? (
        <Field label="Comentario general" hint="Opcional: conclusiones de la evaluación.">
          <textarea name="comment" rows={2} value={overall} onChange={(e) => setOverall(e.target.value)} className={INPUT_CLASS} />
        </Field>
      ) : null}

      {conditional ? (
        <fieldset className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] p-4">
          <legend className="px-1 text-sm font-semibold">Plan de mejora</legend>
          <p className="text-sm">Un proveedor «con condiciones» no se guarda sin un plan: qué tiene que corregir, quién lo sigue y para cuándo. Queda como Acción y se reevalúa en 6 meses.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Qué tiene que corregir" hint="Si lo deja vacío se usa «Plan de mejora» con el nombre del proveedor.">
              <input name="planTitle" className={INPUT_CLASS} placeholder="Ej.: Presentar el certificado de calibración vigente" />
            </Field>
            <Field label="Responsable del seguimiento" required>
              <select name="planOwnerUserId" required defaultValue={currentUserId} className={INPUT_CLASS}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha límite" required>
              <input type="date" name="planDueAt" required defaultValue={defaultPlanDue} className={INPUT_CLASS} />
            </Field>
            <Field label="Detalle" hint="Opcional.">
              <input name="planDescription" className={INPUT_CLASS} />
            </Field>
          </div>
        </fieldset>
      ) : null}

      {state.error ? <FormError>{state.error}</FormError> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || (mode !== "declared" && (live === null || !live.ok))}>
          {pending ? "Guardando…" : "Guardar evaluación"}
        </Button>
        <Link href={`/t/${slug}/suppliers/${supplierId}`} className={buttonClass("ghost")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
