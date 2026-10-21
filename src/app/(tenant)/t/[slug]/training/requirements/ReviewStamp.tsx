"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import { recordMatrixReviewAction, type TrainingActionState } from "@/app/(tenant)/t/[slug]/training/actions";

const initial: TrainingActionState = {};

/** Sello de revisión de la matriz: fecha, quién y quiénes participaron o fueron consultados (ISO 45001 §5.4). */
export function ReviewStamp({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(recordMatrixReviewAction.bind(null, slug), initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: true });
  return (
    <form {...keep} className="flex flex-col gap-3">
      <Field
        label="Quiénes participaron o fueron consultados"
        hint="Ej.: Revisada con el delegado de seguridad, el jefe de planta y la representante de los trabajadores."
        required
      >
        <textarea name="note" required minLength={3} maxLength={2000} rows={3} className={INPUT_CLASS} />
      </Field>
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Registrando…" : "Registrar revisión de la matriz"}
        </Button>
      </div>
    </form>
  );
}
