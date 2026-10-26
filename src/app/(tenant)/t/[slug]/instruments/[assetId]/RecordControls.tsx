"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  discardDraftAction,
  registerReturnAction,
  removeCertificateAction,
  sendToCalibrationAction,
  voidRecordAction,
  type InstrumentActionState,
} from "@/app/(tenant)/t/[slug]/instruments/actions";

const initial: InstrumentActionState = {};

function Feedback({ state }: { state: InstrumentActionState }) {
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

/** Anular un registro cerrado: pide el motivo, que queda visible en el historial. */
export function VoidRecordForm({ slug, assetId, recordId }: { slug: string; assetId: string; recordId: string }) {
  const [state, formAction, pending] = useActionState(voidRecordAction.bind(null, slug, assetId, recordId), initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-col gap-2">
      <Field label="Motivo de la anulación" required hint="El registro se conserva tachado y deja de contar. Después cargá el correcto.">
        <input name="reason" required minLength={5} maxLength={300} placeholder="Ej.: se cargó en el equipo equivocado" className={INPUT_CLASS} />
      </Field>
      <Feedback state={state} />
      <div>
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Anulando…" : "Anular registro"}
        </Button>
      </div>
    </form>
  );
}

export function DiscardDraftForm({ slug, assetId, recordId }: { slug: string; assetId: string; recordId: string }) {
  const [state, formAction, pending] = useActionState(discardDraftAction.bind(null, slug, assetId, recordId), initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-col gap-2">
      <Feedback state={state} />
      <div>
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Descartando…" : "Descartar el borrador"}
        </Button>
      </div>
    </form>
  );
}

export function RemoveCertificateForm({ slug, assetId, attachmentId, fileName }: { slug: string; assetId: string; attachmentId: string; fileName: string }) {
  const [state, formAction, pending] = useActionState(removeCertificateAction.bind(null, slug, assetId, attachmentId), initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="inline-flex items-center gap-2">
      <Button type="submit" variant="ghost" disabled={pending} aria-label={`Quitar ${fileName}`}>
        Quitar
      </Button>
      {state.error ? <span className="text-xs text-[var(--color-danger)]">{state.error}</span> : null}
    </form>
  );
}

/** El equipo sale al laboratorio. */
export function SendToLabForm({ slug, assetId, today }: { slug: string; assetId: string; today: string }) {
  const [state, formAction, pending] = useActionState(sendToCalibrationAction.bind(null, slug, assetId), initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Fecha de envío" required>
          <input name="sentAt" type="date" required max={today} defaultValue={today} className={INPUT_CLASS} />
        </Field>
        <Field label="Regreso estimado" hint="Opcional.">
          <input name="expectedReturnAt" type="date" className={INPUT_CLASS} />
        </Field>
        <Field label="Laboratorio" hint="Opcional.">
          <input name="labName" maxLength={120} className={INPUT_CLASS} />
        </Field>
      </div>
      <Feedback state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando…" : "Registrar el envío"}
        </Button>
      </div>
    </form>
  );
}

/** El equipo volvió del laboratorio. */
export function ReturnFromLabForm({ slug, assetId, today }: { slug: string; assetId: string; today: string }) {
  const [state, formAction, pending] = useActionState(registerReturnAction.bind(null, slug, assetId), initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-col gap-3">
      <Field label="Fecha de regreso" required hint="Registrar el regreso no deja el equipo vigente: para eso hay que cargar la calibración.">
        <input name="returnedAt" type="date" required max={today} defaultValue={today} className={`${INPUT_CLASS} sm:max-w-56`} />
      </Field>
      <Feedback state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando…" : "Registrar el regreso"}
        </Button>
      </div>
    </form>
  );
}
