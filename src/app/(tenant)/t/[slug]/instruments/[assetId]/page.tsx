import Link from "next/link";
import { notFound } from "next/navigation";
import { getInstrument } from "@/lib/instruments";
import { loadInstrumentsAccess } from "@/app/(tenant)/t/[slug]/instruments/access";
import { InstrumentStatusChip } from "@/app/(tenant)/t/[slug]/instruments/status";
import { RetireInstrumentForm } from "@/app/(tenant)/t/[slug]/instruments/RetireForm";
import { ReturnFromLabForm, SendToLabForm } from "@/app/(tenant)/t/[slug]/instruments/[assetId]/RecordControls";
import { ImpactForm } from "@/app/(tenant)/t/[slug]/instruments/[assetId]/ImpactForm";
import { IMPACT_OUTCOME_LABELS, listCompletedAssessments } from "@/lib/impact-assessments";
import { listTenantMemberOptions } from "@/lib/findings";
import {
  DECISION_RULE_LABELS,
  RECORD_KIND_LABELS,
  TRACEABILITY_LABELS,
  describeEmp,
  describeRule,
  magnitudeLabel,
  type Channel,
} from "@/domain/calibration";
import { diffDays, formatDateEs, isoFromDate, todayIso } from "@/domain/inspections/dates";
import { ASSET_STATUS_LABELS, RESULT_LABELS } from "@/domain/inspections/types";
import { Button, FormError, SectionBlock, StatusChip, buttonClass } from "@/components/ui";
import { getEnabledModulesCached } from "@/lib/modules";
import { lastFunctionalCheck } from "@/lib/functional-check";
import { startFunctionalCheckAction } from "@/app/(tenant)/t/[slug]/instruments/actions";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

const RESULT_LABEL = { apt: "Apto", not_apt: "No apto", not_evaluated: "No evaluado" } as const;
const RESULT_CHIP = { apt: "ok", not_apt: "danger", not_evaluated: "pending" } as const;
const TRIGGER_LABEL = {
  as_found_not_apt: "El equipo estaba fuera de tolerancia al recibirlo",
  adjusted_without_as_found: "Se ajustó un equipo de uso crítico sin medir cómo estaba antes",
  functional_check_failed: "Falló la prueba funcional",
} as const;

const dateOrDash = (d: Date | null) => (d ? formatDateEs(isoFromDate(d)) : "—");
const th = "px-4 py-2.5 font-semibold";
const THEAD = "border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]";

function ChannelLine({ channel, rule }: { channel: Channel; rule: Parameters<typeof describeRule>[0] }) {
  return (
    <li className="flex flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm">
      <span className="font-medium">
        {channel.label} <span className="font-normal text-[var(--color-ink-muted)]">· rango {String(channel.rangeMin)} a {String(channel.rangeMax)} {channel.unit}</span>
        {channel.active ? null : <span className="ml-2 text-xs font-normal text-[var(--color-ink-muted)]">(inactivo)</span>}
      </span>
      <span className="text-[var(--color-ink-muted)]">{describeRule(rule, channel)}</span>
      <span className="text-xs text-[var(--color-ink-muted)]">Error máximo permitido: {describeEmp(channel)}</span>
    </li>
  );
}

export default async function InstrumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; assetId: string }>;
  searchParams: Promise<{ historial?: string; error?: string }>;
}) {
  const { slug, assetId } = await params;
  const sp = await searchParams;
  const { ctx, tenant, canManage, canWrite } = await loadInstrumentsAccess(slug);
  const page = Number(sp.historial);
  const detail = await getInstrument(tenant.id, assetId, { historyPage: Number.isInteger(page) && page > 1 ? page : 1 });
  if (!detail) notFound();
  const { asset, control, channels, view, records, openShipment, pendingAssessment } = detail;
  // La prueba funcional usa el motor de Inspecciones: solo se ofrece si ese módulo está activo.
  const functionalCheckEnabled = (await getEnabledModulesCached(tenant.id)).has("inspections");
  const [completedAssessments, members, lastCheck] = await Promise.all([
    listCompletedAssessments(tenant.id, asset.id),
    canManage && pendingAssessment ? listTenantMemberOptions(tenant.id) : Promise.resolve([]),
    functionalCheckEnabled ? lastFunctionalCheck(tenant.id, asset.id) : Promise.resolve(null),
  ]);
  const base = `/t/${slug}/instruments`;
  const attrs = asset.attributes as Record<string, string | undefined>;
  const retired = asset.status === "retired";
  const usable = view.usability.usable;
  const controlled = control.requiresCalibration || control.requiresVerification;

  return (
    <div className="flex flex-col gap-6">
      <p className="flex flex-wrap items-center justify-between gap-3">
        <Link href={base} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a equipos
        </Link>
        {canManage && !retired ? (
          <Link href={`${base}/${asset.id}/edit`} className={buttonClass("secondary")}>
            Editar equipo
          </Link>
        ) : null}
      </p>

      <section
        aria-label="Estado del equipo"
        className={`flex flex-col gap-2 rounded-[var(--radius-lg)] border p-5 ${usable ? "border-[var(--color-line)] bg-[var(--color-surface-raised)]" : "border-[var(--color-danger-line)] bg-[var(--color-danger-soft)]"}`}
      >
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
          {asset.code} · {magnitudeLabel(control.magnitude)}
        </p>
        {usable ? (
          <>
            <p className="flex flex-wrap items-center gap-3 font-[family-name:var(--font-display)] text-2xl font-semibold">
              <InstrumentStatusChip status={view.status} />
              {view.status === "not_required" ? "Sin control metrológico" : "Se puede usar"}
            </p>
            {view.nextDueAt ? (
              <p className="text-sm">
                Próximo vencimiento: <strong className="tabular-nums">{formatDateEs(view.nextDueAt)}</strong>
                {view.status === "due_soon" ? " · conviene programar la calibración" : ""}
              </p>
            ) : null}
            {view.status === "not_required" && control.noControlReason ? <p className="text-sm text-[var(--color-ink-muted)]">Motivo: {control.noControlReason}</p> : null}
          </>
        ) : (
          <>
            <p className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--color-danger)]">NO USAR</p>
            <p className="text-base font-medium">{view.usability.reason}</p>
            {view.usability.action ? (
              <p className="text-sm">
                <span className="font-semibold">Qué hacer:</span> {view.usability.action}
              </p>
            ) : null}
          </>
        )}
        {view.reasons.length > 1 ? (
          <p className="text-xs text-[var(--color-ink-muted)]">También: {view.reasons.slice(1).map((r) => ({ valid: "vigente", due_soon: "por vencer", expired: "vencido", not_apt: "no apto", in_calibration: "en calibración", never_calibrated: "sin calibración inicial", impact_pending: "evaluación pendiente", not_required: "sin control" })[r]).join(", ")}.</p>
        ) : null}
        {retired ? <p className="text-sm">Dado de baja{asset.retirementReason ? `: ${asset.retirementReason}` : ""}.</p> : null}
      </section>

      {canWrite && !retired ? (
        <section aria-label="Acciones" className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            {control.requiresCalibration ? (
              <Link href={`${base}/${asset.id}/records/new`} className={buttonClass(usable || openShipment ? "secondary" : "primary")}>
                Cargar calibración
              </Link>
            ) : null}
            {control.requiresVerification ? (
              <Link href={`${base}/${asset.id}/records/new?tipo=verification`} className={buttonClass("secondary")}>
                Cargar verificación
              </Link>
            ) : null}
            {functionalCheckEnabled ? (
              <form action={startFunctionalCheckAction.bind(null, slug, asset.id)}>
                <Button type="submit" variant="secondary">
                  Hacer la prueba funcional
                </Button>
              </form>
            ) : null}
          </div>
          {sp.error ? <FormError>{sp.error}</FormError> : null}
          {functionalCheckEnabled ? (
            <p className="text-xs text-[var(--color-ink-muted)]">
              {lastCheck ? (
                <>
                  Último control previo al uso: {formatDateEs(lastCheck.inspectedAt)} · {RESULT_LABELS[lastCheck.result ?? "fit"]} (hace {Math.max(0, diffDays(lastCheck.inspectedAt, todayIso()))} días){" "}
                  <Link href={`/t/${slug}/inspections/${lastCheck.id}`} className="text-[var(--color-accent)] hover:underline">
                    Ver
                  </Link>
                </>
              ) : (
                "Todavía no se hizo ninguna prueba funcional. Es opcional y no extiende la vigencia de la calibración."
              )}
            </p>
          ) : null}
          {controlled ? (
            <details className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4">
              <summary className="cursor-pointer text-sm font-semibold">{openShipment ? "Registrar el regreso del laboratorio" : "Enviar a calibrar"}</summary>
              <div className="mt-3">
                {openShipment ? <ReturnFromLabForm slug={slug} assetId={asset.id} today={todayIso()} /> : <SendToLabForm slug={slug} assetId={asset.id} today={todayIso()} />}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {pendingAssessment ? (
        <SectionBlock title="Evaluación de impacto pendiente" what="El equipo estuvo fuera de tolerancia: hay que revisar si las mediciones hechas con él son confiables.">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Item label="Motivo">{TRIGGER_LABEL[pendingAssessment.trigger]}</Item>
            <Item label="Mediciones a revisar">
              {pendingAssessment.windowFrom ? `Desde el ${dateOrDash(pendingAssessment.windowFrom)}` : "Desde que se empezó a usar"} hasta el {dateOrDash(pendingAssessment.windowTo)}
            </Item>
            <Item label="Estado">
              <StatusChip status="danger" label="Pendiente" />
            </Item>
          </dl>
          {canManage ? (
            <ImpactForm slug={slug} assetId={asset.id} assessmentId={pendingAssessment.id} members={members} defaultOwnerId={members.some((m) => m.id === ctx.userId) ? ctx.userId : ""} />
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">La completa un administrador o un responsable de proceso. Hasta entonces el equipo no se puede usar.</p>
          )}
        </SectionBlock>
      ) : null}

      {openShipment ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-info-line)] bg-[var(--color-info-soft)] px-4 py-3 text-sm">
          En el laboratorio desde el <strong>{dateOrDash(openShipment.sentAt)}</strong>
          {openShipment.labName ? ` (${openShipment.labName})` : ""}
          {openShipment.expectedReturnAt ? `, regreso estimado ${dateOrDash(openShipment.expectedReturnAt)}` : ""}.
        </p>
      ) : null}

      <SectionBlock title="El equipo">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Descripción">{asset.description}</Item>
          <Item label="Sede">
            {asset.site.name}
            {asset.sector ? <span className="block text-xs text-[var(--color-ink-muted)]">{asset.sector}</span> : null}
          </Item>
          <Item label="Responsable">{asset.assignedPerson?.name ?? "—"}</Item>
          <Item label="Marca y modelo">{[attrs.brand, attrs.model].filter(Boolean).join(" ") || "—"}</Item>
          <Item label="N.º de serie">{attrs.serialNumber ?? "—"}</Item>
          <Item label="En uso desde">{attrs.inServiceSince ? formatDateEs(attrs.inServiceSince) : "—"}</Item>
          <Item label="Estado del activo">{ASSET_STATUS_LABELS[asset.status]}</Item>
          <Item label="Uso crítico">{control.criticalUse ? `Sí${control.criticalUseReason ? `: ${control.criticalUseReason}` : ""}` : "No"}</Item>
          <Item label="Patrón de trabajo">{control.isReferenceStandard ? "Sí" : "No"}</Item>
        </dl>
      </SectionBlock>

      {controlled ? (
        <SectionBlock title="Cómo se controla" what={DECISION_RULE_LABELS[control.decisionRule]}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Item label="Calibración">{control.requiresCalibration ? `Cada ${control.calibrationIntervalMonths} meses` : "No se exige"}</Item>
            <Item label="Verificación interna">{control.requiresVerification ? `Cada ${control.verificationIntervalMonths} meses` : "No se exige"}</Item>
            <Item label="Aviso previo">{control.alertLeadDays} días</Item>
            <Item label="Vigencia hasta">{dateOrDash(control.nextDueAt)}</Item>
          </dl>
          {control.intervalReason ? <p className="text-xs text-[var(--color-ink-muted)]">Motivo del intervalo: {control.intervalReason}</p> : null}
          {control.decisionRuleReason ? <p className="text-xs text-[var(--color-ink-muted)]">Por qué esta regla: {control.decisionRuleReason}</p> : null}
          {control.decisionRule === "certificate_statement" ? (
            <p className="text-sm">{describeRule("certificate_statement")}</p>
          ) : channels.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {channels.map((c) => (
                <ChannelLine key={c.key} channel={c} rule={control.decisionRule} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">Todavía no hay canales definidos.</p>
          )}
        </SectionBlock>
      ) : null}

      {completedAssessments.length > 0 ? (
        <SectionBlock title="Evaluaciones de impacto realizadas" what="Qué se decidió cuando el equipo estuvo fuera de tolerancia.">
          <ul className="flex flex-col gap-3">
            {completedAssessments.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-3 text-sm">
                <span className="font-medium">
                  {a.outcome ? IMPACT_OUTCOME_LABELS[a.outcome] : "—"}
                  <span className="ml-2 font-normal text-[var(--color-ink-muted)]">
                    {a.windowFrom ? `desde el ${dateOrDash(a.windowFrom)}` : "desde que se empezó a usar"} hasta el {dateOrDash(a.windowTo)} · completada el {dateOrDash(a.completedAt)}
                  </span>
                </span>
                {a.affectedSummary ? <span>Qué se midió: {a.affectedSummary}</span> : null}
                {a.rationale ? <span className="text-[var(--color-ink-muted)]">{a.rationale}</span> : null}
                {a.finding ? (
                  <Link href={`/t/${slug}/findings/${a.finding.id}`} className="text-[var(--color-accent)] hover:underline">
                    Hallazgo: {a.finding.title}
                  </Link>
                ) : null}
                {a.actions.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {a.actions.map((x) => (
                      <li key={x.action.id}>
                        {x.action.title}
                        {x.action.dueAt ? ` · para el ${formatDateEs(isoFromDate(x.action.dueAt))}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionBlock>
      ) : null}

      <SectionBlock
        title={`Historial de calibraciones y verificaciones (${detail.recordCount})`}
        what="Cada control con su resultado, su vigencia y el certificado para descargar."
      >
        {records.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            {controlled ? "Todavía no se cargó ninguna calibración o verificación. Mientras tanto el equipo figura como sin calibración inicial." : "Este equipo no lleva calibración."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[50rem] text-left text-sm">
              <caption className="sr-only">Historial de calibraciones y verificaciones</caption>
              <thead className={THEAD}>
                <tr>
                  <th scope="col" className={th}>Fecha</th>
                  <th scope="col" className={th}>Tipo</th>
                  <th scope="col" className={th}>Laboratorio</th>
                  <th scope="col" className={th}>Resultado</th>
                  <th scope="col" className={th}>Vigente hasta</th>
                  <th scope="col" className={th}>Certificado</th>
                  <th scope="col" className={th}><span className="sr-only">Detalle</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {records.map((r) => {
                  const voided = r.status === "voided";
                  return (
                    <tr key={r.id} className={voided ? "text-[var(--color-ink-muted)]" : undefined}>
                      <td className={`px-4 py-3 tabular-nums ${voided ? "line-through" : ""}`}>{formatDateEs(isoFromDate(r.performedAt))}</td>
                      <td className="px-4 py-3">
                        {RECORD_KIND_LABELS[r.kind]}
                        {r.adjusted ? <span className="block text-xs text-[var(--color-ink-muted)]">Con ajuste</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        {r.labName}
                        <span className="block text-xs text-[var(--color-ink-muted)]">
                          {TRACEABILITY_LABELS[r.traceability]}
                          {r.certificateNumber ? ` · cert. ${r.certificateNumber}` : ""}
                          {r.referenceStandard ? ` · patrón ${r.referenceStandard.code}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "draft" ? (
                          <StatusChip status="pending" label="Borrador" />
                        ) : voided ? (
                          <span className="text-xs">Anulado: {r.voidReason}</span>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            {r.adjusted && r.asFoundResult ? (
                              <span className="flex items-center gap-1.5 text-xs">
                                Al recibir <StatusChip status={RESULT_CHIP[r.asFoundResult]} label={RESULT_LABEL[r.asFoundResult]} />
                              </span>
                            ) : null}
                            {r.asLeftResult ? (
                              <span className="flex items-center gap-1.5 text-xs">
                                {r.adjusted ? "Al entregar" : null} <StatusChip status={RESULT_CHIP[r.asLeftResult]} label={RESULT_LABEL[r.asLeftResult]} />
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{voided ? "—" : dateOrDash(r.validUntil)}</td>
                      <td className="px-4 py-3">
                        {r.attachments.length === 0 ? (
                          "—"
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {r.attachments.map((a) => (
                              <li key={a.id}>
                                <a href={`/api/calibration/attachments/${a.id}/download`} className="text-[var(--color-accent)] hover:underline" download={a.fileName}>
                                  {a.fileName}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`${base}/${asset.id}/records/${r.id}`} className="text-[var(--color-accent)] hover:underline">
                          {r.status === "draft" && canWrite ? "Continuar" : "Ver detalle"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {detail.historyPages > 1 ? (
          <nav aria-label="Páginas del historial" className="flex flex-wrap items-center gap-3 text-sm">
            {detail.historyPage > 1 ? (
              <Link href={`${base}/${asset.id}?historial=${detail.historyPage - 1}`} className={buttonClass("ghost")}>
                ← Más recientes
              </Link>
            ) : null}
            <span className="tabular-nums text-[var(--color-ink-muted)]">
              Página {detail.historyPage} de {detail.historyPages}
            </span>
            {detail.historyPage < detail.historyPages ? (
              <Link href={`${base}/${asset.id}?historial=${detail.historyPage + 1}`} className={buttonClass("ghost")}>
                Más antiguos →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </SectionBlock>

      {canManage && !retired ? (
        <details className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4">
          <summary className="cursor-pointer text-sm font-semibold">Dar de baja el equipo</summary>
          <div className="mt-3">
            <RetireInstrumentForm slug={slug} assetId={asset.id} code={asset.code} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
