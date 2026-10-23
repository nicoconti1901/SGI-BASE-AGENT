import Link from "next/link";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { PlanForm } from "@/app/(tenant)/t/[slug]/training/plan/PlanForm";
import { PlanRowActions } from "@/app/(tenant)/t/[slug]/training/plan/PlanRowActions";
import { getPlanSummary, listPlanSessions } from "@/lib/training-plan";
import { listCourses } from "@/lib/training-config";
import { listSites } from "@/lib/masterdata";
import { trainingToday } from "@/lib/training";
import { PLAN_LEVEL_LABELS } from "@/domain/training/plan-labels";
import { Button, EmptyState, Field, INPUT_CLASS, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

const day = (iso: string) => iso.split("-").reverse().join("/");

type SearchParams = { anio?: string };

export default async function PlanPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canRecord, canManage } = await loadTrainingAccess(slug);
  const today = trainingToday();
  const parsed = Number(sp.anio);
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : Number(today.slice(0, 4));
  const base = `/t/${slug}/training`;

  const [summary, sessions, courses, sites] = await Promise.all([
    getPlanSummary(tenant.id, year, today),
    listPlanSessions(tenant.id, { year }),
    canRecord ? listCourses(tenant.id) : Promise.resolve([]),
    listSites(tenant.id),
  ]);
  const totals = summary.reduce(
    (t, s) => ({ planned: t.planned + s.planned, done: t.done + s.done, overdue: t.overdue + s.overdue, extra: t.extra + s.extra }),
    { planned: 0, done: 0, overdue: 0, extra: 0 },
  );
  const percent = totals.planned === 0 ? null : Math.round((totals.done / totals.planned) * 100);
  const pending = sessions.filter((s) => s.status === "planned");

  return (
    <div className="flex flex-col gap-6">
      <SectionBlock
        title={`Plan anual ${year}`}
        what="Lo planificado frente a lo realizado, por sede. El plan anual es una exigencia del Decreto 351/79 (art. 211) y de la Res. SRT 905/15."
        next={canRecord ? "agregá las capacitaciones previstas del año; cuando se dicten, registralas desde acá y quedan contadas como realizadas." : "consultá el avance del plan."}
        actions={
          sessions.length > 0 ? (
            <Link href={`${base}/plan/export?anio=${year}`} className={buttonClass("secondary")}>
              Exportar para firma (CSV)
            </Link>
          ) : undefined
        }
      >
        <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Año del plan">
          <Field label="Año">
            <input type="number" name="anio" min={2000} max={2100} defaultValue={year} className={`${INPUT_CLASS} w-28`} />
          </Field>
          <Button type="submit" variant="secondary">
            Ver
          </Button>
        </form>

        {summary.length === 0 ? (
          <EmptyState what={`Todavía no hay capacitaciones en el plan ${year}.`} next={canRecord ? "agregá la primera abajo." : "cuando se planifique, la vas a ver acá."} />
        ) : (
          <>
            <p className="text-sm">
              <span className="font-semibold">Cumplimiento del plan: </span>
              {percent === null ? "sin capacitaciones planificadas" : `${percent}% (${totals.done} de ${totals.planned})`}
              {totals.overdue > 0 ? <span className="ml-2"><StatusChip status="overdue" label={`${totals.overdue} atrasada(s)`} /></span> : null}
            </p>
            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Plan anual por sede</caption>
                <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Sede</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Planificadas</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Realizadas</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Por hacer</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Atrasadas</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Fuera del plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {summary.map((s) => (
                    <tr key={s.siteId ?? "none"}>
                      <th scope="row" className="px-4 py-3 font-medium">{s.siteName}</th>
                      <td className="px-4 py-3 tabular-nums">{s.planned}</td>
                      <td className="px-4 py-3 tabular-nums">{s.done}</td>
                      <td className="px-4 py-3 tabular-nums">{s.upcoming}</td>
                      <td className="px-4 py-3 tabular-nums">{s.overdue > 0 ? <StatusChip status="overdue" label={String(s.overdue)} /> : 0}</td>
                      <td className="px-4 py-3 tabular-nums">{s.extra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionBlock>

      {canRecord ? (
        <SectionBlock title="Planificar una capacitación" what="Una intención: todavía no hay asistentes ni registros.">
          {courses.length === 0 ? (
            <EmptyState what="Todavía no hay cursos." next="creá el curso antes de planificarlo." action={{ href: `${base}/courses`, label: "Ir a Cursos" }} />
          ) : (
            <PlanForm slug={slug} today={today} courses={courses.map((c) => ({ id: c.id, name: c.name }))} sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
          )}
        </SectionBlock>
      ) : null}

      {sessions.length > 0 ? (
        <SectionBlock title="Capacitaciones del plan" what={`${pending.length} pendiente(s) y ${sessions.length - pending.length} realizada(s) en ${year}.`}>
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Capacitaciones planificadas para {year}</caption>
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Fecha prevista</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Curso</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Sede</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Nivel</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {sessions.map((s) => {
                  const late = s.status === "planned" && s.heldAt < today;
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-3 tabular-nums">{day(s.status === "planned" ? s.heldAt : s.plannedFor)}</td>
                      <td className="px-4 py-3 font-medium">
                        {s.status === "held" ? (
                          <Link href={`${base}/sessions/${s.id}`} className="text-[var(--color-accent)] hover:underline">
                            {s.courseName}
                          </Link>
                        ) : (
                          s.courseName
                        )}
                      </td>
                      <td className="px-4 py-3">{s.siteName ?? "Toda la empresa"}</td>
                      <td className="px-4 py-3">{s.level ? PLAN_LEVEL_LABELS[s.level] : "—"}</td>
                      <td className="px-4 py-3">
                        {s.status === "held" ? (
                          <StatusChip status="ok" label={`Realizada el ${day(s.heldAt)}`} />
                        ) : late ? (
                          <StatusChip status="overdue" label="Atrasada" />
                        ) : (
                          <StatusChip status="pending" label="Pendiente" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.status === "planned" ? <PlanRowActions slug={slug} sessionId={s.id} heldAt={s.heldAt} canRecord={canRecord} canManage={canManage} /> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Cuando el plan esté firmado, subilo al módulo de Documentos para que quede como evidencia.
          </p>
        </SectionBlock>
      ) : null}
    </div>
  );
}
