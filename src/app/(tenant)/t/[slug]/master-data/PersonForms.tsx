"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { SitePicker } from "@/components/pickers/SitePicker";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  savePersonAction,
  savePersonTasksAction,
  setPersonActiveAction,
  type PersonActionState,
} from "@/app/(tenant)/t/[slug]/master-data/people-actions";

const initial: PersonActionState = {};

type Option = { id: string; name: string };
export type TaskOption = Option & { critical: boolean };

export type PersonDefaults = {
  id: string;
  employeeCode: string;
  name: string;
  documentId: string | null;
  userId: string | null;
  employer: "own" | "contractor";
  contractorName: string | null;
  siteId: string;
  extraSiteIds: string[];
  positionId: string;
  /** AAAA-MM-DD */
  hiredAt: string | null;
  jobTaskIds: string[];
};

function Feedback({ state }: { state: PersonActionState }) {
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

function Checks({ name, options, selected }: { name: string; options: (Option & { critical?: boolean })[]; selected: string[] }) {
  if (options.length === 0) return <p className="text-sm text-[var(--color-ink-muted)]">No hay opciones cargadas todavía.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm">
          <input type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(o.id)} className="h-4 w-4 accent-[var(--color-accent)]" />
          <span>
            {o.name}
            {o.critical ? <span className="ml-2 text-xs font-semibold text-[var(--color-warning)]">Crítica</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Alta (sin `person`) o edición completa de una persona. Solo para quien gestiona datos maestros. */
export function PersonForm({
  slug,
  person,
  sites,
  positions,
  tasks,
  members,
}: {
  slug: string;
  person?: PersonDefaults;
  sites: Option[];
  positions: Option[];
  tasks: TaskOption[];
  members: Option[];
}) {
  const action = savePersonAction.bind(null, slug, person?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);
  const [employer, setEmployer] = useState(person?.employer ?? "own");
  const [baseSite, setBaseSite] = useState(person?.siteId ?? "");

  return (
    <form {...keep} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Legajo" required hint="Es único en la empresa. Reimportar la nómina usa el legajo para actualizar.">
          <input name="employeeCode" required defaultValue={person?.employeeCode} placeholder="Ej.: 1042" className={INPUT_CLASS} />
        </Field>
        <Field label="Nombre y apellido" required>
          <input name="name" required minLength={2} defaultValue={person?.name} placeholder="Ej.: Ana Pérez" className={INPUT_CLASS} />
        </Field>
        <Field label="DNI" hint="Opcional. Entre 7 y 9 dígitos.">
          <input name="documentId" inputMode="numeric" defaultValue={person?.documentId ?? ""} placeholder="Ej.: 30111222" className={INPUT_CLASS} />
        </Field>
        <Field label="Fecha de ingreso" hint="Opcional.">
          <input name="hiredAt" type="date" defaultValue={person?.hiredAt ?? ""} className={INPUT_CLASS} />
        </Field>
        <Field label="Empresa">
          <select name="employer" value={employer} onChange={(e) => setEmployer(e.target.value as "own" | "contractor")} className={INPUT_CLASS}>
            <option value="own">Propia</option>
            <option value="contractor">Contratista</option>
          </select>
        </Field>
        {employer === "contractor" ? (
          <Field label="Contratista" hint="Razón social de la empresa contratista.">
            <input name="contractorName" defaultValue={person?.contractorName ?? ""} placeholder="Ej.: Montajes del Sur SA" className={INPUT_CLASS} />
          </Field>
        ) : null}
        <Field label="Puesto" required>
          <select name="positionId" required defaultValue={person?.positionId ?? ""} className={INPUT_CLASS}>
            <option value="" disabled>
              Elegí un puesto
            </option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <SitePicker
          sites={sites}
          name="siteId"
          label="Sede base"
          hint="Donde trabaja habitualmente."
          required
          value={baseSite}
          onChange={setBaseSite}
        />
        <Field label="Usuario del sistema" hint="Opcional. Solo si la persona inicia sesión (por ejemplo, un inspector).">
          <select name="userId" defaultValue={person?.userId ?? ""} className={INPUT_CLASS}>
            <option value="">Sin usuario</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Sedes adicionales</legend>
        <p className="text-xs text-[var(--color-ink-muted)]">Otras sedes donde rota. La sede base no hace falta repetirla.</p>
        <Checks name="extraSiteIds" options={sites.filter((s) => s.id !== baseSite)} selected={person?.extraSiteIds ?? []} />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Tareas que realiza</legend>
        <Checks name="jobTaskIds" options={tasks} selected={person?.jobTaskIds ?? []} />
      </fieldset>

      <Feedback state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : person ? "Guardar cambios" : "Registrar persona"}
        </Button>
      </div>
    </form>
  );
}

/** Asignación de tareas: la usa también el responsable de proceso. */
export function PersonTasksForm({
  slug,
  personId,
  tasks,
  selected,
}: {
  slug: string;
  personId: string;
  tasks: TaskOption[];
  selected: string[];
}) {
  const action = savePersonTasksAction.bind(null, slug, personId);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-col gap-3">
      <Checks name="jobTaskIds" options={tasks} selected={selected} />
      <Feedback state={state} />
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar tareas"}
        </Button>
      </div>
    </form>
  );
}

/** Baja (con motivo opcional) o reactivación de una persona. */
export function PersonActiveToggle({ slug, personId, active, name }: { slug: string; personId: string; active: boolean; name: string }) {
  const action = setPersonActiveAction.bind(null, slug, personId, !active);
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {active ? (
        <Field label="Motivo de la baja" hint="Opcional. Queda en el registro de cambios; el historial de la persona se conserva.">
          <input name="reason" placeholder="Ej.: Renuncia" className={INPUT_CLASS} />
        </Field>
      ) : null}
      <Feedback state={state} />
      <div>
        <Button type="submit" variant={active ? "danger" : "secondary"} disabled={pending}>
          {pending ? "Procesando…" : active ? `Dar de baja a ${name}` : `Reactivar a ${name}`}
        </Button>
      </div>
    </form>
  );
}
