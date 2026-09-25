"use client";

import { useActionState } from "react";
import { DOCUMENT_FATE_LABELS, type DocumentFate } from "@/domain/assessment/gap";
import {
  uploadDocumentAction,
  type UploadDocumentState,
} from "@/app/(platform)/platform/tenants/[slug]/documents/actions";

export type RequirementOption = {
  id: string;
  label: string;
};

export type ExistingDocumentOption = {
  id: string;
  title: string;
  fate: DocumentFate;
};

const initial: UploadDocumentState = {};

export function UploadDocumentForm({
  slug,
  requirements,
  documents,
}: {
  slug: string;
  requirements: RequirementOption[];
  documents: ExistingDocumentOption[];
}) {
  const action = uploadDocumentAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)]"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl">
        Subir documento
      </h2>
      <p className="text-sm text-[var(--color-ink-muted)]">
        El archivo se guarda en object storage (S3/MinIO o memoria en local sin
        configurar). Podés crear uno nuevo o agregar una versión a uno
        existente.
      </p>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Documento existente (opcional — nueva versión)
        <select
          name="documentId"
          defaultValue=""
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        >
          <option value="">— Crear documento nuevo —</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.title} ({DOCUMENT_FATE_LABELS[doc.fate]})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Título
        <input
          name="title"
          required
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Destino (fate)
        <select
          name="fate"
          defaultValue="create"
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        >
          {(Object.keys(DOCUMENT_FATE_LABELS) as DocumentFate[]).map((fate) => (
            <option key={fate} value={fate}>
              {DOCUMENT_FATE_LABELS[fate]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Vincular a requisito
        <select
          name="tenantRequirementId"
          defaultValue=""
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        >
          <option value="">— Sin vínculo —</option>
          {requirements.map((req) => (
            <option key={req.id} value={req.id}>
              {req.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Archivo (PDF / Office / imagen)
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,application/pdf"
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Notas de versión
        <textarea
          name="notes"
          rows={2}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
        <input
          type="checkbox"
          name="forceOverwriteKeep"
          className="size-4 accent-[var(--color-accent)]"
        />
        Forzar nueva versión si el documento está en Conservar
      </label>

      {state.error ? (
        <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-[var(--color-success)]">
          Documento guardado correctamente.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Subiendo…" : "Subir"}
      </button>
    </form>
  );
}
