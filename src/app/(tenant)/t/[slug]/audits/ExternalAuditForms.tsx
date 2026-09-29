"use client";

import { useActionState } from "react";
import {
  addExternalFindingAction,
  completeExternalAuditAction,
  createExternalAuditAction,
  saveExternalAuditAction,
  transitionAuditAction,
  uploadExternalReportAction,
  type AuditActionState,
} from "@/app/(tenant)/t/[slug]/audits/actions";
import { Feedback } from "@/app/(tenant)/t/[slug]/audits/AuditForms";
import {
  AUDIT_ITEM_RESULT_LABELS,
  EXTERNAL_AUDIT_TYPE_LABELS,
  AUDIT_STANDARD_LABELS,
  type AuditItemResult,
  type AuditStandard,
  type ExternalAuditType,
} from "@/domain/audits/types";

const initial: AuditActionState = {};
const input =
  "rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";
const primary =
  "self-start rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60";
const secondary =
  "self-start rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-medium disabled:opacity-60";

const STANDARDS: AuditStandard[] = ["ISO9001", "ISO14001", "ISO45001"];
const FINDING_RESULTS: AuditItemResult[] = ["nc_major", "nc_minor", "observation", "improvement"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[var(--color-ink-muted)]">{hint}</span> : null}
    </label>
  );
}

export type ExternalDefaults = {
  title: string;
  externalBody: string;
  externalType: ExternalAuditType | "";
  externalAuditor: string;
  externalResult: string;
  responseDueAt: string;
  scope: string;
  standards: AuditStandard[];
  plannedStart: string;
  plannedEnd: string;
};

function ExternalFields({ defaults }: { defaults?: ExternalDefaults }) {
  return (
    <>
      <Field label="Título" hint="Ej.: Auditoría de recertificación ISO 9001">
        <input name="title" required defaultValue={defaults?.title} className={input} />
      </Field>
      <Field label="Entidad que audita" hint="Certificadora, cliente o autoridad.">
        <input name="externalBody" required defaultValue={defaults?.externalBody} className={input} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de auditoría">
          <select name="externalType" required defaultValue={defaults?.externalType ?? ""} className={input}>
            <option value="" disabled>
              Elegí un tipo
            </option>
            {(Object.keys(EXTERNAL_AUDIT_TYPE_LABELS) as ExternalAuditType[]).map((t) => (
              <option key={t} value={t}>
                {EXTERNAL_AUDIT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Auditor líder (opcional)">
          <input name="externalAuditor" defaultValue={defaults?.externalAuditor} className={input} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inicio">
          <input type="date" name="plannedStart" required defaultValue={defaults?.plannedStart} className={input} />
        </Field>
        <Field label="Fin">
          <input type="date" name="plannedEnd" required defaultValue={defaults?.plannedEnd} className={input} />
        </Field>
      </div>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 font-medium">Normas</legend>
        {STANDARDS.map((s) => (
          <label key={s} className="flex items-center gap-2">
            <input
              type="checkbox"
              name="standards"
              value={s}
              defaultChecked={defaults?.standards.includes(s)}
            />
            {AUDIT_STANDARD_LABELS[s]}
          </label>
        ))}
      </fieldset>
      <Field label="Alcance" hint="Sitios, procesos o requisitos que va a cubrir la auditoría.">
        <textarea name="scope" rows={2} defaultValue={defaults?.scope} className={input} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Resultado o recomendación" hint="Tal como figura en el informe del organismo.">
          <input name="externalResult" defaultValue={defaults?.externalResult} className={input} />
        </Field>
        <Field label="Plazo para responder las NC" hint="Genera un vencimiento.">
          <input type="date" name="responseDueAt" defaultValue={defaults?.responseDueAt} className={input} />
        </Field>
      </div>
    </>
  );
}

export function CreateExternalAuditForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createExternalAuditAction.bind(null, slug), initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Feedback state={state} />
      <ExternalFields />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Creando…" : "Crear auditoría externa"}
      </button>
    </form>
  );
}

export function ExternalAuditPlanForm({
  slug,
  auditId,
  defaults,
}: {
  slug: string;
  auditId: string;
  defaults: ExternalDefaults;
}) {
  const [state, action, pending] = useActionState(
    saveExternalAuditAction.bind(null, slug, auditId),
    initial,
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <ExternalFields defaults={defaults} />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={secondary}>
        {pending ? "Guardando…" : "Guardar plan"}
      </button>
    </form>
  );
}

export function ExternalFindingForm({ slug, auditId }: { slug: string; auditId: string }) {
  const [state, action, pending] = useActionState(
    addExternalFindingAction.bind(null, slug, auditId),
    initial,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de hallazgo">
          <select name="result" required defaultValue="nc_minor" className={input}>
            {FINDING_RESULTS.map((r) => (
              <option key={r} value={r}>
                {AUDIT_ITEM_RESULT_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha">
          <input
            type="date"
            name="detectedAt"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={input}
          />
        </Field>
      </div>
      <Field label="Título">
        <input name="title" required className={input} />
      </Field>
      <Field label="Descripción y evidencia" hint="Lo que consta en el informe de la entidad auditora.">
        <textarea name="description" rows={3} required className={input} />
      </Field>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={secondary}>
        {pending ? "Registrando…" : "Registrar hallazgo"}
      </button>
    </form>
  );
}

export function CompleteExternalAuditButton({ slug, auditId }: { slug: string; auditId: string }) {
  const [state, action, pending] = useActionState(
    completeExternalAuditAction.bind(null, slug, auditId),
    initial,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Guardando…" : "Marcar como realizada"}
      </button>
    </form>
  );
}

export function CancelExternalAuditForm({ slug, auditId }: { slug: string; auditId: string }) {
  const [state, action, pending] = useActionState(
    transitionAuditAction.bind(null, slug, auditId, "cancelled"),
    initial,
  );
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-[var(--color-ink-muted)]">Cancelar auditoría</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
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

export function ExternalReportUpload({
  slug,
  auditId,
  files,
  canUpload,
}: {
  slug: string;
  auditId: string;
  files: { id: string; fileName: string }[];
  canUpload: boolean;
}) {
  const [state, action, pending] = useActionState(
    uploadExternalReportAction.bind(null, slug, auditId),
    initial,
  );
  return (
    <div className="flex flex-col gap-2 text-sm">
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li key={f.id}>
              <a
                href={`/api/audits/report/${f.id}/download`}
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                {f.fileName}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--color-ink-muted)]">Todavía no se adjuntó el informe.</p>
      )}
      {canUpload ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="file"
            accept="application/pdf"
            aria-label="Informe del auditor externo"
            className="text-xs"
          />
          <button type="submit" disabled={pending} className={secondary}>
            {pending ? "Subiendo…" : "Adjuntar informe"}
          </button>
          <Feedback state={state} />
        </form>
      ) : null}
    </div>
  );
}
