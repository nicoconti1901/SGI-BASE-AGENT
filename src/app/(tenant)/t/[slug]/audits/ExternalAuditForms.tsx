"use client";

import { Field, INPUT_CLASS } from "@/components/ui";

import { useActionState } from "react";
import { useKeepInputs } from "@/lib/use-keep-inputs";
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
const primary =
  "self-start rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-solid)] disabled:opacity-60";
const secondary =
  "self-start rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-medium disabled:opacity-60";

const saveChanges =
  "self-start rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] disabled:opacity-60";
const complete =
  "self-start rounded-md bg-[var(--color-success)] px-4 py-2 text-sm font-medium text-[var(--color-on-solid)] disabled:opacity-60";

const STANDARDS: AuditStandard[] = ["ISO9001", "ISO14001", "ISO45001"];
const FINDING_RESULTS: AuditItemResult[] = ["nc_major", "nc_minor", "observation", "improvement"];


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
        <input name="title" required defaultValue={defaults?.title} className={INPUT_CLASS} />
      </Field>
      <Field label="Entidad que audita" hint="Certificadora, cliente o autoridad.">
        <input name="externalBody" required defaultValue={defaults?.externalBody} className={INPUT_CLASS} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de auditoría">
          <select name="externalType" required defaultValue={defaults?.externalType ?? ""} className={INPUT_CLASS}>
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
          <input name="externalAuditor" defaultValue={defaults?.externalAuditor} className={INPUT_CLASS} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inicio">
          <input type="date" name="plannedStart" required defaultValue={defaults?.plannedStart} className={INPUT_CLASS} />
        </Field>
        <Field label="Fin">
          <input type="date" name="plannedEnd" required defaultValue={defaults?.plannedEnd} className={INPUT_CLASS} />
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
        <textarea name="scope" rows={2} defaultValue={defaults?.scope} className={INPUT_CLASS} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Resultado o recomendación" hint="Tal como figura en el informe del organismo.">
          <input name="externalResult" defaultValue={defaults?.externalResult} className={INPUT_CLASS} />
        </Field>
        <Field label="Plazo para responder las NC" hint="Genera un vencimiento.">
          <input type="date" name="responseDueAt" defaultValue={defaults?.responseDueAt} className={INPUT_CLASS} />
        </Field>
      </div>
    </>
  );
}

export function CreateExternalAuditForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createExternalAuditAction.bind(null, slug), initial);
  const actionForm = useKeepInputs(action, state);
  return (
    <form {...actionForm} className="flex flex-col gap-4">
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
  const actionForm = useKeepInputs(action, state);
  return (
    <form {...actionForm} className="flex flex-col gap-4">
      <ExternalFields defaults={defaults} />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={saveChanges}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function ExternalFindingForm({ slug, auditId }: { slug: string; auditId: string }) {
  const [state, action, pending] = useActionState(
    addExternalFindingAction.bind(null, slug, auditId),
    initial,
  );
  const actionForm = useKeepInputs(action, state, { resetOnSuccess: true });
  return (
    <form {...actionForm} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de hallazgo">
          <select name="result" required defaultValue="nc_minor" className={INPUT_CLASS}>
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
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <Field label="Título">
        <input name="title" required className={INPUT_CLASS} />
      </Field>
      <Field label="Descripción y evidencia" hint="Lo que consta en el informe de la entidad auditora.">
        <textarea name="description" rows={3} required className={INPUT_CLASS} />
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
  const actionForm = useKeepInputs(action, state);
  return (
    <form {...actionForm} className="flex flex-col gap-2">
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={complete}>
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
  const actionForm = useKeepInputs(action, state);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-[var(--color-ink-muted)]">Cancelar auditoría</summary>
      <form {...actionForm} className="mt-2 flex flex-col gap-2">
        <Field label="Motivo">
          <input name="reason" required className={INPUT_CLASS} />
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
  const actionForm = useKeepInputs(action, state, { resetOnSuccess: true });
  return (
    <div className="flex flex-col gap-2 text-sm">
      {files.length > 0 ? (
        <>
          <ul className="flex flex-col gap-1">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3">
                <a
                  href={`/api/audits/report/${f.id}/download`}
                  className="text-[var(--color-accent)] underline-offset-2 hover:underline"
                >
                  {f.fileName}
                </a>
                <a
                  href={`/api/audits/report/${f.id}/download?inline=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[var(--color-ink-muted)] underline-offset-2 hover:underline"
                >
                  Abrir en pestaña nueva
                </a>
              </li>
            ))}
          </ul>
          <iframe
            title={`Vista del informe ${files[files.length - 1].fileName}`}
            src={`/api/audits/report/${files[files.length - 1].id}/download?inline=1`}
            className="h-[36rem] w-full rounded-md border border-[var(--color-line)]"
          />
        </>
      ) : (
        <p className="text-[var(--color-ink-muted)]">Todavía no se adjuntó el informe.</p>
      )}
      {canUpload ? (
        <form {...actionForm} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="file"
            accept="application/pdf"
            required
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
