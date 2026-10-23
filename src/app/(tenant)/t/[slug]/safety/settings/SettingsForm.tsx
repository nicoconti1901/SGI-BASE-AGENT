"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { saveSafetySettingsAction, type SettingsState } from "@/app/(tenant)/t/[slug]/safety/settings-actions";

type Option = { id: string; name: string };

type Props = {
  slug: string;
  settings: { fatalChargeDays: number; severityBase: 1000 | 1000000; exposureDueDay: number; exposureOwnerUserId: string | null; showOptionalIndices: boolean };
  members: Option[];
  indicators: Option[];
  links: Record<string, string | undefined>;
  metrics: { key: string; label: string }[];
};

const initial: SettingsState = {};

export function SettingsForm({ slug, settings, members, indicators, links, metrics }: Props) {
  const [state, formAction, pending] = useActionState(saveSafetySettingsAction.bind(null, slug), initial);
  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-[family-name:var(--font-display)] text-base font-semibold">Cómo se calculan los índices</legend>
        <Field label="Días que se cargan por un fallecimiento" hint="Se suman a los días perdidos en el índice de gravedad. Valor habitual: 6.000.">
          <input name="fatalChargeDays" inputMode="numeric" defaultValue={settings.fatalChargeDays} className={INPUT_CLASS} />
        </Field>
        <Field label="Base del índice de gravedad" hint="Días perdidos por cada mil horas (habitual en Argentina) o por cada millón.">
          <select name="severityBase" defaultValue={settings.severityBase} className={INPUT_CLASS}>
            <option value={1000}>Por mil horas</option>
            <option value={1000000}>Por millón de horas</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="showOptionalIndices" defaultChecked={settings.showOptionalIndices} className="h-4 w-4" />
          Mostrar también TRIR y DART (indicadores internacionales; con pocos casos fluctúan mucho)
        </label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-[family-name:var(--font-display)] text-base font-semibold">Carga de las horas trabajadas</legend>
        <Field label="Día del mes siguiente en que vence la carga" hint="Entre 1 y 28. Se avisa 5 días antes.">
          <input name="exposureDueDay" inputMode="numeric" defaultValue={settings.exposureDueDay} className={INPUT_CLASS} />
        </Field>
        <Field label="Quién carga las horas" hint="Recibe el aviso. Sin responsable, lo reciben los administradores.">
          <select name="exposureOwnerUserId" defaultValue={settings.exposureOwnerUserId ?? ""} className={INPUT_CLASS}>
            <option value="">Sin responsable (administradores)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-[family-name:var(--font-display)] text-base font-semibold">Metas</legend>
        <p className="text-sm text-[var(--color-ink-muted)] sm:col-span-2">
          Si ya tenés un indicador con la meta de un índice (en Objetivos e indicadores), vinculalo: el tablero muestra si se cumple. Solo se lee la meta; no se cargan mediciones.
        </p>
        {metrics.map((m) => (
          <Field key={m.key} label={m.label}>
            <select name={`indicator_${m.key}`} defaultValue={links[m.key] ?? ""} className={INPUT_CLASS}>
              <option value="">Sin meta</option>
              {indicators.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </fieldset>

      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar ajustes"}
        </Button>
      </div>
    </form>
  );
}
