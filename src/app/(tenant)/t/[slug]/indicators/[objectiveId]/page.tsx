import Link from "next/link";
import { notFound } from "next/navigation";
import { getObjective } from "@/lib/objectives";
import { listTenantMemberOptions } from "@/lib/findings";
import { listOfferedStandards } from "@/lib/ims-catalog";
import { AUDIT_STANDARD_LABELS } from "@/domain/audits/types";
import { hasStructuredPlan, parsePlanSteps } from "@/domain/indicators/plan";
import { canRunObjective, objectiveLockMessage } from "@/domain/indicators/ownership";
import { statusBands } from "@/domain/indicators/bands";
import {
  DIRECTION_LABELS,
  FREQUENCY_LABELS,
  KIND_LABELS,
  MEASUREMENT_STATUS_LABELS,
  MEASUREMENT_STATUS_TONE,
  OBJECTIVE_STATUS_LABELS,
} from "@/domain/indicators/types";
import {
  CloseObjectiveForm,
  CreateIndicatorForm,
  EditIndicatorForm,
  ToggleIndicatorButton,
} from "@/app/(tenant)/t/[slug]/indicators/ObjectiveForms";
import { EditableObjective } from "@/app/(tenant)/t/[slug]/indicators/EditableObjective";
import {
  formatDate,
  loadIndicatorsAccess,
  toDateInput,
} from "@/app/(tenant)/t/[slug]/indicators/access";
import { RecordFacts, StatusChip, Summary, buttonClass } from "@/components/ui";

export default async function ObjectivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; objectiveId: string }>;
  searchParams: Promise<{ listo?: string; agregar?: string }>;
}) {
  const { slug, objectiveId } = await params;
  const { listo, agregar } = await searchParams;
  const { ctx, tenant, canWrite } = await loadIndicatorsAccess(slug);
  const [objective, members, standards] = await Promise.all([
    getObjective(tenant.id, objectiveId),
    listTenantMemberOptions(tenant.id),
    listOfferedStandards(tenant.id),
  ]);
  if (!objective) notFound();

  const options = members.map((m) => ({ id: m.id, name: m.name }));
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Sin asignar";
  const open = objective.status === "active";
  // Lo lleva su responsable (o el superusuario): quien lo creó y se lo asignó a otra persona lo ve, pero no lo mueve.
  const runs = canRunObjective({
    ownerUserId: objective.ownerUserId,
    actorUserId: ctx.userId,
    canWrite,
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });
  const editable = runs && open;
  const activeIndicators = objective.indicators.filter((i) => i.active);
  const tally = { on_target: 0, alert: 0, off_target: 0, no_data: 0 };
  for (const i of activeIndicators) tally[(i.measurements[0]?.status ?? "no_data") as keyof typeof tally] += 1;
  const closeRemaining = [
    ...(activeIndicators.length === 0 ? ["cargar al menos un indicador"] : []),
    ...(tally.no_data > 0 && activeIndicators.length > 0 ? [`los primeros valores de ${tally.no_data} indicador${tally.no_data === 1 ? "" : "es"}`] : []),
    `que ${nameOf(objective.ownerUserId)} lo cierre con su resultado (cumplido, no cumplido o cancelado) hasta el ${formatDate(objective.dueDate)}`,
  ];
  const planSteps = parsePlanSteps(objective.planSteps);
  const plan = { steps: planSteps, resources: objective.planResources, evaluation: objective.planEvaluation };
  const justSaved = listo === "indicador";
  const listHref = `/t/${slug}/indicators`;

  const steps = [
    { label: "Objetivo", done: true },
    { label: "Indicadores", done: activeIndicators.length > 0 },
    { label: "Resumen", done: activeIndicators.length > 0 },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href={listHref} className="text-sm text-[var(--color-accent)]">
          ← Lista de objetivos
        </Link>
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
          ISO · §6.2 · {objective.code}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 break-words font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {objective.title}
          </h1>
          <StatusChip label={OBJECTIVE_STATUS_LABELS[objective.status]} status={open ? "info" : "pending"} />
        </div>
        {objective.closingNote ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Cierre{objective.closedAt ? ` (${formatDate(objective.closedAt)})` : ""}: {objective.closingNote}
          </p>
        ) : null}
        {open ? (
          <ol aria-label="Pasos para crear el objetivo" className="mt-2 grid grid-cols-3 gap-2">
            {steps.map((s, i) => (
              <li
                key={s.label}
                className={`rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                  s.done
                    ? "border-[var(--color-success-line)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
                    : "border-[var(--color-warning)] bg-[var(--color-warning-soft)] font-semibold text-[var(--color-warning)]"
                }`}
              >
                <span className="block font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em]">
                  {String(i + 1).padStart(2, "0")} · {s.done ? "Listo" : "Falta"}
                </span>
                {s.label}
              </li>
            ))}
          </ol>
        ) : null}
      </header>

      {open && !runs ? (
        <section
          role="note"
          className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-info)] bg-[var(--color-info-soft)] p-5 text-sm"
        >
          <p className="font-semibold">Lo ves en solo lectura</p>
          <p>{objectiveLockMessage(nameOf(objective.ownerUserId))}</p>
          <p>
            <span className="font-semibold">Estado actual:</span> vigente hasta el {formatDate(objective.dueDate)}.{" "}
            {activeIndicators.length === 0
              ? "Todavía no tiene indicadores."
              : `${activeIndicators.length} indicador${activeIndicators.length === 1 ? "" : "es"}: ${tally.on_target} en meta, ${tally.alert} en alerta, ${tally.off_target} fuera de meta, ${tally.no_data} sin datos.`}
          </p>
          <p>
            <span className="font-semibold">Para cerrarlo falta:</span> {closeRemaining.join(" · ")}.
          </p>
        </section>
      ) : null}

      {justSaved ? (
        <section
          role="status"
          className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-success-line)] bg-[var(--color-success-soft)] p-5"
        >
          <p className="font-semibold text-[var(--color-success)]">Indicador guardado. Así quedó el objetivo completo.</p>
          <div className="flex flex-wrap gap-2">
            <Link href={listHref} className={buttonClass("primary")}>
              Volver a la lista de objetivos
            </Link>
            {editable ? (
              <Link href={`/t/${slug}/indicators/${objective.id}?agregar=1#agregar-indicador`} className={buttonClass("secondary")}>
                Agregar otro indicador
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <EditableObjective
        slug={slug}
        objectiveId={objective.id}
        members={options}
        standards={standards}
        canEdit={editable}
        defaults={{
          title: objective.title,
          description: objective.description,
          standards: objective.standards,
          ownerUserId: objective.ownerUserId,
          dueDate: toDateInput(objective.dueDate),
          plan: objective.plan,
          planSteps,
          planResources: objective.planResources,
          planEvaluation: objective.planEvaluation,
        }}
        summary={
          <div className="flex flex-col gap-4">
            <Summary
              items={[
                { label: "Responsable del objetivo", value: nameOf(objective.ownerUserId) },
                { label: "Fecha de cumplimiento", value: formatDate(objective.dueDate) },
                { label: "Normas", value: objective.standards.map((s) => AUDIT_STANDARD_LABELS[s]).join(", ") },
                { label: "Por qué importa", value: objective.description || "—" },
              ]}
            />
            <div className="flex flex-col gap-2 border-t border-[var(--color-line)] pt-4">
              <h3 className="text-sm font-semibold">Plan</h3>
              {hasStructuredPlan(plan) ? (
                <>
                  {planSteps.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[32rem] text-left text-sm">
                        <thead className="bg-[var(--color-surface-sunken)] text-xs text-[var(--color-ink-muted)]">
                          <tr>
                            <th className="px-3 py-2 font-medium">Acción</th>
                            <th className="px-3 py-2 font-medium">Responsable</th>
                            <th className="px-3 py-2 font-medium">Fecha límite</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-line)]">
                          {planSteps.map((s, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{s.what}</td>
                              <td className="px-3 py-2">{nameOf(s.ownerUserId)}</td>
                              <td className="px-3 py-2 tabular-nums">{formatDate(new Date(`${s.dueDate}T12:00:00`))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <Summary
                    items={[
                      { label: "Recursos", value: plan.resources || "—" },
                      { label: "Cómo se evalúa", value: plan.evaluation || "—" },
                    ]}
                  />
                </>
              ) : objective.plan ? (
                <p className="text-sm">{objective.plan}</p>
              ) : (
                <p className="text-sm text-[var(--color-warning)]">Sin plan cargado: usá «Editar» para agregar las acciones.</p>
              )}
            </div>
          </div>
        }
      />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">Indicadores</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Con qué se mide el avance del objetivo. Cada indicador tiene su propio responsable de carga.
          </p>
        </div>
        {objective.indicators.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)]">
            Falta el indicador: sin él no se puede medir el avance del objetivo.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {objective.indicators.map((i) => {
              const last = i.measurements[0];
              const status = last ? last.status : "no_data";
              const bands = statusBands(i);
              return (
                <li
                  key={i.id}
                  className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-card-line)] bg-[var(--color-surface-raised)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
                        Indicador
                      </span>
                      <p className="mt-1 break-words font-semibold">
                        <Link href={`/t/${slug}/indicators/${objective.id}/${i.id}`} className="hover:underline">
                          {i.name}
                        </Link>
                        {!i.active ? <span className="ml-2 text-xs text-[var(--color-ink-muted)]">(desactivado)</span> : null}
                      </p>
                    </div>
                    <span className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-semibold ${MEASUREMENT_STATUS_TONE[status]}`}>
                      {MEASUREMENT_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <RecordFacts
                    facts={[
                      { label: "Responsable del indicador", value: nameOf(i.ownerUserId) },
                      { label: "Meta", value: bands[0]?.text ?? `${i.target} ${i.unit}` },
                      { label: "Frecuencia", value: FREQUENCY_LABELS[i.frequency] },
                      { label: "Último valor", value: last ? `${last.value} ${i.unit}` : "Sin cargar" },
                    ]}
                  />
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {DIRECTION_LABELS[i.direction]} · {KIND_LABELS[i.kind]}
                    {i.alertThreshold !== null ? ` · Aviso en ${i.alertThreshold} ${i.unit}` : ""}
                  </p>
                  {editable ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium text-[var(--color-accent)]">Editar indicador</summary>
                      <div className="mt-3 flex flex-col gap-4">
                        <EditIndicatorForm
                          slug={slug}
                          objectiveId={objective.id}
                          indicatorId={i.id}
                          members={options}
                          defaults={{
                            name: i.name,
                            formula: i.formula,
                            unit: i.unit,
                            direction: i.direction,
                            target: String(i.target),
                            alertThreshold: i.alertThreshold === null ? "" : String(i.alertThreshold),
                            frequency: i.frequency,
                            kind: i.kind,
                            ownerUserId: i.ownerUserId,
                          }}
                        />
                        <ToggleIndicatorButton slug={slug} objectiveId={objective.id} indicatorId={i.id} active={i.active} />
                      </div>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {editable ? (
          objective.indicators.length === 0 || agregar ? (
            <div
              id="agregar-indicador"
              className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-surface-raised)] p-5"
            >
              <h3 className="font-[family-name:var(--font-display)] text-lg">
                {objective.indicators.length === 0 ? "Agregá el indicador del objetivo" : "Agregar otro indicador"}
              </h3>
              <CreateIndicatorForm slug={slug} objectiveId={objective.id} members={options} />
            </div>
          ) : (
            <Link
              href={`/t/${slug}/indicators/${objective.id}?agregar=1#agregar-indicador`}
              className={buttonClass("secondary", "self-start")}
            >
              + Agregar otro indicador
            </Link>
          )
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
        <Link href={listHref} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a la lista de objetivos
        </Link>
        {editable ? <CloseObjectiveForm slug={slug} objectiveId={objective.id} /> : null}
      </div>
    </div>
  );
}
