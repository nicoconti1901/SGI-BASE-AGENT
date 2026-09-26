"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  closeMeasureAction,
  uploadFindingDocAction,
  type FindingActionState,
} from "@/app/(tenant)/t/[slug]/findings/actions";

const initial: FindingActionState = {};

function SelectedFileHint({ file }: { file: File | null }) {
  if (!file) return null;
  const kb =
    file.size < 1024 * 1024
      ? `${Math.round(file.size / 1024)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-raised)] font-[family-name:var(--font-mono)] text-[10px] font-bold text-[var(--color-accent)]">
        OK
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-accent-ink)]">
          {file.name}
        </p>
        <p className="text-xs text-[var(--color-accent)]">
          {kb} · listo para subir
        </p>
      </div>
    </div>
  );
}

export function FindingDocUploadForm({
  slug,
  findingId,
}: {
  slug: string;
  findingId: string;
}) {
  const action = uploadFindingDocAction.bind(null, slug, findingId);
  const [state, formAction, pending] = useActionState(action, initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!state.ok) return;
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [state.ok]);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-2 text-sm text-[var(--color-ink-muted)]">
        <span className="font-medium text-[var(--color-ink)]">Elegir archivo</span>
        <input
          ref={inputRef}
          type="file"
          name="file"
          required
          onChange={onChange}
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,image/png,image/jpeg,application/pdf"
          className="block w-full text-sm file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </label>
      <SelectedFileHint file={file} />
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Descripción (opcional)
        <input
          name="label"
          placeholder="Ej.: foto de la escena, registro de operación…"
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      {state.error ? (
        <p className="rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] px-3 py-2 text-sm font-medium text-[var(--color-success)]">
          {state.ok} — ya aparece en la lista arriba.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Subiendo…" : "Adjuntar documentación"}
      </button>
    </form>
  );
}

export function CloseMeasureWithEvidenceForm({
  slug,
  findingId,
  measureId,
}: {
  slug: string;
  findingId: string;
  measureId: string;
}) {
  const action = closeMeasureAction.bind(null, slug, findingId, measureId);
  const [state, formAction, pending] = useActionState(action, initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  return (
    <form
      action={formAction}
      className="border-t border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-4"
    >
      <p className="text-sm font-medium text-[var(--color-ink)]">
        Cerrar con evidencia
      </p>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        Obligatorio: foto, PDF o registro que demuestre la ejecución.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          name="file"
          required
          onChange={onChange}
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,image/png,image/jpeg,application/pdf"
          className="block w-full text-xs file:mr-2 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--color-accent)] file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
        <SelectedFileHint file={file} />
        <input
          name="label"
          placeholder="Descripción de la evidencia (opcional)"
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-ink)]"
        />
        {state.error ? (
          <p className="rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] px-3 py-2 text-xs font-medium text-[var(--color-success)]">
            {state.ok}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-[var(--radius-md)] bg-[var(--color-success)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Cerrando…" : "Confirmar cierre"}
        </button>
      </div>
    </form>
  );
}
