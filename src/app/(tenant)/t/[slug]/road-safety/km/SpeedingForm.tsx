"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { saveSpeedingAction } from "@/app/(tenant)/t/[slug]/road-safety/actions";

/** Excesos de velocidad del mes, a mano y por vehículo (D21): sin integración satelital. */
export function SpeedingForm({ slug, month, vehicles }: { slug: string; month: string; vehicles: { id: string; code: string }[] }) {
  const router = useRouter();
  const [assetId, setAssetId] = useState("");
  const [count, setCount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    setDone(false);
    start(async () => {
      const result = await saveSpeedingAction(slug, { assetId, month, count: count.trim() === "" ? NaN : Number(count), note });
      if (!result.ok) return setError(result.error);
      setDone(true);
      setCount("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Vehículo" required>
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={INPUT_CLASS}>
            <option value="">Elegí el vehículo</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Excesos en el mes" required hint="Cantidad de veces que superó el límite.">
          <input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="Nota" hint="De dónde sale el dato, si querés dejarlo.">
          <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={INPUT_CLASS} />
        </Field>
      </div>
      {error ? <FormError>{error}</FormError> : null}
      {done ? <p role="status" className="text-sm font-semibold text-[var(--color-success)]">Excesos guardados.</p> : null}
      <div>
        <Button type="button" onClick={submit} disabled={pending || !assetId || count.trim() === ""}>
          {pending ? "Guardando…" : "Guardar excesos"}
        </Button>
      </div>
    </div>
  );
}
