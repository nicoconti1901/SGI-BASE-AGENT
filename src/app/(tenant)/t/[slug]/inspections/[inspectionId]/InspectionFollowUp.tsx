"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { completeFollowUpAction, correctAnswerAction, uploadFollowUpEvidenceAction } from "@/app/(tenant)/t/[slug]/inspections/actions";

/** Evidencia y cierre de la acción de seguimiento de la inspección. */
export function FollowUpControls({ slug, inspectionId, hasEvidence }: { slug: string; inspectionId: string; hasEvidence: boolean }) {
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
      const result = await uploadFollowUpEvidenceAction(slug, inspectionId, data);
      if (result.ok) {
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else setError(result.error);
    });
  }

  function complete() {
    setError(null);
    start(async () => {
      const result = await completeFollowUpAction(slug, inspectionId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-3">
      <div className="flex max-w-full flex-wrap items-end gap-2 [&>*]:min-w-0 [&>*]:max-w-full">
        <Field label="Evidencia de lo resuelto" hint="Foto o documento. Hace falta al menos una para completar.">
          <input ref={fileRef} type="file" className="w-full max-w-full text-sm" />
        </Field>
        <Button type="button" variant="secondary" disabled={pending} onClick={upload}>
          Adjuntar
        </Button>
      </div>
      <div>
        <Button type="button" disabled={pending || !hasEvidence} onClick={complete}>
          Marcar completada
        </Button>
      </div>
      {error ? <FormError>{error}</FormError> : null}
    </div>
  );
}

export function PrintButton() {
  return (
    <Button type="button" variant="secondary" className="print:hidden" onClick={() => window.print()}>
      Imprimir
    </Button>
  );
}

const CHECK_OPTIONS = [
  { value: "conform", label: "Conforme" },
  { value: "nonconform", label: "No conforme" },
  { value: "na", label: "No aplica" },
] as const;

/** Corrección de una respuesta de una inspección cerrada: siempre con motivo. */
export function CorrectAnswer({
  slug,
  inspectionId,
  answerId,
  kind,
  unit,
  naAllowed,
  value,
  numberValue,
}: {
  slug: string;
  inspectionId: string;
  answerId: string;
  kind: "check" | "number";
  unit: string | null;
  naAllowed: boolean;
  value: "conform" | "nonconform" | "na" | null;
  numberValue: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState<string>(kind === "check" ? (value ?? "conform") : String(numberValue ?? ""));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const patch = kind === "check" ? { value: newValue as "conform" | "nonconform" | "na" } : { numberValue: Number(newValue.replace(",", ".")) };
      const result = await correctAnswerAction(slug, inspectionId, answerId, patch, reason);
      if (result.ok) {
        setOpen(false);
        setReason("");
        router.refresh();
      } else setError(result.error);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-[var(--color-accent)] hover:underline">
        Corregir
      </button>
    );
  }
  return (
    <div className="mt-2 flex w-full flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] p-3">
      <p className="text-xs text-[var(--color-ink-muted)]">La respuesta anterior queda registrada con tu nombre y el motivo. El resultado se recalcula.</p>
      {kind === "check" ? (
        <Field label="Respuesta correcta">
          <select value={newValue} onChange={(e) => setNewValue(e.target.value)} className={INPUT_CLASS}>
            {CHECK_OPTIONS.filter((o) => o.value !== "na" || naAllowed).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label={`Valor correcto${unit ? ` (${unit})` : ""}`}>
          <input type="text" inputMode="decimal" value={newValue} onChange={(e) => setNewValue(e.target.value)} className={INPUT_CLASS} />
        </Field>
      )}
      <Field label="Motivo de la corrección" hint="Al menos 10 caracteres.">
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={INPUT_CLASS} />
      </Field>
      {error ? <FormError>{error}</FormError> : null}
      <div className="flex gap-2">
        <Button type="button" disabled={pending} onClick={submit}>
          Guardar corrección
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
