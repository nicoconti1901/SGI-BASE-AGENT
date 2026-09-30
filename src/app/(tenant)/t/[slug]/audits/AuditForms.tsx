"use client";

import { useActionState, useState } from "react";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import {
  approveProgramAction,
  createAuditAction,
  saveAuditPlanAction,
  saveProgramAction,
  transitionAuditAction,
  type AuditActionState,
} from "@/app/(tenant)/t/[slug]/audits/actions";
import { impartialityConflicts } from "@/domain/audits/lifecycle";
import {
  AUDIT_MODE_LABELS,
  AUDIT_STANDARD_LABELS,
  type AuditMode,
  type AuditStandard,
} from "@/domain/audits/types";

const initial: AuditActionState = {};
const input =
  "rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";
const primary =
  "self-start rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60";
const secondary =
  "self-start rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-medium disabled:opacity-60";

export type MemberOption = { id: string; name: string };

export function Feedback({ state }: { state: AuditActionState }) {
  if (state.issues?.length) {
    return (
      <div role="alert" className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
        <p className="font-medium">Falta:</p>
        <ul className="mt-1 list-disc pl-5">
          {state.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-[var(--color-success)]">
        {state.ok}
      </p>
    );
  }
  return null;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[var(--color-ink-muted)]">{hint}</span> : null}
    </label>
  );
}

// ─── Programa ───────────────────────────────────────────────────────────────

export function ProgramForm({
  slug,
  year,
  objectives,
  frequencyRationale,
  canApprove,
}: {
  slug: string;
  year: number;
  objectives: string;
  frequencyRationale: string;
  canApprove: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState(
    saveProgramAction.bind(null, slug, year),
    initial,
  );
  const saveActionForm = useKeepInputs(saveAction, saveState);
  const [approveState, approveAction, approving] = useActionState(
    approveProgramAction.bind(null, slug, year),
    initial,
  );
  const approveActionForm = useKeepInputs(approveAction, approveState);

  return (
    <div className="flex flex-col gap-3">
      <form {...saveActionForm} className="flex flex-col gap-3">
        <Field label="Objetivos del programa" hint="Ej.: auditar todos los procesos del SGI al menos una vez en el año.">
          <textarea name="objectives" rows={2} defaultValue={objectives} required className={input} />
        </Field>
        <Field
          label="Criterio de frecuencia"
          hint="Por qué algunos procesos se auditan más: importancia, cambios recientes, resultados de auditorías anteriores."
        >
          <textarea name="frequencyRationale" rows={2} defaultValue={frequencyRationale} className={input} />
        </Field>
        <Feedback state={saveState} />
        <button type="submit" disabled={saving} className={secondary}>
          {saving ? "Guardando…" : "Guardar programa"}
        </button>
      </form>
      {canApprove ? (
        <form {...approveActionForm} className="flex flex-col gap-2">
          <Feedback state={approveState} />
          <button type="submit" disabled={approving} className={primary}>
            {approving ? "Aprobando…" : "Aprobar programa"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

// ─── Alta ───────────────────────────────────────────────────────────────────

export function CreateAuditForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createAuditAction.bind(null, slug), initial);
  const actionForm = useKeepInputs(action, state);
  return (
    <form {...actionForm} className="flex flex-col gap-4">
      <Feedback state={state} />
      <Field label="Título" hint="Ej.: Proceso de compras y proveedores">
        <input name="title" required className={input} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inicio">
          <input type="date" name="plannedStart" required className={input} />
        </Field>
        <Field label="Fin">
          <input type="date" name="plannedEnd" required className={input} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Creando…" : "Crear y completar el plan"}
      </button>
    </form>
  );
}

// ─── Plan ───────────────────────────────────────────────────────────────────

export type PlanDefaults = {
  title: string;
  objective: string;
  scope: string;
  standards: AuditStandard[];
  plannedStart: string;
  plannedEnd: string;
  mode: AuditMode;
  leadUserId: string;
  auditorUserIds: string[];
  auditees: { userId: string; area: string }[];
  impartialityException: string;
};

export function AuditPlanForm({
  slug,
  auditId,
  members,
  defaults,
}: {
  slug: string;
  auditId: string;
  members: MemberOption[];
  defaults: PlanDefaults;
}) {
  const [state, action, pending] = useActionState(
    saveAuditPlanAction.bind(null, slug, auditId),
    initial,
  );
  const actionForm = useKeepInputs(action, state);
  const [lead, setLead] = useState(defaults.leadUserId);
  const [auditors, setAuditors] = useState<string[]>(defaults.auditorUserIds);
  const [auditees, setAuditees] = useState(
    defaults.auditees.length ? defaults.auditees : [{ userId: "", area: "" }],
  );

  const conflicts = impartialityConflicts(
    [lead, ...auditors].filter(Boolean),
    auditees.map((a) => a.userId || null),
  );
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id;

  return (
    <form {...actionForm} className="flex flex-col gap-5">
      <Field label="Título">
        <input name="title" required defaultValue={defaults.title} className={input} />
      </Field>
      <Field
        label="Objetivo"
        hint="Qué querés comprobar, en una frase. Ej.: verificar que los cambios en despacho redujeron los errores de especificación."
      >
        <textarea name="objective" rows={2} defaultValue={defaults.objective} className={input} />
      </Field>
      <Field label="Alcance" hint="Procesos, áreas, sitios y período que se revisan.">
        <textarea name="scope" rows={2} defaultValue={defaults.scope} className={input} />
      </Field>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Normas (criterios)</legend>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(AUDIT_STANDARD_LABELS) as AuditStandard[]).map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input type="checkbox" name="standards" value={s} defaultChecked={defaults.standards.includes(s)} />
              {AUDIT_STANDARD_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Inicio">
          <input type="date" name="plannedStart" required defaultValue={defaults.plannedStart} className={input} />
        </Field>
        <Field label="Fin">
          <input type="date" name="plannedEnd" required defaultValue={defaults.plannedEnd} className={input} />
        </Field>
        <Field label="Modalidad">
          <select name="mode" defaultValue={defaults.mode} className={input}>
            {(Object.keys(AUDIT_MODE_LABELS) as AuditMode[]).map((m) => (
              <option key={m} value={m}>
                {AUDIT_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
        <legend className="mb-1 font-medium">Equipo auditor</legend>
        <Field label="Auditor líder">
          <select name="leadUserId" value={lead} onChange={(e) => setLead(e.target.value)} className={input}>
            <option value="">— Elegir —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="text-sm">
          <span className="font-medium">Auditores (opcional)</span>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {members
              .filter((m) => m.id !== lead)
              .map((m) => (
                <label key={m.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="auditorUserIds"
                    value={m.id}
                    checked={auditors.includes(m.id)}
                    onChange={(e) =>
                      setAuditors((prev) =>
                        e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id),
                      )
                    }
                  />
                  {m.name}
                </label>
              ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 border-t border-[var(--color-line)] pt-4">
        <legend className="mb-1 font-medium">Qué y a quién se audita</legend>
        {auditees.map((a, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              name="auditeeArea"
              aria-label="Área o proceso"
              placeholder="Área o proceso"
              value={a.area}
              onChange={(e) =>
                setAuditees((prev) => prev.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))
              }
              className={input}
            />
            <select
              name="auditeeUserId"
              aria-label="Responsable auditado"
              value={a.userId}
              onChange={(e) =>
                setAuditees((prev) => prev.map((x, j) => (j === i ? { ...x, userId: e.target.value } : x)))
              }
              className={input}
            >
              <option value="">— Responsable (opcional) —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAuditees((prev) => prev.filter((_, j) => j !== i))}
              className="rounded-md px-3 py-2 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-danger)]"
              aria-label="Quitar"
            >
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAuditees((prev) => [...prev, { userId: "", area: "" }])}
          className="self-start text-sm font-medium text-[var(--color-accent)]"
        >
          + Agregar área
        </button>
      </fieldset>

      {conflicts.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] p-3 text-sm">
          <p className="font-medium text-[var(--color-warning)]">
            {conflicts.map(nameOf).join(", ")} figura como auditor y como auditado. Nadie debería
            auditar su propio trabajo.
          </p>
          <Field label="Si no hay otra opción, justificá la excepción">
            <textarea
              name="impartialityException"
              rows={2}
              defaultValue={defaults.impartialityException}
              placeholder="Ej.: es la única persona formada como auditora en la empresa"
              className={input}
            />
          </Field>
        </div>
      ) : null}

      <Feedback state={state} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Guardando…" : "Guardar plan"}
      </button>
    </form>
  );
}

// ─── Estado ─────────────────────────────────────────────────────────────────

export function PrepareButton({ slug, auditId }: { slug: string; auditId: string }) {
  const [state, action, pending] = useActionState(
    transitionAuditAction.bind(null, slug, auditId, "prepared"),
    initial,
  );
  const actionForm = useKeepInputs(action, state);
  return (
    <form {...actionForm} className="flex flex-col gap-2">
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={primary}>
        Marcar como preparada
      </button>
    </form>
  );
}

export function CancelAuditForm({ slug, auditId }: { slug: string; auditId: string }) {
  const [state, action, pending] = useActionState(
    transitionAuditAction.bind(null, slug, auditId, "cancelled"),
    initial,
  );
  const actionForm = useKeepInputs(action, state);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-[var(--color-ink-muted)]">Cancelar auditoría</summary>
      <form {...actionForm} className="mt-2 flex flex-col gap-2">
        <Field label="Motivo">
          <input name="reason" required className={input} />
        </Field>
        <Feedback state={state} />
        <button type="submit" disabled={pending} className={secondary}>
          Confirmar cancelación
        </button>
      </form>
    </details>
  );
}
