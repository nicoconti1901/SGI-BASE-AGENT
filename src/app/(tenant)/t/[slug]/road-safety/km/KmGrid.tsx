"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS, StatusChip, type ChipStatus } from "@/components/ui";
import { addResetAction, saveKmAction } from "@/app/(tenant)/t/[slug]/road-safety/actions";

export type KmRow = {
  assetId: string;
  code: string;
  description: string;
  state: "ok" | "allocated" | "manual" | "no_data" | "inconsistent";
  /** Km que dan los odómetros (o el reparto por días). */
  computedKm: number | null;
  /** Km confirmados o cargados; `null` si todavía no se confirmó el mes. */
  storedKm: number | null;
  manualReason: string | null;
};

const STATE: Record<KmRow["state"], { label: string; status: ChipStatus }> = {
  ok: { label: "Calculado", status: "ok" },
  allocated: { label: "Repartido", status: "info" },
  manual: { label: "Manual", status: "info" },
  no_data: { label: "Sin dato", status: "warning" },
  inconsistent: { label: "Lecturas que no cierran", status: "danger" },
};

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-AR"));

function Row({ slug, month, row, canManage }: { slug: string; month: string; row: KmRow; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [km, setKm] = useState(row.storedKm !== null ? String(row.storedKm) : "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canConfirm = row.computedKm !== null && (row.state === "ok" || row.state === "allocated") && row.storedKm === null;
  const chip = STATE[row.state];

  function save(payload: { km: number | null; reason: string }) {
    setError(null);
    start(async () => {
      const result = await saveKmAction(slug, { assetId: row.assetId, month, ...payload });
      if (!result.ok) return setError(result.error);
      setEditing(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <tr className="align-top">
      <th scope="row" className="px-4 py-3 font-medium">
        {row.code}
        <span className="block text-xs font-normal text-[var(--color-ink-muted)]">{row.description}</span>
      </th>
      <td className="px-4 py-3 tabular-nums">{fmt(row.computedKm)}</td>
      <td className="px-4 py-3 tabular-nums">
        {fmt(row.storedKm)}
        {row.storedKm !== null ? <span className="ml-2 text-xs text-[var(--color-ink-muted)]">{row.state === "manual" ? "a mano" : "confirmado"}</span> : null}
        {row.manualReason ? <span className="block text-xs text-[var(--color-ink-muted)]">{row.manualReason}</span> : null}
      </td>
      <td className="px-4 py-3">
        <StatusChip status={chip.status} label={chip.label} />
      </td>
      <td className="px-4 py-3">
        {canManage ? (
          editing ? (
            <div className="flex min-w-56 flex-col gap-2">
              <Field label="Km del mes">
                <input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} aria-label={`Km de ${row.code}`} className={INPUT_CLASS} />
              </Field>
              <Field label="Motivo" hint="Obligatorio al cargar o cambiar a mano.">
                <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} aria-label={`Motivo para ${row.code}`} className={INPUT_CLASS} />
              </Field>
              <div className="flex gap-2">
                <Button type="button" onClick={() => save({ km: km.trim() === "" ? NaN : Number(km.replace(/\./g, "").replace(",", ".")), reason })} disabled={pending}>
                  {pending ? "Guardando…" : "Guardar"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={pending}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canConfirm ? (
                <Button type="button" onClick={() => save({ km: null, reason: "" })} disabled={pending}>
                  {pending ? "Guardando…" : "Confirmar"}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                {row.storedKm === null ? "Cargar a mano" : "Cambiar"}
              </Button>
            </div>
          )
        ) : null}
        {error ? <FormError>{error}</FormError> : null}
      </td>
    </tr>
  );
}

/** Grilla del mes: una fila por vehículo con los km calculados de los odómetros, los confirmados y su estado. */
export function KmGrid({ slug, month, monthLabel, rows, canManage }: { slug: string; month: string; monthLabel: string; rows: KmRow[]; canManage: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">Km de la flota en {monthLabel}</caption>
        <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">Vehículo</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Según odómetro</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Km del mes</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">
          {rows.map((row) => (
            <Row key={row.assetId} slug={slug} month={month} row={row} canManage={canManage} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Marca un reinicio o cambio de tablero: el odómetro vuelve a empezar y esos km no se estiman. */
export function ResetForm({ slug, vehicles }: { slug: string; vehicles: { id: string; code: string }[] }) {
  const router = useRouter();
  const [assetId, setAssetId] = useState("");
  const [effectiveOn, setEffectiveOn] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    setDone(false);
    start(async () => {
      const result = await addResetAction(slug, { assetId, effectiveOn, reason });
      if (!result.ok) return setError(result.error);
      setDone(true);
      setReason("");
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
        <Field label="Desde el día" required>
          <input type="date" value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="Motivo" required hint="Por ejemplo: cambio de tablero.">
          <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className={INPUT_CLASS} />
        </Field>
      </div>
      {error ? <FormError>{error}</FormError> : null}
      {done ? <p role="status" className="text-sm font-semibold text-[var(--color-success)]">Reinicio registrado.</p> : null}
      <div>
        <Button type="button" onClick={submit} disabled={pending || !assetId || !effectiveOn}>
          {pending ? "Guardando…" : "Registrar reinicio"}
        </Button>
      </div>
    </div>
  );
}
