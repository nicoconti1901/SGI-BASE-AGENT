import Link from "next/link";
import { notFound } from "next/navigation";
import { listJobTasks, listSites } from "@/lib/masterdata";
import { fieldAuditProgram } from "@/lib/inspection-field-audits";
import { PersonPicker } from "@/components/pickers/PersonPicker";
import { SitePicker } from "@/components/pickers/SitePicker";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { setMonthlyTargetAction, startFieldAuditAction } from "@/app/(tenant)/t/[slug]/inspections/actions";
import { todayIso } from "@/domain/inspections/dates";
import { MONTH_RE, SPECIAL_TASKS, SPECIAL_TASK_KEYS, monthLabel, monthOf, shiftMonth } from "@/domain/inspections/field-audit";
import { Button, EmptyState, Field, FormError, INPUT_CLASS, SectionBlock, StatGrid, StatTile, StatusChip, buttonClass } from "@/components/ui";

const STATUS_CHIP = {
  met: { status: "ok", label: "Cumplida" },
  pending: { status: "warning", label: "En curso" },
  no_target: { status: "pending", label: "Sin meta" },
} as const;

export default async function FieldAuditsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ month?: string; error?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canWrite, canManageAssets } = await loadInspectionsAccess(slug);
  if (sp.month && !MONTH_RE.test(sp.month)) notFound();
  const thisMonth = monthOf(todayIso());
  const month = sp.month ?? thisMonth;
  const [program, sites, tasks] = await Promise.all([
    fieldAuditProgram(tenant.id, month),
    canWrite ? listSites(tenant.id) : Promise.resolve([]),
    canWrite ? listJobTasks(tenant.id) : Promise.resolve([]),
  ]);
  const { summary, rows } = program;
  const monthHref = (m: string) => `/t/${slug}/inspections/campo?month=${m}`;

  return (
    <div className="flex flex-col gap-6">
      {sp.error ? <FormError>{sp.error}</FormError> : null}

      {canWrite ? (
        <SectionBlock title="Nueva auditoría" eyebrow="En el frente de trabajo" what="Elegí la sede y la tarea. Si hay trabajo en altura, espacio confinado o izaje, marcalo: se suman sus controles.">
          {sites.length === 0 ? (
            <EmptyState what="Falta cargar al menos una sede." next="registrala en Datos maestros y volvé." action={{ href: `/t/${slug}/master-data/sites`, label: "Cargar sedes" }} />
          ) : (
            <form action={startFieldAuditAction.bind(null, slug)} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SitePicker sites={sites.map((s) => ({ id: s.id, name: s.name }))} name="siteId" required />
                <Field label="Tarea que se audita" hint="Opcional. Sale de los datos maestros.">
                  <select name="jobTaskId" defaultValue="" className={INPUT_CLASS}>
                    <option value="">Sin indicar</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Contratista" hint="Opcional. Si el frente lo hace una empresa contratista.">
                  <input name="contractorName" maxLength={120} autoComplete="off" placeholder="Ej.: Montajes del Sur SA" className={INPUT_CLASS} />
                </Field>
                <PersonPicker slug={slug} name="supervisorPersonId" label="Supervisor del frente" hint="Opcional. Buscá por nombre o legajo." />
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-semibold">Tareas especiales en este frente</legend>
                <div className="flex flex-wrap gap-2">
                  {SPECIAL_TASK_KEYS.map((key) => (
                    <label key={key} className="flex min-h-12 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm">
                      <input type="checkbox" name="specialTasks" value={key} className="h-4 w-4 accent-[var(--color-accent)]" />
                      <span>{SPECIAL_TASKS[key]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <Button type="submit" className="min-h-12 w-full sm:w-auto">
                  Empezar la auditoría
                </Button>
              </div>
            </form>
          )}
        </SectionBlock>
      ) : null}

      <SectionBlock
        title="Cumplimiento del programa"
        eyebrow={monthLabel(month)}
        what="Auditorías cerradas en el mes contra la meta de cada sede."
        next={canManageAssets ? "fijá la meta mensual de cada sede; sin meta, la sede no se mide." : undefined}
        actions={
          <nav aria-label="Mes" className="flex items-center gap-2">
            <Link href={monthHref(shiftMonth(month, -1))} className={buttonClass("secondary", "min-h-10")} aria-label="Mes anterior">
              ←
            </Link>
            <span className="min-w-[8rem] text-center text-sm font-semibold capitalize">{monthLabel(month)}</span>
            <Link href={monthHref(shiftMonth(month, 1))} className={buttonClass("secondary", "min-h-10")} aria-label="Mes siguiente">
              →
            </Link>
          </nav>
        }
      >
        <StatGrid cols={3} aria-label="Resumen del programa">
          <StatTile label="Sedes con meta" value={summary.withTarget} />
          <StatTile label="Metas cumplidas" value={`${summary.met} de ${summary.withTarget}`} tone={summary.withTarget > 0 && summary.met < summary.withTarget ? "warning" : "default"} />
          <StatTile label="Auditorías / meta" value={`${summary.done} / ${summary.target}`} />
        </StatGrid>

        {rows.length === 0 ? (
          <EmptyState what="Todavía no hay sedes." next="cargalas en Datos maestros para medir el programa." action={{ href: `/t/${slug}/master-data/sites`, label: "Cargar sedes" }} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Cumplimiento del programa de auditorías de campo por sede en {monthLabel(month)}</caption>
              <thead>
                <tr className="border-b border-[var(--color-line)] text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Sede
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Hechas
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Meta mensual
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Cumplimiento
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const chip = STATUS_CHIP[r.status];
                  return (
                    <tr key={r.siteId} className="border-b border-[var(--color-line)] align-middle">
                      <th scope="row" className="py-3 pr-3 font-semibold">
                        {r.siteName}
                      </th>
                      <td className="py-3 pr-3 tabular-nums">{r.done}</td>
                      <td className="py-3 pr-3">
                        {canManageAssets ? (
                          <form action={setMonthlyTargetAction.bind(null, slug, month, r.siteId)} className="flex items-center gap-2">
                            <input
                              name="monthlyTarget"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={200}
                              step={1}
                              defaultValue={r.target ?? ""}
                              placeholder="—"
                              aria-label={`Meta mensual de ${r.siteName}`}
                              className={`${INPUT_CLASS} min-h-10 w-20`}
                            />
                            <Button type="submit" variant="secondary" className="min-h-10" aria-label={`Guardar la meta de ${r.siteName}`}>
                              Guardar
                            </Button>
                          </form>
                        ) : (
                          <span className="tabular-nums">{r.target ?? "—"}</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusChip status={chip.status} label={chip.label} />
                          {r.pct !== null ? (
                            <span className="tabular-nums text-[var(--color-ink-muted)]">
                              {String(r.pct).replace(".", ",")} %{r.missing > 0 ? ` · faltan ${r.missing}` : ""}
                            </span>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-[var(--color-ink-muted)]">
          Cuentan las auditorías cerradas con fecha dentro del mes. Una auditoría abierta (en borrador) todavía no suma.{" "}
          <Link href={`/t/${slug}/inspections`} className="font-medium text-[var(--color-accent)] hover:underline">
            Ver todas las inspecciones
          </Link>
        </p>
      </SectionBlock>
    </div>
  );
}
