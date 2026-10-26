"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import { completeImpactAction, type InstrumentActionState } from "@/app/(tenant)/t/[slug]/instruments/actions";

const initial: InstrumentActionState = {};
const MAX_ACTIONS = 5;
const radioRow = "flex min-h-10 items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm";

const OUTCOMES = [
  { value: "no_affected_results", label: "Las mediciones no se vieron afectadas", hint: "Con la justificación alcanza." },
  { value: "affected_results_actioned", label: "Hubo mediciones afectadas y se tomaron acciones", hint: "Se crea un hallazgo en borrador. Podés sumar acciones de seguimiento." },
  { value: "cannot_determine", label: "No se puede determinar el efecto", hint: "Requiere al menos una acción o un hallazgo." },
] as const;

type ActionRow = { title: string; ownerUserId: string; dueAt: string };

/** Evaluación de impacto: qué se midió, qué se decidió y por qué; con hallazgo y acciones cuando corresponde. */
export function ImpactForm({ slug, assetId, assessmentId, members, defaultOwnerId }: { slug: string; assetId: string; assessmentId: string; members: { id: string; name: string }[]; defaultOwnerId: string }) {
  const [state, formAction, pending] = useActionState(completeImpactAction.bind(null, slug, assetId, assessmentId), initial);
  const keep = useKeepInputs(formAction, state);
  const [outcome, setOutcome] = useState<string>("");
  const [register, setRegister] = useState(false);
  const [rows, setRows] = useState<ActionRow[]>([]);
  const affected = outcome === "affected_results_actioned";
  const update = (index: number, patch: Partial<ActionRow>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <form {...keep} className="flex flex-col gap-4">
      <input type="hidden" name="actions" value={JSON.stringify(rows)} />
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-sm font-semibold">Qué se concluyó</legend>
        {OUTCOMES.map((o) => (
          <label key={o.value} className={radioRow}>
            <input type="radio" name="outcome" value={o.value} required checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
            <span className="flex flex-col">
              <span className="font-medium">{o.label}</span>
              <span className="text-xs text-[var(--color-ink-muted)]">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field label="Qué se midió con el equipo en ese período" required hint="Ej.: mediciones de atmósfera en 3 espacios confinados de la cuadrilla norte.">
        <textarea name="affectedSummary" required minLength={3} rows={3} maxLength={1500} className={INPUT_CLASS} />
      </Field>
      <Field label="Justificación de la decisión" required hint="Por qué concluís eso: qué revisaste y qué encontraste.">
        <textarea name="rationale" required minLength={10} rows={3} maxLength={2000} className={INPUT_CLASS} />
      </Field>
      <label className="flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm">
        <input type="checkbox" name="registerFinding" checked={affected || register} onChange={(e) => setRegister(e.target.checked)} disabled={affected} className="h-4 w-4 accent-[var(--color-accent)]" />
        <span>Registrar un hallazgo en borrador{affected ? " (se crea siempre cuando hubo mediciones afectadas)" : ""}</span>
      </label>
      {affected ? <input type="hidden" name="registerFinding" value="on" /> : null}

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="text-sm font-semibold">Acciones de seguimiento</legend>
        <p className="text-xs text-[var(--color-ink-muted)]">Repetir mediciones, reevaluar lo producido, avisar al cliente. Quedan en el seguimiento de acciones de la empresa.</p>
        {rows.map((row, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
            <Field label={`Acción ${index + 1}: qué hay que hacer`} required>
              <input value={row.title} onChange={(e) => update(index, { title: e.target.value })} maxLength={200} className={INPUT_CLASS} />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Responsable" required>
                <select value={row.ownerUserId} onChange={(e) => update(index, { ownerUserId: e.target.value })} className={INPUT_CLASS}>
                  <option value="">Elegí</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha límite" required>
                <input type="date" value={row.dueAt} onChange={(e) => update(index, { dueAt: e.target.value })} className={INPUT_CLASS} />
              </Field>
            </div>
            <div>
              <Button variant="ghost" onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                Quitar la acción {index + 1}
              </Button>
            </div>
          </div>
        ))}
        {rows.length < MAX_ACTIONS ? (
          <div>
            <Button variant="secondary" onClick={() => setRows([...rows, { title: "", ownerUserId: defaultOwnerId, dueAt: "" }])}>
              Agregar una acción
            </Button>
          </div>
        ) : null}
      </fieldset>

      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Completar la evaluación"}
        </Button>
      </div>
    </form>
  );
}
