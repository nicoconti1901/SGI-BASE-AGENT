"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FormError, INPUT_CLASS, buttonClass } from "@/components/ui";
import { cancelPlannedSessionAction, reschedulePlannedSessionAction } from "@/app/(tenant)/t/[slug]/training/followup-actions";

type Props = { slug: string; sessionId: string; heldAt: string; canRecord: boolean; canManage: boolean };

/** Acciones sobre una sesión pendiente del plan: registrarla, moverla de fecha o sacarla del plan. */
export function PlanRowActions({ slug, sessionId, heldAt, canRecord, canManage }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "reschedule" | "cancel">("none");
  const [date, setDate] = useState(heldAt);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  function run(action: () => ReturnType<typeof cancelPlannedSessionAction>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) return setError(result.error);
      setMode("none");
      router.refresh();
    });
  }

  if (!canRecord) return null;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/t/${slug}/training/sessions/new?planned=${sessionId}`} className={buttonClass("secondary")}>
          Registrar
        </Link>
        <Button type="button" variant="ghost" onClick={() => setMode(mode === "reschedule" ? "none" : "reschedule")}>
          Cambiar fecha
        </Button>
        {canManage ? (
          <Button type="button" variant="ghost" onClick={() => setMode(mode === "cancel" ? "none" : "cancel")}>
            Sacar del plan
          </Button>
        ) : null}
      </div>
      {mode === "reschedule" ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input type="date" aria-label="Nueva fecha" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
          <Button type="button" disabled={saving} onClick={() => run(() => reschedulePlannedSessionAction(slug, sessionId, date))}>
            Guardar fecha
          </Button>
        </div>
      ) : null}
      {mode === "cancel" ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            aria-label="Motivo"
            placeholder="Motivo (mínimo 10 caracteres)"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            className={INPUT_CLASS}
          />
          <Button type="button" variant="secondary" disabled={saving} onClick={() => run(() => cancelPlannedSessionAction(slug, sessionId, reason))}>
            Confirmar
          </Button>
        </div>
      ) : null}
      {error ? <FormError>{error}</FormError> : null}
    </div>
  );
}
