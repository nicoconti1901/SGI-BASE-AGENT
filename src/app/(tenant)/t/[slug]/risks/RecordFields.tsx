"use client";

import { useActionState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { RoActionState } from "@/app/(tenant)/t/[slug]/risks/actions";
import {
  QUALITATIVE_LEVEL_HINTS,
  QUALITATIVE_LEVEL_LABELS,
  QUALITATIVE_LEVELS,
  type QualitativeLevel,
} from "@/domain/risks/types";
import { ChoiceCards, Field, INPUT_CLASS } from "@/components/ui";

export type Member = { id: string; name: string };
export type Assessment = {
  id: string;
  version: number;
  method: string;
  rationale: string;
  resultJson: unknown;
  assessedAt: Date | string;
};

const initial: RoActionState = {};

/** Acción de una sección de la ficha: al guardar bien, la sección vuelve a modo lectura. */
export function useSectionAction<S extends string>(
  section: NoInfer<S>,
  action: (prev: RoActionState, fd: FormData) => Promise<RoActionState>,
  setEditing: Dispatch<SetStateAction<S | null>>,
) {
  return useActionState(async (prev: RoActionState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) setEditing((cur) => (cur === section ? null : cur));
    return result;
  }, initial);
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-solid)] disabled:opacity-60"
    >
      {pending ? "Guardando…" : children}
    </button>
  );
}

export function MemberSelect({
  name,
  label,
  hint,
  members,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  members: Member[];
  defaultValue?: string | null;
}) {
  return (
    <Field label={label} hint={hint} required>
      <select name={name} required defaultValue={defaultValue ?? ""} className={INPUT_CLASS}>
        <option value="" disabled>
          Elegí una persona
        </option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Nivel cualitativo con su explicación a la vista + justificación. */
export function AssessmentFields({
  question,
  rationalePlaceholder,
  hasPrevious,
}: {
  question: string;
  rationalePlaceholder: string;
  hasPrevious: boolean;
}) {
  return (
    <>
      <input type="hidden" name="method" value="qualitative" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{question}</legend>
        <ChoiceCards<QualitativeLevel>
          name="level"
          options={QUALITATIVE_LEVELS.map((l) => ({
            value: l,
            label: QUALITATIVE_LEVEL_LABELS[l],
            hint: QUALITATIVE_LEVEL_HINTS[l],
          }))}
        />
      </fieldset>
      <Field
        label="¿Por qué este nivel?"
        required
        hint={hasPrevious ? "Se guarda como una nueva versión; las anteriores quedan en el historial." : undefined}
      >
        <textarea name="rationale" required rows={2} placeholder={rationalePlaceholder} className={INPUT_CLASS} />
      </Field>
    </>
  );
}

export function AssessmentSummary({
  assessments,
  describe,
}: {
  assessments: Assessment[];
  describe: (method: string, result: unknown) => string;
}) {
  const [latest, ...older] = [...assessments].sort((a, b) => b.version - a.version);
  if (!latest) return null;
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]">
        <dt className="text-[var(--color-ink-muted)]">Nivel actual</dt>
        <dd className="font-semibold">{describe(latest.method, latest.resultJson)}</dd>
        <dt className="text-[var(--color-ink-muted)]">Por qué</dt>
        <dd className="break-words font-medium">{latest.rationale}</dd>
        <dt className="text-[var(--color-ink-muted)]">Evaluado el</dt>
        <dd className="font-medium">
          {new Date(latest.assessedAt).toLocaleDateString("es-AR")} · versión {latest.version}
        </dd>
      </dl>
      {older.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-accent)]">Evaluaciones anteriores ({older.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {older.map((a) => (
              <li key={a.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2">
                <span className="font-medium">Versión {a.version}</span> · {describe(a.method, a.resultJson)} ·{" "}
                {new Date(a.assessedAt).toLocaleDateString("es-AR")}
                <span className="block text-[var(--color-ink-muted)]">{a.rationale}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
