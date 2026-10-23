"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { evaluateEffectivenessAction } from "@/app/(tenant)/t/[slug]/training/followup-actions";
import {
  EVALUATION_METHOD_LABELS,
  EVALUATION_STATUS_LABELS,
  type EvaluationMethod,
  type EvaluationStatus,
} from "@/domain/training/followup";

type Option = { id: string; name: string };
type Person = { recordId: string; name: string; employeeCode: string };
type Resolution = "action" | "reschedule";

type Props = {
  slug: string;
  kind: "session" | "record";
  id: string;
  today: string;
  suggestedReschedule: string;
  suggestedActionDue: string;
  people: Person[];
  members: Option[];
};

/** Resultado general de la capacitación, excepciones por persona y, si alguien no alcanzó el resultado, qué hacer. */
export function EvaluationForm({ slug, kind, id, today, suggestedReschedule, suggestedActionDue, people, members }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<EvaluationStatus>("effective");
  const [method, setMethod] = useState<EvaluationMethod | "">("");
  const [note, setNote] = useState("");
  const [exceptions, setExceptions] = useState<Record<string, { status: EvaluationStatus; note: string }>>({});
  const [resolution, setResolution] = useState<Resolution>("action");
  const [actionOwner, setActionOwner] = useState(members[0]?.id ?? "");
  const [actionDue, setActionDue] = useState(suggestedActionDue);
  const [actionTitle, setActionTitle] = useState("");
  const [rescheduledTo, setRescheduledTo] = useState(suggestedReschedule);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const someoneFails = status === "not_effective" || Object.values(exceptions).some((e) => e.status === "not_effective");

  function toggleException(recordId: string, on: boolean) {
    setExceptions((prev) => {
      const next = { ...prev };
      if (on) next[recordId] = { status: status === "not_effective" ? "effective" : "not_effective", note: "" };
      else delete next[recordId];
      return next;
    });
  }

  function submit() {
    setError(null);
    start(async () => {
      const result = await evaluateEffectivenessAction(slug, {
        kind,
        id,
        status,
        method: method || null,
        note,
        exceptions: Object.entries(exceptions).map(([recordId, e]) => ({ recordId, status: e.status, note: e.note || undefined })),
        resolution: someoneFails
          ? resolution === "action"
            ? { kind: "action", ownerUserId: actionOwner, dueAt: actionDue, title: actionTitle || undefined }
            : { kind: "reschedule", rescheduledTo }
          : undefined,
      });
      if (!result.ok) return setError(result.error);
      router.push(`/t/${slug}/training/effectiveness`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resultado general" className="grid gap-3 sm:grid-cols-2">
        <Field label="Resultado general" required>
          <select value={status} onChange={(e) => setStatus(e.target.value as EvaluationStatus)} className={INPUT_CLASS}>
            {(Object.keys(EVALUATION_STATUS_LABELS) as EvaluationStatus[]).map((s) => (
              <option key={s} value={s}>
                {EVALUATION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cómo se evaluó" required>
          <select value={method} onChange={(e) => setMethod(e.target.value as EvaluationMethod | "")} className={INPUT_CLASS}>
            <option value="">Elegí un método</option>
            {(Object.keys(EVALUATION_METHOD_LABELS) as EvaluationMethod[]).map((m) => (
              <option key={m} value={m}>
                {EVALUATION_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Qué se observó" hint="Obligatorio si el resultado no es «Eficaz».">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={INPUT_CLASS} />
          </Field>
        </div>
      </section>

      <section aria-label="Excepciones por persona" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Excepciones</h3>
        <p className="text-sm text-[var(--color-ink-muted)]">Tildá a quien tuvo un resultado distinto del general.</p>
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          {people.map((p) => {
            const exception = exceptions[p.recordId];
            return (
              <li key={p.recordId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(exception)} onChange={(e) => toggleException(p.recordId, e.target.checked)} className="h-4 w-4" />
                  <span className="font-medium">{p.name}</span>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">{p.employeeCode}</span>
                </label>
                {exception ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      aria-label={`Resultado de ${p.name}`}
                      value={exception.status}
                      onChange={(e) => setExceptions((prev) => ({ ...prev, [p.recordId]: { ...exception, status: e.target.value as EvaluationStatus } }))}
                      className={INPUT_CLASS}
                    >
                      {(Object.keys(EVALUATION_STATUS_LABELS) as EvaluationStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {EVALUATION_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`Qué se observó en ${p.name}`}
                      placeholder="Qué se observó"
                      value={exception.note}
                      maxLength={1000}
                      onChange={(e) => setExceptions((prev) => ({ ...prev, [p.recordId]: { ...exception, note: e.target.value } }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {someoneFails ? (
        <section aria-label="Qué hacer con lo que no fue eficaz" className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] p-4">
          <h3 className="text-sm font-semibold">Hay personas a las que no les fue eficaz</h3>
          <p className="text-sm">Elegí qué hacer: crear una acción para reforzar o evaluar de nuevo más adelante.</p>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Qué hacer</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="resolution" checked={resolution === "action"} onChange={() => setResolution("action")} />
              Crear una acción de refuerzo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="resolution" checked={resolution === "reschedule"} onChange={() => setResolution("reschedule")} />
              Reprogramar la evaluación
            </label>
          </fieldset>
          {resolution === "action" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Responsable de la acción" required>
                <select value={actionOwner} onChange={(e) => setActionOwner(e.target.value)} className={INPUT_CLASS}>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Plazo" required>
                <input type="date" min={today} value={actionDue} onChange={(e) => setActionDue(e.target.value)} className={INPUT_CLASS} />
              </Field>
              <Field label="Título" hint="Si lo dejás vacío, se arma solo.">
                <input value={actionTitle} maxLength={200} onChange={(e) => setActionTitle(e.target.value)} className={INPUT_CLASS} />
              </Field>
            </div>
          ) : (
            <Field label="Nueva fecha de evaluación" required hint="Las personas con resultado no eficaz quedan pendientes hasta esa fecha.">
              <input type="date" min={today} value={rescheduledTo} onChange={(e) => setRescheduledTo(e.target.value)} className={INPUT_CLASS} />
            </Field>
          )}
        </section>
      ) : null}

      {error ? <FormError>{error}</FormError> : null}
      <div>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "Guardando…" : "Guardar evaluación"}
        </Button>
      </div>
    </div>
  );
}
