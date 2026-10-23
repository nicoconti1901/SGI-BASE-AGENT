"use client";

import { useActionState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { uploadDocumentAction, voidDocumentAction, voidEvaluationAction } from "@/app/(tenant)/t/[slug]/suppliers/evaluation-actions";
import type { SupplierActionState } from "@/app/(tenant)/t/[slug]/suppliers/guard";
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

/** Anular una evaluación equivocada: queda en el historial con el motivo. */
export function VoidEvaluationForm({ slug, supplierId, evaluationId }: { slug: string; supplierId: string; evaluationId: string }) {
  const action = voidEvaluationAction.bind(null, slug, supplierId, evaluationId);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-[16rem] flex-1">
        <Field label="Anular esta evaluación" hint="Una evaluación no se edita: si estaba equivocada, se anula y se carga otra. Queda registrada con el motivo.">
          <input name="reason" required minLength={3} placeholder="Ej.: Se cargó en el proveedor equivocado" className={INPUT_CLASS} />
        </Field>
      </div>
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Anulando…" : "Anular evaluación"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export type DocumentTypeOption = { id: string; name: string; validityMonths: number | null };

export function UploadDocumentForm({ slug, supplierId, types }: { slug: string; supplierId: string; types: DocumentTypeOption[] }) {
  const action = uploadDocumentAction.bind(null, slug, supplierId);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: true });
  return (
    <form {...keep} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Documento" required>
          <select name="typeId" required defaultValue="" className={INPUT_CLASS}>
            <option value="" disabled>Elegí qué documento es</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Archivo" required hint="PDF, imagen, Word o texto. Hasta 15 MB.">
          <input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt" className={INPUT_CLASS} />
        </Field>
        <Field label="Fecha de emisión" hint="Opcional.">
          <input type="date" name="issuedAt" className={INPUT_CLASS} />
        </Field>
        <Field label="Vence el" hint="Dejalo vacío si el documento no vence. Avisamos antes de la fecha.">
          <input type="date" name="expiresAt" className={INPUT_CLASS} />
        </Field>
      </div>
      <Feedback state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Subiendo…" : "Cargar documento"}
        </Button>
      </div>
    </form>
  );
}

export function VoidDocumentForm({ slug, supplierId, documentId }: { slug: string; supplierId: string; documentId: string }) {
  const action = voidDocumentAction.bind(null, slug, supplierId, documentId);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);
  return (
    <form {...keep} className="flex flex-wrap items-center gap-2">
      <input name="reason" required minLength={3} aria-label="Motivo de la anulación" placeholder="Motivo de la anulación" className={`${INPUT_CLASS} max-w-56`} />
      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? "…" : "Anular"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}
