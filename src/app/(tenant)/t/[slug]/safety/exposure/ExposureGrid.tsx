"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, INPUT_CLASS, StatusChip } from "@/components/ui";
import { saveExposureGridAction, type ExposureRowPayload } from "@/app/(tenant)/t/[slug]/safety/exposure-actions";

type Cell = { hours: number; headcountAvg: number } | null;
type Row = { siteId: string; siteName: string; own: Cell; contractor: Cell };

type Draft = { ownHours: string; ownHeadcount: string; conHours: string; conHeadcount: string; noContractor: boolean };

const toDraft = (r: Row): Draft => ({
  ownHours: r.own ? String(r.own.hours) : "",
  ownHeadcount: r.own ? String(r.own.headcountAvg) : "",
  conHours: r.contractor ? String(r.contractor.hours) : "",
  conHeadcount: r.contractor ? String(r.contractor.headcountAvg) : "",
  noContractor: Boolean(r.contractor && r.contractor.hours === 0 && r.contractor.headcountAvg === 0),
});

const num = (s: string) => Number(s.trim().replace(",", "."));
const filled = (a: string, b: string) => a.trim() !== "" && b.trim() !== "";

/** Grilla del mes: una fila por sede con horas y dotación del personal propio y de los contratistas. */
export function ExposureGrid({ slug, month, monthLabel, monthEnded, rows }: { slug: string; month: string; monthLabel: string; monthEnded: boolean; rows: Row[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(rows.map((r) => [r.siteId, toDraft(r)])));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; warnings: string[] } | null>(null);
  const [saving, start] = useTransition();

  const set = (siteId: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [siteId]: { ...d[siteId], ...patch } }));

  function payloadFor(r: Row): ExposureRowPayload | null | "incomplete" {
    const d = drafts[r.siteId];
    const out: ExposureRowPayload = { siteId: r.siteId, siteName: r.siteName };
    const initial = toDraft(r);
    if (filled(d.ownHours, d.ownHeadcount)) {
      const own = { hours: num(d.ownHours), headcountAvg: num(d.ownHeadcount) };
      if (!r.own || r.own.hours !== own.hours || r.own.headcountAvg !== own.headcountAvg) out.own = own;
    } else if (d.ownHours !== initial.ownHours || d.ownHeadcount !== initial.ownHeadcount) {
      return "incomplete";
    }
    if (d.noContractor) {
      if (!r.contractor || r.contractor.hours !== 0 || r.contractor.headcountAvg !== 0) out.contractor = { hours: 0, headcountAvg: 0 };
    } else if (filled(d.conHours, d.conHeadcount)) {
      const contractor = { hours: num(d.conHours), headcountAvg: num(d.conHeadcount) };
      if (!r.contractor || r.contractor.hours !== contractor.hours || r.contractor.headcountAvg !== contractor.headcountAvg) out.contractor = contractor;
    } else if (d.conHours !== initial.conHours || d.conHeadcount !== initial.conHeadcount) {
      return "incomplete";
    }
    return out.own || out.contractor ? out : null;
  }

  const plan = rows.map((r) => ({ row: r, payload: payloadFor(r) }));
  const incomplete = plan.filter((p) => p.payload === "incomplete").map((p) => p.row.siteName);
  const changes = plan.flatMap((p) => (p.payload && p.payload !== "incomplete" ? [p.payload] : []));
  const correcting = plan.some((p) => {
    const pl = p.payload;
    return pl && pl !== "incomplete" && ((pl.own && p.row.own) || (pl.contractor && p.row.contractor));
  });
  const needsReason = monthEnded && correcting;

  function submit() {
    setError(null);
    setNotice(null);
    if (incomplete.length > 0) return setError(`Completá las horas y la dotación de ${incomplete.join(", ")}.`);
    if (changes.length === 0) return setError("No hay cambios para guardar.");
    start(async () => {
      const result = await saveExposureGridAction(slug, month, changes, reason);
      if (!result.ok) return setError(result.error);
      setNotice({ text: `Guardado: ${result.saved} carga(s) nueva(s) y ${result.corrected} corrección(es).`, warnings: result.warnings });
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <caption className="sr-only">Horas trabajadas y dotación de {monthLabel} por sede</caption>
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold" rowSpan={2}>Sede</th>
              <th scope="colgroup" colSpan={2} className="px-4 pt-2.5 font-semibold">Personal propio</th>
              <th scope="colgroup" colSpan={2} className="px-4 pt-2.5 font-semibold">Contratistas</th>
              <th scope="col" className="px-4 py-2.5 font-semibold" rowSpan={2}>Estado</th>
            </tr>
            <tr>
              <th scope="col" className="px-4 pb-2.5 font-semibold">Horas</th>
              <th scope="col" className="px-4 pb-2.5 font-semibold">Dotación</th>
              <th scope="col" className="px-4 pb-2.5 font-semibold">Horas</th>
              <th scope="col" className="px-4 pb-2.5 font-semibold">Dotación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {rows.map((r) => {
              const d = drafts[r.siteId];
              const complete = Boolean(r.own && r.contractor);
              return (
                <tr key={r.siteId}>
                  <th scope="row" className="px-4 py-3 font-medium">{r.siteName}</th>
                  <td className="px-2 py-2">
                    <input aria-label={`Horas del personal propio en ${r.siteName}`} inputMode="numeric" value={d.ownHours} onChange={(e) => set(r.siteId, { ownHours: e.target.value })} className={`${INPUT_CLASS} w-28`} />
                  </td>
                  <td className="px-2 py-2">
                    <input aria-label={`Dotación del personal propio en ${r.siteName}`} inputMode="decimal" value={d.ownHeadcount} onChange={(e) => set(r.siteId, { ownHeadcount: e.target.value })} className={`${INPUT_CLASS} w-24`} />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      aria-label={`Horas de contratistas en ${r.siteName}`}
                      inputMode="numeric"
                      disabled={d.noContractor}
                      value={d.noContractor ? "0" : d.conHours}
                      onChange={(e) => set(r.siteId, { conHours: e.target.value })}
                      className={`${INPUT_CLASS} w-28`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      aria-label={`Dotación de contratistas en ${r.siteName}`}
                      inputMode="decimal"
                      disabled={d.noContractor}
                      value={d.noContractor ? "0" : d.conHeadcount}
                      onChange={(e) => set(r.siteId, { conHeadcount: e.target.value })}
                      className={`${INPUT_CLASS} w-24`}
                    />
                    <label className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                      <input
                        type="checkbox"
                        checked={d.noContractor}
                        onChange={(e) => set(r.siteId, { noContractor: e.target.checked })}
                        aria-label={`Sin personal contratista en ${r.siteName}`}
                      />
                      Sin contratistas este mes
                    </label>
                  </td>
                  <td className="px-4 py-3">{complete ? <StatusChip status="ok" label="Cargado" /> : <StatusChip status="warning" label="Falta cargar" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {needsReason ? (
        <Field label="Motivo de la corrección" required hint={`Estás cambiando valores de un mes que ya terminó (${monthLabel}). Queda registrado con tu nombre.`}>
          <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className={INPUT_CLASS} />
        </Field>
      ) : null}

      {error ? <FormError>{error}</FormError> : null}
      {notice ? (
        <div role="status" className="flex flex-col gap-1 text-sm">
          <p className="font-semibold text-[var(--color-success)]">{notice.text}</p>
          {notice.warnings.map((w) => (
            <p key={w} className="text-[var(--color-warning)]">{w}</p>
          ))}
        </div>
      ) : null}
      <div>
        <Button type="button" onClick={submit} disabled={saving || changes.length === 0}>
          {saving ? "Guardando…" : `Guardar ${monthLabel}`}
        </Button>
      </div>
    </div>
  );
}
