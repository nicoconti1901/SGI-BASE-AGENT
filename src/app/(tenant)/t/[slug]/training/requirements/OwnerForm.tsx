"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { setTrainingOwnerAction } from "@/app/(tenant)/t/[slug]/training/followup-actions";

type State = { error?: string; ok?: string };
const initial: State = {};

/** Quién recibe los avisos de vencimiento de capacitaciones. Sin responsable, van a los administradores. */
export function OwnerForm({ slug, members, current }: { slug: string; members: { id: string; name: string }[]; current: string | null }) {
  const [state, formAction, pending] = useActionState(setTrainingOwnerAction.bind(null, slug), initial);
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:max-w-md">
      <Field label="Responsable de capacitaciones" hint="Recibe un resumen por persona con lo que vence o falta. Sin responsable, lo reciben los administradores.">
        <select name="ownerUserId" defaultValue={current ?? ""} className={INPUT_CLASS}>
          <option value="">Sin responsable (administradores)</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar responsable"}
        </Button>
      </div>
    </form>
  );
}
