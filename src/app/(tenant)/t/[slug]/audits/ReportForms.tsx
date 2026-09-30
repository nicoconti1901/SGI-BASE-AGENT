"use client";

import { useActionState } from "react";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  executorTransitionAction,
  saveAuditReportAction,
  type AuditActionState,
} from "@/app/(tenant)/t/[slug]/audits/actions";
import { Feedback } from "@/app/(tenant)/t/[slug]/audits/AuditForms";

const initial: AuditActionState = {};
const input =
  "rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";
const primary =
  "self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60";
const secondary =
  "self-start rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2 text-sm font-medium disabled:opacity-60";

export function TransitionButton({
  slug,
  auditId,
  to,
  label,
  primaryStyle = false,
}: {
  slug: string;
  auditId: string;
  to: "reporting" | "in_progress" | "closed";
  label: string;
  primaryStyle?: boolean;
}) {
  const [state, action, pending] = useActionState(
    executorTransitionAction.bind(null, slug, auditId, to),
    initial,
  );
  const actionForm = useKeepInputs(action, state);
  return (
    <form {...actionForm} className="flex flex-col gap-2">
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={primaryStyle ? primary : secondary}>
        {label}
      </button>
    </form>
  );
}

export function AuditReportForm({
  slug,
  auditId,
  objective,
  conclusion,
  strengths,
  includes45001,
  workersCommunicated,
}: {
  slug: string;
  auditId: string;
  objective: string;
  conclusion: string;
  strengths: string;
  includes45001: boolean;
  workersCommunicated: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveAuditReportAction.bind(null, slug, auditId),
    initial,
  );
  const actionForm = useKeepInputs(action, state);
  return (
    <form {...actionForm} className="flex flex-col gap-4">
      <p className="rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent-ink)]">
        El objetivo era: <strong>{objective}</strong>. ¿Qué respondés con la evidencia reunida?
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Conclusión</span>
        <textarea
          name="conclusion"
          rows={3}
          defaultValue={conclusion}
          placeholder="Ej.: el proceso cumple los requisitos y los cambios redujeron los errores; se detectó una NC menor en la evaluación de proveedores."
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Fortalezas (opcional)</span>
        <textarea
          name="strengths"
          rows={2}
          defaultValue={strengths}
          placeholder="Ej.: registros de despacho completos y trazables."
          className={input}
        />
      </label>
      {includes45001 ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="workersCommunicated" defaultChecked={workersCommunicated} />
          Los resultados se comunicaron a los trabajadores y sus representantes (ISO 45001 §9.2.2)
        </label>
      ) : null}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={secondary}>
        {pending ? "Guardando…" : "Guardar informe"}
      </button>
    </form>
  );
}
