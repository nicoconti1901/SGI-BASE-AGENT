"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import {
  addFichaAction,
  addFollowUpAction,
  saveHealthAction,
  updateFactAction,
  type FichaActionState,
} from "@/app/(tenant)/t/[slug]/safety/actions";
import {
  FactFields,
  HealthFields,
  type FactDefaults,
  type HealthDefaults,
  type SiteOption,
} from "@/app/(tenant)/t/[slug]/safety/IncidentFields";
import {
  CLASSIFICATION_LABELS,
  LABOR_CLASSIFICATIONS,
  type IncidentClassification,
} from "@/domain/safety-stats/types";

const initial: FichaActionState = {};

function Feedback({ state }: { state: FichaActionState }) {
  return (
    <>
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm font-medium text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      {state.warnings?.map((w) => (
        <p key={w} role="status" className="text-sm text-[var(--color-warning)]">
          {w}
        </p>
      ))}
    </>
  );
}

/** Ficha de salud: persona afectada, lesión, parte del cuerpo y n.° de ART. */
export function HealthForm({
  slug,
  findingId,
  classification,
  defaults,
}: {
  slug: string;
  findingId: string;
  classification: IncidentClassification;
  defaults?: HealthDefaults;
}) {
  const [state, action, pending] = useActionState(saveHealthAction.bind(null, slug, findingId), initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <HealthFields slug={slug} classification={classification} defaults={defaults} />
      <Feedback state={state} />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando…" : "Guardar ficha de salud"}
      </Button>
    </form>
  );
}

/** Corrige el hecho. La clasificación y los días se cambian con un seguimiento. */
export function FactForm({
  slug,
  findingId,
  sites,
  defaults,
}: {
  slug: string;
  findingId: string;
  sites: SiteOption[];
  defaults: FactDefaults;
}) {
  const [state, action, pending] = useActionState(updateFactAction.bind(null, slug, findingId), initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FactFields sites={sites} defaults={defaults} showDays={false} lockClassification />
      <Feedback state={state} />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando…" : "Guardar cambios del hecho"}
      </Button>
    </form>
  );
}

/** Para un incidente dado de alta sin ficha. */
export function AddFichaForm({
  slug,
  findingId,
  sites,
}: {
  slug: string;
  findingId: string;
  sites: SiteOption[];
}) {
  const [state, action, pending] = useActionState(addFichaAction.bind(null, slug, findingId), initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FactFields sites={sites} showDays={false} />
      <Feedback state={state} />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando…" : "Registrar ficha de accidente"}
      </Button>
    </form>
  );
}

/** Actualizar días perdidos o reclasificar: cada envío agrega una fila al historial. */
export function FollowUpForm({
  slug,
  findingId,
  current,
}: {
  slug: string;
  findingId: string;
  current: { classification: IncidentClassification; returnToWorkDate: string; chargePct: string; restrictedWork: boolean };
}) {
  const [state, action, pending] = useActionState(addFollowUpAction.bind(null, slug, findingId), initial);
  const [classification, setClassification] = useState<IncidentClassification>(current.classification);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Clasificación" hint="Si el caso empeoró o mejoró, cambiala acá: queda en el historial.">
        <select
          name="fact_classification"
          value={classification}
          onChange={(e) => setClassification(e.target.value as IncidentClassification)}
          className={INPUT_CLASS}
        >
          {LABOR_CLASSIFICATIONS.map((c) => (
            <option key={c} value={c}>
              {CLASSIFICATION_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>
      {classification === "lost_time" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de reintegro" hint="Vacía = sigue de baja. El sistema cuenta los días.">
            <input type="date" name="fact_returnToWorkDate" defaultValue={current.returnToWorkDate} className={INPUT_CLASS} />
          </Field>
          <Field label="Incapacidad permanente (%)">
            <input
              type="number"
              name="fact_chargePct"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              defaultValue={current.chargePct}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      ) : null}
      {classification === "no_lost_time" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="fact_restrictedWork"
            defaultChecked={current.restrictedWork}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Volvió con tareas restringidas
        </label>
      ) : null}
      <Field label="Nota" hint="Opcional. No incluyas diagnósticos.">
        <textarea name="note" rows={2} maxLength={500} className={INPUT_CLASS} />
      </Field>
      <Feedback state={state} />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Registrando…" : "Registrar seguimiento"}
      </Button>
    </form>
  );
}
