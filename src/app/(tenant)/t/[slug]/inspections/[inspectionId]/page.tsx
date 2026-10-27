import Link from "next/link";
import { notFound } from "next/navigation";
import { findNextPendingAsset, getInspectionView } from "@/lib/inspections";
import { OBRADOR_TEMPLATE_KEY, siteExtinguisherStatus } from "@/lib/inspection-sites";
import { FIELD_AUDIT_TEMPLATE_KEY } from "@/lib/inspection-field-audit";
import { SPECIAL_TASKS, isSpecialTask } from "@/domain/inspections/templates/field-audit";
import { prisma } from "@/lib/db";
import { listTenantMembers } from "@/lib/identity";
import { ownerOfPerson } from "@/lib/inspection-support";
import { ACTION_STATUS_LABELS, type ActionStatus } from "@/domain/actions/types";
import { FINDING_STATUS_LABELS } from "@/domain/findings/types";
import { loadInspectionsAccess } from "@/app/(tenant)/t/[slug]/inspections/access";
import { InspectionCapture, type CaptureItem } from "@/app/(tenant)/t/[slug]/inspections/[inspectionId]/InspectionCapture";
import { CorrectAnswer, FollowUpControls, PrintButton } from "@/app/(tenant)/t/[slug]/inspections/[inspectionId]/InspectionFollowUp";
import { startInspectionAction } from "@/app/(tenant)/t/[slug]/inspections/actions";
import { getAssetType } from "@/domain/inspections/asset-types";
import { INSTRUMENT_TYPE_KEY } from "@/domain/calibration/types";
import { explainResult, itemOutcome } from "@/domain/inspections/result";
import { formatDateEs, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { CRITICALITY_LABELS, RESULT_LABELS, type InspectionResult } from "@/domain/inspections/types";
import { Button, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

/** Las acciones de seguimiento separan los pasos extra (retirar, destruir) de la lista de no conformidades. */
const STEPS_MARKER = "\nAdemás:\n";

/** Contexto de una auditoría en campo en una línea: tarea, contratista, supervisor y tareas especiales. */
function fieldAuditSummary(inspection: { jobTask: { name: string } | null; contractorName: string | null; supervisor: { name: string } | null; specialTasks: string[] }) {
  const special = inspection.specialTasks.filter(isSpecialTask).map((t) => SPECIAL_TASKS[t]);
  const parts = [
    inspection.jobTask ? `Tarea: ${inspection.jobTask.name}` : null,
    inspection.contractorName ? `Contratista: ${inspection.contractorName}` : null,
    inspection.supervisor ? `Supervisor: ${inspection.supervisor.name}` : null,
    special.length > 0 ? `Tareas especiales: ${special.join(", ")}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Auditoría de seguridad en campo";
}

const RESULT_CHIP: Record<InspectionResult, "ok" | "warning" | "danger"> = { fit: "ok", fit_with_observations: "warning", unfit: "danger" };

export default async function InspectionPage({ params }: { params: Promise<{ slug: string; inspectionId: string }> }) {
  const { slug, inspectionId } = await params;
  const { tenant, ctx, canWrite, canRelease } = await loadInspectionsAccess(slug);
  const view = await getInspectionView(tenant.id, inspectionId);
  if (!view) notFound();
  const { inspection } = view;
  const asset = inspection.asset;
  const type = asset ? getAssetType(asset.typeKey) : null;
  const summary = asset && type ? `${type.label} · ${type.summarize(asset.attributes as Record<string, unknown>)}` : inspection.template.key === FIELD_AUDIT_TEMPLATE_KEY ? fieldAuditSummary(inspection) : "Inspección de área";
  const back = (
    <p className="print:hidden">
      <Link href={`/t/${slug}/inspections`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
        ← Volver a inspecciones
      </Link>
    </p>
  );

  if (inspection.status === "draft") {
    const mine = inspection.inspectorUserId === ctx.userId;
    if (!canWrite || (!mine && !canRelease)) {
      return (
        <div className="flex flex-col gap-4">
          {back}
          <SectionBlock title={`Borrador sobre ${asset?.code ?? "el área"}`} what={`Lo está completando ${view.inspectorName}. Cuando lo cierre vas a ver el resultado acá.`} />
        </div>
      );
    }
    // Zona de obradores: el sistema muestra cuántos extintores de la sede están vencidos (SPEC, anexo T2).
    const extinguishers = inspection.template.key === OBRADOR_TEMPLATE_KEY ? await siteExtinguisherStatus(tenant.id, inspection.siteId) : null;
    const extinguisherNote = extinguishers
      ? extinguishers.total === 0
        ? "El sistema no tiene extintores cargados en esta sede."
        : extinguishers.expired === 0
          ? `Los ${extinguishers.total} extintores cargados en esta sede tienen sus vencimientos al día.`
          : `Atención: ${extinguishers.expired} de ${extinguishers.total} extintores cargados en esta sede tienen algún vencimiento vencido.`
      : null;
    const items: CaptureItem[] = view.items.map(({ answer, item, evalItem, autoDueAt }) => ({
      itemId: item.id,
      code: item.code,
      section: item.section,
      text: item.text,
      help: item.code === "fire_extinguishers" && extinguisherNote ? extinguisherNote : item.help,
      unit: item.unit,
      evalItem,
      auto: evalItem.autoSource ? { dueAt: autoDueAt, conform: evalItem.autoConform === true } : null,
      value: answer.value,
      numberValue: answer.numberValue,
      textValue: answer.textValue,
      comment: answer.comment,
      photos: answer.attachments,
    }));
    const members = (await listTenantMembers(tenant.id)).map((m) => ({ id: m.user.id, name: m.user.name }));
    const defaultOwnerUserId = (await ownerOfPerson(prisma, tenant.id, asset?.assignedPersonId ?? null)) ?? ctx.userId;
    return (
      <div className="flex flex-col gap-4">
        {back}
        <InspectionCapture
          slug={slug}
          inspectionId={inspection.id}
          assetCode={asset?.code ?? inspection.template.name}
          assetSummary={summary}
          siteName={inspection.site.name}
          inspectorName={view.inspectorName}
          inspectedAt={isoFromDate(inspection.inspectedAt)}
          notes={inspection.notes}
          performedBy={inspection.performedBy ? { id: inspection.performedBy.id, name: inspection.performedBy.name, employeeCode: inspection.performedBy.employeeCode, siteName: inspection.performedBy.site.name } : null}
          items={items}
          members={members.some((m) => m.id === defaultOwnerUserId) ? members : [...members, { id: defaultOwnerUserId, name: view.userName(defaultOwnerUserId) }]}
          defaultOwnerUserId={defaultOwnerUserId}
        />
      </div>
    );
  }

  // Cerrada: resultado y respuestas, solo lectura.
  const result = inspection.result!;
  const next = canWrite
    ? await findNextPendingAsset({ tenantId: tenant.id, siteId: inspection.siteId, excludeAssetId: inspection.assetId, actorUserId: ctx.userId })
    : null;
  const nonconforming = view.items.filter(({ item, evalItem, answer }) => {
    if (item.kind !== "check" && item.kind !== "number") return false;
    return itemOutcome(evalItem, { itemId: item.id, value: evalItem.autoSource ? undefined : answer.value, numberValue: answer.numberValue }) === "nonconform";
  });

  return (
    <div className="flex flex-col gap-6">
      {back}
      <SectionBlock
        title={asset ? `${asset.code} · ${inspection.template.name}` : `${inspection.template.name} · ${inspection.site.name}`}
        eyebrow={`Inspección del ${formatDateEs(isoFromDate(inspection.inspectedAt))} · ${inspection.site.name}`}
        what={summary}
        actions={
          <>
            <StatusChip status={RESULT_CHIP[result]} label={RESULT_LABELS[result]} />
            {asset ? (
              <Link href={asset.typeKey === INSTRUMENT_TYPE_KEY ? `/t/${slug}/instruments/${asset.id}` : `/t/${slug}/assets/${asset.id}`} className={buttonClass("secondary", "print:hidden")}>
                {asset.typeKey === INSTRUMENT_TYPE_KEY ? "Ver el equipo" : "Ver el activo"}
              </Link>
            ) : null}
            <PrintButton />
          </>
        }
      >
        <p>{explainResult({ result, nonconformByCriticality: countByCriticality(nonconforming.map((n) => n.item.criticality)) })}</p>
        <dl className="grid gap-4 sm:grid-cols-4">
          <Stat label="Puntaje" value={`${String(inspection.scorePct ?? 0).replace(".", ",")} %`} />
          <Stat label="Conformes" value={`${inspection.conformCount} de ${inspection.applicableCount}`} />
          <Stat label="Inspector" value={view.inspectorName} />
          <Stat label="Firmada" value={inspection.closedAt ? inspection.closedAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—"} />
        </dl>
        {inspection.notes ? <p className="text-sm text-[var(--color-ink-muted)]">Observaciones: {inspection.notes}</p> : null}
        {next ? (
          <form action={startInspectionAction.bind(null, slug, next.id)} className="print:hidden">
            <Button type="submit" className="min-h-12">
              Siguiente activo pendiente: {next.code}
            </Button>
          </form>
        ) : null}
      </SectionBlock>

      {nonconforming.length > 0 ? (
        <SectionBlock title="No conformidades" what="Lo que no cumplió, con lo que escribió el inspector.">
          <ul className="flex flex-col gap-3">
            {nonconforming.map(({ item, answer }) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger)] p-4 text-sm">
                <p className="font-semibold">
                  {item.text} <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">{CRITICALITY_LABELS[item.criticality]}</span>
                </p>
                {answer.comment ? <p>{answer.comment}</p> : null}
                {answer.attachments.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {answer.attachments.map((p) => (
                      <li key={p.id}>
                        <a href={`/api/inspections/attachments/${p.id}/download`} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/inspections/attachments/${p.id}/download`} alt={`Foto: ${p.fileName}`} className="h-24 w-24 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] object-cover" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionBlock>
      ) : null}

      {inspection.action ? (
        <SectionBlock title="Seguimiento" what="Lo que hay que resolver por lo que no cumplió. Se avisa al responsable antes del plazo.">
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold">{inspection.action.title}</p>
            <p className="text-[var(--color-ink-muted)]">
              {ACTION_STATUS_LABELS[inspection.action.status as ActionStatus]} · Responsable: {view.userName(inspection.action.ownerUserId)}
              {inspection.action.dueAt ? ` · Plazo: ${formatDateEs(todayIso(inspection.action.dueAt))}` : ""}
            </p>
            {inspection.action.description?.includes(STEPS_MARKER) ? (
              <p className="whitespace-pre-line">
                <strong>Además:</strong> {inspection.action.description.split(STEPS_MARKER)[1]}
              </p>
            ) : null}
            {inspection.finding ? (
              <p>
                Hallazgo en borrador:{" "}
                <Link href={`/t/${slug}/findings/${inspection.finding.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                  {inspection.finding.title}
                </Link>{" "}
                <span className="text-[var(--color-ink-muted)]">({FINDING_STATUS_LABELS[inspection.finding.status]}: revisalo y publicalo cuando corresponda)</span>
              </p>
            ) : null}
            {inspection.action.attachments.length > 0 ? (
              <ul>
                {inspection.action.attachments.map((att) => (
                  <li key={att.id}>
                    <a className="text-[var(--color-accent)] underline" href={`/api/actions/attachments/${att.id}/download`}>
                      {att.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {canWrite && (inspection.action.status === "open" || inspection.action.status === "in_progress") ? (
              <div className="print:hidden">
                <FollowUpControls slug={slug} inspectionId={inspection.id} hasEvidence={inspection.action.attachments.length > 0} />
              </div>
            ) : null}
          </div>
        </SectionBlock>
      ) : null}

      <SectionBlock title="Respuestas" what="El listado tal como estaba la plantilla cuando se hizo la inspección.">
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
          {view.items.map(({ item, answer }) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span>
                <span className="block font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">{item.section}</span>
                {item.text}
              </span>
              <span className="flex flex-wrap items-center gap-3 font-semibold">
                {item.kind === "number" || item.kind === "reading"
                  ? `${answer.numberValue ?? "—"}${item.unit ? ` ${item.unit}` : ""}`
                  : item.kind === "text"
                    ? answer.textValue || "—"
                    : answer.value === "conform"
                      ? "Conforme"
                      : answer.value === "nonconform"
                        ? "No conforme"
                        : answer.value === "na"
                          ? "No aplica"
                          : "—"}
                {canRelease && !item.autoSource && (item.kind === "check" || item.kind === "number") ? (
                  <span className="print:hidden">
                    <CorrectAnswer slug={slug} inspectionId={inspection.id} answerId={answer.id} kind={item.kind} unit={item.unit} naAllowed={item.naAllowed} value={answer.value} numberValue={answer.numberValue} />
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      {inspection.corrections.length > 0 ? (
        <SectionBlock title="Correcciones" what="Cada cambio a una inspección cerrada queda con su motivo y quién lo hizo.">
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {inspection.corrections.map((c) => {
              const row = view.items.find((i) => i.answer.id === c.answerId);
              return (
                <li key={c.id} className="flex flex-col gap-1 px-4 py-3">
                  <p className="font-semibold">{row?.item.text ?? "Ítem"}</p>
                  <p>
                    {c.previousValue ?? "—"} → {c.newValue ?? "—"} · resultado: {c.previousResult ? RESULT_LABELS[c.previousResult] : "—"} → {RESULT_LABELS[c.newResult]}
                  </p>
                  <p className="text-[var(--color-ink-muted)]">
                    {c.reason} — {view.userName(c.byUserId)}, {formatDateEs(todayIso(c.createdAt))}
                  </p>
                </li>
              );
            })}
          </ul>
        </SectionBlock>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function countByCriticality(list: ("critical" | "major" | "minor")[]) {
  return { critical: list.filter((c) => c === "critical").length, major: list.filter((c) => c === "major").length, minor: list.filter((c) => c === "minor").length };
}
