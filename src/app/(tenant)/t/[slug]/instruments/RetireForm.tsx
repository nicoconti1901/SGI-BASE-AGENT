"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import { retireInstrumentAction, type InstrumentActionState } from "@/app/(tenant)/t/[slug]/instruments/actions";

const initial: InstrumentActionState = {};

export function RetireInstrumentForm({ slug, assetId, code }: { slug: string; assetId: string; code: string }) {
  const [state, formAction, pending] = useActionState(retireInstrumentAction.bind(null, slug, assetId), initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-col gap-3">
      <Field label={`Motivo de la baja de ${code}`} required hint="Queda registrado. El equipo conserva su historial de calibraciones y no vuelve a usarse.">
        <input name="reason" required minLength={5} placeholder="Ej.: vendido, roto sin reparación, reemplazado" className={INPUT_CLASS} />
      </Field>
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Dando de baja…" : "Dar de baja"}
        </Button>
      </div>
    </form>
  );
}
