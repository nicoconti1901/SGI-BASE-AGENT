"use client";

import { Field, INPUT_CLASS } from "@/components/ui";

import { useActionState } from "react";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  closeObjectiveAction,
  createIndicatorAction,
  createObjectiveAction,
  setIndicatorActiveAction,
  updateIndicatorAction,
  updateObjectiveAction,
  type IndicatorActionState,
} from "@/app/(tenant)/t/[slug]/indicators/actions";
import { AUDIT_STANDARD_LABELS, type AuditStandard } from "@/domain/audits/types";
import {
  DIRECTION_LABELS,
  FREQUENCY_LABELS,
  KIND_HINTS,
  KIND_LABELS,
  type IndicatorDirection,
  type IndicatorFrequency,
  type IndicatorKind,
} from "@/domain/indicators/types";

const initial: IndicatorActionState = {};
export const primary =
  "self-start rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-solid)] disabled:opacity-60";
export const saveChanges =
  "self-start rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] disabled:opacity-60";
export const secondary =
  "self-start rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-medium disabled:opacity-60";

const STANDARDS: AuditStandard[] = ["ISO9001", "ISO14001", "ISO45001"];

export type MemberOption = { id: string; name: string };

export function Feedback({ state }: { state: IndicatorActionState }) {
  if (state.issues?.length) {
    return (
      <div
        role="alert"
        className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]"
      >
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
      <p
        role="alert"
        className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]"
      >
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


function MemberSelect({
  name,
  label,
  hint,
  members,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  members: MemberOption[];
  defaultValue?: string;
}) {
  return (
    <Field label={label} hint={hint}>
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

// ─── Objetivo ───────────────────────────────────────────────────────────────

export type ObjectiveDefaults = {
  title: string;
  description: string;
  standards: AuditStandard[];
  ownerUserId: string;
  dueDate: string;
  plan: string;
};

function ObjectiveFields({ members, defaults }: { members: MemberOption[]; defaults?: ObjectiveDefaults }) {
  return (
    <>
      <Field label="Objetivo" hint="Ej.: Reducir los reclamos de clientes a menos del 2 % de los pedidos.">
        <input name="title" required defaultValue={defaults?.title} className={INPUT_CLASS} />
      </Field>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 font-medium">Normas</legend>
        {STANDARDS.map((s) => (
          <label key={s} className="flex items-center gap-2">
            <input type="checkbox" name="standards" value={s} defaultChecked={defaults?.standards.includes(s)} />
            {AUDIT_STANDARD_LABELS[s]}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <MemberSelect
          name="ownerUserId"
          label="Responsable"
          members={members}
          defaultValue={defaults?.ownerUserId}
        />
        <Field label="Fecha de cumplimiento">
          <input type="date" name="dueDate" required defaultValue={defaults?.dueDate} className={INPUT_CLASS} />
        </Field>
      </div>
      <Field label="Descripción" hint="Qué se quiere lograr y por qué importa.">
        <textarea name="description" rows={2} defaultValue={defaults?.description} className={INPUT_CLASS} />
      </Field>
      <Field label="Plan" hint="Qué se va a hacer, con qué recursos y cómo se evalúan los resultados (§6.2.2).">
        <textarea name="plan" rows={3} defaultValue={defaults?.plan} className={INPUT_CLASS} />
      </Field>
    </>
  );
}

export function CreateObjectiveForm({ slug, members }: { slug: string; members: MemberOption[] }) {
  const [state, action, pending] = useActionState(createObjectiveAction.bind(null, slug), initial);
  const form = useKeepInputs(action, state);
    return (
    <form {...form} className="flex flex-col gap-4">
      <Feedback state={state} />
      <ObjectiveFields members={members} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Creando…" : "Crear y agregar indicadores"}
      </button>
    </form>
  );
}

export function EditObjectiveForm({
  slug,
  objectiveId,
  members,
  defaults,
}: {
  slug: string;
  objectiveId: string;
  members: MemberOption[];
  defaults: ObjectiveDefaults;
}) {
  const [state, action, pending] = useActionState(
    updateObjectiveAction.bind(null, slug, objectiveId),
    initial,
  );
  const form = useKeepInputs(action, state);
    return (
    <form {...form} className="flex flex-col gap-4">
      <ObjectiveFields members={members} defaults={defaults} />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={saveChanges}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function CloseObjectiveForm({ slug, objectiveId }: { slug: string; objectiveId: string }) {
  const [state, action, pending] = useActionState(
    closeObjectiveAction.bind(null, slug, objectiveId),
    initial,
  );
  const form = useKeepInputs(action, state);
    return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-[var(--color-ink-muted)]">Cerrar objetivo</summary>
      <form {...form} className="mt-3 flex flex-col gap-3">
        <Field label="Resultado">
          <select name="result" defaultValue="achieved" className={INPUT_CLASS}>
            <option value="achieved">Cumplido</option>
            <option value="not_achieved">No cumplido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </Field>
        <Field label="Comentario" hint="Qué pasó, o el motivo si se cancela.">
          <textarea name="note" rows={2} required className={INPUT_CLASS} />
        </Field>
        <Feedback state={state} />
        <button type="submit" disabled={pending} className={secondary}>
          Confirmar cierre
        </button>
      </form>
    </details>
  );
}

// ─── Indicador ──────────────────────────────────────────────────────────────

export type IndicatorDefaults = {
  name: string;
  formula: string;
  unit: string;
  direction: IndicatorDirection;
  target: string;
  alertThreshold: string;
  frequency: IndicatorFrequency;
  kind: IndicatorKind;
  ownerUserId: string;
};

function IndicatorFields({ members, defaults }: { members: MemberOption[]; defaults?: IndicatorDefaults }) {
  return (
    <>
      <Field label="Indicador" hint="Ej.: Reclamos por cada 100 pedidos.">
        <input name="name" required defaultValue={defaults?.name} className={INPUT_CLASS} />
      </Field>
      <Field label="Fórmula o método de cálculo" hint="Cómo se obtiene el valor y de qué registro sale.">
        <textarea name="formula" rows={2} defaultValue={defaults?.formula} className={INPUT_CLASS} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Unidad" hint="%, casos, horas…">
          <input name="unit" required defaultValue={defaults?.unit} className={INPUT_CLASS} />
        </Field>
        <Field label="Dirección">
          <select name="direction" defaultValue={defaults?.direction ?? "higher_better"} className={INPUT_CLASS}>
            {(Object.keys(DIRECTION_LABELS) as IndicatorDirection[]).map((d) => (
              <option key={d} value={d}>
                {DIRECTION_LABELS[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Frecuencia">
          <select name="frequency" defaultValue={defaults?.frequency ?? "monthly"} className={INPUT_CLASS}>
            {(Object.keys(FREQUENCY_LABELS) as IndicatorFrequency[]).map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meta">
          <input name="target" inputMode="decimal" required defaultValue={defaults?.target} className={INPUT_CLASS} />
        </Field>
        <Field
          label="Umbral de alerta (opcional)"
          hint="Avisa antes de incumplir: del lado bueno de la meta."
        >
          <input
            name="alertThreshold"
            inputMode="decimal"
            defaultValue={defaults?.alertThreshold}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <select name="kind" defaultValue={defaults?.kind ?? "lagging"} className={INPUT_CLASS}>
            {(Object.keys(KIND_LABELS) as IndicatorKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]} — {KIND_HINTS[k]}
              </option>
            ))}
          </select>
        </Field>
        <MemberSelect
          name="ownerUserId"
          label="Quién carga los valores"
          members={members}
          defaultValue={defaults?.ownerUserId}
        />
      </div>
    </>
  );
}

export function CreateIndicatorForm({
  slug,
  objectiveId,
  members,
}: {
  slug: string;
  objectiveId: string;
  members: MemberOption[];
}) {
  const [state, action, pending] = useActionState(
    createIndicatorAction.bind(null, slug, objectiveId),
    initial,
  );
  const form = useKeepInputs(action, state, { resetOnSuccess: true });
    return (
    <form {...form} className="flex flex-col gap-4">
      <IndicatorFields members={members} />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Agregando…" : "Agregar indicador"}
      </button>
    </form>
  );
}

export function EditIndicatorForm({
  slug,
  objectiveId,
  indicatorId,
  members,
  defaults,
}: {
  slug: string;
  objectiveId: string;
  indicatorId: string;
  members: MemberOption[];
  defaults: IndicatorDefaults;
}) {
  const [state, action, pending] = useActionState(
    updateIndicatorAction.bind(null, slug, objectiveId, indicatorId),
    initial,
  );
  const form = useKeepInputs(action, state);
    return (
    <form {...form} className="flex flex-col gap-4">
      <IndicatorFields members={members} defaults={defaults} />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={saveChanges}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function ToggleIndicatorButton({
  slug,
  objectiveId,
  indicatorId,
  active,
}: {
  slug: string;
  objectiveId: string;
  indicatorId: string;
  active: boolean;
}) {
  const [state, action, pending] = useActionState(
    setIndicatorActiveAction.bind(null, slug, objectiveId, indicatorId, !active),
    initial,
  );
  const form = useKeepInputs(action, state);
    return (
    <form {...form} className="flex flex-col gap-1">
      <button type="submit" disabled={pending} className={secondary}>
        {active ? "Desactivar indicador" : "Reactivar indicador"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
