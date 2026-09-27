"use client";

import { useActionState } from "react";
import {
  addMeasureAction,
  cancelFindingAction,
  reopenFindingAction,
  rescheduleVerificationAction,
  startMeasureAction,
  verifyFindingAction,
  type LifecycleActionState,
} from "@/app/(tenant)/t/[slug]/findings/lifecycle-actions";

const initial: LifecycleActionState = {};
const input =
  "rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";
const primary =
  "self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60";
const secondary =
  "self-start rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-1.5 text-sm font-medium disabled:opacity-60";

export function Feedback({ state }: { state: LifecycleActionState }) {
  if (state.issues?.length) {
    return (
      <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
        <p className="font-medium">Falta:</p>
        <ul className="mt-1 list-disc pl-5">
          {state.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-[var(--color-success)]">
        {state.ok}
      </p>
    );
  }
  return null;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[var(--color-ink-muted)]">{hint}</span> : null}
    </label>
  );
}

export function StartMeasureButton({
  slug,
  findingId,
  measureId,
}: {
  slug: string;
  findingId: string;
  measureId: string;
}) {
  const [state, action, pending] = useActionState(
    startMeasureAction.bind(null, slug, findingId, measureId),
    initial,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <button type="submit" disabled={pending} className={secondary}>
        {pending ? "Iniciando…" : "Iniciar medida"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function VerifyForm({
  slug,
  findingId,
  soleOwner,
  early,
  dueLabel,
}: {
  slug: string;
  findingId: string;
  /** Quien verifica es responsable de todas las medidas (P3). */
  soleOwner: boolean;
  /** Todavía no llegó la fecha programada (P2). */
  early: boolean;
  dueLabel: string | null;
}) {
  const [state, action, pending] = useActionState(
    verifyFindingAction.bind(null, slug, findingId),
    initial,
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent-ink)]">
        ¿El problema volvió a ocurrir desde que se cerraron las medidas? Revisá registros, inspecciones o
        indicadores del período, no solo que las tareas estén hechas.
      </p>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 font-medium">Resultado</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="result" value="effective" required />
          Eficaz: no volvió a ocurrir
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="result" value="not_effective" />
          No eficaz: el problema persiste
        </label>
      </fieldset>
      <Field label="Evidencia de eficacia" hint="Qué revisaste, en qué período y qué encontraste.">
        <textarea
          name="evidence"
          rows={3}
          placeholder="Ej.: se inspeccionaron 12 trabajos en altura de octubre; todos con permiso verificado en campo y línea de vida instalada."
          className={input}
        />
      </Field>
      {early ? (
        <Field
          label="Motivo para verificar antes de lo programado"
          hint={dueLabel ? `La verificación está programada para el ${dueLabel}.` : undefined}
        >
          <input name="earlyReason" placeholder="Ej.: el proceso tiene ciclo semanal y ya pasaron 4 ciclos" className={input} />
        </Field>
      ) : null}
      {soleOwner ? (
        <Field
          label="Sos responsable de todas las medidas: justificá por qué verificás vos"
          hint="Lo recomendable es que verifique otra persona."
        >
          <input name="independenceException" placeholder="Ej.: única persona de SST en la planta" className={input} />
        </Field>
      ) : null}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Registrando…" : "Registrar verificación"}
      </button>
    </form>
  );
}

export function RescheduleForm({
  slug,
  findingId,
  current,
}: {
  slug: string;
  findingId: string;
  current: string;
}) {
  const [state, action, pending] = useActionState(
    rescheduleVerificationAction.bind(null, slug, findingId),
    initial,
  );
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-[var(--color-ink-muted)]">Cambiar la fecha de verificación</summary>
      <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
        <Field label="Nueva fecha">
          <input type="date" name="dueAt" defaultValue={current} required className={input} />
        </Field>
        <button type="submit" disabled={pending} className={secondary}>
          Reprogramar
        </button>
        <Feedback state={state} />
      </form>
    </details>
  );
}

export function ReasonForm({
  slug,
  findingId,
  kind,
}: {
  slug: string;
  findingId: string;
  kind: "cancel" | "reopen";
}) {
  const bound =
    kind === "cancel"
      ? cancelFindingAction.bind(null, slug, findingId)
      : reopenFindingAction.bind(null, slug, findingId);
  const [state, action, pending] = useActionState(bound, initial);
  const copy =
    kind === "cancel"
      ? {
          summary: "Anular hallazgo",
          label: "Motivo de la anulación",
          placeholder: "Ej.: duplicado del hallazgo de ayer",
          button: "Confirmar anulación",
        }
      : {
          summary: "Reabrir hallazgo",
          label: "Motivo de la reapertura",
          placeholder: "Ej.: volvió a ocurrir una caída en la nave 3",
          button: "Confirmar reapertura",
        };
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-[var(--color-ink-muted)]">{copy.summary}</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <Field label={copy.label}>
          <input name="reason" required placeholder={copy.placeholder} className={input} />
        </Field>
        <Feedback state={state} />
        <button type="submit" disabled={pending} className={secondary}>
          {copy.button}
        </button>
      </form>
    </details>
  );
}

export function AddMeasureForm({
  slug,
  findingId,
  members,
  highlight,
}: {
  slug: string;
  findingId: string;
  members: { id: string; name: string }[];
  /** Tras "no eficaz" o reapertura: se abre sola y sugiere correctiva. */
  highlight: boolean;
}) {
  const [state, action, pending] = useActionState(addMeasureAction.bind(null, slug, findingId), initial);
  return (
    <details open={highlight} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
      <summary className="cursor-pointer text-sm font-medium">Agregar medida</summary>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <select name="kind" defaultValue="corrective" className={input}>
            <option value="corrective">Correctiva</option>
            <option value="preventive">Preventiva</option>
          </select>
        </Field>
        <Field label="Responsable">
          <select name="ownerUserId" required className={input}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Qué se va a hacer">
            <input name="title" required placeholder="Ej.: instalar línea de vida fija en nave 3" className={input} />
          </Field>
        </div>
        <Field label="Vence" hint="Obligatorio para medidas correctivas.">
          <input type="date" name="dueAt" className={input} />
        </Field>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="linkedRootCause" defaultChecked={highlight} />
          Ataca la causa raíz
        </label>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Feedback state={state} />
          <button type="submit" disabled={pending} className={primary}>
            {pending ? "Agregando…" : "Agregar medida"}
          </button>
        </div>
      </form>
    </details>
  );
}
