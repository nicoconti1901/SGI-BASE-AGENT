import Link from "next/link";
import { loadSafetyAccess } from "@/app/(tenant)/t/[slug]/safety/access";
import { ExposureGrid } from "@/app/(tenant)/t/[slug]/safety/exposure/ExposureGrid";
import { exposureMonthOptions, getExposureGrid, listExposureRevisions } from "@/lib/safety-exposure";
import { monthLabel } from "@/domain/safety-stats/exposure-import";
import { localDay } from "@/domain/safety-stats/period";
import { EMPLOYER_LABELS } from "@/domain/safety-stats/types";
import { Button, EmptyState, Field, HintCallout, INPUT_CLASS, SectionBlock, buttonClass } from "@/components/ui";

export default async function ExposurePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { slug } = await params;
  const { mes } = await searchParams;
  const { tenant, canManage } = await loadSafetyAccess(slug);
  const today = localDay(new Date());
  const options = exposureMonthOptions(today);
  const month = mes && options.includes(mes) ? mes : options[0];
  const base = `/t/${slug}/safety`;

  const [rows, revisions] = await Promise.all([getExposureGrid(tenant.id, month), listExposureRevisions(tenant.id, { month })]);
  const pending = rows.filter((r) => !r.own || !r.contractor).length;

  return (
    <div className="flex flex-col gap-6">
      <SectionBlock
        title="Horas trabajadas"
        what="Con las horas trabajadas y la dotación de cada mes se calculan los índices del tablero. Si no se cargan, el índice dice «sin datos»: nunca 0."
        next={
          canManage
            ? "elegí el mes, completá las horas y la dotación promedio de cada sede y guardá. Si no hubo contratistas, tildá «Sin contratistas este mes»."
            : "consultá lo cargado. Solo el administrador y el responsable de proceso cargan las horas."
        }
        actions={
          canManage ? (
            <Link href={`${base}/exposure/import`} className={buttonClass("secondary")}>
              Importar desde CSV
            </Link>
          ) : undefined
        }
      >
        <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Mes">
          <Field label="Mes">
            <select name="mes" defaultValue={month} className={INPUT_CLASS}>
              {options.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="secondary">
            Ver
          </Button>
        </form>

        {rows.length === 0 ? (
          <EmptyState what="No hay sedes activas." next="creá las sedes en Datos maestros para cargar sus horas." action={{ href: `/t/${slug}/master-data/sites`, label: "Ir a Sedes" }} />
        ) : canManage ? (
          <>
            <HintCallout>
              {pending === 0
                ? `Las ${rows.length} sede(s) tienen ${monthLabel(month)} completo.`
                : `Faltan cargar ${pending} de ${rows.length} sede(s) en ${monthLabel(month)}. La dotación es el promedio de personas del mes.`}
            </HintCallout>
            <ExposureGrid slug={slug} month={month} monthLabel={monthLabel(month)} monthEnded={month < today.slice(0, 7)} rows={rows} />
          </>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Horas trabajadas de {monthLabel(month)}</caption>
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Sede</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{EMPLOYER_LABELS.own}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{EMPLOYER_LABELS.contractor}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {rows.map((r) => (
                  <tr key={r.siteId}>
                    <th scope="row" className="px-4 py-3 font-medium">{r.siteName}</th>
                    <td className="px-4 py-3 tabular-nums">{r.own ? `${r.own.hours.toLocaleString("es-AR")} h · ${r.own.headcountAvg} pers.` : "Sin cargar"}</td>
                    <td className="px-4 py-3 tabular-nums">{r.contractor ? `${r.contractor.hours.toLocaleString("es-AR")} h · ${r.contractor.headcountAvg} pers.` : "Sin cargar"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBlock>

      {revisions.length > 0 ? (
        <SectionBlock title="Correcciones de este mes" what="Cada cambio a un valor ya cargado queda con el valor anterior, el nuevo, el motivo y quién lo hizo.">
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] text-sm">
            {revisions.map((r, i) => (
              <li key={i} className="flex flex-col gap-0.5 px-4 py-3">
                <span className="font-medium">
                  {r.siteName} · {EMPLOYER_LABELS[r.employerKind]}: {r.previous.hours.toLocaleString("es-AR")} h / {r.previous.headcountAvg} → {r.next.hours.toLocaleString("es-AR")} h / {r.next.headcountAvg}
                </span>
                <span className="text-[var(--color-ink-muted)]">
                  {r.reason} · {r.actorName ?? "—"} · {r.at.toLocaleDateString("es-AR")}
                </span>
              </li>
            ))}
          </ul>
        </SectionBlock>
      ) : null}
    </div>
  );
}
