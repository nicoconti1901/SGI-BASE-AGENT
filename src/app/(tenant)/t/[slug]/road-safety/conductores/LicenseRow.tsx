"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { PersonPicker } from "@/components/pickers/PersonPicker";
import { saveLicenseAction, setDriverAction } from "@/app/(tenant)/t/[slug]/road-safety/actions";

/** Vencimiento de la licencia de un conductor: se carga, se cambia o se quita; y se puede sacar la marca de conductor. */
export function LicenseEditor({ slug, personId, name, expiresOn }: { slug: string; personId: string; name: string; expiresOn: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(expiresOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(next: string | null) {
    setError(null);
    start(async () => {
      const result = await saveLicenseAction(slug, { personId, expiresOn: next });
      if (!result.ok) return setError(result.error);
      if (next === null) setValue("");
      router.refresh();
    });
  }

  function drop() {
    setError(null);
    start(async () => {
      const result = await setDriverAction(slug, { personId, isDriver: false });
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Vencimiento de la licencia de ${name}`} className={`${INPUT_CLASS} w-44`} />
      <Button type="button" onClick={() => save(value)} disabled={pending || value === "" || value === (expiresOn ?? "")}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
      {expiresOn ? (
        <Button type="button" variant="secondary" onClick={() => save(null)} disabled={pending}>
          Quitar licencia
        </Button>
      ) : null}
      <Button type="button" variant="secondary" onClick={drop} disabled={pending} aria-label={`Sacar a ${name} de los conductores`}>
        Sacar de conductores
      </Button>
      {error ? <FormError>{error}</FormError> : null}
    </div>
  );
}

/** Marca a una persona como conductor: se busca por nombre o legajo. */
export function AddDriverForm({ slug, taskId }: { slug: string; taskId?: string }) {
  const router = useRouter();
  const [personId, setPersonId] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const result = await setDriverAction(slug, { personId, isDriver: true });
      if (!result.ok) return setError(result.error);
      setPersonId("");
      setPickerKey((k) => k + 1);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Agregar conductor" hint="Buscá a la persona por nombre o legajo. Después cargá el vencimiento de su licencia.">
        <PersonPicker key={pickerKey} slug={slug} name="driverPersonId" label="Persona" qualifyForTaskId={taskId} onChange={(p) => setPersonId(p?.id ?? "")} />
      </Field>
      {error ? <FormError>{error}</FormError> : null}
      <div>
        <Button type="button" onClick={submit} disabled={pending || personId === ""}>
          {pending ? "Guardando…" : "Marcar como conductor"}
        </Button>
      </div>
    </div>
  );
}
