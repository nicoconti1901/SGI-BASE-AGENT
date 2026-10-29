"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FormError, INPUT_CLASS } from "@/components/ui";
import { saveLicenseAction } from "@/app/(tenant)/t/[slug]/road-safety/actions";

/** Vencimiento de la licencia de una persona: se carga, se cambia o se quita. */
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Vencimiento de la licencia de ${name}`} className={`${INPUT_CLASS} w-44`} />
      <Button type="button" onClick={() => save(value)} disabled={pending || value === "" || value === (expiresOn ?? "")}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
      {expiresOn ? (
        <Button type="button" variant="secondary" onClick={() => save(null)} disabled={pending}>
          Quitar
        </Button>
      ) : null}
      {error ? <FormError>{error}</FormError> : null}
    </div>
  );
}
