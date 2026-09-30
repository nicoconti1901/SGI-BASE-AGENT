"use client";

import { useActionState } from "react";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  correctMeasurementAction,
  createFindingFromMeasurementAction,
  recordMeasurementAction,
  type IndicatorActionState,
} from "@/app/(tenant)/t/[slug]/indicators/actions";
import {
  Feedback,
  primary,
  saveChanges,
  secondary,
} from "@/app/(tenant)/t/[slug]/indicators/ObjectiveForms";
import { Field, INPUT_CLASS } from "@/components/ui";

const initial: IndicatorActionState = {};

export function RecordMeasurementForm({
  slug,
  objectiveId,
  indicatorId,
  periodLabel,
  unit,
}: {
  slug: string;
  objectiveId: string;
  indicatorId: string;
  periodLabel: string;
  unit: string;
}) {
  const [state, action, pending] = useActionState(
    recordMeasurementAction.bind(null, slug, objectiveId, indicatorId),
    initial,
  );
  const form = useKeepInputs(action, state, { resetOnSuccess: true });
  return (
    <form {...form} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Cargar {periodLabel}</h3>
      <Field label={`Valor (${unit})`}>
        <input name="value" inputMode="decimal" required className={INPUT_CLASS} />
      </Field>
      <Field
        label="Análisis del desvío"
        hint="Obligatorio si el valor queda fuera de meta: por qué pasó y qué se sabe de la causa."
      >
        <textarea name="analysis" rows={3} className={INPUT_CLASS} />
      </Field>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Guardando…" : "Cargar valor"}
      </button>
    </form>
  );
}

export function CorrectMeasurementForm({
  slug,
  objectiveId,
  indicatorId,
  measurementId,
  currentValue,
  currentAnalysis,
}: {
  slug: string;
  objectiveId: string;
  indicatorId: string;
  measurementId: string;
  currentValue: number;
  currentAnalysis: string;
}) {
  const [state, action, pending] = useActionState(
    correctMeasurementAction.bind(null, slug, objectiveId, indicatorId, measurementId),
    initial,
  );
  const form = useKeepInputs(action, state);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-[var(--color-accent)]">Corregir valor</summary>
      <form {...form} className="mt-3 flex flex-col gap-3">
        <Field label="Valor correcto">
          <input name="value" inputMode="decimal" required defaultValue={currentValue} className={INPUT_CLASS} />
        </Field>
        <Field label="Motivo de la corrección" hint="Queda registrado con el valor anterior.">
          <input name="reason" required className={INPUT_CLASS} />
        </Field>
        <Field label="Análisis del desvío" hint="Obligatorio si el valor corregido queda fuera de meta.">
          <textarea name="analysis" rows={2} defaultValue={currentAnalysis} className={INPUT_CLASS} />
        </Field>
        <Feedback state={state} />
        <button type="submit" disabled={pending} className={saveChanges}>
          {pending ? "Guardando…" : "Guardar corrección"}
        </button>
      </form>
    </details>
  );
}

export function CreateFindingButton({
  slug,
  objectiveId,
  indicatorId,
  measurementId,
}: {
  slug: string;
  objectiveId: string;
  indicatorId: string;
  measurementId: string;
}) {
  const [state, action, pending] = useActionState(
    createFindingFromMeasurementAction.bind(null, slug, objectiveId, indicatorId, measurementId),
    initial,
  );
  const form = useKeepInputs(action, state);
  return (
    <form {...form} className="flex flex-col gap-1">
      <button type="submit" disabled={pending} className={secondary}>
        {pending ? "Creando…" : "Crear hallazgo"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
