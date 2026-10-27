"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { createSupplierFindingAction, recordCommunicationAction } from "@/app/(tenant)/t/[slug]/suppliers/followup-actions";
import type { SupplierActionState } from "@/app/(tenant)/t/[slug]/suppliers/guard";
import {
  SUPPLIER_COMMUNICATION_CHANNELS,
  SUPPLIER_COMMUNICATION_CHANNEL_LABELS,
  SUPPLIER_COMMUNICATION_KINDS,
  SUPPLIER_COMMUNICATION_KIND_LABELS,
  SUPPLIER_FINDING_KINDS,
  SUPPLIER_FINDING_KIND_LABELS,
  type SupplierCommunicationKindValue,
} from "@/domain/suppliers/findings";
import { useKeepInputs } from "@/lib/use-keep-inputs";

const initial: SupplierActionState = {};

function Feedback({ state }: { state: SupplierActionState }) {
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

/** Registrar un hallazgo del proveedor: nace en borrador en Hallazgos, con origen «proveedor». */
export function NewSupplierFindingForm({ slug, supplierId, today }: { slug: string; supplierId: string; today: string }) {
  const action = createSupplierFindingAction.bind(null, slug, supplierId);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: true });
  return (
    <form {...keep} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo" required>
          <select name="kind" required defaultValue="" className={INPUT_CLASS}>
            <option value="" disabled>Elegí de qué se trata</option>
            {SUPPLIER_FINDING_KINDS.map((k) => (
              <option key={k} value={k}>{SUPPLIER_FINDING_KIND_LABELS[k]}</option>
            ))}
          </select>
        </Field>
        <Field label="Detectado el" required>
          <input type="date" name="detectedAt" required defaultValue={today} max={today} className={INPUT_CLASS} />
        </Field>
      </div>
      <Field label="Qué pasó" required hint="Hechos concretos: qué, cuándo y qué efecto tuvo.">
        <textarea name="description" required minLength={3} rows={3} placeholder="Ej.: El lote 4521 llegó con 3 días de atraso y 12 piezas fuera de medida." className={INPUT_CLASS} />
      </Field>
      <Field label="Título" hint="Opcional: si lo dejás vacío se arma solo con el tipo y el proveedor.">
        <input name="title" maxLength={140} className={INPUT_CLASS} />
      </Field>
      <Feedback state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Registrar hallazgo"}
        </Button>
      </div>
    </form>
  );
}

export type EvaluationOption = { id: string; label: string };

/** Registrar lo que se le comunicó al proveedor (ISO 9001 §8.4.3). Solo registra: no envía nada. */
export function CommunicationForm({
  slug,
  supplierId,
  today,
  evaluations,
  defaultKind,
  defaultEvaluationId,
}: {
  slug: string;
  supplierId: string;
  today: string;
  evaluations: EvaluationOption[];
  defaultKind: SupplierCommunicationKindValue;
  defaultEvaluationId?: string;
}) {
  const action = recordCommunicationAction.bind(null, slug, supplierId);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: true });
  return (
    <form {...keep} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Qué se comunicó" required>
          <select name="kind" required defaultValue={defaultKind} className={INPUT_CLASS}>
            {SUPPLIER_COMMUNICATION_KINDS.map((k) => (
              <option key={k} value={k}>{SUPPLIER_COMMUNICATION_KIND_LABELS[k]}</option>
            ))}
          </select>
        </Field>
        <Field label="Evaluación" hint="Obligatoria si comunicó un resultado.">
          <select name="evaluationId" defaultValue={defaultEvaluationId ?? ""} className={INPUT_CLASS}>
            <option value="">Ninguna</option>
            {evaluations.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Fecha" required>
          <input type="date" name="sentAt" required defaultValue={today} max={today} className={INPUT_CLASS} />
        </Field>
        <Field label="Cómo" required>
          <select name="channel" required defaultValue="email" className={INPUT_CLASS}>
            {SUPPLIER_COMMUNICATION_CHANNELS.map((c) => (
              <option key={c} value={c}>{SUPPLIER_COMMUNICATION_CHANNEL_LABELS[c]}</option>
            ))}
          </select>
        </Field>
        <Field label="A quién" hint="Opcional: persona o área del proveedor.">
          <input name="recipientName" maxLength={120} className={INPUT_CLASS} />
        </Field>
        <Field label="Adjunto" hint="Opcional: el mail, la carta o el acta. PDF, imagen, Word o texto, hasta 15 MB.">
          <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt" className={INPUT_CLASS} />
        </Field>
      </div>
      <Field label="Resumen" required hint="Qué se le pidió o qué resultado se le informó.">
        <textarea name="summary" required minLength={3} rows={3} className={INPUT_CLASS} />
      </Field>
      <Feedback state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Registrar comunicación"}
        </Button>
      </div>
    </form>
  );
}
