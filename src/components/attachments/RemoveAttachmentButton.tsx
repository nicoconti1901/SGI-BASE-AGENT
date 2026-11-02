"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeAttachmentAction } from "@/app/(tenant)/t/[slug]/remove-attachment-action";
import type { AttachmentKind } from "@/domain/attachments/removal";

/**
 * «Quitar» con confirmación en el lugar: primero se pregunta, y recién ahí se borra el archivo.
 * Mostrarlo solo a quien puede (`canRemoveAttachment`); el servidor vuelve a controlar.
 */
export function RemoveAttachmentButton({
  slug,
  kind,
  attachmentId,
  fileName,
  className = "",
}: {
  slug: string;
  kind: AttachmentKind;
  attachmentId: string;
  fileName: string;
  className?: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function remove() {
    start(async () => {
      const result = await removeAttachmentAction(slug, kind, attachmentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAsking(false);
      router.refresh();
    });
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setAsking(true);
        }}
        aria-label={`Quitar el archivo ${fileName}`}
        className={`rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium text-[var(--color-ink-muted)] underline-offset-2 hover:text-[var(--color-danger)] hover:underline ${className}`}
      >
        Quitar
      </button>
    );
  }

  return (
    <span role="group" aria-label={`Confirmar que se quita ${fileName}`} className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className="text-[var(--color-ink)]">¿Quitar este archivo? No se puede deshacer.</span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-[var(--radius-sm)] border border-[var(--color-danger)] px-2 py-1 font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] disabled:opacity-60"
      >
        {pending ? "Quitando…" : "Sí, quitar"}
      </button>
      <button type="button" onClick={() => setAsking(false)} disabled={pending} className="underline">
        Cancelar
      </button>
      {error ? (
        <span role="alert" className="w-full text-[var(--color-danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
