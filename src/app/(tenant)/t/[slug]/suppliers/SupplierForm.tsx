"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, Field, FormError, HintCallout, INPUT_CLASS, buttonClass } from "@/components/ui";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import { saveSupplierAction, type SupplierActionState } from "@/app/(tenant)/t/[slug]/suppliers/actions";
import {
  SUPPLIER_CRITICALITIES,
  SUPPLIER_CRITICALITY_HINTS,
  SUPPLIER_CRITICALITY_LABELS,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
  type SupplierCriticalityValue,
  type SupplierTypeValue,
} from "@/domain/suppliers/types";

const initial: SupplierActionState = {};

export type SupplierDefaults = {
  id: string;
  legalName: string;
  tradeName: string | null;
  taxId: string | null;
  type: SupplierTypeValue;
  category: string | null;
  criticality: SupplierCriticalityValue;
  criticalityReason: string | null;
  ownerUserId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  siteIds: string[];
};

type Option = { id: string; name: string };

/** Alta (sin `supplier`) o edición de un proveedor. Solo para quien gestiona proveedores. */
export function SupplierForm({
  slug,
  supplier,
  sites,
  members,
  categories,
  currentUserId,
}: {
  slug: string;
  supplier?: SupplierDefaults;
  sites: Option[];
  members: Option[];
  categories: string[];
  currentUserId: string;
}) {
  const action = saveSupplierAction.bind(null, slug, supplier?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);
  const [criticality, setCriticality] = useState<SupplierCriticalityValue>(supplier?.criticality ?? "standard");
  const reasonRequired = criticality !== "standard";

  return (
    <form {...keep} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Razón social" required>
          <input name="legalName" required minLength={2} defaultValue={supplier?.legalName} placeholder="Ej.: Montajes del Sur SA" className={INPUT_CLASS} />
        </Field>
        <Field label="Nombre de fantasía" hint="Opcional.">
          <input name="tradeName" defaultValue={supplier?.tradeName ?? ""} placeholder="Ej.: Montajes Sur" className={INPUT_CLASS} />
        </Field>
        <Field label="CUIT" hint="Opcional solo para proveedores del exterior. Se controla el dígito verificador.">
          <input name="taxId" inputMode="numeric" defaultValue={supplier?.taxId ?? ""} placeholder="Ej.: 30-50001091-2" className={INPUT_CLASS} />
        </Field>
        <Field label="Tipo" required hint="El contratista trabaja dentro de sus instalaciones: se le exige documentación laboral y de seguros.">
          <select name="type" required defaultValue={supplier?.type ?? ""} className={INPUT_CLASS}>
            <option value="" disabled>Elegí el tipo</option>
            {SUPPLIER_TYPES.map((t) => (
              <option key={t} value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Rubro" hint="Texto libre. Sugerimos los que ya usó.">
          <input name="category" list="supplier-categories" defaultValue={supplier?.category ?? ""} placeholder="Ej.: Mantenimiento industrial" className={INPUT_CLASS} />
          <datalist id="supplier-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Responsable interno" hint="Quien recibe los avisos de reevaluación y vencimientos.">
          <select name="ownerUserId" defaultValue={supplier ? (supplier.ownerUserId ?? "") : currentUserId} className={INPUT_CLASS}>
            <option value="">Sin responsable</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Criticidad</legend>
        <HintCallout>¿Un fallo de este proveedor afecta la conformidad del producto, la seguridad o el ambiente?</HintCallout>
        <div className="grid gap-2 sm:grid-cols-3">
          {SUPPLIER_CRITICALITIES.map((c) => (
            <label key={c} className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-soft)]">
              <input type="radio" name="criticality" value={c} checked={criticality === c} onChange={() => setCriticality(c)} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
              <span>
                <span className="font-semibold">{SUPPLIER_CRITICALITY_LABELS[c]}</span>
                <span className="block text-xs text-[var(--color-ink-muted)]">{SUPPLIER_CRITICALITY_HINTS[c]}</span>
              </span>
            </label>
          ))}
        </div>
        <Field
          label="Motivo de la criticidad"
          required={reasonRequired}
          hint={reasonRequired ? "Es obligatorio: queda como respaldo ante una auditoría." : "Opcional para proveedores estándar."}
        >
          <textarea
            name="criticalityReason"
            rows={2}
            required={reasonRequired}
            defaultValue={supplier?.criticalityReason ?? ""}
            placeholder={criticality === "low" ? "Ej.: Compra ocasional de insumos de oficina, sin impacto en el producto." : "Ej.: Trabaja en altura dentro de la planta."}
            className={INPUT_CLASS}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Sedes que atiende</legend>
        <p className="text-xs text-[var(--color-ink-muted)]">Si no marca ninguna, se entiende que atiende todas.</p>
        {sites.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Todavía no hay sedes cargadas en Datos maestros.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {sites.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm">
                <input type="checkbox" name="siteIds" value={s.id} defaultChecked={supplier?.siteIds.includes(s.id)} className="h-4 w-4 accent-[var(--color-accent)]" />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Contacto" hint="Opcional.">
          <input name="contactName" defaultValue={supplier?.contactName ?? ""} placeholder="Ej.: Luis Gómez" className={INPUT_CLASS} />
        </Field>
        <Field label="Email del contacto">
          <input name="contactEmail" type="email" defaultValue={supplier?.contactEmail ?? ""} placeholder="Ej.: luis@montajes.com" className={INPUT_CLASS} />
        </Field>
        <Field label="Teléfono">
          <input name="contactPhone" defaultValue={supplier?.contactPhone ?? ""} placeholder="Ej.: 299 555 0101" className={INPUT_CLASS} />
        </Field>
      </div>
      <Field label="Notas" hint="Opcional.">
        <textarea name="notes" rows={3} defaultValue={supplier?.notes ?? ""} className={INPUT_CLASS} />
      </Field>

      {state.error ? <FormError>{state.error}</FormError> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : supplier ? "Guardar cambios" : "Registrar proveedor"}
        </Button>
        <Link href={supplier ? `/t/${slug}/suppliers/${supplier.id}` : `/t/${slug}/suppliers`} className={buttonClass("ghost")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
