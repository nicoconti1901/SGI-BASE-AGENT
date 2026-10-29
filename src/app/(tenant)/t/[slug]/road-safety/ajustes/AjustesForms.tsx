"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { saveSettingsAction, setDriverTaskAction } from "@/app/(tenant)/t/[slug]/road-safety/actions";

const toNumber = (text: string) => (text.trim() === "" ? NaN : Number(text.replace(/\./g, "").replace(",", ".")));

/** Umbrales de la empresa: poca exposición (D16) y reincidencia (D25). */
export function SettingsForm({ slug, canManage, initial }: { slug: string; canManage: boolean; initial: { minExposureKm: number; repeatThreshold: number; repeatWindowMonths: number } }) {
  const router = useRouter();
  const [minExposureKm, setMin] = useState(String(initial.minExposureKm));
  const [repeatThreshold, setThreshold] = useState(String(initial.repeatThreshold));
  const [repeatWindowMonths, setWindow] = useState(String(initial.repeatWindowMonths));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    setDone(false);
    start(async () => {
      const result = await saveSettingsAction(slug, {
        minExposureKm: toNumber(minExposureKm),
        repeatThreshold: toNumber(repeatThreshold),
        repeatWindowMonths: toNumber(repeatWindowMonths),
      });
      if (!result.ok) return setError(result.error);
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Poca exposición: menos de (km)" hint="Bajo este total de km en el período, el tablero avisa que conviene mirar el número absoluto.">
          <input inputMode="numeric" value={minExposureKm} disabled={!canManage} onChange={(e) => setMin(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="Conductor para revisar: hechos desde" hint="Cantidad de hechos en la ventana para que aparezca en la lista.">
          <input inputMode="numeric" value={repeatThreshold} disabled={!canManage} onChange={(e) => setThreshold(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="Ventana de revisión (meses)" hint="De 1 a 60 meses.">
          <input inputMode="numeric" value={repeatWindowMonths} disabled={!canManage} onChange={(e) => setWindow(e.target.value)} className={INPUT_CLASS} />
        </Field>
      </div>
      {error ? <FormError>{error}</FormError> : null}
      {done ? <p role="status" className="text-sm font-semibold text-[var(--color-success)]">Ajustes guardados.</p> : null}
      {canManage ? (
        <div>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar ajustes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Tarea de conducción: sus cursos obligatorios (Capacitaciones) prueban el manejo defensivo vigente. */
export function DriverTaskForm({ slug, canManage, tasks, current }: { slug: string; canManage: boolean; tasks: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  const [jobTaskId, setJobTaskId] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    setDone(false);
    start(async () => {
      const result = await setDriverTaskAction(slug, { jobTaskId });
      if (!result.ok) return setError(result.error);
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Tarea de conducción" hint="Sus cursos obligatorios (Capacitaciones) prueban el manejo defensivo. Sin tarea elegida, ningún conductor queda habilitado.">
        <select value={jobTaskId} disabled={!canManage} onChange={(e) => setJobTaskId(e.target.value)} className={INPUT_CLASS}>
          <option value="">Sin elegir</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      {error ? <FormError>{error}</FormError> : null}
      {done ? <p role="status" className="text-sm font-semibold text-[var(--color-success)]">Tarea guardada.</p> : null}
      {canManage ? (
        <div>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar tarea"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
