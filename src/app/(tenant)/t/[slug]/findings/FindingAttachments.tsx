"use client";

import {
  useActionState,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  closeMeasureAction,
  uploadFindingDocAction,
  type FindingActionState,
} from "@/app/(tenant)/t/[slug]/findings/actions";
import { FilePicker, INPUT_CLASS } from "@/components/ui";

const initial: FindingActionState = {};
const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,image/png,image/jpeg,application/pdf";

/** Al elegir el archivo se adjunta en el momento: no hay un segundo botón que recordar. */
export function FindingDocUploadForm({
  slug,
  findingId,
}: {
  slug: string;
  findingId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: FindingActionState, formData: FormData) => {
      const result = await uploadFindingDocAction(slug, findingId, prev, formData);
      if (result.ok) {
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        formRef.current?.reset();
      }
      return result;
    },
    initial,
  );

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    if (picked) formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Descripción (opcional)</span>
        <input
          name="label"
          placeholder="Ej.: foto de la escena, registro de operación…"
          className={INPUT_CLASS}
        />
        <span className="text-xs text-[var(--color-ink-muted)]">
          Escribila antes de elegir el archivo.
        </span>
      </label>
      <FilePicker
        ref={inputRef}
        name="file"
        accept={ACCEPT}
        required
        disabled={pending}
        file={file}
        fileStatus={pending ? "adjuntando…" : undefined}
        hint="PDF, foto o documento. Se adjunta al elegirlo."
        onChange={onChange}
      />
      {state.error ? (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
      {state.ok && !pending ? (
        <p role="status" className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] px-3 py-2 text-sm font-medium text-[var(--color-success)]">
          {state.ok}: ya figura en la documentación del hallazgo.
        </p>
      ) : null}
    </form>
  );
}

/** Cerrar exige evidencia: primero se elige el archivo y después se confirma el cierre. */
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
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 border-t border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-4"
    >
      <div>
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          Cerrar la medida
        </p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          1. Elegí la evidencia que demuestra la ejecución (foto, PDF o registro). 2. Confirmá el cierre.
        </p>
      </div>
      <FilePicker
        name="file"
        accept={ACCEPT}
        required
        disabled={pending}
        file={file}
        fileStatus="lista para el cierre"
        hint="Evidencia obligatoria para cerrar."
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <input
        name="label"
        placeholder="Descripción de la evidencia (opcional)"
        aria-label="Descripción de la evidencia (opcional)"
        className={INPUT_CLASS}
      />
      {state.error ? (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] px-3 py-2 text-xs font-medium text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !file}
        className="w-fit rounded-[var(--radius-md)] bg-[var(--color-success)] px-4 py-2 text-sm font-semibold text-[var(--color-on-solid)] disabled:opacity-60"
      >
        {pending ? "Cerrando…" : file ? "Cerrar medida con esta evidencia" : "Elegí la evidencia para cerrar"}
      </button>
    </form>
  );
}
