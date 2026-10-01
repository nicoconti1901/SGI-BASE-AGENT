"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  saveCatalogItemAction,
  setCatalogItemActiveAction,
  type MasterDataActionState,
} from "@/app/(tenant)/t/[slug]/master-data/actions";
import { SITE_KINDS, SITE_KIND_LABELS, type MasterDataEntity } from "@/domain/masterdata/types";

const initial: MasterDataActionState = {};

export type CatalogItemView = {
  id: string;
  name: string;
  active: boolean;
  kind?: string;
  address?: string | null;
  critical?: boolean;
};

const NAME_EXAMPLE: Record<MasterDataEntity, string> = {
  site: "Ej.: Base Neuquén",
  position: "Ej.: Operador de grúa",
  task: "Ej.: Trabajo en altura",
};

function Fields({ entity, item }: { entity: MasterDataEntity; item?: CatalogItemView }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre" required>
        <input name="name" required minLength={2} defaultValue={item?.name} placeholder={NAME_EXAMPLE[entity]} className={INPUT_CLASS} />
      </Field>
      {entity === "site" ? (
        <>
          <Field label="Tipo de sede">
            <select name="kind" defaultValue={item?.kind ?? "office"} className={INPUT_CLASS}>
              {SITE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SITE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dirección" hint="Opcional. Sirve para ubicar la sede en inspecciones e informes.">
              <input name="address" defaultValue={item?.address ?? ""} placeholder="Ej.: Ruta 7 km 12, Neuquén" className={INPUT_CLASS} />
            </Field>
          </div>
        </>
      ) : null}
      {entity === "task" ? (
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="critical" defaultChecked={item?.critical} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
          <span>
            <span className="font-semibold">Tarea crítica</span>
            <span className="block text-xs text-[var(--color-ink-muted)]">
              Trabajo en altura, izaje, conducción, espacio confinado… Quien la hace tiene que estar habilitado.
            </span>
          </span>
        </label>
      ) : null}
    </div>
  );
}

/** Alta (sin `item`) o edición (con `item`) de una sede, puesto o tarea. */
export function CatalogForm({
  slug,
  entity,
  item,
  submitLabel,
}: {
  slug: string;
  entity: MasterDataEntity;
  item?: CatalogItemView;
  submitLabel: string;
}) {
  const action = saveCatalogItemAction.bind(null, slug, entity, item?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: !item });

  return (
    <form {...keep} className="flex flex-col gap-3">
      <Fields entity={entity} item={item} />
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Baja lógica o reactivación; muestra el motivo si la baja está bloqueada. */
export function ActiveToggle({
  slug,
  entity,
  item,
  label,
}: {
  slug: string;
  entity: MasterDataEntity;
  item: CatalogItemView;
  label: string;
}) {
  const action = setCatalogItemActiveAction.bind(null, slug, entity, item.id, !item.active);
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.error ? <FormError>{state.error}</FormError> : null}
      <div>
        <Button type="submit" variant={item.active ? "danger" : "secondary"} disabled={pending} aria-label={`${label}: ${item.name}`}>
          {pending ? "Procesando…" : label}
        </Button>
      </div>
    </form>
  );
}
