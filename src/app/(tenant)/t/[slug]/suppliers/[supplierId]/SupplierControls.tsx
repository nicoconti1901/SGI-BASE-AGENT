"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import {
  linkPersonAction,
  setSupplierActiveAction,
  unlinkPersonAction,
  type SupplierActionState,
} from "@/app/(tenant)/t/[slug]/suppliers/actions";
import { useKeepInputs } from "@/lib/use-keep-inputs";

const initial: SupplierActionState = {};

function Feedback({ state }: { state: SupplierActionState }) {
  return (
    <>
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
    </>
  );
}

/** Baja con motivo, o reactivación si ya está de baja. */
export function SupplierActiveControl({ slug, supplierId, inactive }: { slug: string; supplierId: string; inactive: boolean }) {
  const action = setSupplierActiveAction.bind(null, slug, supplierId, inactive);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-col gap-3">
      {inactive ? null : (
        <Field label="Motivo de la baja" hint="Queda registrado. Se puede reactivar más adelante.">
          <input name="reason" required minLength={3} placeholder="Ej.: Dejó de operar con nosotros" className={INPUT_CLASS} />
        </Field>
      )}
      <Feedback state={state} />
      <div>
        <Button type="submit" variant={inactive ? "secondary" : "danger"} disabled={pending}>
          {pending ? "Guardando…" : inactive ? "Reactivar proveedor" : "Dar de baja"}
        </Button>
      </div>
    </form>
  );
}

export type LinkablePerson = { id: string; name: string; employeeCode: string; contractorName: string | null; sameName: boolean };

export function LinkPersonForm({ slug, supplierId, people }: { slug: string; supplierId: string; people: LinkablePerson[] }) {
  const action = linkPersonAction.bind(null, slug, supplierId);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: true });
  if (people.length === 0) {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">
        No hay personas de contratistas sin vincular. Cargalas en Datos maestros como «Contratista» y volvé acá.
      </p>
    );
  }
  return (
    <form {...keep} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-[16rem] flex-1">
        <Field label="Vincular una persona" hint="Primero van las que figuran con el nombre de este contratista.">
          <select name="personId" required defaultValue="" className={INPUT_CLASS}>
            <option value="" disabled>
              Elegí una persona
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.employeeCode}){p.contractorName ? ` · ${p.contractorName}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Vinculando…" : "Vincular"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function UnlinkPersonButton({ slug, supplierId, personId, name }: { slug: string; supplierId: string; personId: string; name: string }) {
  const action = unlinkPersonAction.bind(null, slug, supplierId, personId);
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <Button type="submit" variant="ghost" disabled={pending} aria-label={`Desvincular a ${name}`}>
        {pending ? "…" : "Desvincular"}
      </Button>
      {state.error ? <span className="text-xs text-[var(--color-danger)]">{state.error}</span> : null}
    </form>
  );
}
