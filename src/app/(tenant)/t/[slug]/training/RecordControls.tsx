"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { uploadTrainingAttachmentAction, voidRecordAction, voidSessionAction } from "@/app/(tenant)/t/[slug]/training/records-actions";

/** Anula un registro o una sesión: pide el motivo (queda en el historial) y confirma. */
export function VoidControl({ slug, kind, id, label = "Anular" }: { slug: string; kind: "record" | "session"; id: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const result = kind === "record" ? await voidRecordAction(slug, id, reason) : await voidSessionAction(slug, id, reason);
      if (result.ok) {
        setOpen(false);
        setReason("");
        router.refresh();
      } else setError(result.error);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-[var(--color-danger)] hover:underline">
        {label}
      </button>
    );
  }
  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger)] p-3">
      <p className="text-xs text-[var(--color-ink-muted)]">
        {kind === "session" ? "Se anulan la sesión y todos sus registros." : "Deja de contar para el cumplimiento."} Nada se borra: queda en el historial con tu nombre y el motivo.
      </p>
      <Field label="Motivo" hint="Al menos 10 caracteres.">
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={INPUT_CLASS} />
      </Field>
      {error ? <FormError>{error}</FormError> : null}
      <div className="flex gap-2">
        <Button type="button" variant="danger" disabled={pending} onClick={submit}>
          Confirmar anulación
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** Sube la planilla firmada de una sesión o el certificado de un registro (PDF, JPG o PNG, hasta 10 MB). */
export function AttachControl({ slug, kind, ownerId, label = "Adjuntar archivo" }: { slug: string; kind: "record" | "session"; ownerId: string; label?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Elegí un archivo");
    setError(null);
    start(async () => {
      const data = new FormData();
      data.set("file", file);
      const result = await uploadTrainingAttachmentAction(slug, kind, ownerId, data);
      if (result.ok) {
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" aria-label={label} className="text-sm" />
        <Button type="button" variant="secondary" disabled={pending} onClick={upload}>
          {pending ? "Subiendo…" : "Subir"}
        </Button>
      </div>
      {error ? <FormError>{error}</FormError> : null}
    </div>
  );
}

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" className="print:hidden" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
