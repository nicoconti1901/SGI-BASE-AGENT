"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, HintCallout, INPUT_CLASS } from "@/components/ui";
import {
  discardDraftAction,
  saveDocumentTypeAction,
  saveDraftAction,
  setDocumentTypeActiveAction,
  startDraftAction,
} from "@/app/(tenant)/t/[slug]/suppliers/criteria-actions";
import type { SupplierActionState } from "@/app/(tenant)/t/[slug]/suppliers/guard";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  DOCUMENT_RECURRENCES,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
  type CriterionPhaseValue,
  type DocumentRecurrenceValue,
  type SupplierTypeValue,
} from "@/domain/suppliers/types";

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

export function StartDraftButton({ slug, supplierType, label }: { slug: string; supplierType: SupplierTypeValue; label: string }) {
  const [state, formAction, pending] = useActionState(startDraftAction.bind(null, slug, supplierType), initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Creando…" : label}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

// ─── Editor del borrador ───────────────────────────────────────────────────

export type EditorCriterion = {
  name: string;
  description: string;
  descriptor1: string;
  descriptor3: string;
  descriptor5: string;
  weight: number;
  excluding: boolean;
  allowNA: boolean;
  phase: CriterionPhaseValue;
  basic: boolean;
};

const PHASE_LABEL: Record<CriterionPhaseValue, string> = {
  selection: "Solo al seleccionar",
  performance: "Solo al reevaluar",
  both: "En ambas",
};

const EMPTY: EditorCriterion = {
  name: "", description: "", descriptor1: "", descriptor3: "", descriptor5: "",
  weight: 10, excluding: false, allowNA: false, phase: "both", basic: false,
};

export function DraftEditor({
  slug,
  templateId,
  supplierType,
  version,
  initialCriteria,
  approvedMin,
  conditionalMin,
  changeNote,
}: {
  slug: string;
  templateId: string;
  supplierType: SupplierTypeValue;
  version: number;
  initialCriteria: EditorCriterion[];
  approvedMin: number;
  conditionalMin: number;
  changeNote: string;
}) {
  const [state, formAction, pending] = useActionState(saveDraftAction.bind(null, slug, templateId, supplierType), initial);
  const [criteria, setCriteria] = useState<EditorCriterion[]>(initialCriteria);
  const [approved, setApproved] = useState(String(approvedMin));
  const [conditional, setConditional] = useState(String(conditionalMin));
  const [note, setNote] = useState(changeNote);
  const total = criteria.reduce((n, c) => n + (Number.isFinite(c.weight) ? c.weight : 0), 0);

  const update = (index: number, patch: Partial<EditorCriterion>) =>
    setCriteria((list) => list.map((c, i) => (i === index ? { ...c, ...patch, ...(patch.excluding ? { allowNA: false } : {}) } : c)));
  const move = (index: number, delta: number) =>
    setCriteria((list) => {
      const next = list.slice();
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="criteria" value={JSON.stringify(criteria)} />
      <HintCallout>
        Está editando la versión {version} (borrador). Al publicarla pasa a ser la vigente; las evaluaciones ya hechas conservan los criterios con los que se hicieron.
      </HintCallout>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Aprobado desde (puntos)" required hint="De 0 a 100.">
          <input name="approvedMin" type="number" min={0} max={100} required value={approved} onChange={(e) => setApproved(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="Con condiciones desde (puntos)" required hint="Por debajo es «no aprobado».">
          <input name="conditionalMin" type="number" min={0} max={100} required value={conditional} onChange={(e) => setConditional(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="Qué cambió en esta versión" hint="Obligatorio para publicar una versión nueva.">
          <input name="changeNote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: Más peso a seguridad" className={INPUT_CLASS} />
        </Field>
      </div>

      <ol className="flex flex-col divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
        {criteria.map((c, i) => (
          <li key={i} className="flex flex-col gap-3 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem_12rem]">
              <Field label={`Criterio ${i + 1}`} required>
                <input value={c.name} onChange={(e) => update(i, { name: e.target.value })} required className={INPUT_CLASS} />
              </Field>
              <Field label="Peso" required>
                <input type="number" min={1} max={100} value={c.weight} onChange={(e) => update(i, { weight: Number(e.target.value) })} required className={INPUT_CLASS} />
              </Field>
              <Field label="Cuándo se pregunta">
                <select value={c.phase} onChange={(e) => update(i, { phase: e.target.value as CriterionPhaseValue })} className={INPUT_CLASS}>
                  {(Object.keys(PHASE_LABEL) as CriterionPhaseValue[]).map((p) => (
                    <option key={p} value={p}>{PHASE_LABEL[p]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Qué se evalúa">
              <input value={c.description} onChange={(e) => update(i, { description: e.target.value })} className={INPUT_CLASS} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Una nota de 1 significa…">
                <input value={c.descriptor1} onChange={(e) => update(i, { descriptor1: e.target.value })} className={INPUT_CLASS} />
              </Field>
              <Field label="Una nota de 3 significa…">
                <input value={c.descriptor3} onChange={(e) => update(i, { descriptor3: e.target.value })} className={INPUT_CLASS} />
              </Field>
              <Field label="Una nota de 5 significa…">
                <input value={c.descriptor5} onChange={(e) => update(i, { descriptor5: e.target.value })} className={INPUT_CLASS} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={c.excluding} onChange={(e) => update(i, { excluding: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
                Excluyente <span className="text-xs text-[var(--color-ink-muted)]">(un 1 = no aprobado; un 2 = con condiciones como mucho)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={c.allowNA} disabled={c.excluding} onChange={(e) => update(i, { allowNA: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
                Admite «No aplica»
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={c.basic} onChange={(e) => update(i, { basic: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
                Entra en la evaluación simplificada
              </label>
              <span className="ml-auto flex gap-1">
                <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir ${c.name || `criterio ${i + 1}`}`}>Subir</Button>
                <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === criteria.length - 1} aria-label={`Bajar ${c.name || `criterio ${i + 1}`}`}>Bajar</Button>
                <Button variant="ghost" onClick={() => setCriteria((l) => l.filter((_, idx) => idx !== i))} aria-label={`Quitar ${c.name || `criterio ${i + 1}`}`}>Quitar</Button>
              </span>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => setCriteria((l) => [...l, { ...EMPTY }])}>
          Agregar criterio
        </Button>
        <p role="status" className={`text-sm tabular-nums ${total === 100 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
          Los pesos suman {total} de 100{total === 100 ? "" : ": para publicar tienen que sumar 100"}
        </p>
      </div>

      <Feedback state={state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar borrador"}
        </Button>
        <Button type="submit" name="intent" value="publish" disabled={pending}>
          Publicar versión {version}
        </Button>
      </div>
    </form>
  );
}

export function DiscardDraftButton({ slug, templateId, supplierType }: { slug: string; templateId: string; supplierType: SupplierTypeValue }) {
  const [state, formAction, pending] = useActionState(discardDraftAction.bind(null, slug, templateId, supplierType), initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div>
        <Button type="submit" variant="ghost" disabled={pending}>
          {pending ? "Descartando…" : "Descartar borrador"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

// ─── Tipos de documento ────────────────────────────────────────────────────

export type DocumentTypeFormValues = {
  id?: string;
  name: string;
  appliesTo: SupplierTypeValue[];
  required: boolean;
  blocksEnablement: boolean;
  validityMonths: number | null;
  recurrence: DocumentRecurrenceValue;
  note: string;
};

const RECURRENCE_LABEL: Record<DocumentRecurrenceValue, string> = { none: "No se repite", monthly: "Todos los meses" };

export function DocumentTypeForm({ slug, value }: { slug: string; value?: DocumentTypeFormValues }) {
  const [state, formAction, pending] = useActionState(saveDocumentTypeAction.bind(null, slug), initial);
  const keep = useKeepInputs(formAction, state, { resetOnSuccess: !value });
  return (
    <form {...keep} className="flex flex-col gap-3">
      {value?.id ? <input type="hidden" name="id" value={value.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre del documento" required>
          <input name="name" required minLength={3} defaultValue={value?.name} placeholder="Ej.: Habilitación de trabajo en altura" className={INPUT_CLASS} />
        </Field>
        <Field label="Vigencia sugerida (meses)" hint="Opcional. Se propone al cargar, no se impone.">
          <input name="validityMonths" type="number" min={1} max={120} defaultValue={value?.validityMonths ?? ""} className={INPUT_CLASS} />
        </Field>
      </div>
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <legend className="mb-1 font-semibold">Se le pide a</legend>
        {SUPPLIER_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-2">
            <input type="checkbox" name="appliesTo" value={t} defaultChecked={value ? value.appliesTo.includes(t) : false} className="h-4 w-4 accent-[var(--color-accent)]" />
            {SUPPLIER_TYPE_LABELS[t]}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="required" defaultChecked={value?.required} className="h-4 w-4 accent-[var(--color-accent)]" />
          Es obligatorio
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="blocksEnablement" defaultChecked={value?.blocksEnablement} className="h-4 w-4 accent-[var(--color-accent)]" />
          Si falta o vence, el proveedor queda «no habilitado»
        </label>
        <label className="flex items-center gap-2">
          Se renueva
          <select name="recurrence" defaultValue={value?.recurrence ?? "none"} className={INPUT_CLASS}>
            {DOCUMENT_RECURRENCES.map((r) => (
              <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>
            ))}
          </select>
        </label>
      </div>
      <Field label="Nota" hint="Opcional. Por ejemplo, «orientativo: validar con su asesor».">
        <input name="note" defaultValue={value?.note} className={INPUT_CLASS} />
      </Field>
      <Feedback state={state} />
      <div>
        <Button type="submit" variant={value ? "secondary" : "primary"} disabled={pending}>
          {pending ? "Guardando…" : value ? "Guardar cambios" : "Agregar tipo de documento"}
        </Button>
      </div>
    </form>
  );
}

export function ToggleDocumentTypeButton({ slug, id, active, name }: { slug: string; id: string; active: boolean; name: string }) {
  const [state, formAction, pending] = useActionState(setDocumentTypeActiveAction.bind(null, slug, id, !active), initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <Button type="submit" variant="ghost" disabled={pending} aria-label={`${active ? "Desactivar" : "Reactivar"} ${name}`}>
        {pending ? "…" : active ? "Desactivar" : "Reactivar"}
      </Button>
      {state.error ? <span className="text-xs text-[var(--color-danger)]">{state.error}</span> : null}
    </form>
  );
}
