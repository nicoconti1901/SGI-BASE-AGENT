"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { SitePicker } from "@/components/pickers/SitePicker";
import { PersonPicker } from "@/components/pickers/PersonPicker";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  renewDueDateAction,
  retireAssetAction,
  saveAssetAction,
  type AssetActionState,
} from "@/app/(tenant)/t/[slug]/assets/actions";
import { getAssetType, type AttributeField } from "@/domain/inspections/asset-types";

const initial: AssetActionState = {};

function Feedback({ state }: { state: AssetActionState }) {
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

export type AssetDefaults = {
  id: string;
  code: string;
  description: string;
  siteId: string;
  sector: string | null;
  ownership: "own" | "rented" | "contractor";
  contractorName: string | null;
  assignedPerson: { id: string; name: string; employeeCode: string; siteName: string } | null;
  attributes: Record<string, unknown>;
};

function AttributeInput({ field, value }: { field: AttributeField; value: unknown }) {
  const name = `attr_${field.key}`;
  const hint = "hint" in field ? field.hint : undefined;
  if (field.type === "boolean") {
    return (
      <label className="flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm">
        <input type="checkbox" name={name} defaultChecked={value === true} className="h-4 w-4 accent-[var(--color-accent)]" />
        <span>{field.label}</span>
      </label>
    );
  }
  return (
    <Field label={field.label} required={field.required} hint={hint}>
      {field.type === "select" ? (
        <select name={name} required={field.required} defaultValue={String(value ?? (field.required ? field.options[0]?.value : "") ?? "")} className={INPUT_CLASS}>
          {field.required ? null : <option value="">—</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "number" ? (
        <input name={name} type="number" inputMode="decimal" required={field.required} min={field.min} step={field.step ?? "any"} defaultValue={value === undefined ? String(field.initial ?? "") : String(value)} className={INPUT_CLASS} />
      ) : (
        <input name={name} type={field.type === "date" ? "date" : "text"} required={field.required} defaultValue={value === undefined ? "" : String(value)} className={INPUT_CLASS} />
      )}
    </Field>
  );
}

/** Alta (sin `asset`) o edición de un activo. Los campos y vencimientos salen del tipo. */
export function AssetForm({
  slug,
  typeKey,
  fields,
  dueKindLabels,
  sites,
  asset,
}: {
  slug: string;
  typeKey: string;
  fields: AttributeField[];
  dueKindLabels: Record<string, string>;
  sites: { id: string; name: string }[];
  asset?: AssetDefaults;
}) {
  const action = saveAssetAction.bind(null, slug, asset?.id ?? null, typeKey);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);
  const [ownership, setOwnership] = useState(asset?.ownership ?? "own");

  return (
    <form {...keep} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {asset ? null : (
          <Field label="Código" required hint="Es único en la empresa y se guarda en mayúsculas. Ej.: EXT-014 (como figura en la etiqueta).">
            <input name="code" required maxLength={30} placeholder="Ej.: EXT-014" className={INPUT_CLASS} />
          </Field>
        )}
        <Field label="Descripción" required hint="Dónde está o qué es, para reconocerlo rápido.">
          <input name="description" required minLength={2} defaultValue={asset?.description} placeholder="Ej.: Pasillo planta baja, junto a la escalera" className={INPUT_CLASS} />
        </Field>
        <SitePicker sites={sites} name="siteId" label="Sede" required defaultValue={asset?.siteId ?? ""} />
        <Field label="Sector" hint="Opcional. Texto libre.">
          <input name="sector" defaultValue={asset?.sector ?? ""} placeholder="Ej.: Depósito" className={INPUT_CLASS} />
        </Field>
        <Field label="Propiedad">
          <select name="ownership" value={ownership} onChange={(e) => setOwnership(e.target.value as typeof ownership)} className={INPUT_CLASS}>
            <option value="own">Propio</option>
            <option value="rented">Alquilado</option>
            <option value="contractor">De contratista</option>
          </select>
        </Field>
        {ownership !== "own" ? (
          <Field label={ownership === "contractor" ? "Contratista" : "Proveedor del alquiler"} required={ownership === "contractor"}>
            <input name="contractorName" defaultValue={asset?.contractorName ?? ""} placeholder="Ej.: Montajes del Sur SA" className={INPUT_CLASS} />
          </Field>
        ) : null}
        <PersonPicker slug={slug} name="assignedPersonId" label="Persona a cargo" hint="Opcional. Recibe los avisos de este activo si tiene usuario." defaultPerson={asset?.assignedPerson ?? null} />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Datos del equipo</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <AttributeInput key={f.key} field={f} value={asset?.attributes[f.key]} />
          ))}
        </div>
      </fieldset>

      {asset ? null : (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold">Vencimientos</legend>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {getAssetType(typeKey).dueHelp ??
              "Cargá la última fecha en que se hizo y el sistema calcula el vencimiento, o cargá el vencimiento directamente. El mantenimiento es obligatorio; la prueba hidráulica, si la dejás vacía, se cuenta desde la fabricación. La prueba de manguera solo aplica a CO₂ o mangueras con válvula de control."}
          </p>
          {Object.entries(dueKindLabels).map(([kind, label]) => (
            <div key={kind} className="grid gap-3 sm:grid-cols-2">
              <Field label={`${label}: última vez`}>
                <input name={`due_${kind}_last`} type="date" className={INPUT_CLASS} />
              </Field>
              <Field label={`${label}: vence`}>
                <input name={`due_${kind}_due`} type="date" className={INPUT_CLASS} />
              </Field>
            </div>
          ))}
        </fieldset>
      )}

      <Feedback state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : asset ? "Guardar cambios" : "Registrar activo"}
        </Button>
      </div>
    </form>
  );
}

/** Renovar un vencimiento: nueva fecha (o última vez) y comprobante. */
export function RenewDueDateForm({ slug, assetId, kind, label }: { slug: string; assetId: string; kind: string; label: string }) {
  const action = renewDueDateAction.bind(null, slug, assetId, kind);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: true });
  return (
    <form {...keep} className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Se hizo el" hint="El sistema suma el plazo.">
          <input name="lastDoneAt" type="date" className={INPUT_CLASS} />
        </Field>
        <Field label="O nuevo vencimiento">
          <input name="dueAt" type="date" className={INPUT_CLASS} />
        </Field>
        <Field label="Comprobante" hint="N.º de certificado. Opcional.">
          <input name="reference" maxLength={80} className={INPUT_CLASS} />
        </Field>
      </div>
      <Feedback state={state} />
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Renovando…" : `Renovar ${label.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}

export function RetireAssetForm({ slug, assetId, code }: { slug: string; assetId: string; code: string }) {
  const action = retireAssetAction.bind(null, slug, assetId);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-col gap-3">
      <Field label={`Motivo de la baja de ${code}`} required hint="Queda registrado. Un activo dado de baja no vuelve y no se puede inspeccionar.">
        <input name="reason" required minLength={5} placeholder="Ej.: vendido, destruido, fuera de uso" className={INPUT_CLASS} />
      </Field>
      <Feedback state={state} />
      <div>
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Dando de baja…" : "Dar de baja"}
        </Button>
      </div>
    </form>
  );
}
